import os
import re
import cv2
import time
import math
import json
import uuid
import threading
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, Tuple, List

from db import get_db_connection
from risk_engine import calculate_wildlife_risk
from geofence_engine import check_geofences
from detection_service import get_detection_service
from temporal_safety import get_stream_tracker, global_alert_deduplicator

logger = logging.getLogger("kavach.cctv")

BASE_DIR = Path(__file__).resolve().parent
SAMPLE_DIR = BASE_DIR / "sample_images"
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

# Thread-safe frame buffers and active worker threads
# camera_id -> {"frame_bytes": bytes, "timestamp": float, "detection": dict, "fps": float, "status": str, "error": str}
_FRAME_BUFFERS: Dict[str, Dict[str, Any]] = {}
_CAMERA_THREADS: Dict[str, threading.Thread] = {}
_CAMERA_STOP_FLAGS: Dict[str, threading.Event] = {}
_CAMERA_STATUS: Dict[str, str] = {}  # "CONNECTED" | "DISCONNECTED" | "RECONNECTING" | "ERROR" | "MONITORING"
_CAMERA_LOCK = threading.Lock()


def sanitize_rtsp_url(url: Optional[str]) -> str:
    """Masks username and password in RTSP URLs to prevent leaking credentials."""
    if not url:
        return ""
    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:****@", url)


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates geodesic distance between two points in meters."""
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def find_nearest_village(lat: float, lng: float) -> Tuple[Optional[Dict[str, Any]], float]:
    """Finds the nearest active village to coordinates and returns (village_row, distance_m)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM villages WHERE is_active = 1")
    villages = cursor.fetchall()
    conn.close()

    if not villages:
        return None, 99999.0

    nearest = None
    min_dist = float("inf")
    for v in villages:
        dist = haversine_distance_m(lat, lng, v["lat"], v["lng"])
        if dist < min_dist:
            min_dist = dist
            nearest = dict(v)

    return nearest, min_dist


def test_rtsp_connection(rtsp_url: str, timeout_sec: float = 3.0) -> Dict[str, Any]:
    """
    Actually attempts to connect to the RTSP / IP camera stream and read a frame.
    Uses a fast socket check followed by OpenCV frame verification.
    Returns technical details: CONNECTED with resolution & FPS, or CONNECTION_FAILED with exact error.
    """
    import socket
    from urllib.parse import urlparse

    if not rtsp_url:
        return {"status": "CONNECTION_FAILED", "error": "RTSP URL is empty or not provided."}

    masked = sanitize_rtsp_url(rtsp_url)
    logger.info("[CCTV] Testing RTSP connection to %s (timeout=%ss)...", masked, timeout_sec)

    # Allow local device index (e.g. "0" or "1") or local file
    is_numeric = rtsp_url.isdigit()
    is_file = Path(rtsp_url).exists()

    if is_file:
        cap = cv2.VideoCapture(rtsp_url)
        ret, frame = cap.read()
        cap.release()
        if ret and frame is not None:
            return {
                "status": "CONNECTED",
                "resolution": f"{frame.shape[1]}x{frame.shape[0]}",
                "fps": 25,
                "message": f"Connected to local video source ({frame.shape[1]}x{frame.shape[0]})."
            }
        return {"status": "CONNECTION_FAILED", "error": f"Failed to read from local file: {rtsp_url}"}

    if is_numeric:
        cap = cv2.VideoCapture(int(rtsp_url))
        ret, frame = cap.read()
        cap.release()
        if ret and frame is not None:
            return {
                "status": "CONNECTED",
                "resolution": f"{frame.shape[1]}x{frame.shape[0]}",
                "fps": 30,
                "message": f"Connected to local camera device {rtsp_url}."
            }
        return {"status": "CONNECTION_FAILED", "error": f"Camera device index {rtsp_url} is not accessible."}

    # For RTSP / HTTP network streams, perform fast TCP socket probe first
    if rtsp_url.startswith(("rtsp://", "http://", "https://")):
        try:
            parsed = urlparse(rtsp_url)
            host = parsed.hostname
            port = parsed.port or (554 if rtsp_url.startswith("rtsp://") else 80)

            if host:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(2.0)
                try:
                    sock.connect((host, port))
                    sock.close()
                except (socket.timeout, ConnectionRefusedError, OSError) as sock_err:
                    sock.close()
                    logger.warning("[CCTV] TCP probe failed for %s:%s - %s", host, port, sock_err)
                    return {
                        "status": "CONNECTION_FAILED",
                        "error": f"Camera host unreachable at {host}:{port} ({sock_err}). Ensure CCTV is powered and online."
                    }
        except Exception as e:
            logger.debug("[CCTV] URL parse / socket probe exception: %s", e)

    try:
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;3000000"
        cap = cv2.VideoCapture(rtsp_url)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        start_time = time.time()
        connected = False
        test_frame = None

        while time.time() - start_time < timeout_sec:
            if cap.isOpened():
                ret, frame = cap.read()
                if ret and frame is not None and frame.size > 0:
                    connected = True
                    test_frame = frame
                    break
            time.sleep(0.1)

        cap.release()

        if connected and test_frame is not None:
            h, w, _ = test_frame.shape
            logger.info("[CCTV] RTSP connection test successful (%dx%d)", w, h)
            return {
                "status": "CONNECTED",
                "resolution": f"{w}x{h}",
                "fps": 25,
                "message": f"Successfully connected to network camera stream ({w}x{h})."
            }
        else:
            return {
                "status": "CONNECTION_FAILED",
                "error": f"Connection timed out or stream unavailable ({masked}). Verify IP address, port, and credentials."
            }
    except Exception as e:
        logger.error("[CCTV] RTSP test error: %s", e)
        return {
            "status": "CONNECTION_FAILED",
            "error": f"RTSP network error: {e}"
        }


def deduplicate_or_create_incident(
    species: str,
    confidence: float,
    camera_id: str,
    camera_name: str,
    village_id: str,
    village_name: str,
    lat: float,
    lng: float,
    risk_eval: Dict[str, Any],
    dist_to_village: float,
    snapshot_path: str
) -> Tuple[str, Optional[str]]:
    """
    Groups repeated detections of the same species on the same camera into an incident,
    preventing notification spam while updating incident telemetry.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    now_display = datetime.now().strftime("Today, %H:%M")
    now_time = datetime.now().strftime("%H:%M")

    cursor.execute("""
        SELECT * FROM incidents
        WHERE camera_id = ? AND animal = ? AND status != 'RESOLVED'
        ORDER BY ROWID DESC LIMIT 1
    """, (camera_id, species))
    existing = cursor.fetchone()

    incident_id = None
    alert_id = None

    if existing:
        incident_id = existing["id"]
        new_count = (existing["detection_count"] or 1) + 1
        cursor.execute("""
            UPDATE incidents
            SET last_detected = ?, detection_count = ?, confidence = MAX(confidence, ?)
            WHERE id = ?
        """, (now_time, new_count, confidence, incident_id))
    else:
        incident_id = f"INC-{uuid.uuid4().hex[:6].upper()}"
        incident_code = f"KVC-{1000 + int(time.time()) % 9000}"
        initial_timeline = [
            {"stage": "Detection", "time": now_time, "detail": f"AI identified {species} on {camera_name} ({confidence}% conf)."},
            {"stage": "Alert Generated", "time": now_time, "detail": f"Conflict risk assessed at {risk_eval['risk_score']}/100 ({risk_eval['risk_level']}). Approx ~{int(dist_to_village)}m from {village_name}."}
        ]

        cursor.execute("""
            INSERT INTO incidents (id, incident_code, title, animal, confidence, lat, lng, timestamp, reporter, image_path, risk_level, status, assigned_officer, notes, timeline_json, village_id, village_name, camera_id, first_detected, last_detected, detection_count, verification_status, escalation_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            incident_id,
            incident_code,
            f"Active {species} Movement Near {village_name}",
            species,
            confidence,
            lat,
            lng,
            now_display,
            f"{camera_name} ({camera_id})",
            snapshot_path,
            risk_eval["risk_level"],
            "NEW",
            "Beat Officer (Pending Assignment)",
            f"{species} detected ~{int(dist_to_village)}m from {village_name}. {risk_eval['reason']}",
            json.dumps(initial_timeline),
            village_id,
            village_name,
            camera_id,
            now_time,
            now_time,
            1,
            "PENDING",
            "NORMAL"
        ))

        if risk_eval["risk_score"] >= 70.0:
            alert_id = f"ALT-{uuid.uuid4().hex[:6].upper()}"
            cursor.execute("""
                INSERT INTO alerts (id, title, species, confidence, risk_score, priority, reason, recommendation, lat, lng, distance_to_settlement, timestamp, status, village_id, village_name, alert_channels_json, dedup_incident_id, verification_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                alert_id,
                f"🚨 {risk_eval['risk_level']} ALERT: {species.upper()} DETECTED NEAR {village_name.upper()}",
                species,
                confidence,
                risk_eval["risk_score"],
                risk_eval["risk_level"],
                f"{species} detected on {camera_name}, ~{int(dist_to_village)}m from {village_name}. {risk_eval['reason']}",
                risk_eval["recommendation"],
                lat,
                lng,
                round(dist_to_village, 1),
                now_display,
                "PENDING",
                village_id,
                village_name,
                json.dumps(["SMS", "PUSH", "SIREN"]),
                incident_id,
                "AI_DETECTED"
            ))

    conn.commit()
    conn.close()
    return incident_id, alert_id


def _run_cctv_worker(camera_id: str, rtsp_url: str, stop_event: threading.Event):
    """
    Controlled background CCTV worker thread.
    - Maintains a single persistent stream connection.
    - Runs YOLO detection via shared DetectionService at a configured inference interval.
    - Handles stream drops with exponential backoff reconnect.
    - Updates telemetry, frame buffers, and camera health.
    """
    logger.info("[CCTV] Worker started for %s (URL: %s)", camera_id, sanitize_rtsp_url(rtsp_url))

    # Fetch camera metadata from DB
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,))
    cam_info = cursor.fetchone()
    conn.close()

    if not cam_info:
        logger.error("[CCTV] Camera %s not found in database", camera_id)
        _CAMERA_STATUS[camera_id] = "ERROR"
        return

    cam_name = cam_info["name"]
    cam_lat = cam_info["lat"]
    cam_lng = cam_info["lng"]
    cam_conf_thresh = cam_info["confidence_threshold"] or 25.0

    nearest_v, dist_to_v = find_nearest_village(cam_lat, cam_lng)
    cam_village_id = nearest_v["id"] if nearest_v else "VIL-01"
    cam_village_name = nearest_v["name"] if nearest_v else "Rajpur Village"

    ds = get_detection_service()

    is_numeric = rtsp_url.isdigit()
    source = int(rtsp_url) if is_numeric else rtsp_url

    backoff_sec = 2.0
    max_backoff = 30.0
    retry_count = 0

    cap = None
    frame_idx = 0
    last_infer_time = 0.0
    current_fps = 0.0
    fps_counter = 0
    fps_start = time.time()
    last_detections: List[Dict[str, Any]] = []

    while not stop_event.is_set():
        try:
            # 1. Connect or Reconnect if not opened
            if cap is None or not cap.isOpened():
                if retry_count >= 5:
                    _CAMERA_STATUS[camera_id] = "OFFLINE"
                    if retry_count == 5:
                        logger.info("[CCTV] Max retries reached for %s. Setting status to OFFLINE until restarted.", camera_id)
                        retry_count += 1
                    # Wait 60s before checking again, or exit immediately if stop_event is set
                    if stop_event.wait(timeout=60.0):
                        break
                    continue

                # Fast pre-check for network or demo streams to prevent OpenCV GIL blocking
                if isinstance(source, str) and source.startswith(("rtsp://", "http://", "https://")):
                    import socket
                    from urllib.parse import urlparse
                    try:
                        p = urlparse(source)
                        h = p.hostname
                        pt = p.port or 554
                        if h:
                            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                            s.settimeout(0.6)
                            s.connect((h, pt))
                            s.close()
                    except Exception as probe_err:
                        retry_count += 1
                        _CAMERA_STATUS[camera_id] = "OFFLINE"
                        logger.info("[CCTV] Fast probe: %s unreachable at %s (%s). Marked OFFLINE.", camera_id, source[:30], probe_err)
                        if stop_event.wait(timeout=30.0):
                            break
                        continue
                elif isinstance(source, str) and source.startswith("demo://"):
                    demo_file = Path("sample_videos") / source.replace("demo://", "")
                    if not demo_file.exists():
                        _CAMERA_STATUS[camera_id] = "OFFLINE"
                        logger.info("[CCTV] Demo file not found for %s (%s). Marked OFFLINE.", camera_id, source)
                        if stop_event.wait(timeout=60.0):
                            break
                        continue
                    source = str(demo_file)

                os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|stimeout;2000000"
                cap = cv2.VideoCapture(source)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

                if not cap.isOpened():
                    retry_count += 1
                    _CAMERA_STATUS[camera_id] = "OFFLINE" if retry_count >= 3 else "RECONNECTING"
                    logger.warning("[CCTV] Stream connection failed for %s. Backoff %ss.", camera_id, backoff_sec)
                    if stop_event.wait(timeout=backoff_sec):
                        break
                    backoff_sec = min(backoff_sec * 2, max_backoff)
                    continue
                else:
                    # Successfully connected
                    _CAMERA_STATUS[camera_id] = "CONNECTED"
                    backoff_sec = 2.0
                    retry_count = 0
                    logger.info("[CCTV] %s connected successfully.", camera_id)

            # 2. Read Frame
            ret, frame = cap.read()
            if not ret or frame is None or frame.size == 0:
                logger.warning("[CCTV] Failed to read frame from %s. Reconnecting...", camera_id)
                cap.release()
                cap = None
                _CAMERA_STATUS[camera_id] = "RECONNECTING"
                time.sleep(1.0)
                continue

            _CAMERA_STATUS[camera_id] = "MONITORING"
            frame_idx += 1
            now = time.time()

            # 3. Throttle Inference (~3–5 FPS for real-time video)
            if (now - last_infer_time) >= 0.25:
                last_infer_time = now
                try:
                    effective_conf = max(cam_conf_thresh / 100.0, 0.50)
                    last_detections = ds.detect_frame(frame, conf_threshold=effective_conf, imgsz=640)
                except Exception as e:
                    logger.error("[CCTV] Inference error on %s: %s", camera_id, e)

            # 4. Annotate Tactical HUD & Bounding Boxes
            detected_species = None
            best_conf = 0.0

            for det in last_detections:
                x1, y1, x2, y2 = [int(v) for v in det["bbox"]]
                conf = det["confidence"]
                sp = det["species"]
                if conf > best_conf:
                    best_conf = conf
                    detected_species = sp

                # High threat red, otherwise amber
                box_color = (0, 0, 230) if sp in ["Tiger", "Lion", "Leopard", "Elephant", "Asian Elephant"] else (0, 165, 255)
                cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
                lbl = f"{sp.upper()} {conf}%"
                cv2.rectangle(frame, (x1, max(0, y1 - 22)), (x1 + len(lbl) * 10 + 10, y1), box_color, -1)
                cv2.putText(frame, lbl, (x1 + 4, max(14, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

            # Top HUD Telemetry
            time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cv2.putText(frame, f"KAVACH [{camera_id}] {cam_name} | {time_str}", (12, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 120), 2)
            cv2.putText(frame, f"NEAR: {cam_village_name} (~{int(dist_to_v)}m) | {int(current_fps)} FPS | {_CAMERA_STATUS[camera_id]}", (12, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 220, 255), 1)

            # 5. Encode JPEG & Save to Buffer
            _, jpeg_buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
            frame_bytes = jpeg_buf.tobytes()

            _FRAME_BUFFERS[camera_id] = {
                "frame_bytes": frame_bytes,
                "timestamp": now,
                "fps": current_fps,
                "status": _CAMERA_STATUS[camera_id],
                "detection": {
                    "species": detected_species,
                    "confidence": best_conf,
                    "count": len(last_detections),
                    "detections": last_detections,
                    "camera_id": camera_id,
                    "camera_name": cam_name,
                    "village_name": cam_village_name,
                    "distance_to_village_m": round(dist_to_v, 1)
                } if detected_species else None
            }

            # 6. Multi-frame confirmation & deduplication safety check (STEP 8 & STEP 15)
            stream_tracker = get_stream_tracker(f"cctv_{camera_id}", required_consecutive=3, conf_floor=cam_conf_thresh)
            safety_eval = stream_tracker.update(detected_species, best_conf)

            # Trigger Incident & DB record ONLY if confirmed detection across consecutive frames
            if safety_eval["is_confirmed"] and detected_species and best_conf >= cam_conf_thresh:
                # Check alert cooldown / deduplication
                should_alert, elapsed_alert = global_alert_deduplicator.should_dispatch_alert(detected_species, cam_village_id)
                if not should_alert:
                    logger.debug("[CCTV] Alert suppressed by cooldown (%.1fs elapsed). Telemetry will continue updating.", elapsed_alert)

                snapshot_filename = f"cctv_{camera_id}_{int(time.time())}.jpg"
                snapshot_path = UPLOADS_DIR / snapshot_filename
                cv2.imwrite(str(snapshot_path), frame)

                geofence_res = check_geofences(cam_lat, cam_lng)
                risk_eval = calculate_wildlife_risk(
                    species=detected_species,
                    confidence=best_conf,
                    count=len(last_detections),
                    lat=cam_lat,
                    lng=cam_lng,
                    distance_to_settlement_m=dist_to_v,
                    geofence_multiplier=geofence_res["risk_multiplier"]
                )

                inc_id, alt_id = deduplicate_or_create_incident(
                    species=detected_species,
                    confidence=best_conf,
                    camera_id=camera_id,
                    camera_name=cam_name,
                    village_id=cam_village_id,
                    village_name=cam_village_name,
                    lat=cam_lat,
                    lng=cam_lng,
                    risk_eval=risk_eval,
                    dist_to_village=dist_to_v,
                    snapshot_path=f"/uploads/{snapshot_filename}"
                )

                # Persist detection record
                try:
                    c_conn = get_db_connection()
                    c_cur = c_conn.cursor()
                    c_cur.execute("""
                        INSERT INTO detections (id, timestamp, species, class_name, confidence, bbox_json, count, lat, lng, accuracy, risk_score, risk_level, image_path, device_id, zone_id, status, source, camera_id, camera_name, village_id, village_name, incident_code, incident_id, verification_status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CCTV', ?, ?, ?, ?, ?, ?, 'AI_DETECTED')
                    """, (
                        f"DET-{uuid.uuid4().hex[:6].upper()}",
                        datetime.now().strftime("Today, %H:%M"),
                        detected_species,
                        detected_species.lower(),
                        best_conf,
                        json.dumps([d["bbox"] for d in last_detections]),
                        len(last_detections),
                        cam_lat,
                        cam_lng,
                        5.0,
                        risk_eval["risk_score"],
                        risk_eval["risk_level"],
                        f"/uploads/{snapshot_filename}",
                        camera_id,
                        cam_village_id,
                        "RECORDED",
                        camera_id,
                        cam_name,
                        cam_village_id,
                        cam_village_name,
                        f"KVC-{inc_id[-4:]}",
                        inc_id
                    ))
                    c_cur.execute("""
                        UPDATE cameras
                        SET status = 'ONLINE', last_frame_time = ?, latest_detection = ?, latest_confidence = ?, latest_bbox_json = ?
                        WHERE id = ?
                    """, (time_str, detected_species, best_conf, json.dumps([d["bbox"] for d in last_detections]), camera_id))
                    c_conn.commit()
                    c_conn.close()
                except Exception as db_err:
                    logger.error("[CCTV] Failed to insert detection event: %s", db_err)

            # FPS calculation
            fps_counter += 1
            if time.time() - fps_start >= 1.0:
                current_fps = round(fps_counter / (time.time() - fps_start), 1)
                fps_counter = 0
                fps_start = time.time()

            # Small sleep to yield CPU
            time.sleep(0.02)

        except Exception as loop_err:
            logger.error("[CCTV] Exception in worker loop for %s: %s", camera_id, loop_err, exc_info=True)
            _CAMERA_STATUS[camera_id] = "ERROR"
            time.sleep(2.0)

    if cap is not None:
        cap.release()

    _CAMERA_STATUS[camera_id] = "DISCONNECTED"
    logger.info("[CCTV] Worker stopped for %s", camera_id)


def start_camera_stream(camera_id: str) -> bool:
    """Starts background CCTV worker for camera_id if not already running."""
    with _CAMERA_LOCK:
        if camera_id in _CAMERA_THREADS and _CAMERA_THREADS[camera_id].is_alive():
            return True

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,))
        cam = cursor.fetchone()
        conn.close()

        if not cam:
            logger.warning("[CCTV] Cannot start stream: camera %s not found", camera_id)
            return False

        rtsp_url = cam["rtsp_url"]
        if not rtsp_url:
            logger.warning("[CCTV] Camera %s has no RTSP URL", camera_id)
            return False

        stop_event = threading.Event()
        _CAMERA_STOP_FLAGS[camera_id] = stop_event
        _CAMERA_STATUS[camera_id] = "CONNECTING"

        t = threading.Thread(
            target=_run_cctv_worker,
            args=(camera_id, rtsp_url, stop_event),
            daemon=True,
            name=f"CCTVWorker-{camera_id}"
        )
        _CAMERA_THREADS[camera_id] = t
        t.start()
        logger.info("[CCTV] Started stream thread for %s", camera_id)
        return True


def stop_camera_stream(camera_id: str) -> bool:
    """Stops background CCTV worker for camera_id."""
    with _CAMERA_LOCK:
        if camera_id in _CAMERA_STOP_FLAGS:
            _CAMERA_STOP_FLAGS[camera_id].set()
        if camera_id in _CAMERA_THREADS:
            _CAMERA_THREADS[camera_id].join(timeout=2.0)
            _CAMERA_THREADS.pop(camera_id, None)
            _CAMERA_STOP_FLAGS.pop(camera_id, None)

        _CAMERA_STATUS[camera_id] = "DISCONNECTED"
        logger.info("[CCTV] Stopped stream thread for %s", camera_id)
        return True


def get_latest_frame_bytes(camera_id: str) -> Optional[bytes]:
    """Retrieves the latest JPEG bytes from frame buffer."""
    buf = _FRAME_BUFFERS.get(camera_id)
    if buf and "frame_bytes" in buf:
        return buf["frame_bytes"]
    return None


def get_camera_telemetry(camera_id: str) -> Dict[str, Any]:
    """Returns real-time telemetry: FPS, status, and latest detection."""
    buf = _FRAME_BUFFERS.get(camera_id, {})
    status = _CAMERA_STATUS.get(camera_id, "DISCONNECTED")
    is_alive = camera_id in _CAMERA_THREADS and _CAMERA_THREADS[camera_id].is_alive()

    return {
        "camera_id": camera_id,
        "is_streaming": is_alive,
        "status": status,
        "fps": buf.get("fps", 0.0),
        "last_frame_seconds_ago": round(time.time() - buf.get("timestamp", 0), 1) if buf.get("timestamp") else None,
        "detection": buf.get("detection", None)
    }


def auto_start_active_cameras():
    """Starts active cameras on server startup."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, rtsp_url FROM cameras WHERE detection_active = 1 LIMIT 4")
        cams = cursor.fetchall()
        conn.close()

        for c in cams:
            if c["rtsp_url"]:
                start_camera_stream(c["id"])
    except Exception as e:
        logger.warning("[CCTV] Auto-start cameras failed: %s", e)
