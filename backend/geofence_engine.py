import math
import json
import logging
from typing import List, Dict, Any, Tuple
from db import get_db_connection

logger = logging.getLogger("kavach.geofence")

def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates geodesic distance between two coordinates in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def point_in_polygon(lat: float, lng: float, polygon: List[List[float]]) -> bool:
    """
    Ray-casting point in polygon algorithm.
    polygon is a list of [lat, lng] points.
    """
    n = len(polygon)
    inside = False
    p1x, p1y = polygon[0][0], polygon[0][1]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n][0], polygon[i % n][1]
        if lat > min(p1x, p2x):
            if lat <= max(p1x, p2x):
                if lng <= max(p1y, p2y):
                    if p1x != p2x:
                        xinters = (lat - p1x) * (p2y - p1y) / (p2x - p1x) + p1y
                    if p1y == p2y or lng <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def check_geofences(lat: float, lng: float) -> Dict[str, Any]:
    """
    Evaluates whether (lat, lng) falls inside any active geofence.
    Returns breach summaries, highest risk multiplier, and proximity details.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM geofences WHERE is_active = 1")
    rows = cursor.fetchall()
    conn.close()

    breached = []
    max_multiplier = 1.0
    min_dist_to_residential = 99999.0

    for row in rows:
        geo_id = row["id"]
        name = row["name"]
        geo_type = row["type"]
        geometry_type = row["geometry_type"]
        coords_raw = row["coordinates_json"]
        radius_m = row["radius_m"] or 0.0
        multiplier = row["risk_multiplier"] or 1.0

        is_inside = False
        dist = 0.0

        try:
            coords = json.loads(coords_raw)
            if geometry_type == "CIRCLE":
                center = coords.get("center", [0, 0])
                radius = coords.get("radius", radius_m)
                dist = haversine_meters(lat, lng, center[0], center[1])
                if geo_type == "RESIDENTIAL_BUFFER":
                    min_dist_to_residential = min(min_dist_to_residential, dist)
                if dist <= radius:
                    is_inside = True

            elif geometry_type == "POLYGON":
                # coords is [[lat, lng], [lat, lng], ...]
                if isinstance(coords, list) and len(coords) >= 3:
                    is_inside = point_in_polygon(lat, lng, coords)
                    # Approximate distance to centroid
                    avg_lat = sum(p[0] for p in coords) / len(coords)
                    avg_lng = sum(p[1] for p in coords) / len(coords)
                    dist = haversine_meters(lat, lng, avg_lat, avg_lng)
                    if geo_type == "RESIDENTIAL_BUFFER":
                        min_dist_to_residential = min(min_dist_to_residential, dist)

            if is_inside:
                breached.append({
                    "id": geo_id,
                    "name": name,
                    "type": geo_type,
                    "multiplier": multiplier,
                    "distance_m": round(dist, 1)
                })
                if multiplier > max_multiplier:
                    max_multiplier = multiplier

        except Exception as e:
            logger.error("Error parsing geofence %s: %s", geo_id, e)

    return {
        "has_breach": len(breached) > 0,
        "breached_count": len(breached),
        "breached_geofences": breached,
        "risk_multiplier": max_multiplier,
        "est_dist_to_settlement_m": round(min_dist_to_residential, 1) if min_dist_to_residential < 90000 else 1200.0
    }
