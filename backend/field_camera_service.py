"""
KAVACH Wildlife Intelligence — Field Camera WebRTC & AI Processing Service.
Manages real-time mobile camera sessions, WebRTC signaling (offers, answers, ICE candidates),
frame ingestion, YOLO inference, movement tracking, risk calculation, and alert dispatch.
"""

import time
import uuid
import base64
import json
import logging
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
import cv2
import numpy as np

from fastapi import WebSocket, WebSocketDisconnect

from db import get_db_connection
from detection_service import DetectionService
from movement_tracker import WildlifeMovementTracker
from risk_engine import calculate_wildlife_risk
from notification_service import NotificationService

logger = logging.getLogger("kavach.field_camera")
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class FieldCameraManager:
    _instance: Optional["FieldCameraManager"] = None

    def __new__(cls) -> "FieldCameraManager":
        if cls._instance is None:
            cls._instance = super(FieldCameraManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return

        # Active camera sessions: session_id -> metadata
        self.sessions: Dict[str, Dict[str, Any]] = {}
        # Per-session movement trackers
        self.trackers: Dict[str, WildlifeMovementTracker] = {}
        # WebRTC Signaling storage: session_id -> { "offer": sdp, "answer": sdp, "ice_broadcaster": [], "ice_viewer": [] }
        self.signaling: Dict[str, Dict[str, Any]] = {}
        # Connected WebSockets for real-time signaling: session_id -> {"broadcaster": [ws], "viewer": [ws]}
        self.signaling_sockets: Dict[str, Dict[str, List[WebSocket]]] = {}
        # Alert debounce tracking: session_id -> last_alert_time
        self.last_alert_time: Dict[str, float] = {}

        self._lock = asyncio.Lock()
        self._initialized = True
        logger.info("[FIELD-CAMERA] Service initialized.")

    def get_or_create_session(
        self,
        camera_id: str = "CAM-001",
        session_id: Optional[str] = None,
        device_type: str = "Android Field Camera",
        lat: Optional[float] = None,
        lng: Optional[float] = None
    ) -> Dict[str, Any]:
        """Creates or retrieves an active mobile field camera session."""
        sid = session_id or camera_id
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if sid not in self.sessions:
            self.sessions[sid] = {
                "camera_id": camera_id,
                "session_id": sid,
                "device_type": device_type,
                "status": "CONNECTING",
                "stream_status": "OFFLINE",
                "connected_at": now_str,
                "last_seen": now_str,
                "lat": lat if lat is not None else 20.2667,
                "lng": lng if lng is not None else 79.4000,
                "fps": 0.0,
                "frames_processed": 0,
                "detections_count": 0,
                "latest_detection": None
            }
            self.trackers[sid] = WildlifeMovementTracker(frame_width=1280, frame_height=720)
            self.signaling[sid] = {
                "offer": None,
                "answer": None,
                "ice_broadcaster": [],
                "ice_viewer": []
            }
            self.signaling_sockets[sid] = {"broadcaster": [], "viewer": []}
            logger.info("[FIELD-CAMERA] Created session %s for camera %s", sid, camera_id)
        else:
            # Update metadata
            self.sessions[sid]["last_seen"] = now_str
            if lat is not None:
                self.sessions[sid]["lat"] = lat
            if lng is not None:
                self.sessions[sid]["lng"] = lng

        return self.sessions[sid]

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self.sessions.get(session_id)

    def get_all_sessions(self) -> List[Dict[str, Any]]:
        return list(self.sessions.values())

    def update_session_status(self, session_id: str, status: str, stream_status: Optional[str] = None):
        if session_id in self.sessions:
            self.sessions[session_id]["status"] = status
            if stream_status:
                self.sessions[session_id]["stream_status"] = stream_status
            self.sessions[session_id]["last_seen"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # -------------------------------------------------------------
    # WebRTC Signaling Methods (WebSocket + REST fallback)
    # -------------------------------------------------------------
    async def register_signaling_ws(self, session_id: str, role: str, ws: WebSocket):
        self.get_or_create_session(session_id=session_id)
        if session_id not in self.signaling_sockets:
            self.signaling_sockets[session_id] = {"broadcaster": [], "viewer": []}

        clean_role = "broadcaster" if role in ("broadcaster", "sender", "phone", "source") else "viewer"
        self.signaling_sockets[session_id][clean_role].append(ws)
        logger.info("[FIELD-CAMERA] WS connected: session=%s, role=%s", session_id, clean_role)

        if clean_role == "broadcaster":
            self.update_session_status(session_id, "CONNECTED", "ONLINE")

    async def unregister_signaling_ws(self, session_id: str, role: str, ws: WebSocket):
        clean_role = "broadcaster" if role in ("broadcaster", "sender", "phone", "source") else "viewer"
        if session_id in self.signaling_sockets and clean_role in self.signaling_sockets[session_id]:
            if ws in self.signaling_sockets[session_id][clean_role]:
                self.signaling_sockets[session_id][clean_role].remove(ws)
        logger.info("[FIELD-CAMERA] WS disconnected: session=%s, role=%s", session_id, clean_role)

        # If broadcaster left, set status DISCONNECTED
        if clean_role == "broadcaster" and not self.signaling_sockets.get(session_id, {}).get("broadcaster"):
            self.update_session_status(session_id, "DISCONNECTED", "OFFLINE")

    async def relay_signal(self, session_id: str, sender_role: str, payload: Dict[str, Any]):
        """Relays WebRTC signals (offer, answer, ice_candidate) to opposing peer."""
        clean_sender = "broadcaster" if sender_role in ("broadcaster", "sender", "phone", "source") else "viewer"
        target_role = "viewer" if clean_sender == "broadcaster" else "broadcaster"

        # Cache signaling state for REST polling fallback
        sig = self.signaling.setdefault(session_id, {"offer": None, "answer": None, "ice_broadcaster": [], "ice_viewer": []})
        msg_type = payload.get("type", "")

        if msg_type == "offer":
            sig["offer"] = payload.get("sdp")
        elif msg_type == "answer":
            sig["answer"] = payload.get("sdp")
        elif msg_type == "ice_candidate":
            cand = payload.get("candidate")
            if cand:
                if clean_sender == "broadcaster":
                    sig["ice_broadcaster"].append(cand)
                else:
                    sig["ice_viewer"].append(cand)

        # Broadcast to active WebSockets in target role
        target_sockets = self.signaling_sockets.get(session_id, {}).get(target_role, [])
        dead = []
        for ws in target_sockets:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)

        for d in dead:
            if d in target_sockets:
                target_sockets.remove(d)

    # -------------------------------------------------------------
    # Real AI Frame Processing & Telemetry Pipeline
    # -------------------------------------------------------------
    def process_field_camera_frame(
        self,
        camera_id: str,
        session_id: str,
        image_bytes: bytes,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        timestamp_str: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processes an actual video frame from the mobile field camera:
        1. Decodes genuine image bytes with OpenCV.
        2. Executes YOLO inference via DetectionService (backend/best.pt).
        3. Strictly filters for approved KAVACH wildlife species.
        4. Updates per-session MovementTracker to compute real direction and speed.
        5. Calculates risk with calculate_wildlife_risk.
        6. Logs real telemetry to 'detections' table with source='PHONE_CAMERA'.
        7. If risk is high/critical, creates an Incident and dispatches alerts.
        """
        sess = self.get_or_create_session(camera_id=camera_id, session_id=session_id, lat=lat, lng=lng)
        sess["frames_processed"] += 1
        sess["last_seen"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Decode image
        np_arr = np.frombuffer(image_bytes, np.uint8)
        frame_bgr = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame_bgr is None or frame_bgr.size == 0:
            return {"success": False, "error": "Invalid frame bytes", "detected": False, "detections": []}

        h, w = frame_bgr.shape[:2]
        frame_diag = float(np.sqrt(w * w + h * h))

        # 1. Run YOLO inference using existing DetectionService
        ds = DetectionService()
        raw_detections = ds.detect_frame(frame_bgr, conf_threshold=0.50, imgsz=640)

        # 2. Movement Tracking
        tracker = self.trackers.setdefault(session_id, WildlifeMovementTracker(frame_width=w, frame_height=h))
        now_epoch = time.time()
        active_tracks = tracker.process_frame(raw_detections, frame_idx=sess["frames_processed"], timestamp_sec=now_epoch)
        overall_mov = tracker.get_overall_movement_summary()

        # Primary movement status
        movement_summary = {
            "movement_status": overall_mov.get("movement_status", "STATIONARY" if raw_detections else "UNKNOWN"),
            "direction": overall_mov.get("dominant_direction", "UNKNOWN"),
            "speed_px_per_sec": overall_mov.get("max_speed_px_per_sec", 0.0),
            "description": overall_mov.get("description", "")
        }
        if raw_detections:
            movement_summary["movement_status"] = raw_detections[0].get("movement_status", movement_summary["movement_status"])
            movement_summary["direction"] = raw_detections[0].get("direction", movement_summary["direction"])
            movement_summary["speed_px_per_sec"] = raw_detections[0].get("speed_px_per_sec", movement_summary["speed_px_per_sec"])

        # If no wildlife detected, return early
        if not raw_detections:
            sess["latest_detection"] = None
            return {
                "success": True,
                "detected": False,
                "detections": [],
                "movement": movement_summary,
                "risk": None,
                "camera_id": camera_id,
                "session_id": session_id,
                "timestamp": timestamp_str or datetime.now().strftime("%H:%M:%S")
            }

        # 3. Target species found!
        sess["detections_count"] += 1
        primary = raw_detections[0]
        species = primary["species"]
        confidence = float(primary["confidence"])

        cur_lat = lat if lat is not None else sess["lat"]
        cur_lng = lng if lng is not None else sess["lng"]

        # Approximate nearest settlement
        dist_to_village = 350.0
        village_name = "Moharli Settlement (Buffer Zone)"
        village_id = "VIL-01"

        try:
            from gis.spatial import find_nearest_village
            v_res, v_dist = find_nearest_village(cur_lat, cur_lng)
            if v_res:
                village_name = v_res.get("name", village_name)
                village_id = v_res.get("id", village_id)
                dist_to_village = v_dist
        except Exception:
            pass

        # 4. Calculate Risk
        risk_eval = calculate_wildlife_risk(
            species=species,
            confidence=confidence,
            count=len(raw_detections),
            lat=cur_lat,
            lng=cur_lng,
            distance_to_settlement_m=dist_to_village
        )

        now_time = datetime.now().strftime("%H:%M:%S")
        now_display = datetime.now().strftime("Today, %H:%M")
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Save snapshot for evidence
        snapshot_filename = f"fcam_{session_id}_{int(now_epoch)}.jpg"
        snapshot_path = UPLOAD_DIR / snapshot_filename
        try:
            cv2.imwrite(str(snapshot_path), frame_bgr)
            evidence_url = f"/uploads/{snapshot_filename}"
        except Exception:
            evidence_url = ""

        # 5. Persist detection in SQLite detections table
        det_id = f"DET-FCAM-{uuid.uuid4().hex[:6].upper()}"
        conn = get_db_connection()
        cursor = conn.cursor()

        incident_id = None
        alert_id = None

        # Cooldown check for debouncing repeated alerts (at most once every 60s per species/session)
        last_alert = self.last_alert_time.get(session_id, 0.0)
        cooldown_elapsed = now_epoch - last_alert

        should_alert = (
            (risk_eval["risk_score"] >= 70.0 or movement_summary["movement_status"] == "MOVING")
            and cooldown_elapsed > 60.0
        )

        if should_alert:
            self.last_alert_time[session_id] = now_epoch
            incident_id = f"INC-FCAM-{uuid.uuid4().hex[:6].upper()}"
            inc_code = f"KVC-{uuid.uuid4().hex[:4].upper()}"
            alert_id = f"ALT-FCAM-{uuid.uuid4().hex[:6].upper()}"

            initial_timeline = [
                {
                    "stage": "Field Camera Detection",
                    "time": now_time,
                    "detail": f"AI identified {species} ({confidence}% conf) via live wireless phone camera {camera_id}."
                },
                {
                    "stage": "Movement & Conflict Triage",
                    "time": now_time,
                    "detail": f"{species} {movement_summary['movement_status']} ({movement_summary['direction']}). Risk score {risk_eval['risk_score']:.1f} ({risk_eval['risk_level']})."
                }
            ]

            # Insert operational incident
            cursor.execute("""
                INSERT INTO incidents (id, incident_code, title, animal, confidence, lat, lng, timestamp, reporter, image_path, risk_level, status, assigned_officer, notes, timeline_json, village_id, village_name, first_detected, last_detected, detection_count, verification_status, source, severity)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REPORTED', 'Pending Assignment', ?, ?, ?, ?, ?, ?, 1, 'AI_DETECTED', 'PHONE_CAMERA', ?)
            """, (
                incident_id,
                inc_code,
                f"{risk_eval['risk_level']} Alert: {species} Field Camera Sighting",
                species,
                confidence,
                cur_lat,
                cur_lng,
                now_display,
                f"Field Camera ({camera_id})",
                evidence_url,
                risk_eval["risk_level"],
                risk_eval["reason"],
                json.dumps(initial_timeline),
                village_id,
                village_name,
                now_display,
                now_display,
                risk_eval["risk_level"]
            ))

            # Insert alert
            cursor.execute("""
                INSERT INTO alerts (id, title, species, confidence, risk_score, priority, reason, recommendation, lat, lng, distance_to_settlement, timestamp, status, village_id, village_name, alert_channels_json, verification_status, dedup_incident_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, 'AI_DETECTED', ?)
            """, (
                alert_id,
                f"🚨 FIELD CAMERA: {species} near {village_name}",
                species,
                confidence,
                risk_eval["risk_score"],
                risk_eval["risk_level"],
                risk_eval["reason"],
                risk_eval["recommendation"],
                cur_lat,
                cur_lng,
                dist_to_village,
                now_display,
                village_id,
                village_name,
                json.dumps(["SIREN_ACTIVATION", "FCM_PUSH", "WEBSOCKET_BROADCAST"]),
                incident_id
            ))

            # Dispatch real multi-channel alert
            NotificationService.dispatch_alert(
                alert_id=alert_id,
                species=species,
                risk_level=risk_eval["risk_level"],
                risk_score=risk_eval["risk_score"],
                village_name=village_name,
                distance_str=f"{int(dist_to_village)}m",
                recommendation=risk_eval["recommendation"],
                lat=cur_lat,
                lng=cur_lng
            )

        # Store detection record with source 'PHONE_CAMERA'
        cursor.execute("""
            INSERT INTO detections (id, timestamp, species, class_name, confidence, bbox_json, count, lat, lng, accuracy, risk_score, risk_level, image_path, device_id, zone_id, status, source, camera_id, camera_name, village_id, village_name, verification_status, movement_status, direction, incident_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECORDED', 'PHONE_CAMERA', ?, 'Field Phone Camera', ?, ?, 'AI_DETECTED', ?, ?, ?)
        """, (
            det_id,
            now_display,
            species,
            primary.get("class_name", species.lower()),
            confidence,
            json.dumps([d["bbox"] for d in raw_detections]),
            len(raw_detections),
            cur_lat,
            cur_lng,
            10.0,
            risk_eval["risk_score"],
            risk_eval["risk_level"],
            evidence_url,
            camera_id,
            "ZONE-FIELD-01",
            camera_id,
            village_id,
            village_name,
            movement_summary["movement_status"],
            movement_summary["direction"],
            incident_id
        ))

        conn.commit()
        conn.close()

        # Update session latest detection
        detection_entry = {
            "detection_id": det_id,
            "species": species,
            "confidence": confidence,
            "emoji": primary.get("emoji", "🐾"),
            "movement": movement_summary,
            "risk": risk_eval,
            "location": {"village": village_name, "lat": cur_lat, "lng": cur_lng},
            "timestamp": now_time,
            "incident_id": incident_id,
            "image_url": evidence_url
        }
        sess["latest_detection"] = detection_entry

        return {
            "success": True,
            "detected": True,
            "detection_id": det_id,
            "species": species,
            "confidence": confidence,
            "emoji": primary.get("emoji", "🐾"),
            "detections": raw_detections,
            "movement": movement_summary,
            "risk": risk_eval,
            "incident_id": incident_id,
            "alert_id": alert_id,
            "timestamp": now_time,
            "location": {"village": village_name, "lat": cur_lat, "lng": cur_lng}
        }


# Global Singleton Manager
field_camera_manager = FieldCameraManager()
