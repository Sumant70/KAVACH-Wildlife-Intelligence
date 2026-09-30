import sqlite3
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger("kavach.db")

DB_PATH = Path(__file__).resolve().parent / "kavach.db"

def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def add_column_if_missing(cursor, table: str, column_def: str):
    """Safely adds a column to an existing table if it doesn't already exist."""
    col_name = column_def.split()[0]
    try:
        cursor.execute(f"PRAGMA table_info({table})")
        existing_cols = [row[1] for row in cursor.fetchall()]
        if col_name not in existing_cols:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column_def}")
            logger.info("Added column %s to table %s", col_name, table)
    except Exception as e:
        logger.warning("Could not add column %s to %s: %s", col_name, table, e)

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. VILLAGES (Community Safety & Geo-Fencing)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS villages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        district TEXT,
        state TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        forest_range TEXT,
        alert_radius_m REAL DEFAULT 2000.0,
        warning_radius_m REAL DEFAULT 4000.0,
        danger_radius_m REAL DEFAULT 1000.0,
        registered_users INTEGER DEFAULT 150,
        emergency_contact TEXT,
        is_active INTEGER DEFAULT 1
    )
    """)

    # 2. CAMERAS (CCTV / RTSP / IP Camera Management)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cameras (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'CCTV',
        rtsp_url TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        forest_range TEXT,
        village_id TEXT,
        village_name TEXT,
        status TEXT DEFAULT 'ONLINE',
        fps INTEGER DEFAULT 15,
        last_frame_time TEXT,
        detection_active INTEGER DEFAULT 1,
        latest_detection TEXT,
        latest_confidence REAL,
        latest_bbox_json TEXT
    )
    """)

    # 3. DETECTIONS (Image / Live Camera / CCTV)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS detections (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        species TEXT,
        class_name TEXT,
        confidence REAL,
        bbox_json TEXT,
        count INTEGER DEFAULT 1,
        lat REAL,
        lng REAL,
        accuracy REAL,
        risk_score REAL,
        risk_level TEXT,
        image_path TEXT,
        device_id TEXT,
        zone_id TEXT,
        status TEXT DEFAULT 'RECORDED',
        source TEXT DEFAULT 'IMAGE',
        camera_id TEXT,
        camera_name TEXT,
        village_id TEXT,
        village_name TEXT,
        incident_code TEXT,
        verification_status TEXT DEFAULT 'AI_DETECTED'
    )
    """)

    # Migrations for existing detections table
    add_column_if_missing(cursor, "detections", "source TEXT DEFAULT 'IMAGE'")
    add_column_if_missing(cursor, "detections", "camera_id TEXT")
    add_column_if_missing(cursor, "detections", "camera_name TEXT")
    add_column_if_missing(cursor, "detections", "village_id TEXT")
    add_column_if_missing(cursor, "detections", "village_name TEXT")
    add_column_if_missing(cursor, "detections", "incident_code TEXT")
    add_column_if_missing(cursor, "detections", "verification_status TEXT DEFAULT 'AI_DETECTED'")
    add_column_if_missing(cursor, "detections", "movement_status TEXT DEFAULT 'UNKNOWN'")
    add_column_if_missing(cursor, "detections", "direction TEXT DEFAULT 'UNKNOWN'")
    add_column_if_missing(cursor, "detections", "incident_id TEXT")
    add_column_if_missing(cursor, "detections", "frame_id INTEGER")

    # 4. INCIDENTS (Consolidated Operational Cases & Lifecycle)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        incident_code TEXT,
        title TEXT,
        animal TEXT,
        confidence REAL,
        lat REAL,
        lng REAL,
        timestamp TEXT,
        reporter TEXT,
        image_path TEXT,
        risk_level TEXT,
        status TEXT DEFAULT 'NEW',
        assigned_officer TEXT,
        notes TEXT,
        timeline_json TEXT,
        village_id TEXT,
        village_name TEXT,
        camera_id TEXT,
        first_detected TEXT,
        last_detected TEXT,
        detection_count INTEGER DEFAULT 1,
        verification_status TEXT DEFAULT 'PENDING',
        escalation_level TEXT DEFAULT 'NORMAL',
        escalation_time TEXT,
        guard_notes TEXT,
        guard_photo_path TEXT,
        resolution TEXT
    )
    """)

    add_column_if_missing(cursor, "incidents", "incident_code TEXT")
    add_column_if_missing(cursor, "incidents", "village_id TEXT")
    add_column_if_missing(cursor, "incidents", "village_name TEXT")
    add_column_if_missing(cursor, "incidents", "camera_id TEXT")
    add_column_if_missing(cursor, "incidents", "first_detected TEXT")
    add_column_if_missing(cursor, "incidents", "last_detected TEXT")
    add_column_if_missing(cursor, "incidents", "detection_count INTEGER DEFAULT 1")
    add_column_if_missing(cursor, "incidents", "verification_status TEXT DEFAULT 'PENDING'")
    add_column_if_missing(cursor, "incidents", "escalation_level TEXT DEFAULT 'NORMAL'")
    add_column_if_missing(cursor, "incidents", "escalation_time TEXT")
    add_column_if_missing(cursor, "incidents", "guard_notes TEXT")
    add_column_if_missing(cursor, "incidents", "guard_photo_path TEXT")
    add_column_if_missing(cursor, "incidents", "resolution TEXT")
    add_column_if_missing(cursor, "incidents", "source TEXT DEFAULT 'CITIZEN_REPORT'")
    add_column_if_missing(cursor, "incidents", "severity TEXT DEFAULT 'MEDIUM'")

    # 5. ALERTS (Community & Ranger Notifications)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        title TEXT,
        species TEXT,
        confidence REAL,
        risk_score REAL,
        priority TEXT,
        reason TEXT,
        recommendation TEXT,
        lat REAL,
        lng REAL,
        distance_to_settlement REAL,
        timestamp TEXT,
        status TEXT DEFAULT 'PENDING',
        village_id TEXT,
        village_name TEXT,
        alert_channels_json TEXT,
        dedup_incident_id TEXT,
        acknowledged_by TEXT,
        acknowledged_at TEXT,
        escalated INTEGER DEFAULT 0,
        verification_status TEXT DEFAULT 'AI_DETECTED'
    )
    """)

    add_column_if_missing(cursor, "alerts", "village_id TEXT")
    add_column_if_missing(cursor, "alerts", "village_name TEXT")
    add_column_if_missing(cursor, "alerts", "alert_channels_json TEXT")
    add_column_if_missing(cursor, "alerts", "dedup_incident_id TEXT")
    add_column_if_missing(cursor, "alerts", "acknowledged_by TEXT")
    add_column_if_missing(cursor, "alerts", "acknowledged_at TEXT")
    add_column_if_missing(cursor, "alerts", "escalated INTEGER DEFAULT 0")
    add_column_if_missing(cursor, "alerts", "verification_status TEXT DEFAULT 'AI_DETECTED'")

    # 6. WILDLIFE REPORTS (Citizen / Villager Sighting Reports)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS wildlife_reports (
        id TEXT PRIMARY KEY,
        reporter_name TEXT,
        reporter_contact TEXT,
        animal_reported TEXT,
        lat REAL,
        lng REAL,
        village_id TEXT,
        village_name TEXT,
        photo_path TEXT,
        description TEXT,
        ai_verified_species TEXT,
        ai_confidence REAL,
        status TEXT DEFAULT 'PENDING_REVIEW',
        timestamp TEXT,
        verified_by TEXT
    )
    """)
    add_column_if_missing(cursor, "wildlife_reports", "created_at TEXT")

    # 7. GEOFENCES (Zones & Buffers)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS geofences (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        geometry_type TEXT,
        coordinates_json TEXT,
        radius_m REAL,
        risk_multiplier REAL,
        description TEXT,
        is_active INTEGER DEFAULT 1
    )
    """)

    # 8. DEVICES (Hardware Telemetry)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT,
        location_name TEXT,
        lat REAL,
        lng REAL,
        status TEXT DEFAULT 'ONLINE',
        battery INTEGER,
        network INTEGER,
        last_detection TEXT,
        last_ping TEXT
    )
    """)

    # 9. USERS (Role-Based Access: Forest Department, Guard, Villager, Admin)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'FOREST_DEPARTMENT',
        full_name TEXT NOT NULL,
        contact TEXT,
        assigned_village_id TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT
    )
    """)

    # 10. NOTIFICATIONS (Multi-Channel Dispatch Audit)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        alert_id TEXT,
        channel TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT,
        detail TEXT,
        timestamp TEXT
    )
    """)

    # 11. CAMERA HEALTH (Heartbeats & Telemetry Tracking)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS camera_health (
        id TEXT PRIMARY KEY,
        camera_id TEXT NOT NULL,
        status TEXT NOT NULL,
        fps REAL DEFAULT 0.0,
        latency_ms INTEGER DEFAULT 0,
        error_message TEXT,
        last_heartbeat TEXT
    )
    """)

    # Migrations for cameras table
    add_column_if_missing(cursor, "cameras", "username TEXT")
    add_column_if_missing(cursor, "cameras", "ip_address TEXT")
    add_column_if_missing(cursor, "cameras", "port INTEGER DEFAULT 554")
    add_column_if_missing(cursor, "cameras", "location TEXT")
    add_column_if_missing(cursor, "cameras", "district TEXT")
    add_column_if_missing(cursor, "cameras", "state TEXT")
    add_column_if_missing(cursor, "cameras", "resolution TEXT DEFAULT '1080p'")
    add_column_if_missing(cursor, "cameras", "confidence_threshold REAL DEFAULT 25.0")
    add_column_if_missing(cursor, "cameras", "retry_count INTEGER DEFAULT 0")
    add_column_if_missing(cursor, "cameras", "error_message TEXT")

    # 12. SYSTEM SETTINGS (Admin Configurable Thresholds)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)

    # 13. AUDIT LOGS
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        username TEXT,
        action TEXT,
        details TEXT
    )
    """)

    # 14. FCM TOKENS (Firebase Cloud Messaging Background Push Device Registry)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fcm_tokens (
        token TEXT PRIMARY KEY,
        device_id TEXT,
        device_name TEXT,
        role TEXT,
        platform TEXT,
        user_agent TEXT,
        created_at TEXT,
        last_seen TEXT,
        is_active INTEGER DEFAULT 1
    )
    """)

    conn.commit()
    seed_initial_data(conn)
    conn.close()
    logger.info("Database initialized & migrated successfully at %s", DB_PATH)

def seed_initial_data(conn):
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Seed Default Users
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        default_users = [
            ("USR-001", "officer.verma", "FOREST_DEPARTMENT", "Anita Verma", "+91-9876543201", "VIL-01", 1, now_str),
            ("USR-002", "guard.sharma", "FOREST_GUARD", "Rajesh Sharma", "+91-9876543202", "VIL-02", 1, now_str),
            ("USR-003", "villager.ramesh", "VILLAGER", "Rameshwar Gurjar", "+91-9876543203", "VIL-01", 1, now_str),
            ("USR-004", "admin.kavach", "ADMIN", "System Administrator", "+91-9876543200", None, 1, now_str),
        ]
        cursor.executemany("""
            INSERT INTO users (id, username, role, full_name, contact, assigned_village_id, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, default_users)

    # A. Seed Villages
    cursor.execute("SELECT COUNT(*) FROM villages")
    if cursor.fetchone()[0] == 0:
        villages_data = [
            ("VIL-01", "Rajpur Village", "Dehradun", "Uttarakhand", 29.5450, 78.8100, "Ramnagar / Corbett Fringe", 2000.0, 4000.0, 1000.0, 247, "+91-9876543210", 1),
            ("VIL-02", "Moharli Village", "Chandrapur", "Maharashtra", 20.2520, 79.3880, "Tadoba-Andhari Buffer", 1800.0, 3500.0, 900.0, 380, "+91-9876543211", 1),
            ("VIL-03", "Kohora Village", "Golaghat", "Assam", 26.5820, 93.1680, "Kaziranga Central Range", 2500.0, 5000.0, 1200.0, 195, "+91-9876543212", 1),
            ("VIL-04", "Aarey Settlement", "Mumbai Suburban", "Maharashtra", 19.2300, 72.9000, "SGNP Southern Fringe", 1500.0, 3000.0, 800.0, 520, "+91-9876543213", 1),
        ]
        cursor.executemany("""
            INSERT INTO villages (id, name, district, state, lat, lng, forest_range, alert_radius_m, warning_radius_m, danger_radius_m, registered_users, emergency_contact, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, villages_data)

    # B. Seed CCTV / RTSP Cameras
    cursor.execute("SELECT COUNT(*) FROM cameras")
    if cursor.fetchone()[0] == 0:
        cameras_data = [
            ("CCTV-01", "Forest Gate Camera 01", "RTSP", "rtsp://demo:demo@192.168.1.101:554/live", 29.5480, 78.8140, "Ramnagar Range", "VIL-01", "Rajpur Village", "ONLINE", 20, now_str, 1, "Leopard", 94.7, json.dumps([280, 320, 610, 720])),
            ("CCTV-02", "Moharli Waterhole Sensor", "CCTV", "rtsp://demo:demo@192.168.1.102:554/live", 20.2550, 79.3910, "Tadoba Buffer", "VIL-02", "Moharli Village", "ONLINE", 15, now_str, 1, "No Animal", 0.0, None),
            ("CCTV-03", "Northern Ridge Outpost", "IP_CAMERA", "rtsp://demo:demo@192.168.1.103:554/live", 20.2620, 79.3750, "Tadoba Core", "VIL-02", "Moharli Village", "OFFLINE", 0, now_str, 0, None, 0.0, None),
            ("CCTV-04", "Corridor Trail Cam 04", "DEMO_VIDEO", "demo://wildlife_cctv_feed.mp4", 29.5420, 78.8050, "Corbett Corridor", "VIL-01", "Rajpur Village", "ONLINE", 24, now_str, 1, "Asian Elephant", 88.5, json.dumps([180, 150, 520, 480]))
        ]
        cursor.executemany("""
            INSERT INTO cameras (id, name, type, rtsp_url, lat, lng, forest_range, village_id, village_name, status, fps, last_frame_time, detection_active, latest_detection, latest_confidence, latest_bbox_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, cameras_data)

    # C. Seed Wildlife Citizen Reports
    cursor.execute("SELECT COUNT(*) FROM wildlife_reports")
    if cursor.fetchone()[0] == 0:
        reports_data = [
            ("REP-101", "Rameshwar Gurjar", "+91-9876500001", "Leopard", 29.5460, 78.8120, "VIL-01", "Rajpur Village", "/sample_images/leopard.jpg", "Saw leopard near sugarcane field edge at dusk.", "Leopard", 91.2, "CONFIRMED", "Today, 06:15", "Officer Anita Verma"),
            ("REP-102", "Sunita Devi", "+91-9876500002", "Elephant", 29.5430, 78.8080, "VIL-01", "Rajpur Village", "/sample_images/elephant.jpg", "Herd of elephants feeding on field border.", "Asian Elephant", 86.4, "PENDING_REVIEW", "Today, 07:30", None),
        ]
        cursor.executemany("""
            INSERT INTO wildlife_reports (id, reporter_name, reporter_contact, animal_reported, lat, lng, village_id, village_name, photo_path, description, ai_verified_species, ai_confidence, status, timestamp, verified_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, reports_data)

    # D. Seed Default System Settings
    cursor.execute("SELECT COUNT(*) FROM system_settings")
    if cursor.fetchone()[0] == 0:
        settings_data = [
            ("detection_fps", "3"),
            ("confidence_threshold", "25"),
            ("demo_mode", "1"),
            ("escalation_minutes", "5"),
            ("siren_audio_enabled", "1"),
            ("default_alert_radius_m", "2000")
        ]
        cursor.executemany("INSERT INTO system_settings (key, value) VALUES (?, ?)", settings_data)

    # E. Seed Devices (if empty)
    cursor.execute("SELECT COUNT(*) FROM devices")
    if cursor.fetchone()[0] == 0:
        devices_data = [
            ("CAM-TATR-01", "Tadoba Core Trail Cam 01", "TRAIL_CAM", "Tadoba-Andhari Core", 20.2667, 79.4000, "ONLINE", 88, 92, "Asian Elephant (06:42)", now_str),
            ("CAM-TATR-02", "Tadoba South Buffer Cam", "TRAIL_CAM", "Tadoba Buffer South", 20.2400, 79.3800, "ONLINE", 76, 85, "Tiger (Yesterday 21:15)", now_str),
            ("CAM-CORB-01", "Corbett Dhikala Gate Watch", "CCTV", "Corbett Dhikala Zone", 29.5300, 78.7740, "ONLINE", 94, 98, "Tiger (Today 03:22)", now_str),
            ("CAM-CORB-02", "Corbett Kosi River Sensor", "IP_CAMERA", "Kosi River Corridor", 29.5800, 78.8200, "WARNING", 42, 60, "Asian Elephant (Today 01:10)", now_str),
            ("CAM-KAZI-01", "Kaziranga Mihimukh Ridge", "TRAIL_CAM", "Central Range Kohora", 26.5775, 93.1711, "ONLINE", 91, 89, "Indian Rhinoceros (Yesterday)", now_str),
            ("CAM-SGNP-01", "SGNP Forest Boundary Cam", "IP_CAMERA", "Sanjay Gandhi NP Edge", 19.2500, 72.9170, "ONLINE", 83, 74, "Leopard (Yesterday 19:03)", now_str),
            ("DRONE-01", "Quick Response Surveillance Drone", "DRONE", "Chandrapur Sector 4", 20.2550, 79.3900, "OFFLINE", 15, 0, "Patrol complete", now_str),
            ("MOBILE-RNG-04", "Ranger Handheld Unit 04", "RANGER_MOBILE", "Ramnagar Forest Division", 29.3950, 79.1280, "ONLINE", 95, 95, "Patrolling Beat 3", now_str)
        ]
        cursor.executemany("""
            INSERT INTO devices (id, name, type, location_name, lat, lng, status, battery, network, last_detection, last_ping)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, devices_data)

    # F. Seed Alerts with village context
    cursor.execute("SELECT COUNT(*) FROM alerts")
    if cursor.fetchone()[0] == 0:
        alerts_data = [
            (
                "ALT-801",
                "High Risk: Leopard Sightings Near Habitation",
                "Leopard",
                92.4,
                86.0,
                "HIGH",
                "Leopard detected 320m from Moharli village perimeter at night.",
                "Deploy quick response patrol and notify village forest committee.",
                20.2510,
                79.3860,
                320.0,
                "Today, 02:45",
                "PENDING",
                "VIL-02",
                "Moharli Village",
                json.dumps(["SMS", "PUSH", "SIREN"]),
                "INC-301",
                None,
                None,
                0,
                "AI_DETECTED"
            ),
            (
                "ALT-802",
                "Critical: Tiger Movement Across Buffer Road",
                "Tiger",
                95.8,
                91.5,
                "CRITICAL",
                "Adult Tiger crossing state highway corridor adjoining buffer zone.",
                "Activate traffic warning sirens and dispatch Forest Beat Guard #2.",
                20.2380,
                79.3820,
                180.0,
                "Today, 05:12",
                "ACKNOWLEDGED",
                "VIL-02",
                "Moharli Village",
                json.dumps(["SMS", "PUSH", "SIREN", "VOICE_CALL"]),
                "INC-302",
                "Officer Anita Verma",
                "05:18",
                0,
                "CONFIRMED"
            ),
            (
                "ALT-803",
                "High Risk: Leopard Near Rajpur Village",
                "Leopard",
                94.7,
                88.0,
                "HIGH",
                "Leopard detected on Forest Gate Camera 01 (~800m from Rajpur Village).",
                "Stay indoors. Keep livestock sheltered. Forest Patrol Alpha deployed.",
                29.5480,
                78.8140,
                800.0,
                "Today, 10:42 PM",
                "PENDING",
                "VIL-01",
                "Rajpur Village",
                json.dumps(["SMS", "PUSH", "SIREN"]),
                "INC-304",
                None,
                None,
                0,
                "AI_DETECTED"
            )
        ]
        cursor.executemany("""
            INSERT INTO alerts (id, title, species, confidence, risk_score, priority, reason, recommendation, lat, lng, distance_to_settlement, timestamp, status, village_id, village_name, alert_channels_json, dedup_incident_id, acknowledged_by, acknowledged_at, escalated, verification_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, alerts_data)

    # G. Seed Incidents with deduplication & lifecycle fields
    cursor.execute("SELECT COUNT(*) FROM incidents")
    if cursor.fetchone()[0] == 0:
        inc_data = [
            (
                "INC-301",
                "KVC-1021",
                "High-Risk Leopard Sighting Near Moharli Village",
                "Leopard",
                92.4,
                20.2510,
                79.3860,
                "Today, 02:45",
                "Automated Trail Camera (CAM-SGNP-01)",
                "/sample_images/leopard.jpg",
                "HIGH",
                "TEAM_DISPATCHED",
                "Officer Rajesh Sharma (Range Officer - Tadoba)",
                "QRT Team Alpha deployed with searchlights and vehicle siren. Local villagers alerted via PA system.",
                json.dumps([
                    {"stage": "Detection", "time": "02:45", "detail": "AI detected Leopard with 92.4% confidence."},
                    {"stage": "Alert Generated", "time": "02:46", "detail": "Risk engine scored 86/100 (High Risk due to 320m settlement proximity)."},
                    {"stage": "Officer Acknowledged", "time": "02:50", "detail": "Duty Officer Rajesh Sharma accepted alert."},
                    {"stage": "Team Dispatched", "time": "03:05", "detail": "Ranger Quick Response Team Alpha left base."}
                ]),
                "VIL-02",
                "Moharli Village",
                "CCTV-02",
                "02:45",
                "03:10",
                3,
                "CONFIRMED",
                "NORMAL",
                None,
                "Guard confirmed pugmarks 200m from north pond.",
                None,
                None
            ),
            (
                "INC-302",
                "KVC-1022",
                "Tiger Crossing State Highway #11",
                "Tiger",
                95.8,
                20.2380,
                79.3820,
                "Today, 05:12",
                "Boundary Sensor (CAM-TATR-02)",
                "/sample_images/tiger.jpg",
                "CRITICAL",
                "UNDER_INVESTIGATION",
                "Officer Anita Verma (Wildlife Warden)",
                "Monitoring movement toward reserve core. Temporary speed limit enforced on highway stretch.",
                json.dumps([
                    {"stage": "Detection", "time": "05:12", "detail": "AI detected Tiger crossing road corridor."},
                    {"stage": "Alert Generated", "time": "05:13", "detail": "Critical priority alert pushed to emergency dispatch."},
                    {"stage": "Officer Acknowledged", "time": "05:18", "detail": "Warden Anita Verma confirmed investigation."}
                ]),
                "VIL-02",
                "Moharli Village",
                "CCTV-02",
                "05:12",
                "05:15",
                2,
                "CONFIRMED",
                "NORMAL",
                None,
                "Traffic held for 15 minutes while tiger returned to deep canopy.",
                None,
                None
            ),
            (
                "INC-304",
                "KVC-1024",
                "Active Leopard Movement Near Rajpur Village",
                "Leopard",
                94.7,
                29.5480,
                78.8140,
                "Today, 10:42 PM",
                "CCTV-01 (Forest Gate)",
                "/sample_images/leopard.jpg",
                "HIGH",
                "NEW",
                "Forest Guard Vikram Patel",
                "Leopard detected ~800m from Rajpur Village. 18 repeated frame detections clustered in past 10 minutes.",
                json.dumps([
                    {"stage": "Detection", "time": "10:42 PM", "detail": "AI detected Leopard on CCTV-01."},
                    {"stage": "Alert Generated", "time": "10:42 PM", "detail": "Village Alert triggered for Rajpur Village (~800m). Multi-channel siren/SMS pushed."},
                    {"stage": "Assigned", "time": "10:43 PM", "detail": "Assigned to Beat Guard Vikram Patel."}
                ]),
                "VIL-01",
                "Rajpur Village",
                "CCTV-01",
                "10:42 PM",
                "10:44 PM",
                18,
                "PENDING",
                "NORMAL",
                None,
                "Proceeding to sector with solar flashlight and acoustic bangers.",
                None,
                None
            )
        ]
        cursor.executemany("""
            INSERT INTO incidents (id, incident_code, title, animal, confidence, lat, lng, timestamp, reporter, image_path, risk_level, status, assigned_officer, notes, timeline_json, village_id, village_name, camera_id, first_detected, last_detected, detection_count, verification_status, escalation_level, escalation_time, guard_notes, guard_photo_path, resolution)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, inc_data)

    conn.commit()


# --------------------------------------------------
# FCM TOKEN REGISTRATION & MANAGEMENT
# --------------------------------------------------
def save_fcm_token(
    token: str,
    device_id: Optional[str] = None,
    device_name: Optional[str] = None,
    role: Optional[str] = None,
    platform: Optional[str] = None,
    user_agent: Optional[str] = None
) -> bool:
    """Stores or refreshes an FCM registration token in SQLite."""
    if not token or not token.strip():
        return False
    token = token.strip()
    now_str = datetime.now().isoformat()
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO fcm_tokens (token, device_id, device_name, role, platform, user_agent, created_at, last_seen, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(token) DO UPDATE SET
                device_id = COALESCE(excluded.device_id, fcm_tokens.device_id),
                device_name = COALESCE(excluded.device_name, fcm_tokens.device_name),
                role = COALESCE(excluded.role, fcm_tokens.role),
                platform = COALESCE(excluded.platform, fcm_tokens.platform),
                user_agent = COALESCE(excluded.user_agent, fcm_tokens.user_agent),
                last_seen = excluded.last_seen,
                is_active = 1
        """, (token, device_id, device_name, role, platform, user_agent, now_str, now_str))
        conn.commit()
        conn.close()
        logger.info("[FCM-DB] Successfully saved/updated token for device '%s'", device_name or device_id or "unnamed")
        return True
    except Exception as e:
        logger.error("[FCM-DB] Error saving FCM token: %s", e)
        return False

def get_active_fcm_tokens() -> List[str]:
    """Returns all active, non-revoked FCM registration tokens."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT token FROM fcm_tokens WHERE is_active = 1")
        rows = cursor.fetchall()
        conn.close()
        return [r["token"] for r in rows if r["token"]]
    except Exception as e:
        logger.error("[FCM-DB] Error fetching active FCM tokens: %s", e)
        return []

def deactivate_fcm_token(token: str) -> bool:
    """Marks an expired or invalid FCM token as inactive."""
    if not token:
        return False
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE fcm_tokens SET is_active = 0, last_seen = ? WHERE token = ?", (datetime.now().isoformat(), token))
        conn.commit()
        conn.close()
        logger.info("[FCM-DB] Marked token as inactive: ...%s", token[-12:])
        return True
    except Exception as e:
        logger.error("[FCM-DB] Error deactivating token: %s", e)
        return False

def remove_invalid_fcm_token(token: str) -> bool:
    """Deletes an unregistered/invalid token from the database."""
    if not token:
        return False
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM fcm_tokens WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        logger.info("[FCM-DB] Deleted unregistered token: ...%s", token[-12:])
        return True
    except Exception as e:
        logger.error("[FCM-DB] Error deleting token: %s", e)
        return False

def get_fcm_token_summary() -> Dict[str, Any]:
    """Returns telemetry summary of registered background devices."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM fcm_tokens WHERE is_active = 1")
        active_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM fcm_tokens")
        total_count = cursor.fetchone()[0]
        cursor.execute("SELECT device_name, role, platform, last_seen FROM fcm_tokens WHERE is_active = 1 ORDER BY last_seen DESC LIMIT 10")
        devices = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return {
            "active_tokens_count": active_count,
            "total_tokens_count": total_count,
            "recent_devices": devices
        }
    except Exception as e:
        logger.error("[FCM-DB] Error fetching FCM token summary: %s", e)
        return {"active_tokens_count": 0, "total_tokens_count": 0, "recent_devices": []}

