"""
KAVACH Wildlife Intelligence — Movement & Trajectory Tracking Engine.
Tracks detected animals across consecutive video frames, calculates displacement,
smooths bounding box noise, and classifies movement status and direction.
"""

import math
from typing import List, Dict, Any, Optional, Tuple


def calculate_iou(boxA: List[float], boxB: List[float]) -> float:
    """Computes Intersection over Union (IoU) between two bounding boxes [x1, y1, x2, y2]."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    inter_w = max(0.0, xB - xA)
    inter_h = max(0.0, yB - yA)
    inter_area = inter_w * inter_h

    boxA_area = max(0.0, boxA[2] - boxA[0]) * max(0.0, boxA[3] - boxA[1])
    boxB_area = max(0.0, boxB[2] - boxB[0]) * max(0.0, boxB[3] - boxB[1])

    union_area = boxA_area + boxB_area - inter_area
    if union_area <= 0.0:
        return 0.0
    return inter_area / union_area


class AnimalTrack:
    """Represents a continuous track of an animal instance across video frames."""

    def __init__(self, track_id: int, initial_det: Dict[str, Any], frame_idx: int, timestamp_sec: float):
        self.track_id = track_id
        self.species = initial_det["species"]
        self.class_name = initial_det.get("class_name", self.species)
        self.class_id = initial_det.get("class_id", 0)
        self.emoji = initial_det.get("emoji", "🐾")
        self.hazard_score = initial_det.get("hazard_score", 50.0)

        bbox = initial_det["bbox"]
        cx = (bbox[0] + bbox[2]) / 2.0
        cy = (bbox[1] + bbox[3]) / 2.0
        w = max(1.0, bbox[2] - bbox[0])
        h = max(1.0, bbox[3] - bbox[1])
        area = w * h

        self.last_seen_frame = frame_idx
        self.frames_detected = 1
        self.max_confidence = initial_det["confidence"]
        self.latest_confidence = initial_det["confidence"]
        self.latest_bbox = bbox

        # History stores per-frame data points
        self.history: List[Dict[str, Any]] = [{
            "frame_idx": frame_idx,
            "timestamp_sec": timestamp_sec,
            "bbox": bbox,
            "cx": cx,
            "cy": cy,
            "w": w,
            "h": h,
            "area": area,
            "confidence": initial_det["confidence"]
        }]

        # Smoothed state (exponential moving average)
        self.smoothed_cx = cx
        self.smoothed_cy = cy
        self.smoothed_area = area

        # Movement classifications
        self.movement_status = "UNKNOWN"  # "MOVING" | "STATIONARY" | "UNKNOWN"
        self.direction = "UNKNOWN"        # "LEFT" | "RIGHT" | "UP" | "DOWN" | "APPROACHING" | "MOVING AWAY" | "STATIONARY" | "UNKNOWN"
        self.speed_px_per_sec = 0.0
        self.total_displacement_px = 0.0

    def update(self, det: Dict[str, Any], frame_idx: int, timestamp_sec: float, frame_diag: float):
        """Updates track with a new detection in the current frame."""
        self.last_seen_frame = frame_idx
        self.frames_detected += 1
        self.latest_confidence = det["confidence"]
        if det["confidence"] > self.max_confidence:
            self.max_confidence = det["confidence"]

        bbox = det["bbox"]
        self.latest_bbox = bbox
        cx = (bbox[0] + bbox[2]) / 2.0
        cy = (bbox[1] + bbox[3]) / 2.0
        w = max(1.0, bbox[2] - bbox[0])
        h = max(1.0, bbox[3] - bbox[1])
        area = w * h

        # Exponential moving average filter (alpha = 0.40) to eliminate bounding box jitter
        alpha = 0.40
        self.smoothed_cx = alpha * cx + (1.0 - alpha) * self.smoothed_cx
        self.smoothed_cy = alpha * cy + (1.0 - alpha) * self.smoothed_cy
        self.smoothed_area = alpha * area + (1.0 - alpha) * self.smoothed_area

        self.history.append({
            "frame_idx": frame_idx,
            "timestamp_sec": timestamp_sec,
            "bbox": bbox,
            "cx": cx,
            "cy": cy,
            "smoothed_cx": self.smoothed_cx,
            "smoothed_cy": self.smoothed_cy,
            "w": w,
            "h": h,
            "area": area,
            "confidence": det["confidence"]
        })

        # Calculate movement & direction across sliding window (last 4 to 8 frames)
        self._calculate_movement(frame_diag)

    def _calculate_movement(self, frame_diag: float):
        """Computes smoothed movement status and direction."""
        num_pts = len(self.history)
        if num_pts < 2:
            self.movement_status = "UNKNOWN"
            self.direction = "UNKNOWN"
            self.speed_px_per_sec = 0.0
            return

        # Look back across sliding window (last 2 to 8 frames)
        window_size = min(num_pts, 8)
        start_pt = self.history[-window_size]
        curr_pt = self.history[-1]

        # Use smoothed centroids to measure true trajectory
        start_cx = start_pt.get("smoothed_cx", start_pt["cx"])
        start_cy = start_pt.get("smoothed_cy", start_pt["cy"])
        curr_cx = curr_pt.get("smoothed_cx", curr_pt["cx"])
        curr_cy = curr_pt.get("smoothed_cy", curr_pt["cy"])

        dx = curr_cx - start_cx
        dy = curr_cy - start_cy
        displacement = math.sqrt(dx * dx + dy * dy)
        self.total_displacement_px = displacement

        dt = max(0.05, curr_pt["timestamp_sec"] - start_pt["timestamp_sec"])
        self.speed_px_per_sec = round(displacement / dt, 1)

        # Movement threshold: at least 8 pixels or 1.5% of frame diagonal
        motion_threshold = max(8.0, 0.015 * frame_diag)

        if displacement >= motion_threshold:
            self.movement_status = "MOVING"

            # Check for depth movement: Area expansion or contraction
            start_area = start_pt["area"]
            curr_area = curr_pt["area"]
            area_delta_ratio = (curr_area - start_area) / max(1.0, start_area)

            # If bounding box area grew significantly (>20%), the animal is approaching
            if area_delta_ratio > 0.20 and displacement < motion_threshold * 1.8:
                self.direction = "APPROACHING"
            # If bounding box area shrank significantly (<-20%), the animal is moving away
            elif area_delta_ratio < -0.20 and displacement < motion_threshold * 1.8:
                self.direction = "MOVING AWAY"
            else:
                # Direction from 2D displacement vector
                if abs(dx) >= abs(dy):
                    self.direction = "RIGHT" if dx > 0 else "LEFT"
                else:
                    self.direction = "DOWN" if dy > 0 else "UP"
        else:
            self.movement_status = "STATIONARY"
            self.direction = "UNKNOWN"

    def get_summary(self) -> Dict[str, Any]:
        """Returns structured summary for this animal track."""
        trajectory = [
            {"t": round(h["timestamp_sec"], 2), "x": round(h["cx"], 1), "y": round(h["cy"], 1)}
            for h in self.history
        ]
        return {
            "track_id": self.track_id,
            "species": self.species,
            "class_name": self.class_name,
            "emoji": self.emoji,
            "confidence": round(self.max_confidence, 1),
            "max_confidence": round(self.max_confidence, 1),
            "latest_confidence": round(self.latest_confidence, 1),
            "frames_detected": self.frames_detected,
            "movement_status": self.movement_status,
            "direction": self.direction,
            "speed_px_per_sec": self.speed_px_per_sec,
            "total_displacement_px": round(self.total_displacement_px, 1),
            "latest_bbox": self.latest_bbox,
            "trajectory": trajectory,
            "centroid_history": trajectory,
            "is_moving": self.movement_status == "MOVING"
        }


class WildlifeMovementTracker:
    """
    Lightweight Multi-Frame Object Tracker & Motion Analyzer for KAVACH.
    Associates YOLO detections across consecutive frames, calculates movement metrics,
    and produces frame-by-frame overlay metadata and overall movement summary.
    """

    def __init__(self, frame_width: int = 1280, frame_height: int = 720):
        self.frame_width = frame_width
        self.frame_height = frame_height
        self.frame_diag = math.sqrt(frame_width * frame_width + frame_height * frame_height)

        self.tracks: Dict[int, AnimalTrack] = {}
        self.next_track_id = 1
        self.max_lost_frames = 6  # Frames before track is declared finished

    def process_frame(self, detections: List[Dict[str, Any]], frame_idx: int, timestamp_sec: float) -> List[Dict[str, Any]]:
        """
        Ingests YOLO detections for a frame, updates tracks, and returns enriched frame detections.
        """
        matched_track_ids = set()
        unmatched_dets = []

        # 1. Match current detections to active tracks
        for det in detections:
            best_track_id = None
            best_score = 0.0

            bbox = det["bbox"]
            det_cx = (bbox[0] + bbox[2]) / 2.0
            det_cy = (bbox[1] + bbox[3]) / 2.0

            for track_id, track in self.tracks.items():
                if track_id in matched_track_ids:
                    continue
                # Strictly match same wildlife species
                if track.species != det["species"]:
                    continue
                # Don't match tracks lost for too long
                if frame_idx - track.last_seen_frame > self.max_lost_frames:
                    continue

                # Calculate IoU and centroid distance
                iou = calculate_iou(bbox, track.latest_bbox)
                last_cx = track.latest_bbox[0] + (track.latest_bbox[2] - track.latest_bbox[0]) / 2.0
                last_cy = track.latest_bbox[1] + (track.latest_bbox[3] - track.latest_bbox[1]) / 2.0
                dist = math.sqrt((det_cx - last_cx) ** 2 + (det_cy - last_cy) ** 2)

                # Matching score: combination of IoU and spatial proximity
                max_allowed_dist = 0.28 * self.frame_diag
                if iou >= 0.15 or dist <= max_allowed_dist:
                    score = iou + max(0.0, 1.0 - (dist / max_allowed_dist))
                    if score > best_score:
                        best_score = score
                        best_track_id = track_id

            if best_track_id is not None:
                matched_track_ids.add(best_track_id)
                self.tracks[best_track_id].update(det, frame_idx, timestamp_sec, self.frame_diag)
                det["track_id"] = best_track_id
                det["movement_status"] = self.tracks[best_track_id].movement_status
                det["direction"] = self.tracks[best_track_id].direction
                det["speed_px_per_sec"] = self.tracks[best_track_id].speed_px_per_sec
            else:
                unmatched_dets.append(det)

        # 2. Spawn new tracks for unmatched detections
        for det in unmatched_dets:
            new_id = self.next_track_id
            self.next_track_id += 1
            new_track = AnimalTrack(new_id, det, frame_idx, timestamp_sec)
            self.tracks[new_id] = new_track
            det["track_id"] = new_id
            det["movement_status"] = new_track.movement_status
            det["direction"] = new_track.direction
            det["speed_px_per_sec"] = new_track.speed_px_per_sec

        return detections

    def get_tracks_summary(self) -> List[Dict[str, Any]]:
        """Returns structured summaries for all tracked animals."""
        return [track.get_summary() for track in self.tracks.values()]

    def get_overall_movement_summary(self) -> Dict[str, Any]:
        """
        Computes overall high-level movement summary across all tracks.
        """
        all_tracks = list(self.tracks.values())
        # STEP 8: Multi-frame confirmation. Only tracks observed across >= 3 frames are considered CONFIRMED
        confirmed_tracks = [t for t in all_tracks if t.frames_detected >= 3]
        if not confirmed_tracks:
            return {
                "has_wildlife": False,
                "movement_status": "NONE",
                "dominant_direction": "NONE",
                "active_tracks_count": len(all_tracks),
                "is_moving": False,
                "description": "Transient detection (less than 3 consecutive frames). Emergency alert suppressed."
            }

        moving_tracks = [t for t in confirmed_tracks if t.movement_status == "MOVING"]
        stationary_tracks = [t for t in confirmed_tracks if t.movement_status == "STATIONARY"]

        is_moving = len(moving_tracks) > 0
        overall_status = "MOVING" if is_moving else ("STATIONARY" if stationary_tracks else "UNKNOWN")

        # Find dominant direction among moving animals
        direction_counts: Dict[str, int] = {}
        for t in moving_tracks:
            direction_counts[t.direction] = direction_counts.get(t.direction, 0) + 1

        dominant_dir = "UNKNOWN"
        if direction_counts:
            dominant_dir = max(direction_counts.items(), key=lambda item: item[1])[0]

        max_speed = max([t.speed_px_per_sec for t in all_tracks], default=0.0)

        # Species summary string
        species_list = list(dict.fromkeys([t.species for t in all_tracks]))
        species_str = ", ".join(species_list)

        if is_moving:
            desc = f"{species_str} observed MOVING in direction {dominant_dir}."
        elif overall_status == "STATIONARY":
            desc = f"{species_str} detected in STATIONARY posture."
        else:
            desc = f"{species_str} detected across brief frames."

        return {
            "has_wildlife": True,
            "movement_status": overall_status,
            "dominant_direction": dominant_dir,
            "is_moving": is_moving,
            "active_tracks_count": len(all_tracks),
            "moving_tracks_count": len(moving_tracks),
            "stationary_tracks_count": len(stationary_tracks),
            "max_speed_px_per_sec": max_speed,
            "species_list": species_list,
            "description": desc
        }
