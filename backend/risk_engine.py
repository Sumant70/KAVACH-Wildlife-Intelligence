import logging
from datetime import datetime
from typing import Dict, Any, Optional

from allowed_wildlife import match_allowed_wildlife, WILDLIFE_METADATA

logger = logging.getLogger("kavach.risk")

# Baseline species danger scores (0-100) reflecting potential conflict severity with humans/livestock
# Strictly configured from centralized WILDLIFE_METADATA for the 15 approved wildlife species
SPECIES_HAZARD_INDEX = {k: v["hazard_score"] for k, v in WILDLIFE_METADATA.items()}

def calculate_wildlife_risk(
    species: str,
    confidence: float,
    count: int = 1,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    distance_to_settlement_m: Optional[float] = None,
    geofence_multiplier: float = 1.0,
    recent_detections_count: int = 0,
    hour_of_day: Optional[int] = None
) -> Dict[str, Any]:
    """
    Computes a composite wildlife conflict risk score (0-100) and actionable explanation.
    Strictly returns 0.0 / 'NONE' if no target wildlife is detected.
    """
    if not species or "no target" in species.lower() or species.lower() in ["none", "null", "clear", "unknown"]:
        return {
            "risk_score": 0.0,
            "risk_level": "NONE",
            "reason": "No target dangerous wildlife identified in camera sector.",
            "recommendation": "Maintain standard automated perimeter scanning.",
            "factors": {
                "species_hazard": 0.0,
                "proximity_meters": 0.0,
                "temporal_window": "N/A",
                "geofence_multiplier": 1.0,
                "cluster_count": 0,
                "ai_confidence": 0.0
            }
        }

    matched_key = match_allowed_wildlife(species)
    if not matched_key:
        # Non-approved class or non-wildlife object
        return {
            "risk_score": 0.0,
            "risk_level": "NONE",
            "reason": f"Observed class '{species}' is not an approved high-risk wildlife target.",
            "recommendation": "No ranger dispatch or community alert required.",
            "factors": {
                "species_hazard": 0.0,
                "proximity_meters": 0.0,
                "temporal_window": "N/A",
                "geofence_multiplier": 1.0,
                "cluster_count": 0,
                "ai_confidence": confidence
            }
        }

    base_hazard = WILDLIFE_METADATA[matched_key]["hazard_score"]


    # 1. Proximity hazard (distance from nearest human habitation)
    dist = distance_to_settlement_m if distance_to_settlement_m is not None else 800.0
    proximity_points = 0.0
    if dist < 200.0:
        proximity_points = 30.0
    elif dist < 500.0:
        proximity_points = 20.0
    elif dist < 1000.0:
        proximity_points = 10.0
    else:
        proximity_points = 0.0

    # 2. Temporal hazard (nighttime vs dusk/dawn vs daylight)
    if hour_of_day is None:
        hour_of_day = datetime.now().hour

    temporal_points = 0.0
    time_label = "Daytime"
    if 20 <= hour_of_day or hour_of_day <= 5:
        temporal_points = 16.0
        time_label = "Nocturnal (High Conflict Window)"
    elif (5 < hour_of_day <= 7) or (17 <= hour_of_day < 20):
        temporal_points = 10.0
        time_label = "Crepuscular / Twilight"
    else:
        temporal_points = 2.0
        time_label = "Broad Daylight"

    # 3. Cluster / Recurrence factor
    cluster_points = min(recent_detections_count * 4.0, 16.0)

    # 4. Animal count / pack size
    count_points = min((count - 1) * 5.0, 15.0) if count > 1 else 0.0

    # Raw composite
    raw_score = (
        (base_hazard * 0.45) +
        (proximity_points * 0.9) +
        (temporal_points * 0.8) +
        (cluster_points * 0.7) +
        (count_points * 0.6)
    )

    # Confidence scaling (high AI confidence gives full weight)
    conf_factor = max(0.65, min(1.0, (confidence / 100.0)))
    scaled_score = raw_score * conf_factor

    # Apply geofence multiplier if coordinates fall inside residential buffer / critical corridor
    final_score = scaled_score * geofence_multiplier
    final_score = round(max(5.0, min(99.0, final_score)), 1)

    # Categorize Risk Level
    if final_score < 40.0:
        risk_level = "LOW"
        recommendation = "Maintain routine perimeter camera monitoring and record observation in field registry."
    elif final_score < 70.0:
        risk_level = "MEDIUM"
        recommendation = "Increase beat patrol frequency and alert nearby agricultural watch posts."
    elif final_score < 85.0:
        risk_level = "HIGH"
        recommendation = "Deploy Quick Response Team (QRT), issue localized SMS alerts, and activate solar floodlights."
    else:
        risk_level = "CRITICAL"
        recommendation = "EMERGENCY: Dispatch armed forest wardens with sirens, restrict village perimeter movement, and initiate active telemetry tracking."

    # Construct comprehensive explanation
    reasons = []
    if base_hazard >= 80:
        reasons.append(f"High-threat predator/mega-herbivore ({species.title()})")
    elif base_hazard >= 50:
        reasons.append(f"Moderate conflict potential ({species.title()})")
    else:
        reasons.append(f"Low-threat wildlife species ({species.title()})")

    if dist < 500:
        reasons.append(f"close proximity ({int(dist)}m) to human habitation")
    if temporal_points >= 10:
        reasons.append(f"active during {time_label.lower()}")
    if count > 1:
        reasons.append(f"group size of {count} animals")
    if geofence_multiplier > 1.0:
        reasons.append("active geofence breach in residential buffer")
    if recent_detections_count > 0:
        reasons.append(f"{recent_detections_count} previous sightings in this sector")

    reason_str = f"{species.title()} detected with {round(confidence, 1)}% AI confidence: " + ", ".join(reasons) + "."

    return {
        "risk_score": final_score,
        "risk_level": risk_level,
        "reason": reason_str,
        "recommendation": recommendation,
        "factors": {
            "species_hazard": base_hazard,
            "proximity_meters": dist,
            "temporal_window": time_label,
            "geofence_multiplier": geofence_multiplier,
            "cluster_count": recent_detections_count,
            "ai_confidence": confidence
        }
    }
