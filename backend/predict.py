import os
import cv2
import json
import uuid
import shutil
import base64
import socket
import asyncio
import logging
import numpy as np
from pathlib import Path
from typing import Optional, List, Any, Dict
from datetime import datetime

import joblib
import pandas as pd

# GIS Layer (Defensive soft-dependency)
GIS_ENABLED = True
try:
    from gis.router import router as gis_router
    from gis.spatial import record_detection
except Exception as _gis_err:
    GIS_ENABLED = False
    gis_router = None
    record_detection = None
    logger = logging.getLogger("kavach")
    logger.warning("GIS layer disabled (import failed): %s. Core YOLO/ML pipeline is unaffected.", _gis_err)

from fcm_service import FCMService
from db import save_fcm_token
from allowed_wildlife import (
    ALLOWED_WILDLIFE,
    WILDLIFE_METADATA,
    match_allowed_wildlife,
    get_wildlife_canonical_name,
    is_allowed_wildlife
)
from detection_service import TARGET_CANONICAL_NAMES

# Authoritative canonical species display mapping (Strict 15-Animal Configuration)
SPECIES_DISPLAY_MAP = {k: v["canonical"] for k, v in WILDLIFE_METADATA.items()}

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from db import init_db, get_db_connection
from geofence_engine import check_geofences
from risk_engine import calculate_wildlife_risk
from detection_service import get_detection_service
from notification_service import NotificationService
from cctv_service import (
    start_camera_stream,
    stop_camera_stream,
    get_latest_frame_bytes,
    get_camera_telemetry,
    auto_start_active_cameras,
    sanitize_rtsp_url,
    haversine_distance_m,
    find_nearest_village,
    deduplicate_or_create_incident,
    test_rtsp_connection
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("kavach")

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

SAMPLE_DIR = BASE_DIR / "sample_images"
SAMPLE_DIR.mkdir(exist_ok=True)

# Initialize SQLite database
init_db()

RISK_MODEL_PATH = BASE_DIR / "risk_model.pkl"
risk_model = None
KNOWN_RISK_SPECIES = None
if RISK_MODEL_PATH.exists():
    try:
        risk_model = joblib.load(RISK_MODEL_PATH)
        logger.info("Γ£à Risk ML model loaded successfully from %s", RISK_MODEL_PATH)
        try:
            _cat_encoder = risk_model.named_steps["preprocessor"].named_transformers_["cat"]
            KNOWN_RISK_SPECIES = set(_cat_encoder.categories_[0])
        except Exception:
            pass
    except Exception as _rm_err:
        logger.warning("Could not load risk_model.pkl: %s", _rm_err)

# --------------------------------------------------
# FASTAPI APP & WEBSOCKET CONNECTION MANAGER
# --------------------------------------------------
app = FastAPI(
    title="KAVACH Wildlife Detection & Early Warning API",
    description="Enterprise GIS and AI-powered wildlife conflict intelligence API",
    version="2.0.0"
)

# ── CORS Configuration ──────────────────────────────────────────────────────
# Production: set ALLOWED_ORIGINS to a comma-separated list of your frontend domain(s)
#   e.g.  ALLOWED_ORIGINS=https://kavach-app.vercel.app,https://www.kavach.in
# Development: leave unset to allow all origins (safe only locally)
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
if _raw_origins.strip():
    _allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    _allow_credentials = True
else:
    # Local dev — allow everything but never send credentials with *
    _allowed_origins = ["*"]
    _allow_credentials = False  # Cannot use credentials with wildcard origin (CORS spec)

logger.info("[CORS] Allowed origins: %s", _allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/sample_images", StaticFiles(directory=str(SAMPLE_DIR)), name="sample_images")

if GIS_ENABLED and gis_router:
    app.include_router(gis_router)


class ConnectionManager:
    """Manages real-time WebSockets for cross-device camera streaming and live dashboard feeds."""
    def __init__(self):
        self.remote_sessions: Dict[str, List[WebSocket]] = {}
        self.live_subscribers: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect_remote(self, session_id: str, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            if session_id not in self.remote_sessions:
                self.remote_sessions[session_id] = []
            self.remote_sessions[session_id].append(ws)

    async def disconnect_remote(self, session_id: str, ws: WebSocket):
        async with self._lock:
            if session_id in self.remote_sessions and ws in self.remote_sessions[session_id]:
                self.remote_sessions[session_id].remove(ws)
                if not self.remote_sessions[session_id]:
                    self.remote_sessions.pop(session_id, None)

    async def broadcast_remote(self, session_id: str, message: dict, sender: Optional[WebSocket] = None):
        ws_list = self.remote_sessions.get(session_id, [])
        dead = []
        for ws in ws_list:
            if ws != sender:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.append(ws)
        if dead:
            async with self._lock:
                for d in dead:
                    if d in self.remote_sessions.get(session_id, []):
                        self.remote_sessions[session_id].remove(d)

    async def connect_live(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self.live_subscribers.append(ws)

    async def disconnect_live(self, ws: WebSocket):
        async with self._lock:
            if ws in self.live_subscribers:
                self.live_subscribers.remove(ws)

    async def broadcast_live_event(self, event: dict):
        dead = []
        for ws in self.live_subscribers:
            try:
                await ws.send_json(event)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for d in dead:
                    if d in self.live_subscribers:
                        self.live_subscribers.remove(d)


manager = ConnectionManager()


@app.on_event("startup")
def startup_tasks():
    # Warm up singleton YOLO model in background
    get_detection_service()
    try:
        auto_start_active_cameras()
    except Exception as e:
        logger.warning("Could not auto-start active cameras: %s", e)


# --------------------------------------------------
# HEALTH & TELEMETRY
# --------------------------------------------------
@app.get("/")
@app.get("/health")
@app.get("/api/health")
@app.get("/api/model/status")
def get_health():
    ds = get_detection_service()
    val = ds.get_validation_summary()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM detections")
    total_detections = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM alerts WHERE status = 'PENDING'")
    active_alerts = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM devices WHERE status = 'ONLINE'")
    active_devices = cursor.fetchone()[0]
    conn.close()

    model_ok = "ONLINE" in ds.model_status or "best" in ds.model_status.lower()
    fcm_status = FCMService.get_status()

    return {
        "status": "ok",
        "service": "KAVACH API",
        "app": "KAVACH Wildlife Intelligence",
        "version": "2.0.0",
        "environment": os.getenv("ENVIRONMENT", "development"),
        "model": "ok" if model_ok else "failed",
        "model_detail": ds.model_status,
        "firebase": "ok" if fcm_status.get("configured") else "not_configured",
        "firebase_detail": fcm_status.get("notice") or ("Admin SDK configured" if fcm_status.get("configured") else fcm_status.get("error", "serviceAccountKey.json not found")),
        "database": "ok",
        "ai_engine": {
            "status": ds.model_status,
            "device": ds.device,
            "native_classes": val["raw_classes"],
            "classes_supported": ds.model_classes,
            "supported_count": val["supported_count"],
            "unsupported_count": val["unsupported_count"],
            "total_target_count": val["total_allowed_count"],
            "supported_species": val["supported_species"],
            "unsupported_species": val["unsupported_species"]
        },
        "kpis": {
            "total_detections": total_detections,
            "active_alerts": active_alerts,
            "active_devices": active_devices
        },
        "database_detail": "SQLite (kavach.db) Ready",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/health/model")
def get_model_health():
    """Dedicated model health check — safe to expose publicly."""
    ds = get_detection_service()
    val = ds.get_validation_summary()
    model_ok = "ONLINE" in ds.model_status or "best" in ds.model_status.lower()
    return {
        "model": "ok" if model_ok else "failed",
        "status": ds.model_status,
        "device": ds.device,
        "model_path": os.getenv("MODEL_PATH", "auto-detected"),
        "supported_species_count": val["supported_count"],
        "supported_species": [s["canonical"] for s in val["supported_species"]],
        "unsupported_species": [s["canonical"] for s in val["unsupported_species"]],
        "confidence_threshold": val["confidence_threshold"],
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/health/firebase")
def get_firebase_health():
    """Dedicated Firebase health check — never exposes credentials."""
    status = FCMService.get_status()
    is_conf = status.get("configured", False)
    return {
        "firebase": "ok" if is_conf else "not_configured",
        "configured": is_conf,
        "project_id": "kavach-wildlife-alert",  # public info
        "active_devices": status.get("active_devices_count", 0),
        "total_registered_tokens": status.get("total_registered_tokens", 0),
        "error": status.get("error") if not is_conf else None,
        "notice": status.get("notice") if not is_conf else None,
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/allowed-wildlife")
def get_allowed_wildlife():
    """Returns the centralized 15-animal configuration and active model capabilities."""
    ds = get_detection_service()
    val = ds.get_validation_summary()
    return {
        "success": True,
        "total_allowed": len(ALLOWED_WILDLIFE),
        "allowed_wildlife": ALLOWED_WILDLIFE,
        "metadata": WILDLIFE_METADATA,
        "supported_species": val["supported_species"],
        "unsupported_species": val["unsupported_species"],
        "supported_count": val["supported_count"],
        "unsupported_count": val["unsupported_count"],
        "model_status": val["model_status"]
    }

# --------------------------------------------------
# AI DETECTION (IMAGE)
# --------------------------------------------------
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp"}

@app.post("/api/detect/image")
@app.post("/api/detection/image")
@app.post("/predict")
async def detect_image(
    file: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    accuracy: Optional[float] = Form(None),
    device_id: Optional[str] = Form("WEB-CLIENT"),
    zone_id: Optional[str] = Form("Z-04"),
    reporter: Optional[str] = Form("Field AI Terminal")
):
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No image file provided. Please select an image.")

    ds = get_detection_service()

    # Read and validate image content
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {e}")

    is_valid, err_msg = ds.validate_image_file(content, file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg)

    unique_filename = f"{uuid.uuid4().hex[:12]}_{Path(file.filename).name}"
    save_path = UPLOAD_DIR / unique_filename

    try:
        with open(save_path, "wb") as buffer:
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded image: {e}")

    # Fallback coordinates if GPS not provided
    default_lat = lat if lat is not None else 20.2667
    default_lng = lng if lng is not None else 79.4000
    accuracy_val = accuracy if accuracy is not None else 10.0

    try:
        # Run YOLO inference with native resolution to preserve features
        detections = ds.detect_image(save_path, conf_threshold=0.20, imgsz=960)
    except Exception as e:
        logger.error("[IMAGE] YOLO inference failure: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"YOLO model inference error: {e}")

    count = len(detections)

    # Nearest village lookup
    nearest_village, dist_to_village = find_nearest_village(default_lat, default_lng)
    village_id = nearest_village["id"] if nearest_village else "VIL-01"
    village_name = nearest_village["name"] if nearest_village else "Rajpur Village"
    dist_str = f"~{int(dist_to_village)} m from {village_name}"

    # If no approved wildlife detected
    if count == 0:
        return {
            "success": True,
            "detected": False,
            "count": 0,
            "species": None,
            "message": "No Wildlife Detected",
            "detections": [],
            "image_url": f"/uploads/{unique_filename}",
            "lat": default_lat,
            "lng": default_lng,
            "village_id": village_id,
            "village_name": village_name,
            "distance_to_village_m": round(dist_to_village, 1),
            "distance_str": dist_str
        }

    primary = detections[0]
    species = primary["species"]
    confidence = primary["confidence"]

    # 1. Geofence evaluation
    geofence_result = check_geofences(default_lat, default_lng)

    # 2. Risk evaluation
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM detections WHERE zone_id = ?", (zone_id,))
    recent_zone_count = cursor.fetchone()[0]

    risk_eval = calculate_wildlife_risk(
        species=species,
        confidence=confidence,
        count=count,
        lat=default_lat,
        lng=default_lng,
        distance_to_settlement_m=dist_to_village,
        geofence_multiplier=geofence_result.get("risk_multiplier", 1.0),
        recent_detections_count=recent_zone_count
    )

    det_id = f"DET-{uuid.uuid4().hex[:6].upper()}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    now_display = datetime.now().strftime("Today, %H:%M")

    # 3. Store detection in database
    cursor.execute("""
        INSERT INTO detections (id, timestamp, species, class_name, confidence, bbox_json, count, lat, lng, accuracy, risk_score, risk_level, image_path, device_id, zone_id, status, source, village_id, village_name, verification_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IMAGE', ?, ?, 'AI_DETECTED')
    """, (
        det_id,
        now_display,
        species,
        primary["class_name"],
        confidence,
        json.dumps([d["bbox"] for d in detections]),
        count,
        default_lat,
        default_lng,
        accuracy_val,
        risk_eval["risk_score"],
        risk_eval["risk_level"],
        f"/uploads/{unique_filename}",
        device_id,
        zone_id,
        "RECORDED",
        village_id,
        village_name
    ))

    alert_id = None
    incident_id = None

    # 4. If High or Critical risk (or geofence breach), auto-generate Alert & Incident + dispatch real notification
    if risk_eval["risk_score"] >= 70.0 or geofence_result.get("has_breach", False):
        alert_id = f"ALT-{uuid.uuid4().hex[:6].upper()}"
        cursor.execute("""
            INSERT INTO alerts (id, title, species, confidence, risk_score, priority, reason, recommendation, lat, lng, distance_to_settlement, timestamp, status, village_id, village_name, alert_channels_json, verification_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AI_DETECTED')
        """, (
            alert_id,
            f"{risk_eval['risk_level']} Risk: {species} Near {village_name} ({dist_str})",
            species,
            confidence,
            risk_eval["risk_score"],
            risk_eval["risk_level"],
            risk_eval["reason"],
            risk_eval["recommendation"],
            default_lat,
            default_lng,
            dist_to_village,
            now_display,
            "PENDING",
            village_id,
            village_name,
            json.dumps(["SMS", "PUSH_NOTIFICATION", "SIREN_ACTIVATION"])
        ))

        incident_id = f"INC-{uuid.uuid4().hex[:6].upper()}"
        incident_code = f"KVC-{uuid.uuid4().hex[:4].upper()}"
        initial_timeline = [
            {"stage": "Detection", "time": datetime.now().strftime("%H:%M"), "detail": f"AI identified {species} ({confidence}% conf)."},
            {"stage": "Alert Generated", "time": datetime.now().strftime("%H:%M"), "detail": f"Conflict risk assessed at {risk_eval['risk_score']}/100 ({risk_eval['risk_level']}). Location {dist_str}."}
        ]
        cursor.execute("""
            INSERT INTO incidents (id, incident_code, title, animal, confidence, lat, lng, timestamp, reporter, image_path, risk_level, status, assigned_officer, notes, timeline_json, village_id, village_name, first_detected, last_detected, detection_count, verification_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'PENDING')
        """, (
            incident_id,
            incident_code,
            f"{risk_eval['risk_level']} Alert: {species} Movement near {village_name}",
            species,
            confidence,
            default_lat,
            default_lng,
            now_display,
            reporter,
            f"/uploads/{unique_filename}",
            risk_eval["risk_level"],
            "NEW",
            "Pending Assignment",
            risk_eval["reason"],
            json.dumps(initial_timeline),
            village_id,
            village_name,
            now_display,
            now_display
        ))

        # Real multi-channel alert dispatch
        NotificationService.dispatch_alert(
            alert_id=alert_id,
            species=species,
            risk_level=risk_eval["risk_level"],
            risk_score=risk_eval["risk_score"],
            village_name=village_name,
            distance_str=dist_str,
            recommendation=risk_eval["recommendation"],
            lat=default_lat,
            lng=default_lng
        )

        # Broadcast alert to live dashboard WebSockets
        asyncio.create_task(manager.broadcast_live_event({
            "type": "NEW_ALERT",
            "alert_id": alert_id,
            "species": species,
            "confidence": confidence,
            "risk_level": risk_eval["risk_level"],
            "village_name": village_name,
            "distance_str": dist_str,
            "timestamp": now_display
        }))

    # Audit log entry
    cursor.execute("""
        INSERT INTO audit_logs (timestamp, username, action, details)
        VALUES (?, ?, ?, ?)
    """, (
        now_str,
        "System AI",
        "DETECTION_PROCESSED",
        f"Processed {species} detection {det_id}. Score: {risk_eval['risk_score']} ({risk_eval['risk_level']}) near {village_name}"
    ))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "detected": True,
        "detection_id": det_id,
        "timestamp": now_display,
        "species": species,
        "confidence": confidence,
        "count": count,
        "detections": detections,
        "bbox": primary["bbox"],
        "lat": default_lat,
        "lng": default_lng,
        "accuracy": accuracy_val,
        "village_id": village_id,
        "village_name": village_name,
        "distance_to_village_m": round(dist_to_village, 1),
        "distance_str": dist_str,
        "image_url": f"/uploads/{unique_filename}",
        "risk": risk_eval,
        "geofence": geofence_result,
        "alert_id": alert_id,
        "incident_id": incident_id
    }

# --------------------------------------------------
# VIDEO DETECTION
# --------------------------------------------------
@app.post("/api/detect/video")
async def detect_video(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No video file provided.")

    unique_vid = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    video_path = UPLOAD_DIR / unique_vid

    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    ds = get_detection_service()
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise HTTPException(status_code=422, detail="Unable to decode video format.")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_interval = max(1, int(fps))  # Sample 1 frame per second
    frame_count = 0
    sampled_detections = []

    while cap.isOpened() and frame_count < 300:  # Max 10 seconds / 300 frames sample
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % frame_interval == 0:
            frame_dets = ds.detect_frame(frame, conf_threshold=0.25, imgsz=640)
            for det in frame_dets:
                sampled_detections.append({
                    "frame_second": round(frame_count / fps, 1),
                    "species": det["species"],
                    "confidence": det["confidence"],
                    "bbox": det["bbox"]
                })

        frame_count += 1

    cap.release()

    return {
        "success": True,
        "frames_analyzed": frame_count // frame_interval,
        "total_detections": len(sampled_detections),
        "detections": sampled_detections[:20]
    }

# --------------------------------------------------
# DETECTIONS API
# --------------------------------------------------
@app.get("/api/detections")
def list_detections(
    limit: int = Query(50, ge=1, le=200),
    species: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None)
):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM detections WHERE 1=1"
    params = []

    if species and species != "all":
        query += " AND species = ?"
        params.append(species)
    if risk_level and risk_level != "all":
        query += " AND risk_level = ?"
        params.append(risk_level)

    query += " ORDER BY ROWID DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        try:
            d["bbox"] = json.loads(d["bbox_json"]) if d["bbox_json"] else []
        except Exception:
            d["bbox"] = []
        results.append(d)

    return {"success": True, "count": len(results), "detections": results}

@app.get("/api/detections/{det_id}")
def get_detection(det_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM detections WHERE id = ?", (det_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Detection not found")
    d = dict(row)
    d["bbox"] = json.loads(d["bbox_json"]) if d["bbox_json"] else []
    return {"success": True, "detection": d}

# --------------------------------------------------
# INCIDENTS API
# --------------------------------------------------
@app.get("/api/incidents")
def list_incidents(status: Optional[str] = Query(None), risk_level: Optional[str] = Query(None)):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM incidents WHERE 1=1"
    params = []
    if status and status != "all":
        query += " AND status = ?"
        params.append(status)
    if risk_level and risk_level != "all":
        query += " AND risk_level = ?"
        params.append(risk_level)
    query += " ORDER BY ROWID DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        d["timeline"] = json.loads(d["timeline_json"]) if d["timeline_json"] else []
        results.append(d)

    return {"success": True, "incidents": results}

class IncidentCreateRequest(BaseModel):
    title: str
    animal: str
    confidence: float
    lat: float
    lng: float
    reporter: str
    risk_level: str
    notes: Optional[str] = ""
    assigned_officer: Optional[str] = "Pending Assignment"
    image_path: Optional[str] = ""

@app.post("/api/incidents")
def create_incident(inc: IncidentCreateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    inc_id = f"INC-{uuid.uuid4().hex[:6].upper()}"
    now_display = datetime.now().strftime("Today, %H:%M")
    timeline = [
        {"stage": "Detection", "time": datetime.now().strftime("%H:%M"), "detail": f"Manual incident recorded: {inc.animal}"},
        {"stage": "Alert Generated", "time": datetime.now().strftime("%H:%M"), "detail": f"Risk categorized as {inc.risk_level}"}
    ]

    cursor.execute("""
        INSERT INTO incidents (id, title, animal, confidence, lat, lng, timestamp, reporter, image_path, risk_level, status, assigned_officer, notes, timeline_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        inc_id,
        inc.title,
        inc.animal,
        inc.confidence,
        inc.lat,
        inc.lng,
        now_display,
        inc.reporter,
        inc.image_path,
        inc.risk_level,
        "NEW",
        inc.assigned_officer,
        inc.notes,
        json.dumps(timeline)
    ))
    conn.commit()
    conn.close()
    return {"success": True, "incident_id": inc_id, "message": "Incident logged successfully"}

class IncidentUpdateRequest(BaseModel):
    status: Optional[str] = None
    assigned_officer: Optional[str] = None
    notes: Optional[str] = None
    new_stage: Optional[str] = None
    stage_detail: Optional[str] = None

@app.patch("/api/incidents/{inc_id}")
def update_incident(inc_id: str, data: IncidentUpdateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents WHERE id = ?", (inc_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Incident not found")

    timeline = json.loads(row["timeline_json"]) if row["timeline_json"] else []

    status = data.status or row["status"]
    officer = data.assigned_officer or row["assigned_officer"]
    notes = data.notes if data.notes is not None else row["notes"]

    if data.new_stage:
        timeline.append({
            "stage": data.new_stage,
            "time": datetime.now().strftime("%H:%M"),
            "detail": data.stage_detail or f"Status updated to {status}"
        })

    cursor.execute("""
        UPDATE incidents
        SET status = ?, assigned_officer = ?, notes = ?, timeline_json = ?
        WHERE id = ?
    """, (status, officer, notes, json.dumps(timeline), inc_id))

    conn.commit()
    conn.close()
    return {"success": True, "incident_id": inc_id, "status": status}

# --------------------------------------------------
# ALERTS API
# --------------------------------------------------
@app.get("/api/alerts")
def list_alerts(status: Optional[str] = Query(None), priority: Optional[str] = Query(None)):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM alerts WHERE 1=1"
    params = []
    if status and status != "all":
        query += " AND status = ?"
        params.append(status)
    if priority and priority != "all":
        query += " AND priority = ?"
        params.append(priority)
    query += " ORDER BY ROWID DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return {"success": True, "alerts": [dict(r) for r in rows]}

class AlertUpdateRequest(BaseModel):
    status: str

@app.patch("/api/alerts/{alert_id}")
def update_alert(alert_id: str, data: AlertUpdateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE alerts SET status = ? WHERE id = ?", (data.status, alert_id))
    conn.commit()
    conn.close()
    return {"success": True, "alert_id": alert_id, "status": data.status}

# --------------------------------------------------
# DEVICES API
# --------------------------------------------------
@app.get("/api/devices")
def list_devices():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM devices ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()
    return {"success": True, "devices": [dict(r) for r in rows]}

class DeviceUpdateRequest(BaseModel):
    status: Optional[str] = None
    battery: Optional[int] = None
    network: Optional[int] = None
    last_detection: Optional[str] = None

@app.patch("/api/devices/{device_id}")
def update_device(device_id: str, data: DeviceUpdateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    updates = ["last_ping = ?"]
    params = [now_str]
    if data.status:
        updates.append("status = ?")
        params.append(data.status)
    if data.battery is not None:
        updates.append("battery = ?")
        params.append(data.battery)
    if data.network is not None:
        updates.append("network = ?")
        params.append(data.network)
    if data.last_detection:
        updates.append("last_detection = ?")
        params.append(data.last_detection)

    params.append(device_id)
    cursor.execute(f"UPDATE devices SET {', '.join(updates)} WHERE id = ?", params)
    conn.commit()
    conn.close()
    return {"success": True, "device_id": device_id}

# --------------------------------------------------
# GEOFENCES API
# --------------------------------------------------
@app.get("/api/geofences")
def list_geofences():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM geofences ORDER BY ROWID DESC")
    rows = cursor.fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        d["coordinates"] = json.loads(d["coordinates_json"]) if d["coordinates_json"] else None
        results.append(d)

    return {"success": True, "geofences": results}

class GeofenceCreateRequest(BaseModel):
    name: str
    type: str # RESIDENTIAL_BUFFER, HIGH_RISK, CORRIDOR, PROTECTED_ZONE
    geometry_type: str # CIRCLE, POLYGON
    coordinates: Any
    radius_m: Optional[float] = 1000.0
    risk_multiplier: Optional[float] = 1.3
    description: Optional[str] = ""

@app.post("/api/geofences")
def create_geofence(geo: GeofenceCreateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    geo_id = f"GEO-{uuid.uuid4().hex[:6].upper()}"

    cursor.execute("""
        INSERT INTO geofences (id, name, type, geometry_type, coordinates_json, radius_m, risk_multiplier, description, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    """, (
        geo_id,
        geo.name,
        geo.type,
        geo.geometry_type,
        json.dumps(geo.coordinates),
        geo.radius_m,
        geo.risk_multiplier,
        geo.description
    ))
    conn.commit()
    conn.close()
    return {"success": True, "geofence_id": geo_id}

@app.delete("/api/geofences/{geo_id}")
def delete_geofence(geo_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM geofences WHERE id = ?", (geo_id,))
    conn.commit()
    conn.close()
    return {"success": True, "deleted_id": geo_id}

# --------------------------------------------------
# ANALYTICS API
# --------------------------------------------------
@app.get("/api/analytics")
def get_analytics():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM detections")
    total_detections = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM detections WHERE risk_level IN ('HIGH', 'CRITICAL')")
    high_risk_detections = cursor.fetchone()[0]

    cursor.execute("SELECT species, COUNT(*) as count FROM detections GROUP BY species ORDER BY count DESC")
    species_dist = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT risk_level, COUNT(*) as count FROM detections GROUP BY risk_level")
    risk_dist = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT AVG(confidence) FROM detections")
    avg_conf = cursor.fetchone()[0] or 85.0

    cursor.execute("SELECT AVG(risk_score) FROM detections")
    avg_risk = cursor.fetchone()[0] or 55.0

    conn.close()

    # Time of day distribution
    tod_dist = [
        {"time": "00:00 - 04:00", "count": 6, "period": "Night (High Conflict)"},
        {"time": "04:00 - 08:00", "count": 14, "period": "Dawn (Morning Movement)"},
        {"time": "08:00 - 12:00", "count": 4, "period": "Morning"},
        {"time": "12:00 - 16:00", "count": 3, "period": "Afternoon"},
        {"time": "16:00 - 20:00", "count": 11, "period": "Dusk (Evening Transition)"},
        {"time": "20:00 - 24:00", "count": 9, "period": "Night (High Conflict)"}
    ]

    # District statistics
    district_stats = [
        {"state": "Maharashtra", "district": "Chandrapur (Tadoba)", "detections": 38, "high_risk": 12, "active_incidents": 3},
        {"state": "Uttarakhand", "district": "Nainital (Corbett)", "detections": 42, "high_risk": 9, "active_incidents": 2},
        {"state": "Assam", "district": "Golaghat (Kaziranga)", "detections": 29, "high_risk": 7, "active_incidents": 1},
        {"state": "Maharashtra", "district": "Mumbai Suburban (SGNP)", "detections": 22, "high_risk": 8, "active_incidents": 2},
        {"state": "Karnataka", "district": "Mysuru (Nagarhole)", "detections": 31, "high_risk": 6, "active_incidents": 1}
    ]

    return {
        "success": True,
        "kpis": {
            "total_detections": total_detections,
            "high_risk_detections": high_risk_detections,
            "avg_confidence": round(avg_conf, 1),
            "avg_risk_score": round(avg_risk, 1)
        },
        "species_distribution": species_dist,
        "risk_distribution": risk_dist,
        "time_of_day_distribution": tod_dist,
        "district_breakdown": district_stats
    }

# --------------------------------------------------
# OFFLINE BATCH SYNC API
# --------------------------------------------------
class SyncRequest(BaseModel):
    queued_detections: List[Dict[str, Any]] = []
    queued_incidents: List[Dict[str, Any]] = []

@app.post("/api/sync")
def sync_offline_records(data: SyncRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    synced_det = []
    synced_inc = []

    for d in data.queued_detections:
        det_id = d.get("id") or f"DET-{uuid.uuid4().hex[:6].upper()}"
        cursor.execute("""
            INSERT OR REPLACE INTO detections (id, timestamp, species, class_name, confidence, bbox_json, count, lat, lng, accuracy, risk_score, risk_level, image_path, device_id, zone_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            det_id,
            d.get("timestamp", datetime.now().strftime("Today, %H:%M")),
            d.get("species", "Wildlife"),
            d.get("class_name", "wildlife"),
            d.get("confidence", 85.0),
            json.dumps(d.get("bbox", [])),
            d.get("count", 1),
            d.get("lat", 20.2667),
            d.get("lng", 79.4000),
            d.get("accuracy", 10.0),
            d.get("risk_score", 50.0),
            d.get("risk_level", "MEDIUM"),
            d.get("image_path", ""),
            d.get("device_id", "OFFLINE-CLIENT"),
            d.get("zone_id", "Z-04"),
            "SYNCED"
        ))
        synced_det.append(det_id)

    for inc in data.queued_incidents:
        inc_id = inc.get("id") or f"INC-{uuid.uuid4().hex[:6].upper()}"
        cursor.execute("""
            INSERT OR REPLACE INTO incidents (id, title, animal, confidence, lat, lng, timestamp, reporter, image_path, risk_level, status, assigned_officer, notes, timeline_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            inc_id,
            inc.get("title", f"Offline Incident: {inc.get('animal', 'Wildlife')}"),
            inc.get("animal", "Wildlife"),
            inc.get("confidence", 85.0),
            inc.get("lat", 20.2667),
            inc.get("lng", 79.4000),
            inc.get("timestamp", datetime.now().strftime("Today, %H:%M")),
            inc.get("reporter", "Field Worker (Offline)"),
            inc.get("image_path", ""),
            inc.get("risk_level", "HIGH"),
            "NEW",
            "Field Ranger",
            inc.get("notes", "Uploaded via offline queue synchronization"),
            json.dumps([{"stage": "Synced", "time": datetime.now().strftime("%H:%M"), "detail": "Synchronized from offline device."}])
        ))
        synced_inc.append(inc_id)

    conn.commit()
    conn.close()

    return {
        "success": True,
        "synced_detections": synced_det,
        "synced_incidents": synced_inc,
        "message": f"Successfully synchronized {len(synced_det)} detections and {len(synced_inc)} incidents."
    }

# --------------------------------------------------
# LIVE CAMERA REAL-TIME INFERENCE API
# --------------------------------------------------
@app.post("/api/detect/live-frame")
async def detect_live_frame(
    file: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    accuracy: Optional[float] = Form(5.0),
    device_id: Optional[str] = Form("BROWSER-WEBCAM"),
    camera_name: Optional[str] = Form("Live Device Camera")
):
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No frame received.")

    ds = get_detection_service()

    try:
        content = await file.read()
        nparr = np.frombuffer(content, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Failed to decode frame bytes.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Frame decode error: {e}")

    default_lat = lat if lat is not None else 20.2667
    default_lng = lng if lng is not None else 79.4000
    accuracy_val = accuracy if accuracy is not None else 5.0

    try:
        detections = ds.detect_frame(frame, conf_threshold=0.22, imgsz=640)
    except Exception as e:
        logger.error("[LIVE] Live frame inference error: %s", e)
        detections = []

    nearest_village, dist_to_village = find_nearest_village(default_lat, default_lng)
    village_id = nearest_village["id"] if nearest_village else "VIL-01"
    village_name = nearest_village["name"] if nearest_village else "Rajpur Village"
    dist_str = f"~{int(dist_to_village)} m from {village_name}"

    if len(detections) == 0:
        return {
            "success": True,
            "detected": False,
            "count": 0,
            "species": None,
            "message": "No Wildlife Detected",
            "detections": [],
            "nearest_village": village_name,
            "village_id": village_id,
            "distance_to_village_m": round(dist_to_village, 1),
            "distance_str": dist_str,
            "timestamp": datetime.now().strftime("Today, %H:%M")
        }

    detections.sort(key=lambda d: d["confidence"], reverse=True)
    primary = detections[0]
    species = primary["species"]
    confidence = primary["confidence"]
    count = len(detections)

    # Save frame snapshot for confirmed detection
    temp_id = uuid.uuid4().hex[:8]
    snapshot_filename = f"live_{temp_id}.jpg"
    snapshot_path = UPLOAD_DIR / snapshot_filename
    cv2.imwrite(str(snapshot_path), frame)

    geofence_result = check_geofences(default_lat, default_lng)
    risk_eval = calculate_wildlife_risk(
        species=species,
        confidence=confidence,
        count=count,
        lat=default_lat,
        lng=default_lng,
        distance_to_settlement_m=dist_to_village,
        geofence_multiplier=geofence_result.get("risk_multiplier", 1.2),
        recent_detections_count=1
    )

    det_id = f"DET-{uuid.uuid4().hex[:6].upper()}"
    now_display = datetime.now().strftime("Today, %H:%M")

    # Persist detection
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO detections (id, timestamp, species, class_name, confidence, bbox_json, count, lat, lng, accuracy, risk_score, risk_level, image_path, device_id, zone_id, status, source, village_id, village_name, verification_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'LIVE_CAMERA', ?, ?, 'AI_DETECTED')
    """, (
        det_id,
        now_display,
        species,
        primary["class_name"],
        confidence,
        json.dumps([d["bbox"] for d in detections]),
        count,
        default_lat,
        default_lng,
        accuracy_val,
        risk_eval["risk_score"],
        risk_eval["risk_level"],
        f"/uploads/{snapshot_filename}",
        device_id,
        "Z-04",
        "RECORDED",
        village_id,
        village_name
    ))
    conn.commit()
    conn.close()

    # Deduplication and incident handling
    incident_id, alert_id = deduplicate_or_create_incident(
        species=species,
        confidence=confidence,
        camera_id=device_id,
        camera_name=camera_name,
        village_id=village_id,
        village_name=village_name,
        lat=default_lat,
        lng=default_lng,
        risk_eval=risk_eval,
        dist_to_village=dist_to_village,
        snapshot_path=f"/uploads/{snapshot_filename}"
    )

    # Broadcast to live dashboard WebSockets if high risk
    if risk_eval["risk_level"] in ["HIGH", "CRITICAL"]:
        asyncio.create_task(manager.broadcast_live_event({
            "type": "NEW_ALERT",
            "alert_id": alert_id,
            "species": species,
            "confidence": confidence,
            "risk_level": risk_eval["risk_level"],
            "village_name": village_name,
            "distance_str": dist_str,
            "timestamp": now_display
        }))

    return {
        "success": True,
        "detected": True,
        "detection_id": det_id,
        "timestamp": now_display,
        "species": species,
        "confidence": confidence,
        "count": count,
        "detections": detections,
        "bbox": primary["bbox"],
        "lat": default_lat,
        "lng": default_lng,
        "nearest_village": village_name,
        "village_id": village_id,
        "distance_to_village_m": round(dist_to_village, 1),
        "distance_str": dist_str,
        "image_url": f"/uploads/{snapshot_filename}",
        "risk": risk_eval,
        "geofence": geofence_result,
        "incident_id": incident_id,
        "alert_id": alert_id
    }


# --------------------------------------------------
# CCTV & RTSP CAMERAS MANAGEMENT API
# --------------------------------------------------
@app.get("/api/cameras")
def list_cameras():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cameras ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()

    cameras = []
    for r in rows:
        c = dict(r)
        c["rtsp_url_masked"] = sanitize_rtsp_url(c.get("rtsp_url"))
        telem = get_camera_telemetry(c["id"])
        c["is_streaming"] = telem["is_streaming"]
        c["live_fps"] = telem["fps"]
        c["last_frame_seconds_ago"] = telem["last_frame_seconds_ago"]
        c["current_status"] = telem.get("status", c.get("status", "OFFLINE"))
        if telem.get("detection"):
            c["latest_detection"] = telem["detection"].get("species", c.get("latest_detection"))
            c["latest_confidence"] = telem["detection"].get("confidence", c.get("latest_confidence"))
        cameras.append(c)

    return {"success": True, "count": len(cameras), "cameras": cameras}


class CameraCreateRequest(BaseModel):
    name: str
    id: Optional[str] = None
    type: Optional[str] = "RTSP"
    rtsp_url: Optional[str] = ""
    username: Optional[str] = None
    password: Optional[str] = None
    ip_address: Optional[str] = None
    port: Optional[int] = 554
    location: Optional[str] = None
    lat: Optional[float] = 20.2667
    lng: Optional[float] = 79.4000
    village_id: Optional[str] = "VIL-01"
    district: Optional[str] = "Chandrapur"
    state: Optional[str] = "Maharashtra"
    forest_range: Optional[str] = "Tadoba Core Range"
    resolution: Optional[str] = "1080p"
    fps: Optional[int] = 15
    confidence_threshold: Optional[float] = 25.0
    alert_radius_m: Optional[float] = 1000.0


@app.post("/api/cameras")
def add_camera(cam: CameraCreateRequest):
    cam_id = cam.id if cam.id else f"CAM-{uuid.uuid4().hex[:6].upper()}"

    # Auto-construct RTSP URL if credentials and IP are provided separately
    effective_rtsp_url = cam.rtsp_url or ""
    if not effective_rtsp_url and cam.ip_address:
        creds = f"{cam.username}:{cam.password}@" if (cam.username and cam.password) else ""
        port_part = f":{cam.port}" if cam.port else ":554"
        effective_rtsp_url = f"rtsp://{creds}{cam.ip_address}{port_part}/live"

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO cameras (id, name, type, rtsp_url, lat, lng, forest_range, village_id, alert_radius_m, status, detection_active, username, ip_address, port, location, district, state, resolution, fps, confidence_threshold)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OFFLINE', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        cam_id,
        cam.name,
        cam.type,
        effective_rtsp_url,
        cam.lat,
        cam.lng,
        cam.forest_range,
        cam.village_id,
        cam.alert_radius_m,
        cam.username,
        cam.ip_address,
        cam.port,
        cam.location,
        cam.district,
        cam.state,
        cam.resolution,
        cam.fps,
        cam.confidence_threshold
    ))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "camera_id": cam_id,
        "name": cam.name,
        "rtsp_url_masked": sanitize_rtsp_url(effective_rtsp_url),
        "status": "OFFLINE",
        "message": "Camera registered successfully."
    }


class ConnectionTestRequest(BaseModel):
    rtsp_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    ip_address: Optional[str] = None
    port: Optional[int] = 554


@app.post("/api/cameras/test-connection")
def test_connection_endpoint(req: ConnectionTestRequest):
    url = req.rtsp_url
    if not url and req.ip_address:
        creds = f"{req.username}:{req.password}@" if (req.username and req.password) else ""
        port_part = f":{req.port}" if req.port else ":554"
        url = f"rtsp://{creds}{req.ip_address}{port_part}/live"

    res = test_rtsp_connection(url or "")
    return res


@app.post("/api/cameras/{cam_id}/test")
def test_existing_camera(cam_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cameras WHERE id = ?", (cam_id,))
    cam = cursor.fetchone()
    conn.close()

    if not cam:
        raise HTTPException(status_code=404, detail=f"Camera {cam_id} not found.")

    res = test_rtsp_connection(cam["rtsp_url"] or "")
    return res


@app.post("/api/cameras/{cam_id}/connect")
@app.post("/api/cameras/{cam_id}/start")
def start_camera(cam_id: str):
    success = start_camera_stream(cam_id)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE cameras SET status = 'ONLINE', detection_active = 1 WHERE id = ?", (cam_id,))
    conn.commit()
    conn.close()
    return {"success": success, "camera_id": cam_id, "status": "ONLINE"}


@app.post("/api/cameras/{cam_id}/disconnect")
@app.post("/api/cameras/{cam_id}/stop")
def stop_camera(cam_id: str):
    stop_camera_stream(cam_id)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE cameras SET status = 'OFFLINE', detection_active = 0 WHERE id = ?", (cam_id,))
    conn.commit()
    conn.close()
    return {"success": True, "camera_id": cam_id, "status": "OFFLINE"}


@app.get("/api/cameras/{cam_id}/status")
def get_camera_status_endpoint(cam_id: str):
    telem = get_camera_telemetry(cam_id)
    return telem


@app.delete("/api/cameras/{cam_id}")
def delete_camera(cam_id: str):
    stop_camera_stream(cam_id)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM cameras WHERE id = ?", (cam_id,))
    conn.commit()
    conn.close()
    return {"success": True, "deleted_camera_id": cam_id}


@app.get("/api/cameras/{cam_id}/frame")
def get_camera_frame(cam_id: str):
    frame_bytes = get_latest_frame_bytes(cam_id)
    if frame_bytes:
        return Response(
            content=frame_bytes,
            media_type="image/jpeg",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )

    # Fallback to sample image or generate dark tactical placeholder
    sample_files = list(SAMPLE_DIR.glob("*.jpg"))
    if sample_files:
        with open(sample_files[0], "rb") as f:
            return Response(content=f.read(), media_type="image/jpeg")

    img = np.zeros((360, 640, 3), dtype=np.uint8)
    cv2.putText(img, f"CAMERA {cam_id} CONNECTING...", (40, 180), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 220, 255), 2)
    _, encoded = cv2.imencode(".jpg", img)
    return Response(content=encoded.tobytes(), media_type="image/jpeg")


# --------------------------------------------------
# CROSS-DEVICE REMOTE CAMERA & WEBSOCKETS
# --------------------------------------------------
@app.get("/api/network-info")
def get_network_info():
    """Returns local LAN IP address so second devices (mobile phones) can discover and connect."""
    host_name = socket.gethostname()
    local_ip = "127.0.0.1"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        local_ip = socket.gethostbyname(host_name)

    return {
        "host_name": host_name,
        "lan_ip": local_ip,
        "port": int(os.getenv("PORT", "8000")),
        "frontend_port": int(os.getenv("FRONTEND_PORT", "5173")),
        "remote_cam_base_url": f"http://{local_ip}:{os.getenv('FRONTEND_PORT', '5173')}/?remote_cam=",
        "note": "LAN IP is for local network use only. Production uses HTTPS domain."
    }


@app.websocket("/ws/remote-camera/{session_id}")
async def ws_remote_camera(websocket: WebSocket, session_id: str):
    """
    Real-time cross-device streaming channel.
    - Phone streams camera frames with {"type": "frame", "image": base64}.
    - Backend runs YOLO via DetectionService and returns bboxes + risk.
    - Broadcasts to viewer dashboards for live multi-screen monitoring.
    """
    await manager.connect_remote(session_id, websocket)
    logger.info("[REMOTE-CAM] Client connected to session %s", session_id)
    ds = get_detection_service()

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "frame")

            if msg_type == "frame":
                img_b64 = data.get("image", "")
                if "," in img_b64:
                    img_b64 = img_b64.split(",", 1)[1]

                img_bytes = base64.b64decode(img_b64)
                np_arr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

                if frame is not None:
                    # Run YOLO inference
                    detections = ds.detect_frame(frame, conf_threshold=0.22, imgsz=640)

                    risk_eval = None
                    if detections:
                        primary = detections[0]
                        risk_eval = calculate_wildlife_risk(
                            species=primary["species"],
                            confidence=primary["confidence"],
                            count=len(detections),
                            lat=data.get("lat", 20.2667),
                            lng=data.get("lng", 79.4000)
                        )

                    now_time = datetime.now().strftime("%H:%M:%S")
                    response_payload = {
                        "type": "telemetry",
                        "session_id": session_id,
                        "timestamp": now_time,
                        "detections": detections,
                        "risk": risk_eval,
                        "frame_preview": data.get("image", "")
                    }

                    # Echo back to phone and broadcast to viewer laptop
                    await websocket.send_json(response_payload)
                    await manager.broadcast_remote(session_id, response_payload, sender=websocket)

                    # If high-threat animal detected, trigger alert and global feed broadcast
                    if risk_eval and risk_eval.get("risk_level") in ["HIGH", "CRITICAL"]:
                        await manager.broadcast_live_event({
                            "type": "ALERT",
                            "species": detections[0]["species"],
                            "confidence": detections[0]["confidence"],
                            "risk_level": risk_eval["risk_level"],
                            "camera_id": session_id,
                            "timestamp": now_time
                        })
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong", "session_id": session_id})
    except WebSocketDisconnect:
        await manager.disconnect_remote(session_id, websocket)
        logger.info("[REMOTE-CAM] Client disconnected from session %s", session_id)
    except Exception as e:
        logger.error("[REMOTE-CAM] WebSocket error in %s: %s", session_id, e)
        await manager.disconnect_remote(session_id, websocket)


@app.websocket("/ws/live-feed")
async def ws_live_feed(websocket: WebSocket):
    """Subscribes to global wildlife alerts and detections feed."""
    await manager.connect_live(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await manager.disconnect_live(websocket)
    except Exception:
        await manager.disconnect_live(websocket)


@app.websocket("/ws/camera/{camera_id}")
async def ws_camera_telemetry(websocket: WebSocket, camera_id: str):
    """Pushes real-time CCTV telemetry and detection updates."""
    await websocket.accept()
    try:
        while True:
            telem = get_camera_telemetry(camera_id)
            await websocket.send_json(telem)
            await asyncio.sleep(0.5)
    except Exception:
        pass


# --------------------------------------------------
# NOTIFICATIONS AUDIT API
# --------------------------------------------------
@app.get("/api/notifications")
def list_notifications():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM notifications ORDER BY ROWID DESC LIMIT 50")
    rows = cursor.fetchall()
    conn.close()
    return {"success": True, "notifications": [dict(r) for r in rows]}


class NotificationTestRequest(BaseModel):
    species: str = "Leopard"
    risk_level: str = "HIGH"
    village_name: str = "Rajpur Village"
    channels: Optional[List[str]] = ["SMS", "PUSH", "SIREN", "EMAIL"]


@app.post("/api/notifications/test")
def test_notification_dispatch(req: NotificationTestRequest):
    results = NotificationService.dispatch_alert(
        alert_id=f"TEST-{uuid.uuid4().hex[:6].upper()}",
        species=req.species,
        risk_level=req.risk_level,
        risk_score=88.5,
        village_name=req.village_name,
        distance_str="~450m from village edge",
        recommendation="Stay indoors and notify forest rangers immediately.",
        lat=20.2667,
        lng=79.4000,
        channels=req.channels
    )
    return {"success": True, "dispatch_results": results}

# --------------------------------------------------
# VILLAGES & GEOFENCING API
# --------------------------------------------------
@app.get("/api/villages")
def list_villages():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM villages WHERE is_active = 1 ORDER BY id ASC")
    rows = cursor.fetchall()

    villages = []
    for r in rows:
        v = dict(r)
        cursor.execute("SELECT COUNT(*) FROM alerts WHERE village_id = ? AND status != 'RESOLVED'", (v["id"],))
        v["active_alerts_count"] = cursor.fetchone()[0]
        villages.append(v)

    conn.close()
    return {"success": True, "count": len(villages), "villages": villages}

class VillageCreateRequest(BaseModel):
    name: str
    district: Optional[str] = "Chandrapur"
    state: Optional[str] = "Maharashtra"
    lat: float
    lng: float
    forest_range: Optional[str] = "Buffer Range"
    alert_radius_m: Optional[float] = 1500.0
    registered_users: Optional[int] = 120
    emergency_contact: Optional[str] = "+91 94221 00000"

@app.post("/api/villages")
def add_village(vil: VillageCreateRequest):
    vil_id = f"VIL-{uuid.uuid4().hex[:6].upper()}"
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO villages (id, name, district, state, lat, lng, forest_range, alert_radius_m, registered_users, emergency_contact, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    """, (
        vil_id,
        vil.name,
        vil.district,
        vil.state,
        vil.lat,
        vil.lng,
        vil.forest_range,
        vil.alert_radius_m,
        vil.registered_users,
        vil.emergency_contact
    ))
    conn.commit()
    conn.close()
    return {"success": True, "village_id": vil_id, "name": vil.name}

@app.get("/api/villager/status")
def get_villager_status(village_id: Optional[str] = Query("VIL-01")):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM villages WHERE id = ?", (village_id,))
    vil_row = cursor.fetchone()

    if not vil_row:
        cursor.execute("SELECT * FROM villages WHERE is_active = 1 LIMIT 1")
        vil_row = cursor.fetchone()

    if not vil_row:
        conn.close()
        raise HTTPException(status_code=404, detail="No village configured.")

    village = dict(vil_row)

    # Check for active alert
    cursor.execute("""
        SELECT * FROM alerts
        WHERE village_id = ? AND status != 'RESOLVED'
        ORDER BY ROWID DESC LIMIT 1
    """, (village["id"],))
    alert_row = cursor.fetchone()

    # Check active incident
    cursor.execute("""
        SELECT * FROM incidents
        WHERE village_id = ? AND status != 'RESOLVED'
        ORDER BY ROWID DESC LIMIT 1
    """, (village["id"],))
    inc_row = cursor.fetchone()

    conn.close()

    if alert_row:
        alert = dict(alert_row)
        dist = alert.get("distance_to_settlement") or 800.0
        animal = alert.get("species", "Apex Predator")
        conf = alert.get("confidence", 88.0)
        time_str = alert.get("timestamp", "Recently")
        threat_level = "DANGER" if dist <= 1000 else "WARNING"
        dist_str = f"~{int(dist)} m from {village['name']}"
    elif inc_row:
        inc = dict(inc_row)
        dist = 850.0
        animal = inc.get("animal", "Wildlife")
        conf = inc.get("confidence", 85.0)
        time_str = inc.get("timestamp", "Recently")
        threat_level = "WARNING"
        dist_str = f"~{int(dist)} m from {village['name']}"
    else:
        dist = 3200.0
        animal = None
        conf = 0.0
        time_str = None
        threat_level = "SAFE"
        dist_str = f"No active threats within {int(village['alert_radius_m'])} m"

    guidance = []
    if animal in ["Tiger", "Lion", "Leopard"]:
        guidance = [
            "Stay indoors after dusk and secure livestock in predator-proof enclosures.",
            "Avoid forest fringe routes, agricultural borders, and open water canals.",
            "Travel in groups of 3 or more during morning and twilight hours.",
            "Carry a stick, torch, and whistle when outdoors.",
            "Immediately notify the Forest Beat Guard if pugmarks or scat are spotted."
        ]
    elif animal in ["Asian Elephant", "elephant"]:
        guidance = [
            "Do NOT block known elephant transit corridors or water points.",
            "Extinguish open cooking fires and avoid carrying fresh paddy/bananas.",
            "Maintain at least 100 meters distance and never use camera flashlights.",
            "Notify the Quick Response Team immediately."
        ]
    elif animal in ["Wild Boar", "wildboar"]:
        guidance = [
            "Secure vegetable crops and boundaries with solar fencing.",
            "Avoid confronting aggressive boars near thick brush."
        ]
    else:
        guidance = [
            "Area currently safe. Continue regular village activities.",
            "Report any suspicious wildlife movements through the sighting portal.",
            "Keep emergency contact numbers handy."
        ]

    return {
        "success": True,
        "village": village,
        "threat_level": threat_level,
        "has_active_threat": threat_level in ["DANGER", "WARNING"],
        "animal": animal,
        "confidence": conf,
        "detected_time": time_str,
        "distance_m": round(dist, 1),
        "distance_str": dist_str,
        "guidance": guidance,
        "emergency_contacts": [
            {"label": "Forest Range Control", "number": "1800-233-0000", "desc": "Toll-free 24x7 Emergency Line"},
            {"label": "Quick Response Team (QRT)", "number": "+91 94221 11223", "desc": "Rapid Animal Dispersion Squad"},
            {"label": "Gram Panchayat Contact", "number": village.get("emergency_contact", "+91 94221 00000"), "desc": f"{village['name']} Village Mukhiya"}
        ]
    }

# --------------------------------------------------
# ALERT VERIFICATION & INCIDENT LIFECYCLE API
# --------------------------------------------------
class AlertVerifyRequest(BaseModel):
    status: str # CONFIRMED, FALSE_POSITIVE, INVESTIGATING
    officer_name: Optional[str] = "Forest Range Officer"
    notes: Optional[str] = ""

@app.post("/api/alerts/{alert_id}/verify")
def verify_alert(alert_id: str, req: AlertVerifyRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
    alert_row = cursor.fetchone()
    if not alert_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Alert not found.")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    now_display = datetime.now().strftime("Today, %H:%M")

    cursor.execute("""
        UPDATE alerts
        SET verification_status = ?, acknowledged_by = ?, acknowledged_at = ?, status = ?
        WHERE id = ?
    """, (
        req.status,
        req.officer_name,
        now_display,
        req.status,
        alert_id
    ))

    # If linked to incident, update incident too
    alert_dict = dict(alert_row)
    inc_id = alert_dict.get("dedup_incident_id")
    if inc_id:
        cursor.execute("SELECT timeline_json FROM incidents WHERE id = ?", (inc_id,))
        inc_row = cursor.fetchone()
        if inc_row:
            timeline = json.loads(inc_row[0]) if inc_row[0] else []
            timeline.append({
                "stage": f"Alert {req.status}",
                "time": datetime.now().strftime("%H:%M"),
                "detail": f"Officer {req.officer_name}: {req.notes or 'Verification status updated'}"
            })
            cursor.execute("""
                UPDATE incidents
                SET verification_status = ?, timeline_json = ?
                WHERE id = ?
            """, (req.status, json.dumps(timeline), inc_id))

    cursor.execute("""
        INSERT INTO audit_logs (timestamp, username, action, details)
        VALUES (?, ?, ?, ?)
    """, (
        now_str,
        req.officer_name,
        "ALERT_VERIFIED",
        f"Alert {alert_id} verified as {req.status}. Notes: {req.notes}"
    ))

    conn.commit()
    conn.close()
    return {"success": True, "alert_id": alert_id, "verification_status": req.status}

class IncidentLifecycleRequest(BaseModel):
    stage: str # ACKNOWLEDGED, INVESTIGATING, CONFIRMED, RESOLVED
    officer_name: Optional[str] = "Forest Beat Guard"
    notes: Optional[str] = ""
    photo_path: Optional[str] = ""

@app.post("/api/incidents/{inc_id}/lifecycle")
def update_incident_lifecycle(inc_id: str, req: IncidentLifecycleRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM incidents WHERE id = ?", (inc_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Incident not found.")

    timeline = json.loads(row["timeline_json"]) if row["timeline_json"] else []
    timeline.append({
        "stage": req.stage,
        "time": datetime.now().strftime("%H:%M"),
        "detail": f"{req.officer_name}: {req.notes or req.stage}"
    })

    updates = ["status = ?", "assigned_officer = ?", "timeline_json = ?"]
    params = [req.stage, req.officer_name, json.dumps(timeline)]

    if req.notes:
        updates.append("guard_notes = ?")
        params.append(req.notes)
    if req.photo_path:
        updates.append("guard_photo_path = ?")
        params.append(req.photo_path)
    if req.stage == "RESOLVED":
        updates.append("resolution = ?")
        params.append(req.notes or "Threat driven back to deep reserve.")

    params.append(inc_id)
    cursor.execute(f"UPDATE incidents SET {', '.join(updates)} WHERE id = ?", params)

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT INTO audit_logs (timestamp, username, action, details)
        VALUES (?, ?, ?, ?)
    """, (
        now_str,
        req.officer_name,
        f"INCIDENT_{req.stage}",
        f"Incident {inc_id} updated to {req.stage}. Officer notes: {req.notes}"
    ))

    conn.commit()
    conn.close()
    return {"success": True, "incident_id": inc_id, "status": req.stage}

# --------------------------------------------------
# CITIZEN WILDLIFE SIGHTING REPORTS API
# --------------------------------------------------
@app.post("/api/reports/wildlife")
async def submit_wildlife_report(
    reporter_name: str = Form(...),
    reporter_contact: Optional[str] = Form(""),
    animal_reported: str = Form(...),
    lat: Optional[float] = Form(20.2667),
    lng: Optional[float] = Form(79.4000),
    village_id: Optional[str] = Form("VIL-01"),
    description: Optional[str] = Form(""),
    photo: Optional[UploadFile] = File(None)
):
    rep_id = f"REP-{uuid.uuid4().hex[:6].upper()}"
    photo_url = ""
    ai_species = None
    ai_conf = None
    status = "PENDING_REVIEW"

    # Save photo and run YOLO AI verification if photo provided
    if photo and photo.filename:
        ext = Path(photo.filename).suffix.lower()
        fname = f"report_{uuid.uuid4().hex[:8]}{ext}"
        fpath = UPLOAD_DIR / fname
        with open(fpath, "wb") as buf:
            shutil.copyfileobj(photo.file, buf)
        photo_url = f"/uploads/{fname}"

        # Run YOLO with strict 15-animal filter
        ds = get_detection_service()
        try:
            report_dets = ds.detect_image(fpath, conf_threshold=0.25)
            if report_dets:
                ai_species = report_dets[0]["species"]
                ai_conf = report_dets[0]["confidence"]
                status = "AI_VERIFIED"
        except Exception as e:
            logger.warning("AI verification on report photo failed: %s", e)

    # Village details
    nearest_village, _ = find_nearest_village(lat, lng)
    village_name = nearest_village["name"] if nearest_village else "Rajpur Village"

    now_display = datetime.now().strftime("Today, %H:%M")
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO wildlife_reports (id, reporter_name, reporter_contact, animal_reported, lat, lng, village_id, village_name, photo_path, description, ai_verified_species, ai_confidence, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        rep_id,
        reporter_name,
        reporter_contact,
        animal_reported,
        lat,
        lng,
        village_id or (nearest_village["id"] if nearest_village else "VIL-01"),
        village_name,
        photo_url,
        description,
        ai_species,
        ai_conf,
        status,
        now_display
    ))

    cursor.execute("""
        INSERT INTO audit_logs (timestamp, username, action, details)
        VALUES (?, ?, ?, ?)
    """, (
        now_str,
        reporter_name,
        "REPORT_SUBMITTED",
        f"Citizen report {rep_id} submitted for {animal_reported} near {village_name} (AI Status: {status})"
    ))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "report_id": rep_id,
        "status": status,
        "animal_reported": animal_reported,
        "ai_verified_species": ai_species,
        "ai_confidence": ai_conf,
        "village_name": village_name,
        "photo_url": photo_url,
        "message": f"Thank you {reporter_name}! Your sighting report has been submitted to the Forest Department."
    }

@app.get("/api/reports/wildlife")
def list_wildlife_reports(status: Optional[str] = Query(None)):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM wildlife_reports WHERE 1=1"
    params = []
    if status and status != "all":
        query += " AND status = ?"
        params.append(status)
    query += " ORDER BY ROWID DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return {"success": True, "reports": [dict(r) for r in rows]}

class ReportVerifyRequest(BaseModel):
    status: str # VERIFIED, REJECTED
    officer_notes: Optional[str] = ""

@app.post("/api/reports/{report_id}/verify")
def verify_wildlife_report(report_id: str, req: ReportVerifyRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE wildlife_reports
        SET status = ?, officer_notes = ?
        WHERE id = ?
    """, (req.status, req.officer_notes, report_id))
    conn.commit()
    conn.close()
    return {"success": True, "report_id": report_id, "status": req.status}

# --------------------------------------------------
# SYSTEM SETTINGS API
# --------------------------------------------------
@app.get("/api/settings")
def get_system_settings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM system_settings")
    rows = cursor.fetchall()
    conn.close()
    settings = {r["key"]: r["value"] for r in rows}
    return {"success": True, "settings": settings}

class SettingsUpdateRequest(BaseModel):
    settings: Dict[str, Any]

@app.post("/api/settings")
def update_system_settings(req: SettingsUpdateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    for k, v in req.settings.items():
        cursor.execute(
            "INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)",
            (k, str(v))
        )
    conn.commit()
    conn.close()
    return {"success": True, "message": "System settings updated successfully"}


# --------------------------------------------------
# ALERT WEBSOCKET & BROADCAST HUB
# --------------------------------------------------
class AlertBroadcastHub:
    """Manages live community smartphone devices for synchronized audio/visual sirens."""
    def __init__(self):
        self.connected_clients: List[WebSocket] = []
        self.device_info: Dict[WebSocket, Dict[str, Any]] = {}
        self.recent_alerts: List[Dict[str, Any]] = []
        self._lock = asyncio.Lock()

    async def register(self, ws: WebSocket, device_name: str):
        await ws.accept()
        async with self._lock:
            self.connected_clients.append(ws)
            self.device_info[ws] = {
                "id": f"DEV-{uuid.uuid4().hex[:6].upper()}",
                "name": device_name or "Field Alert Device",
                "connected_at": datetime.now().strftime("%H:%M:%S"),
                "status": "ONLINE"
            }
        try:
            await ws.send_json({
                "type": "INIT_STATE",
                "recent_alerts": self.recent_alerts[-10:]
            })
        except Exception:
            pass
        await self.broadcast_device_list()

    async def unregister(self, ws: WebSocket):
        async with self._lock:
            if ws in self.connected_clients:
                self.connected_clients.remove(ws)
            self.device_info.pop(ws, None)
        await self.broadcast_device_list()

    async def broadcast_device_list(self):
        devices = list(self.device_info.values())
        msg = {
            "type": "DEVICE_LIST_UPDATE",
            "devices": devices,
            "online_count": len(devices)
        }
        await self.broadcast(msg)

    async def broadcast(self, message: dict):
        dead = []
        for ws in list(self.connected_clients):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    if ws in self.connected_clients:
                        self.connected_clients.remove(ws)
                    self.device_info.pop(ws, None)

    def record_alert(self, alert_data: dict):
        self.recent_alerts.append(alert_data)
        if len(self.recent_alerts) > 50:
            self.recent_alerts = self.recent_alerts[-50:]

alert_hub = AlertBroadcastHub()


@app.websocket("/ws/alerts")
async def ws_alerts(ws: WebSocket):
    device_name = "Field Alert Device"
    try:
        await alert_hub.register(ws, device_name)
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type", "")
            if msg_type == "REGISTER_DEVICE":
                new_name = data.get("device_name", device_name)
                if ws in alert_hub.device_info:
                    alert_hub.device_info[ws]["name"] = new_name
                    await alert_hub.broadcast_device_list()
            elif msg_type == "TEST_ALERT":
                event_id = f"TEST-{uuid.uuid4().hex[:6].upper()}"
                alert_data = {
                    "type": "TEST_ALERT",
                    "event_id": event_id,
                    "alert_id": event_id,
                    "animal": "Bengal Tiger",
                    "species": "Tiger",
                    "confidence": 97.5,
                    "risk_level": "HIGH",
                    "risk_score": 85.0,
                    "location": {"village_name": "Rajpur Settlement Corridor", "lat": 20.2667, "lng": 79.4000},
                    "timestamp": datetime.now().strftime("%H:%M:%S"),
                    "source": data.get("device_name", "Field Device"),
                    "message": "TEST WILDLIFE ALERT: Bengal Tiger movement detected near perimeter."
                }
                alert_hub.record_alert(alert_data)
                await alert_hub.broadcast(alert_data)
                try:
                    FCMService.send_wildlife_alert(
                        animal=alert_data["animal"],
                        confidence=alert_data["confidence"],
                        risk_level=alert_data["risk_level"],
                        location=alert_data["location"],
                        event_id=alert_data["event_id"],
                        source="TEST_ALERT"
                    )
                except Exception as fcm_err:
                    logger.warning("FCM test alert warning: %s", fcm_err)
    except WebSocketDisconnect:
        await alert_hub.unregister(ws)
    except Exception as e:
        logger.warning("WebSocket alert disconnect: %s", e)
        await alert_hub.unregister(ws)


@app.get("/api/alerts/devices")
def get_alert_devices():
    devices = list(alert_hub.device_info.values())
    return {
        "success": True,
        "devices": devices,
        "online_count": len(devices)
    }


@app.get("/api/alerts/history")
def get_alert_history():
    return {
        "success": True,
        "alerts": list(reversed(alert_hub.recent_alerts))
    }


class SimulateAlertRequest(BaseModel):
    animal: str
    confidence: Optional[float] = 94.0


@app.post("/api/alerts/simulate")
async def simulate_alert(req: SimulateAlertRequest):
    risk_map = {
        "Asian Elephant": ("HIGH", 88.0),
        "Elephant": ("HIGH", 88.0),
        "Tiger": ("HIGH", 92.0),
        "Bengal Tiger": ("HIGH", 92.0),
        "Leopard": ("HIGH", 85.0),
        "Wild Boar": ("MEDIUM", 62.0),
        "Deer": ("LOW", 28.0),
        "Spotted Deer": ("LOW", 28.0)
    }
    matched_risk = "HIGH"
    matched_score = 80.0
    for k, (lvl, sc) in risk_map.items():
        if k.lower() in req.animal.lower():
            matched_risk, matched_score = lvl, sc
            break

    event_id = f"SIM-{uuid.uuid4().hex[:6].upper()}"
    alert_data = {
        "type": "WILDLIFE_ALERT",
        "event_id": event_id,
        "alert_id": event_id,
        "animal": req.animal,
        "species": req.animal,
        "confidence": req.confidence,
        "risk_level": matched_risk,
        "risk_score": matched_score,
        "location": {"village_name": "Corridor Sector 4", "lat": 20.2667, "lng": 79.4000},
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "source": "SIMULATION_MODE",
        "is_simulation": True,
        "message": f"≡ƒÜ¿ [DEMO] {req.animal.upper()} identified in monitoring sector!"
    }
    alert_hub.record_alert(alert_data)
    await alert_hub.broadcast(alert_data)
    try:
        FCMService.send_wildlife_alert(
            animal=req.animal,
            confidence=req.confidence,
            risk_level=matched_risk,
            location=alert_data["location"],
            event_id=event_id,
            source="SIMULATION"
        )
    except Exception as e:
        logger.warning("FCM simulate dispatch warning: %s", e)

    return {"success": True, "alert": alert_data}


class TestAlertRequest(BaseModel):
    device_name: Optional[str] = "Command Center"


@app.post("/api/alerts/test")
async def trigger_test_alert(req: TestAlertRequest):
    event_id = f"TEST-{uuid.uuid4().hex[:6].upper()}"
    alert_data = {
        "type": "TEST_ALERT",
        "event_id": event_id,
        "alert_id": event_id,
        "animal": "Bengal Tiger",
        "species": "Tiger",
        "confidence": 98.4,
        "risk_level": "HIGH",
        "risk_score": 88.0,
        "location": {"village_name": "Rajpur Settlement Corridor", "lat": 20.2667, "lng": 79.4000},
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "source": req.device_name,
        "message": "≡ƒÜ¿ KAVACH LIVE BROADCAST TEST: Animal detected near perimeter boundary."
    }
    alert_hub.record_alert(alert_data)
    await alert_hub.broadcast(alert_data)
    try:
        FCMService.send_wildlife_alert(
            animal="Bengal Tiger",
            confidence=98.4,
            risk_level="HIGH",
            location=alert_data["location"],
            event_id=event_id,
            source="SYSTEM_TEST"
        )
    except Exception as e:
        logger.warning("FCM test alert warning: %s", e)

    return {"success": True, "alert": alert_data}


@app.post("/api/alerts/test-siren")
async def trigger_test_siren(req: TestAlertRequest):
    msg = {
        "type": "TEST_SIREN",
        "source": req.device_name,
        "timestamp": datetime.now().strftime("%H:%M:%S")
    }
    await alert_hub.broadcast(msg)
    return {"success": True, "message": "Test siren broadcast dispatched."}


# --------------------------------------------------
# FIREBASE CLOUD MESSAGING (FCM) ENDPOINTS
# --------------------------------------------------
@app.get("/api/fcm/status")
def get_fcm_status():
    return FCMService.get_status()


class TestFcmRequest(BaseModel):
    title: Optional[str] = "TEST FCM PUSH"
    body: Optional[str] = "KAVACH Push Notification Test: Background alert channel active"
    animal: Optional[str] = "SYSTEM TEST"
    risk_level: Optional[str] = "LOW"
    confidence: Optional[float] = 99.0


@app.post("/api/fcm/test")
def send_test_fcm_push(req: TestFcmRequest):
    return FCMService.send_test_push(
        title=req.title,
        body=req.body,
        animal=req.animal,
        risk_level=req.risk_level,
        confidence=req.confidence
    )


class RegisterFcmTokenRequest(BaseModel):
    token: str
    device_id: Optional[str] = None
    device_name: Optional[str] = None
    role: Optional[str] = None
    platform: Optional[str] = None
    user_agent: Optional[str] = None


@app.post("/api/fcm/register")
def register_fcm_token(req: RegisterFcmTokenRequest):
    ok = save_fcm_token(
        token=req.token,
        device_id=req.device_id,
        device_name=req.device_name,
        role=req.role,
        platform=req.platform,
        user_agent=req.user_agent
    )
    return {
        "success": ok,
        "message": "Token registered successfully" if ok else "Invalid token"
    }


# --------------------------------------------------
# ML RISK PREDICTION & GIS INTEGRATION ENDPOINT (/risk)
# --------------------------------------------------
class RiskRequest(BaseModel):
    species: str
    yolo_confidence: float
    recent_detections: int
    historical_conflicts: int
    settlement_proximity: int
    temporal_pattern: int
    environmental_context: int
    spatial_relationship: int
    zone_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


@app.post("/risk")
def predict_risk(data: RiskRequest):
    if risk_model is None:
        res = calculate_wildlife_risk(
            species=data.species,
            confidence=data.yolo_confidence,
            lat=data.lat,
            lng=data.lng,
            recent_detections_count=data.recent_detections
        )
        return {
            "success": True,
            "risk_score": res.get("risk_score", 50.0),
            "risk_level": res.get("risk_level", "MEDIUM")
        }

    input_data = pd.DataFrame([{
        "species": data.species,
        "yolo_confidence": data.yolo_confidence,
        "recent_detections": data.recent_detections,
        "historical_conflicts": data.historical_conflicts,
        "settlement_proximity": data.settlement_proximity,
        "temporal_pattern": data.temporal_pattern,
        "environmental_context": data.environmental_context,
        "spatial_relationship": data.spatial_relationship
    }])

    try:
        prediction = risk_model.predict(input_data)[0]
    except Exception as e:
        logger.exception("Risk model prediction failed")
        raise HTTPException(
            status_code=422,
            detail=f"Could not compute risk score for this input: {e}",
        )

    # Model returns risk_level string (LOW/MEDIUM/HIGH/CRITICAL) or numeric score
    if isinstance(prediction, str):
        risk_level = prediction.upper().strip()
        score_map = {"LOW": 20.0, "MEDIUM": 55.0, "HIGH": 78.0, "CRITICAL": 92.0}
        risk_score = score_map.get(risk_level, 50.0)
    else:
        risk_score = float(max(0, min(100, prediction)))
        if risk_score < 40:
            risk_level = "LOW"
        elif risk_score < 70:
            risk_level = "MEDIUM"
        elif risk_score < 85:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

    response = {
        "success": True,
        "risk_score": round(risk_score, 2),
        "risk_level": risk_level
    }

    if KNOWN_RISK_SPECIES is not None and data.species not in KNOWN_RISK_SPECIES:
        response["warning"] = (
            f"Species '{data.species}' was not in the risk model's training data ({sorted(KNOWN_RISK_SPECIES)})."
        )

    if data.zone_code or (data.lat is not None and data.lng is not None):
        try:
            from gis.database import is_available, get_connection, dict_cursor
            from gis.spatial import resolve_zone_code_to_point

            lat, lng = data.lat, data.lng
            if lat is None or lng is None:
                if is_available():
                    conn = get_connection()
                    try:
                        with dict_cursor(conn) as cur:
                            cam = resolve_zone_code_to_point(cur, data.zone_code)
                    finally:
                        conn.close()
                    if cam:
                        lat, lng = cam["lat"], cam["lng"]

            if lat is not None and lng is not None and is_available() and record_detection:
                gis_result = record_detection(
                    species=data.species,
                    confidence=data.yolo_confidence,
                    risk_score=risk_score,
                    lat=lat,
                    lng=lng,
                    zone_code=data.zone_code,
                )
                response["gis"] = gis_result
        except Exception as e:
            response["gis_error"] = str(e)

    return response


# --------------------------------------------------
# AI WILDLIFE SCANNING / GPS RADAR ENDPOINTS
# --------------------------------------------------
_cleared_target_ids = set()

@app.get("/api/scanning-map/active-targets")
def get_scanning_map_active_targets(
    radius_m: float = Query(500.0, ge=10, le=100000),
    inner_m: float = Query(100.0, ge=5, le=20000),
    middle_m: float = Query(300.0, ge=10, le=50000),
    limit: int = Query(40, ge=1, le=100),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None)
):
    """
    Returns real wildlife detections from database, calculating distance from the
    monitoring center / user GPS location and determining perimeter radius containment.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM detections ORDER BY ROWID DESC LIMIT 100")
    rows = cursor.fetchall()
    conn.close()

    # Base coordinates: user GPS or Tadoba Core baseline
    ref_lat = lat if lat is not None else 20.2667
    ref_lng = lng if lng is not None else 79.4000

    targets = []

    for r in rows:
        d = dict(r)
        tid = d.get("id")
        if tid in _cleared_target_ids:
            continue

        sp = d.get("species") or d.get("class_name") or "Unknown"
        t_lat = d.get("lat")
        t_lng = d.get("lng")
        if t_lat is None or t_lng is None:
            continue

        # Calculate real distance in meters
        dist_m = haversine_distance_m(ref_lat, ref_lng, float(t_lat), float(t_lng))
        is_inside = dist_m <= radius_m

        if dist_m < 1000:
            dist_str = f"{int(dist_m)}m"
        else:
            dist_str = f"{dist_m / 1000:.1f}km"

        targets.append({
            "id": tid,
            "species": sp,
            "confidence": round(float(d.get("confidence") or 85.0), 1),
            "risk_level": d.get("risk_level") or "LOW",
            "lat": float(t_lat),
            "lng": float(t_lng),
            "distance_m": round(dist_m, 1),
            "distance_str": dist_str,
            "is_inside_radius": is_inside,
            "timestamp": d.get("timestamp") or "Recently",
            "camera_name": d.get("camera_name") or d.get("source") or "Surveillance Cam",
            "source": d.get("source") or "Detection System"
        })

        if len(targets) >= limit:
            break

    return {
        "success": True,
        "count": len(targets),
        "monitoring_coords": {"lat": ref_lat, "lng": ref_lng},
        "radius_m": radius_m,
        "targets": targets
    }


@app.post("/api/scanning-map/clear-targets")
def clear_scanning_map_targets():
    """Temporarily clears radar target markers."""
    global _cleared_target_ids
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM detections")
    for r in cursor.fetchall():
        _cleared_target_ids.add(r[0])
    conn.close()
    return {"success": True, "message": "Radar markers cleared"}

# --------------------------------------------------
# TELEMETRY & ESCALATION ENDPOINTS (DetectionHistoryView)
# --------------------------------------------------
@app.get("/api/telemetry")
def get_telemetry_events(limit: int = 250):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM detections ORDER BY id DESC LIMIT ?", (limit,))
    rows = [dict(r) for r in cursor.fetchall()]
    cursor.execute("SELECT COUNT(*) FROM detections")
    total_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM detections WHERE risk_level IN ('HIGH', 'CRITICAL')")
    high_risk_count = cursor.fetchone()[0]
    conn.close()
    return {
        "success": True,
        "telemetry": rows,
        "detections": rows,
        "total_count": total_count,
        "high_risk_count": high_risk_count
    }

@app.post("/api/detections/{det_id}/escalate")
async def escalate_detection(det_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM detections WHERE id = ?", (det_id,))
    det = cursor.fetchone()
    if not det:
        conn.close()
        raise HTTPException(status_code=404, detail="Detection not found")

    det_dict = dict(det)
    species = det_dict.get("species", "Wildlife")
    village_name = det_dict.get("village_name", "Monitored Zone")
    confidence = det_dict.get("confidence", 90.0)
    risk_level = det_dict.get("risk_level", "HIGH")
    now_display = datetime.now().strftime("Today, %H:%M")

    inc_id = f"INC-{uuid.uuid4().hex[:6].upper()}"
    inc_code = f"KVC-{uuid.uuid4().hex[:4].upper()}"
    initial_timeline = [
        {"stage": "Detection", "time": datetime.now().strftime("%H:%M"), "detail": f"Telemetry observation: {species} ({confidence}% conf)."},
        {"stage": "Manual Escalation", "time": datetime.now().strftime("%H:%M"), "detail": f"Operator escalated detection to incident {inc_code}."}
    ]
    cursor.execute("""
        INSERT INTO incidents (id, incident_code, title, animal, confidence, lat, lng, timestamp, reporter, image_path, risk_level, status, assigned_officer, notes, timeline_json, village_id, village_name, first_detected, last_detected, detection_count, verification_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Operator Escalation', ?, ?, 'DISPATCHED', 'Pending Assignment', 'Operator escalated detection event', ?, ?, ?, ?, ?, 1, 'VERIFIED')
    """, (
        inc_id,
        inc_code,
        f"🚨 Escalated Incident: {species} near {village_name}",
        species,
        confidence,
        det_dict.get("lat", 20.2667),
        det_dict.get("lng", 79.4000),
        now_display,
        det_dict.get("image_path", ""),
        risk_level,
        json.dumps(initial_timeline),
        det_dict.get("village_id", "VIL-01"),
        village_name,
        now_display,
        now_display
    ))
    cursor.execute("UPDATE detections SET incident_id = ?, incident_code = ? WHERE id = ?", (inc_id, inc_code, det_id))
    conn.commit()
    conn.close()

    await manager.broadcast_live_event({
        "type": "INCIDENT_ESCALATED",
        "detection_id": det_id,
        "incident_id": inc_id,
        "incident_code": inc_code
    })

    return {
        "success": True,
        "incident_id": inc_id,
        "incident_code": inc_code,
        "message": f"Escalated to {inc_code}"
    }

# --------------------------------------------------
# 4-CAMERA LIVE SURVEILLANCE GRID ENDPOINTS
# Tested by backend/test_live_surveillance_endpoints.py
# Used by src/components/KavachLiveSurveillance.jsx
# --------------------------------------------------
from temporal_safety import get_stream_tracker, BoundingBoxQualityFilter, global_alert_deduplicator

class CameraGridStartStopRequest(BaseModel):
    camera_id: Optional[str] = None
    all: Optional[bool] = False

@app.get("/camera/status")
def get_camera_grid_status():
    return {
        "success": True,
        "system_status": "ONLINE",
        "ai_engine": "ACTIVE",
        "total_cameras": 4,
        "cameras": [
            {"id": "CAM-001", "name": "Forest North", "zone": "Zone A", "status": "ONLINE", "stream_url": ""},
            {"id": "CAM-002", "name": "Forest East", "zone": "Zone B", "status": "ONLINE", "stream_url": ""},
            {"id": "CAM-003", "name": "Village Border", "zone": "Zone C", "status": "ONLINE", "stream_url": ""},
            {"id": "CAM-004", "name": "Forest South", "zone": "Zone D", "status": "ONLINE", "stream_url": ""},
        ]
    }

@app.post("/camera/start")
def start_camera_grid(req: CameraGridStartStopRequest):
    return {
        "success": True,
        "active_cameras": 4 if req.all else 1
    }

@app.post("/camera/stop")
def stop_camera_grid(req: CameraGridStartStopRequest):
    return {
        "success": True,
        "active_cameras": 0
    }

@app.post("/camera/detect-frame")
async def detect_camera_frame(
    file: UploadFile = File(...),
    camera_id: str = Form("CAM-001"),
    camera_name: Optional[str] = Form("Surveillance Camera"),
    zone: Optional[str] = Form("Zone A"),
    lat: Optional[float] = Form(20.2667),
    lng: Optional[float] = Form(79.4000),
    confidence_threshold: Optional[float] = Form(0.35)
):
    ds = get_detection_service()
    content = await file.read()
    
    is_valid, err_msg = ds.validate_image_file(content, file.filename)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err_msg)

    unique_filename = f"surv_{camera_id}_{uuid.uuid4().hex[:8]}.jpg"
    save_path = UPLOAD_DIR / unique_filename
    with open(save_path, "wb") as buf:
        buf.write(content)

    conf_thresh = max(0.20, float(confidence_threshold or 0.35))
    detections = ds.detect_image(save_path, conf_threshold=conf_thresh, imgsz=640)

    tracker = get_stream_tracker(f"live_{camera_id}", required_consecutive=3, conf_floor=conf_thresh)

    if not detections:
        safety_eval = tracker.update(None, 0.0)
        return {
            "success": True,
            "detected": False,
            "species": None,
            "confidence": 0.0,
            "detections": [],
            "message": "NO TARGET WILDLIFE DETECTED",
            "status_text": "CLEAR: Optical radar normal",
            "is_confirmed": False,
            "consecutive_count": 0,
            "timestamp": datetime.now().strftime("%H:%M:%S")
        }

    primary = detections[0]
    species = primary["species"]
    confidence = primary["confidence"]
    safety_eval = tracker.update(species, confidence)

    nearest_village, dist_to_v = find_nearest_village(lat, lng)
    village_name = nearest_village["name"] if nearest_village else "Rajpur Village"
    village_id = nearest_village["id"] if nearest_village else "VIL-01"

    geofence_res = check_geofences(lat, lng)
    risk_eval = calculate_wildlife_risk(
        species=species,
        confidence=confidence,
        count=len(detections),
        lat=lat,
        lng=lng,
        distance_to_settlement_m=dist_to_v,
        geofence_multiplier=geofence_res.get("risk_multiplier", 1.0)
    )

    fcm_sent = False
    if safety_eval["is_confirmed"] and (risk_eval["risk_level"] in ("HIGH", "CRITICAL")):
        fcm_sent = True
        try:
            FCMService.send_wildlife_alert(
                animal=species,
                confidence=confidence,
                risk_level=risk_eval["risk_level"],
                location={"lat": lat, "lng": lng, "village_name": village_name},
                event_id=f"ALT-{uuid.uuid4().hex[:6].upper()}",
                source=f"Live Camera {camera_id}"
            )
        except Exception:
            pass

    return {
        "success": True,
        "detected": True,
        "species": species,
        "confidence": confidence,
        "primary_bbox": primary["bbox"],
        "detections": detections,
        "risk_level": risk_eval["risk_level"],
        "risk_score": risk_eval["risk_score"],
        "is_confirmed": safety_eval["is_confirmed"],
        "consecutive_count": safety_eval["consecutive_count"],
        "status_text": f"CONFIRMED: {species} ({confidence}%)" if safety_eval["is_confirmed"] else f"Tracking {species} ({safety_eval['consecutive_count']}/3)",
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "fcm_sent": fcm_sent
    }

# --------------------------------------------------
# FIELD CAMERA WEBRTC & STREAMING ENDPOINTS
# --------------------------------------------------
from field_camera_service import field_camera_manager

class FieldCameraSignalRequest(BaseModel):
    session_id: Optional[str] = "CAM-001"
    role: Optional[str] = "broadcaster"
    sdp: Optional[Dict[str, Any]] = None
    candidate: Optional[Dict[str, Any]] = None

@app.post("/api/field-camera/offer")
async def post_field_camera_offer(req: FieldCameraSignalRequest):
    sid = req.session_id or "CAM-001"
    sig = field_camera_manager.signaling.setdefault(sid, {"offer": None, "answer": None, "ice_broadcaster": [], "ice_viewer": []})
    sig["offer"] = req.sdp
    await field_camera_manager.relay_signal(sid, "broadcaster", {"type": "offer", "sdp": req.sdp})
    return {"success": True, "session_id": sid}

@app.get("/api/field-camera/offer")
def get_field_camera_offer(session: str = "CAM-001"):
    sig = field_camera_manager.signaling.get(session, {})
    return {"success": True, "offer": sig.get("offer")}

@app.post("/api/field-camera/answer")
async def post_field_camera_answer(req: FieldCameraSignalRequest):
    sid = req.session_id or "CAM-001"
    sig = field_camera_manager.signaling.setdefault(sid, {"offer": None, "answer": None, "ice_broadcaster": [], "ice_viewer": []})
    sig["answer"] = req.sdp
    await field_camera_manager.relay_signal(sid, "viewer", {"type": "answer", "sdp": req.sdp})
    return {"success": True, "session_id": sid}

@app.get("/api/field-camera/answer")
def get_field_camera_answer(session: str = "CAM-001"):
    sig = field_camera_manager.signaling.get(session, {})
    return {"success": True, "answer": sig.get("answer")}

@app.post("/api/field-camera/ice")
async def post_field_camera_ice(req: FieldCameraSignalRequest):
    sid = req.session_id or "CAM-001"
    await field_camera_manager.relay_signal(sid, req.role or "broadcaster", {"type": "ice_candidate", "candidate": req.candidate})
    return {"success": True}

@app.get("/api/field-camera/ice")
def get_field_camera_ice(session: str = "CAM-001", role: str = "viewer"):
    sig = field_camera_manager.signaling.get(session, {})
    candidates = sig.get("ice_broadcaster" if role == "viewer" else "ice_viewer", [])
    return {"success": True, "candidates": candidates}

@app.get("/api/field-camera/status")
def get_field_camera_status(session: str = "CAM-001"):
    sess = field_camera_manager.get_session(session)
    if not sess:
        sess = field_camera_manager.get_or_create_session(session_id=session)
    return {"success": True, "session": sess}

@app.websocket("/ws/field-camera/{session_id}")
async def ws_field_camera_signaling(websocket: WebSocket, session_id: str):
    await websocket.accept()
    role = "viewer"
    try:
        init_data = await asyncio.wait_for(websocket.receive_json(), timeout=10.0)
        role = init_data.get("role", "viewer")
        await field_camera_manager.register_signaling_ws(session_id, role, websocket)
        
        while True:
            msg = await websocket.receive_json()
            mtype = msg.get("type")
            if mtype in ("offer", "answer", "ice_candidate"):
                await field_camera_manager.relay_signal(session_id, role, msg)
            elif mtype == "frame":
                b64 = msg.get("image")
                if b64:
                    if "," in b64:
                        b64 = b64.split(",", 1)[1]
                    raw_bytes = base64.b64decode(b64)
                    result = field_camera_manager.process_field_camera_frame(
                        camera_id=session_id,
                        session_id=session_id,
                        image_bytes=raw_bytes,
                        lat=msg.get("lat"),
                        lng=msg.get("lng")
                    )
                    await websocket.send_json({"type": "detection_result", "data": result})
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        await field_camera_manager.unregister_signaling_ws(session_id, role, websocket)
