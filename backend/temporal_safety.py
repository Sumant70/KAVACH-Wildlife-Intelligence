"""
KAVACH Wildlife Intelligence — Temporal Safety & Multi-Frame Confirmation Engine.

Ensures real-world detection reliability:
1. Strict 4-Class Allowlist Enforcement (Elephant, Tiger, Leopard, Wild Boar).
2. Multi-Frame Consecutive Confirmation before any emergency alert is triggered.
3. Class Consistency Check: Resets confirmation if prediction flips (e.g. Tiger -> Leopard).
4. Bounding Box Quality Filter: Discards abnormal geometry, impossible aspect ratios, tiny slivers.
5. Alert Cooldown & Deduplication: Prevents alert storming / siren spam for continuous detections.
"""

import time
import math
import logging
import threading
from typing import Optional, List, Dict, Any, Tuple

logger = logging.getLogger("kavach.safety")

# Strict KAVACH 5-Class Production Allowlist
TARGET_PRODUCTION_SPECIES = {
    "elephant": "Elephant",
    "tiger": "Tiger",
    "leopard": "Leopard",
    "wild_boar": "Wild Boar",
    "dog": "Dog"
}

ALLOWED_CANONICAL_TARGETS = {"Elephant", "Tiger", "Leopard", "Wild Boar", "Dog"}


class BoundingBoxQualityFilter:
    """Validates bounding box geometry to reject false positive noise."""

    @staticmethod
    def is_valid_box(
        bbox: List[float],
        frame_shape: Tuple[int, int],
        min_pixels: float = 16.0,
        min_area_fraction: float = 0.001,
        max_aspect_ratio: float = 8.0,
        min_aspect_ratio: float = 0.125
    ) -> Tuple[bool, Optional[str]]:
        """
        Validates a [x1, y1, x2, y2] bounding box against the frame dimensions.
        Returns (is_valid, rejection_reason).
        """
        if not bbox or len(bbox) != 4:
            return False, "Malformed coordinates"

        x1, y1, x2, y2 = bbox
        bw = max(0.0, float(x2 - x1))
        bh = max(0.0, float(y2 - y1))

        if bw < min_pixels or bh < min_pixels:
            return False, f"Box too small ({bw:.0f}x{bh:.0f} px < {min_pixels}px minimum)"

        frame_h, frame_w = frame_shape[:2]
        frame_area = max(1.0, float(frame_w * frame_h))
        box_area = bw * bh
        area_fraction = box_area / frame_area

        if area_fraction < min_area_fraction:
            return False, f"Area fraction {area_fraction:.5f} below minimum {min_area_fraction}"

        aspect_ratio = bw / max(1.0, bh)
        if aspect_ratio > max_aspect_ratio or aspect_ratio < min_aspect_ratio:
            return False, f"Abnormal aspect ratio {aspect_ratio:.2f} (must be between {min_aspect_ratio} and {max_aspect_ratio})"

        return True, None


class TemporalConfirmationTracker:
    """
    Tracks detections across consecutive frames to confirm wildlife presence.
    Enforces multi-frame consistency:
    - Frame 1: Tiger (0.72) -> 1 frame
    - Frame 2: Tiger (0.78) -> 2 frames
    - Frame 3: Tiger (0.81) -> 3 frames (CONFIRMED)
    
    If predictions flip (e.g. Tiger -> Leopard), counter resets to 1.
    If no detection occurs, counter decays.
    """

    def __init__(self, stream_id: str, required_consecutive: int = 3, conf_floor: float = 0.30):
        self.stream_id = stream_id
        self.required_consecutive = required_consecutive
        self.conf_floor = conf_floor
        self.current_species: Optional[str] = None
        self.consecutive_count: int = 0
        self.confidence_history: List[float] = []
        self.last_update_time: float = time.time()
        self.is_confirmed: bool = False
        self.confirmed_at: Optional[float] = None

    def update(self, detected_species: Optional[str], confidence: float = 0.0) -> Dict[str, Any]:
        """
        Updates the temporal tracker with the latest frame's top prediction.
        Returns structured confirmation status.
        """
        now = time.time()
        self.last_update_time = now

        # Reject non-target species immediately
        if detected_species and detected_species not in ALLOWED_CANONICAL_TARGETS:
            detected_species = None

        if detected_species and confidence >= self.conf_floor:
            if detected_species == self.current_species:
                self.consecutive_count += 1
                self.confidence_history.append(confidence)
            else:
                # Class flipped (e.g. Tiger -> Leopard) -> Reset confirmation!
                self.current_species = detected_species
                self.consecutive_count = 1
                self.confidence_history = [confidence]
                self.is_confirmed = False
        else:
            # No valid target detection in this frame
            self.consecutive_count = max(0, self.consecutive_count - 1)
            if self.consecutive_count == 0:
                self.current_species = None
                self.confidence_history = []
                self.is_confirmed = False

        if self.consecutive_count >= self.required_consecutive and not self.is_confirmed:
            self.is_confirmed = True
            self.confirmed_at = now
            logger.info(
                "[SAFETY CONFIRMED] Stream %s: %s CONFIRMED across %d consecutive frames (Avg Conf: %.1f%%)",
                self.stream_id, self.current_species, self.consecutive_count,
                (sum(self.confidence_history) / len(self.confidence_history)) if self.confidence_history else confidence
            )

        avg_conf = (sum(self.confidence_history) / len(self.confidence_history)) if self.confidence_history else 0.0

        return {
            "stream_id": self.stream_id,
            "species": self.current_species,
            "consecutive_count": self.consecutive_count,
            "required_consecutive": self.required_consecutive,
            "is_confirmed": self.is_confirmed,
            "average_confidence": round(avg_conf, 1),
            "status": "CONFIRMED" if self.is_confirmed else f"PENDING_CONFIRMATION ({self.consecutive_count}/{self.required_consecutive})"
        }

    def reset(self):
        self.current_species = None
        self.consecutive_count = 0
        self.confidence_history = []
        self.is_confirmed = False
        self.confirmed_at = None


class AlertDeduplicator:
    """Thread-safe cooldown and duplicate alert suppressor for emergency pipelines."""

    def __init__(self, cooldown_seconds: float = 60.0):
        self.cooldown_seconds = cooldown_seconds
        self._last_alert_times: Dict[str, float] = {}
        self._lock = threading.Lock()

    def should_dispatch_alert(self, species: str, village_id: str) -> Tuple[bool, float]:
        """
        Determines whether a new emergency alert should be dispatched.
        Returns (should_dispatch, elapsed_since_last_sec).
        """
        key = f"{species.lower()}_{village_id.lower()}"
        now = time.time()

        with self._lock:
            last_time = self._last_alert_times.get(key, 0.0)
            elapsed = now - last_time

            if elapsed >= self.cooldown_seconds:
                self._last_alert_times[key] = now
                return True, elapsed
            return False, elapsed


# Global instances for system-wide reuse
_GLOBAL_TRACKERS: Dict[str, TemporalConfirmationTracker] = {}
_TRACKERS_LOCK = threading.Lock()
global_alert_deduplicator = AlertDeduplicator(cooldown_seconds=60.0)


def get_stream_tracker(stream_id: str, required_consecutive: int = 3, conf_floor: float = 0.30) -> TemporalConfirmationTracker:
    with _TRACKERS_LOCK:
        if stream_id not in _GLOBAL_TRACKERS:
            _GLOBAL_TRACKERS[stream_id] = TemporalConfirmationTracker(
                stream_id=stream_id,
                required_consecutive=required_consecutive,
                conf_floor=conf_floor
            )
        return _GLOBAL_TRACKERS[stream_id]
