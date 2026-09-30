import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, messaging

from db import get_active_fcm_tokens, deactivate_fcm_token, remove_invalid_fcm_token, get_fcm_token_summary
from allowed_wildlife import is_allowed_wildlife

logger = logging.getLogger("kavach.fcm")

# Project identification
FIREBASE_PROJECT_ID = "kavach-wildlife-alert"

# Credentials file candidates
DEFAULT_KEY_LOCATIONS = [
    Path(__file__).resolve().parent / "serviceAccountKey.json",
    Path(__file__).resolve().parent / "kavach-wildlife-alert-firebase-adminsdk-fbsvc-794a04f572.json",
    Path(__file__).resolve().parent / "firebase_credentials.json",
    Path(__file__).resolve().parent / "firebase-service-account.json",
    Path.cwd() / "serviceAccountKey.json",
    Path.cwd() / "backend" / "serviceAccountKey.json",
    Path.cwd() / "infinityHack-main" / "backend" / "serviceAccountKey.json",
    Path.cwd() / "infinityHack-main" / "backend" / "kavach-wildlife-alert-firebase-adminsdk-fbsvc-794a04f572.json"
]


def find_firebase_credentials() -> Optional[Path]:
    """Finds genuine Firebase service account credentials without inventing paths or exposing secrets."""
    # 1. Environment variables
    cred_env = (
        os.getenv("FIREBASE_CREDENTIALS_PATH")
        or os.getenv("FIREBASE_SERVICE_ACCOUNT_KEY")
        or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    )
    if cred_env:
        p = Path(cred_env).resolve()
        if p.exists() and p.is_file():
            return p

    # 2. Known default locations
    for candidate in DEFAULT_KEY_LOCATIONS:
        try:
            if candidate.exists() and candidate.is_file():
                return candidate.resolve()
        except Exception:
            continue

    # 3. Dynamic glob discovery for service account files in backend and cwd
    search_dirs = [
        Path(__file__).resolve().parent,
        Path.cwd(),
        Path.cwd() / "backend",
        Path.cwd() / "infinityHack-main" / "backend"
    ]
    for d in search_dirs:
        if d.exists() and d.is_dir():
            for pattern in ["*serviceAccount*.json", "*firebase-adminsdk*.json"]:
                for match in d.glob(pattern):
                    if match.is_file() and match.stat().st_size > 100:
                        return match.resolve()

    return None


class FCMService:
    """
    Firebase Cloud Messaging HTTP v1 Push Notification Service for KAVACH.
    Broadcasts real-time emergency wildlife alerts to backgrounded Android & iOS devices.
    Zero secrets or private keys are exposed to the client-side code.
    """
    _initialized: bool = False
    _dry_run_mode: bool = False
    _init_error: Optional[str] = None

    @classmethod
    def initialize(cls) -> bool:
        if len(firebase_admin._apps) > 0:
            cls._initialized = True
            cls._dry_run_mode = False
            cls._init_error = None
            return True

        if cls._initialized and not cls._dry_run_mode:
            return True

        inline_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        cred = None

        if inline_json:
            try:
                cred_dict = json.loads(inline_json)
                cred = credentials.Certificate(cred_dict)
                logger.info("[FCM] Initializing Firebase Admin SDK via inline service account JSON")
            except Exception as e:
                logger.error("[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: %s", e)
                cls._init_error = f"Invalid FIREBASE_SERVICE_ACCOUNT_JSON: {e}"

        if not cred:
            cred_file = find_firebase_credentials()
            if cred_file:
                try:
                    cred = credentials.Certificate(str(cred_file))
                    logger.info("[FCM] Found and initialized Firebase credentials from: %s", cred_file)
                except Exception as e:
                    logger.error("[FCM] Failed to load credentials from %s: %s", cred_file, e)
                    cls._init_error = f"Error loading certificate from {cred_file.name}: {e}"
            else:
                cls._init_error = "Firebase service account credentials file not found."

        if cred:
            try:
                firebase_admin.initialize_app(cred, {
                    "projectId": FIREBASE_PROJECT_ID
                })
                cls._initialized = True
                cls._dry_run_mode = False
                cls._init_error = None
                logger.info("[FCM] Firebase Admin SDK initialized successfully for project: %s", FIREBASE_PROJECT_ID)
                return True
            except Exception as e:
                logger.error("[FCM] Error initializing firebase_admin: %s", e)
                cls._init_error = f"Error initializing firebase_admin: {e}"

        # Do not latch _initialized to True on failure so that retries are possible
        cls._initialized = False
        cls._dry_run_mode = True
        logger.warning(
            "[FCM] Firebase Admin SDK is NOT configured. %s",
            cls._init_error or "Place 'serviceAccountKey.json' in backend/ or set FIREBASE_CREDENTIALS_PATH."
        )
        return False

    @classmethod
    def is_configured(cls) -> bool:
        cls.initialize()
        return (not cls._dry_run_mode) and (len(firebase_admin._apps) > 0)

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        cls.initialize()
        is_conf = cls.is_configured()
        summary = get_fcm_token_summary()
        return {
            "success": True,
            "configured": is_conf,
            "fcm_enabled": is_conf,
            "status": "CONFIGURED" if is_conf else "FAILED",
            "project_id": FIREBASE_PROJECT_ID,
            "active_devices_count": summary["active_tokens_count"],
            "total_registered_tokens": summary["total_tokens_count"],
            "tokens": {
                "active_count": summary["active_tokens_count"],
                "total_count": summary["total_tokens_count"]
            },
            "recent_devices": summary["recent_devices"],
            "error": cls._init_error if not is_conf else None,
            "notice": None if is_conf else (cls._init_error or "Service Account key pending in environment (FIREBASE_CREDENTIALS_PATH)."),
            "origin_requirement": "Secure Context (HTTPS or localhost) required for browser WebPush/FCM"
        }


    @classmethod
    def send_wildlife_alert(
        cls,
        animal: str,
        confidence: float,
        risk_level: str,
        location: Dict[str, Any],
        event_id: str,
        timestamp: Optional[str] = None,
        source: str = "KAVACH_AI_DETECTION"
    ) -> Dict[str, Any]:
        """
        Dispatches high-priority FCM Push Notification to all registered field devices.
        Wired into the real YOLO detection pipeline with 10-second debouncing.
        """
        cls.initialize()

        # STRICT FILTER: FCM alerts are ONLY permitted for confirmed allowed wildlife species
        if not is_allowed_wildlife(animal):
            logger.warning("[FCM] Push alert rejected: '%s' is not in ALLOWED_WILDLIFE.", animal)
            return {
                "success": False,
                "status": "REJECTED_NON_WILDLIFE",
                "dispatched": 0,
                "message": f"'{animal}' is not in approved 15 wildlife classes. Push alert cancelled."
            }

        tokens = get_active_fcm_tokens()
        num_devices = len(tokens)

        village_name = location.get("village_name", "Monitored Sanctuary Sector")
        dist_str = location.get("distance_str", "~250 m from Settlement")
        time_display = timestamp or datetime.now().strftime("%H:%M:%S")

        print(f"\n[FCM] Send attempted to {num_devices} devices for {animal} detection ({event_id})", flush=True)

        if num_devices == 0:
            logger.info("[FCM] No registered device tokens found in database. Skipping push broadcast.")
            return {
                "success": True,
                "dispatched": 0,
                "failed": 0,
                "total": 0,
                "message": "No devices registered for background push."
            }

        title = f"🚨 WILDLIFE ALERT: {animal.upper()} DETECTED"
        body = f"⚠️ {risk_level} Risk | Conf: {confidence}% | {village_name} ({dist_str})"

        # WebPush & High-Priority Notification Configuration
        notification_payload = messaging.Notification(
            title=title,
            body=body
        )

        data_payload = {
            "event_id": str(event_id),
            "animal": str(animal),
            "confidence": str(confidence),
            "risk_level": str(risk_level),
            "village_name": str(village_name),
            "distance_str": str(dist_str),
            "timestamp": str(time_display),
            "source": str(source),
            "click_action": "/alert-device",
            "url": "/alert-device"
        }

        webpush_config = messaging.WebpushConfig(
            headers={
                "Urgency": "high",
                "TTL": "300" # 5 minutes time-to-live for immediate alerts
            },
            notification=messaging.WebpushNotification(
                title=title,
                body=body,
                icon="/favicon.ico",
                badge="/favicon.ico",
                tag=str(event_id),
                renotify=True,
                require_interaction=True,
                vibrate=[300, 100, 300, 100, 500]
            )
        )

        if cls._dry_run_mode or len(firebase_admin._apps) == 0:
            logger.warning("[FCM] Push dispatch skipped: Firebase Admin SDK is not configured.")
            return {
                "success": False,
                "status": "FAILED",
                "dispatched": 0,
                "delivered_count": 0,
                "failed": num_devices,
                "total": num_devices,
                "total_attempted": num_devices,
                "mode": "unconfigured",
                "message": f"FCM not configured on backend: {cls._init_error or 'serviceAccountKey.json missing'}"
            }

        # Real HTTP v1 Multicast Dispatch via Firebase Admin SDK
        try:
            multicast_msg = messaging.MulticastMessage(
                tokens=tokens,
                notification=notification_payload,
                data=data_payload,
                webpush=webpush_config
            )

            response = messaging.send_each_for_multicast(multicast_msg)

            success_count = response.success_count
            failure_count = response.failure_count

            print(f"[FCM] Send successful: {success_count} delivered | {failure_count} failed", flush=True)

            # Clean up invalid/expired tokens automatically
            if failure_count > 0:
                for idx, resp in enumerate(response.responses):
                    if not resp.success:
                        bad_token = tokens[idx]
                        err = resp.exception
                        err_code = getattr(err, "code", str(err))
                        err_msg = str(err).lower()
                        print(f"[FCM] Send failed for token ...{bad_token[-10:]}: {err_code} - {err}", flush=True)

                        # Check if token is unregistered/invalid
                        if (
                            isinstance(err, (messaging.UnregisteredError, messaging.SenderIdMismatchError))
                            or "invalid" in err_msg
                            or "not a valid" in err_msg
                            or "unregistered" in err_msg
                            or err_code in ["INVALID_ARGUMENT", "UNREGISTERED"]
                        ):
                            remove_invalid_fcm_token(bad_token)
                            print(f"[FCM] Invalid token removed: ...{bad_token[-12:]}", flush=True)

            is_ok = (success_count > 0)
            return {
                "success": is_ok,
                "status": "DELIVERED" if is_ok else "FAILED",
                "dispatched": success_count,
                "delivered_count": success_count,
                "failed": failure_count,
                "total": num_devices,
                "total_attempted": num_devices,
                "mode": "live_fcm"
            }

        except Exception as e:
            print(f"[FCM] Send failed: {e}", flush=True)
            logger.error("[FCM] Critical error during FCM multicast dispatch: %s", e)
            return {
                "success": False,
                "status": "FAILED",
                "error": str(e),
                "message": f"FCM multicast dispatch error: {e}",
                "dispatched": 0,
                "delivered_count": 0,
                "total": num_devices,
                "total_attempted": num_devices
            }

    @classmethod
    def send_test_push(
        cls,
        device_name: str = "Command Center",
        target_token: Optional[str] = None,
        title: Optional[str] = None,
        body: Optional[str] = None,
        animal: Optional[str] = None,
        risk_level: Optional[str] = None,
        confidence: Optional[float] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Sends an isolated test notification without generating a fake wildlife detection."""
        cls.initialize()

        if cls._dry_run_mode or len(firebase_admin._apps) == 0:
            print(f"[FCM] Test push aborted: Firebase Admin SDK is NOT configured ({cls._init_error})", flush=True)
            return {
                "success": False,
                "status": "FAILED",
                "dispatched": 0,
                "delivered_count": 0,
                "total": 0,
                "total_attempted": 0,
                "message": f"FCM is not configured on backend: {cls._init_error or 'Service Account key missing'}",
                "error": cls._init_error or "FCM credentials not found"
            }

        cleaned_target = target_token.strip() if (target_token and isinstance(target_token, str) and target_token.strip()) else None
        tokens = [cleaned_target] if cleaned_target else get_active_fcm_tokens()
        num_devices = len(tokens)

        print(f"\n[FCM] Send attempted to {num_devices} devices (TEST PUSH from {device_name})", flush=True)

        if num_devices == 0:
            return {
                "success": False,
                "status": "NO_DEVICES",
                "dispatched": 0,
                "delivered_count": 0,
                "total": 0,
                "total_attempted": 0,
                "message": "No registered device tokens available for test push."
            }

        push_title = title or "🧪 KAVACH TEST PUSH NOTIFICATION"
        push_body = body or f"System verification broadcast from {device_name}. Early Warning Push channels operational."

        notification_payload = messaging.Notification(title=push_title, body=push_body)
        data_payload = {
            "type": "TEST_ALERT",
            "is_test": "true",
            "event_id": f"TEST-PUSH-{datetime.now().strftime('%H%M%S')}",
            "source": device_name,
            "animal": animal or "SYSTEM TEST",
            "risk_level": risk_level or "LOW",
            "confidence": str(confidence or 99.0),
            "timestamp": datetime.now().isoformat(),
            "click_action": "/alert-device",
            "url": "/alert-device"
        }


        webpush_config = messaging.WebpushConfig(
            headers={"Urgency": "high"},
            notification=messaging.WebpushNotification(
                title=title,
                body=body,
                icon="/favicon.ico",
                tag="kavach-test-alert",
                renotify=True,
                vibrate=[200, 100, 200]
            )
        )

        try:
            multicast_msg = messaging.MulticastMessage(
                tokens=tokens,
                notification=notification_payload,
                data=data_payload,
                webpush=webpush_config
            )
            response = messaging.send_each_for_multicast(multicast_msg)
            success_count = response.success_count
            failure_count = response.failure_count
            print(f"[FCM] Send successful: {success_count} delivered | {failure_count} failed", flush=True)

            # Automatically prune invalid or unregistered tokens so the database stays clean
            if failure_count > 0:
                for idx, resp in enumerate(response.responses):
                    if not resp.success:
                        bad_token = tokens[idx]
                        err = resp.exception
                        err_code = getattr(err, "code", str(err))
                        err_msg = str(err).lower()
                        print(f"[FCM] Send failed for token ...{bad_token[-10:]}: {err_code} - {err}", flush=True)
                        if (
                            isinstance(err, (messaging.UnregisteredError, messaging.SenderIdMismatchError))
                            or "invalid" in err_msg
                            or "not a valid" in err_msg
                            or "unregistered" in err_msg
                            or err_code in ["INVALID_ARGUMENT", "UNREGISTERED"]
                        ):
                            remove_invalid_fcm_token(bad_token)
                            print(f"[FCM] Invalid token removed from database: ...{bad_token[-12:]}", flush=True)

            is_ok = (success_count > 0)
            return {
                "success": is_ok,
                "status": "SENT" if is_ok else "FAILED",
                "dispatched": success_count,
                "delivered_count": success_count,
                "failed": failure_count,
                "total": num_devices,
                "total_attempted": num_devices,
                "message": f"{success_count} delivered / {num_devices} devices" if is_ok else "Push delivery failed for all registered tokens."
            }
        except Exception as e:
            print(f"[FCM] Send failed: {e}", flush=True)
            return {
                "success": False,
                "status": "FAILED",
                "error": str(e),
                "message": f"Push dispatch failed: {e}",
                "dispatched": 0,
                "delivered_count": 0,
                "total": num_devices,
                "total_attempted": num_devices
            }
