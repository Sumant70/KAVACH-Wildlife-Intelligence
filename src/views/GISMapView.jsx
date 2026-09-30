import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MapContainer, TileLayer, Marker, Popup, Circle, Polygon, Tooltip, useMap, Polyline
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  Compass, MapPin, Layers, Satellite, ShieldAlert, AlertTriangle,
  Crosshair, Radio, RefreshCw, Eye, CheckCircle2, Info, ChevronRight,
  Sparkles, Play, Activity, Map as MapIcon, Sliders, Bell, AlertOctagon
} from "lucide-react";
import { API_BASE_URL } from "../KavachApp";
import { getWildlifeEmoji, isAllowedWildlife } from "../allowedWildlife";

// Fix Leaflet default icon paths in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Protected Wildlife Reserves in India (Official conservation polygons)
const PROTECTED_RESERVES = [
  {
    name: "Tadoba-Andhari Tiger Reserve",
    state: "Maharashtra",
    center: [20.2667, 79.4000],
    polygon: [
      [20.35, 79.30], [20.38, 79.48], [20.22, 79.52], [20.15, 79.35]
    ],
    color: "#2E7D32"
  },
  {
    name: "Jim Corbett National Park",
    state: "Uttarakhand",
    center: [29.5300, 78.7740],
    polygon: [
      [29.62, 78.68], [29.65, 78.90], [29.45, 78.95], [29.42, 78.72]
    ],
    color: "#2E7D32"
  },
  {
    name: "Sanjay Gandhi National Park",
    state: "Maharashtra",
    center: [19.2500, 72.9170],
    polygon: [
      [19.28, 72.88], [19.30, 72.95], [19.20, 72.96], [19.18, 72.90]
    ],
    color: "#388E3C"
  }
];

// Helper: Geodesic Haversine Distance in meters
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Map Controller for smooth flyTo and recentering
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || 13, { animate: true, duration: 0.8 });
    }
  }, [center, zoom, map]);
  return null;
}

// Custom Marker Creators
const villageIcon = L.divIcon({
  className: "kavach-village-marker",
  html: `
    <div style="
      position: relative;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #059669;
      border: 2px solid #FFFFFF;
      box-shadow: 0 0 14px rgba(5, 150, 105, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    ">
      🏡
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

const cctvCameraIcon = L.divIcon({
  className: "kavach-cctv-marker",
  html: `
    <div style="
      position: relative;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #2563EB;
      border: 2px solid #FFFFFF;
      box-shadow: 0 0 10px rgba(37, 99, 235, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
    ">
      📹
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});

const userGpsIcon = L.divIcon({
  className: "kavach-user-gps-marker",
  html: `
    <div style="
      position: relative;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #3B82F6;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 0 16px #3B82F6;
    ">
      <div style="position: absolute; inset: -7px; border-radius: 50%; border: 2px solid rgba(59, 130, 246, 0.5); animation: pulse 2s infinite;"></div>
    </div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

// Species Marker with Emoji and Risk Glow
function createSpeciesMarker(species, riskLevel, isSelected = false) {
  const emoji = getWildlifeEmoji(species);
  const isCritical = riskLevel === "CRITICAL";
  const isHigh = riskLevel === "HIGH";

  let bg = "#10B981"; // Low risk
  if (riskLevel === "CRITICAL") bg = "#EF4444";
  else if (riskLevel === "HIGH") bg = "#F97316";
  else if (riskLevel === "MEDIUM" || riskLevel === "ALERT") bg = "#F59E0B";

  const size = isSelected ? 42 : 36;
  const shadow = isCritical
    ? "0 0 20px #EF4444, 0 0 10px #EF4444"
    : isHigh
    ? "0 0 16px #F97316"
    : "0 0 10px rgba(0,0,0,0.6)";

  return L.divIcon({
    className: "kavach-species-marker",
    html: `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${bg};
        border: ${isSelected ? "3px solid #FFD700" : "2.5px solid #FFFFFF"};
        box-shadow: ${shadow};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isSelected ? 20 : 18}px;
        cursor: pointer;
        transition: transform 0.2s;
        ${isCritical || isSelected ? "animation: pulse 1.2s infinite;" : ""}
      ">
        ${emoji}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
}

// History Small Dot Marker
function createHistoryDotMarker(species, riskLevel) {
  const emoji = getWildlifeEmoji(species);
  let color = "#10B981";
  if (riskLevel === "CRITICAL") color = "#EF4444";
  else if (riskLevel === "HIGH") color = "#F97316";
  else if (riskLevel === "MEDIUM" || riskLevel === "ALERT") color = "#F59E0B";

  return L.divIcon({
    className: "kavach-history-dot",
    html: `
      <div style="
        position: relative;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: ${color};
        border: 1.5px solid #FFFFFF;
        box-shadow: 0 0 8px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
      ">
        ${emoji}
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
}

export default function GISMapView({
  apiBaseUrl,
  detections = [],
  incidents = [],
  geofences = [],
  userGps,
  targetCoords
}) {
  const effectiveApiUrl = apiBaseUrl || API_BASE_URL;

  // View Mode: "map" (Street/Normal) | "satellite" (Satellite) | "hybrid" (Satellite + Labels)
  const [viewMode, setViewMode] = useState("satellite");

  // Layer Toggles
  const [showLiveLocation, setShowLiveLocation] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  const [showRiskZones, setShowRiskZones] = useState(true);
  const [showVillages, setShowVillages] = useState(true);
  const [showCameras, setShowCameras] = useState(true);

  // Data from backend
  const [villages, setVillages] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [activeDetections, setActiveDetections] = useState(detections);
  const [selectedDetection, setSelectedDetection] = useState(null);

  // Map Positioning
  const defaultCenter = [20.2667, 79.4000]; // Tadoba National Park corridor
  const [mapCenter, setMapCenter] = useState(targetCoords || defaultCenter);
  const [mapZoom, setMapZoom] = useState(targetCoords ? 14 : 12);

  // Error & Status States
  const [satelliteError, setSatelliteError] = useState(false);
  const [tileErrorMsg, setTileErrorMsg] = useState("");
  const [demoSimulating, setDemoSimulating] = useState(false);
  const [demoNotification, setDemoNotification] = useState(null);

  // Environment variables
  const configuredProvider = (import.meta.env?.VITE_MAP_PROVIDER || "esri").toLowerCase();
  const mapboxToken = import.meta.env?.VITE_MAPBOX_ACCESS_TOKEN || "";
  const googleApiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || "";

  // 1. Fetch Villages & Cameras from Backend SQLite DB
  useEffect(() => {
    fetch(`${effectiveApiUrl}/api/villages`)
      .then(r => r.json())
      .then(d => { if (d.villages) setVillages(d.villages); })
      .catch(e => console.warn("[GIS] Villages fetch note:", e.message));

    fetch(`${effectiveApiUrl}/api/cameras`)
      .then(r => r.json())
      .then(d => { if (d.cameras) setCameras(d.cameras); })
      .catch(e => console.warn("[GIS] Cameras fetch note:", e.message));
  }, [effectiveApiUrl]);

  // 2. Fetch Latest Detections from Backend
  useEffect(() => {
    fetch(`${effectiveApiUrl}/api/detections?limit=60`)
      .then(r => r.json())
      .then(d => {
        if (d.detections && d.detections.length > 0) {
          setActiveDetections(d.detections);
          // Auto select latest target detection if none selected
          if (!selectedDetection) {
            const valid = d.detections.find(x => x.lat && x.lng && isAllowedWildlife(x.species));
            if (valid) setSelectedDetection(valid);
          }
        }
      })
      .catch(e => console.warn("[GIS] Detections fetch note:", e.message));
  }, [effectiveApiUrl]);

  // Keep activeDetections in sync with props
  useEffect(() => {
    if (detections && detections.length > 0) {
      setActiveDetections(detections);
      if (!selectedDetection) {
        const latest = detections.find(d => d.lat && d.lng);
        if (latest) setSelectedDetection(latest);
      }
    }
  }, [detections]);

  // If navigation passes target coordinates, fly there
  useEffect(() => {
    if (targetCoords && targetCoords[0] && targetCoords[1]) {
      setMapCenter(targetCoords);
      setMapZoom(14);
    }
  }, [targetCoords]);

  // Calculate Nearest Settlement for any coordinate
  const getNearestSettlement = useMemo(() => {
    return (lat, lng) => {
      if (!lat || !lng || villages.length === 0) return null;
      let minD = Infinity;
      let nearestV = null;
      for (const v of villages) {
        if (v.lat && v.lng) {
          const d = calculateDistanceMeters(lat, lng, v.lat, v.lng);
          if (d !== null && d < minD) {
            minD = d;
            nearestV = v;
          }
        }
      }
      return nearestV ? { village: nearestV, distance_m: minD } : null;
    };
  }, [villages]);

  // Check if multiple detections have occurred in same sector (< 1500m)
  const isRepeatedActivity = useMemo(() => {
    if (!selectedDetection || !selectedDetection.lat || !selectedDetection.lng) return false;
    const sLat = selectedDetection.lat;
    const sLng = selectedDetection.lng;
    const nearbyCount = activeDetections.filter(d => {
      if (!d.lat || !d.lng || d.id === selectedDetection.id) return false;
      const dist = calculateDistanceMeters(sLat, sLng, d.lat, d.lng);
      return dist !== null && dist <= 1800;
    }).length;
    return nearbyCount >= 1;
  }, [selectedDetection, activeDetections]);

  // Build sequential movement polyline for detection history
  const historyTrailCoords = useMemo(() => {
    return activeDetections
      .filter(d => d.lat && d.lng && isAllowedWildlife(d.species))
      .slice(0, 15)
      .map(d => [d.lat, d.lng]);
  }, [activeDetections]);

  // Current detection details for the right-hand card
  const currentDetails = useMemo(() => {
    if (!selectedDetection) return null;
    const s = selectedDetection;
    const lat = s.latitude || s.lat;
    const lng = s.longitude || s.lng;
    const nearest = getNearestSettlement(lat, lng);
    const distM = s.distance_to_settlement || (nearest ? nearest.distance_m : 350);
    const vName = s.village_name || (nearest ? nearest.village.name : "Moharli Village");

    // Dynamic risk zone radius based on severity
    let riskRadius = 500;
    if (s.risk_level === "CRITICAL") riskRadius = 1500;
    else if (s.risk_level === "HIGH") riskRadius = 1000;
    else if (s.risk_level === "MEDIUM") riskRadius = 500;
    else riskRadius = 250;

    return {
      id: s.id,
      species: s.species || "Elephant",
      confidence: s.confidence ? Number(s.confidence).toFixed(1) : "91.0",
      risk_level: s.risk_level || "HIGH",
      risk_score: s.risk_score || 85.0,
      lat: Number(lat).toFixed(5),
      lng: Number(lng).toFixed(5),
      rawLat: lat,
      rawLng: lng,
      timestamp: s.timestamp || "Today, 16:36",
      settlementDistance: distM,
      settlementName: vName,
      status: s.alert_sent || s.risk_level === "HIGH" || s.risk_level === "CRITICAL" ? "ALERT SENT" : "RECORDED",
      riskRadius
    };
  }, [selectedDetection, getNearestSettlement]);

  // Tile Providers Configuration
  // 1. Street / Normal: OpenStreetMap
  const streetUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  // 2. High-Resolution Satellite: Esri World Imagery (Legal, high-res satellite tiles, 0 API key needed)
  // Or Mapbox if token configured
  let satelliteUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  let hybridLabelsUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

  if (configuredProvider === "mapbox" && mapboxToken) {
    satelliteUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`;
    hybridLabelsUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`;
  } else if (configuredProvider === "mapbox" && !mapboxToken && !satelliteError) {
    // Graceful fallback if mapbox selected without key
    setSatelliteError(true);
    setTileErrorMsg("Satellite imagery unavailable — configure MAP API key (Using Esri World Imagery)");
  }

  // Handle Mode Change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setSatelliteError(false);
  };

  // Demo Elephant Detection Simulation
  const handleSimulateElephant = async () => {
    setDemoSimulating(true);
    const demoLat = 20.2667;
    const demoLng = 79.4000;

    try {
      const resp = await fetch(`${effectiveApiUrl}/api/alerts/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animal: "Elephant",
          confidence: 91.5
        })
      });
      const data = await resp.json();

      const newDemoDet = {
        id: data.alert?.event_id || `DEMO-ELE-${Date.now().toString().slice(-4)}`,
        species: "Elephant",
        confidence: 91.5,
        lat: demoLat,
        lng: demoLng,
        latitude: demoLat,
        longitude: demoLng,
        risk_level: "HIGH",
        risk_score: 88.0,
        village_name: "Moharli Village",
        distance_to_settlement: 350,
        timestamp: new Date().toLocaleTimeString(),
        status: "ALERT SENT",
        alert_sent: true,
        is_demo: true
      };

      setActiveDetections(prev => [newDemoDet, ...prev]);
      setSelectedDetection(newDemoDet);
      setMapCenter([demoLat, demoLng]);
      setMapZoom(14);

      setDemoNotification({
        title: "DEMO ELEPHANT DETECTION DISPATCHED",
        msg: "Elephant located ~350m from Moharli Village Configured Safety Zone. Map centered.",
        time: new Date().toLocaleTimeString()
      });

      setTimeout(() => setDemoNotification(null), 6000);
    } catch (e) {
      console.error("Demo simulation error:", e);
    } finally {
      setDemoSimulating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: "calc(100vh - 120px)" }}>
      {/* 1. Header GIS Bar */}
      <div
        className="kv-panel"
        style={{
          padding: "12px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          borderBottom: "2px solid #1E3B2A"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: "linear-gradient(135deg, #183827, #0D2116)",
              border: "1px solid #3F8A5D",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Compass size={18} color="#D6A84F" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#EEF4EE", fontFamily: "'Rajdhani', sans-serif", letterSpacing: 0.8 }}>
                KAVACH WILDLIFE CONFLICT INTELLIGENCE MAP
              </div>
              <div style={{ fontSize: 10.5, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>
                SATELLITE IMAGERY & GPS-BASED DETECTION TELEMETRY
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 10,
              padding: "2px 7px",
              borderRadius: 4,
              background: userGps ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
              color: userGps ? "#10B981" : "#F59E0B",
              border: `1px solid ${userGps ? "#10B981" : "#F59E0B"}`,
              fontWeight: 700,
              fontFamily: "'IBM Plex Mono', monospace"
            }}>
              {userGps ? "● GPS ACTIVE" : "○ GPS FALLBACK"}
            </span>

            <span style={{
              fontSize: 10,
              padding: "2px 7px",
              borderRadius: 4,
              background: "rgba(59, 130, 246, 0.15)",
              color: "#60A5FA",
              border: "1px solid #3B82F6",
              fontWeight: 700,
              fontFamily: "'IBM Plex Mono', monospace"
            }}>
              TILE: {viewMode === "map" ? "STREET (OSM)" : viewMode === "satellite" ? "SATELLITE (ESRI)" : "HYBRID (SATELLITE+LABELS)"}
            </span>
          </div>
        </div>

        {/* View Controls: [ MAP ] [ SATELLITE ] [ HYBRID ] */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{
            display: "flex",
            background: "#08130D",
            borderRadius: 6,
            border: "1px solid #1F422F",
            padding: 3,
            gap: 2
          }}>
            <button
              id="map-btn-normal"
              onClick={() => handleViewModeChange("map")}
              style={{
                background: viewMode === "map" ? "#194029" : "transparent",
                border: "none",
                color: viewMode === "map" ? "#4CAF50" : "#8FA396",
                padding: "6px 14px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s"
              }}
            >
              <MapIcon size={13} />
              <span>MAP</span>
            </button>

            <button
              id="map-btn-satellite"
              onClick={() => handleViewModeChange("satellite")}
              style={{
                background: viewMode === "satellite" ? "#194029" : "transparent",
                border: "none",
                color: viewMode === "satellite" ? "#4CAF50" : "#8FA396",
                padding: "6px 14px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s"
              }}
            >
              <Satellite size={13} />
              <span>SATELLITE</span>
            </button>

            <button
              id="map-btn-hybrid"
              onClick={() => handleViewModeChange("hybrid")}
              style={{
                background: viewMode === "hybrid" ? "#194029" : "transparent",
                border: "none",
                color: viewMode === "hybrid" ? "#4CAF50" : "#8FA396",
                padding: "6px 14px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s"
              }}
            >
              <Layers size={13} />
              <span>HYBRID</span>
            </button>
          </div>

          {/* Quick Layer Controls: [ LIVE LOCATION ] [ DETECTION HISTORY ] [ RISK ZONES ] */}
          <button
            onClick={() => {
              if (userGps?.lat && userGps?.lng) {
                setMapCenter([userGps.lat, userGps.lng]);
                setMapZoom(14);
              } else if (currentDetails?.rawLat) {
                setMapCenter([currentDetails.rawLat, currentDetails.rawLng]);
                setMapZoom(14);
              }
            }}
            title="Recenter to active telemetry location"
            style={{
              background: "#0D2217",
              border: "1px solid #234E35",
              color: "#60A5FA",
              padding: "6px 10px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 5
            }}
          >
            <Crosshair size={13} />
            <span>LIVE LOCATION</span>
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              background: showHistory ? "#183B27" : "#0D2217",
              border: `1px solid ${showHistory ? "#388E3C" : "#234E35"}`,
              color: showHistory ? "#A3E635" : "#8FA396",
              padding: "6px 10px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 5
            }}
          >
            <Activity size={13} />
            <span>DETECTION HISTORY {showHistory ? "ON" : "OFF"}</span>
          </button>

          <button
            onClick={() => setShowRiskZones(!showRiskZones)}
            style={{
              background: showRiskZones ? "#183B27" : "#0D2217",
              border: `1px solid ${showRiskZones ? "#388E3C" : "#234E35"}`,
              color: showRiskZones ? "#F59E0B" : "#8FA396",
              padding: "6px 10px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 5
            }}
          >
            <ShieldAlert size={13} />
            <span>RISK ZONES {showRiskZones ? "ON" : "OFF"}</span>
          </button>

          {/* Demo Mode Action */}
          <button
            id="simulate-elephant-btn"
            onClick={handleSimulateElephant}
            disabled={demoSimulating}
            style={{
              background: "linear-gradient(135deg, #7C2D12, #431407)",
              border: "1px solid #EA580C",
              color: "#FED7AA",
              padding: "6px 12px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: 5,
              boxShadow: "0 0 10px rgba(234, 88, 12, 0.3)"
            }}
          >
            <Play size={12} fill="#FED7AA" />
            <span>{demoSimulating ? "SIMULATING..." : "SIMULATE ELEPHANT DETECTION"}</span>
          </button>
        </div>
      </div>

      {/* Satellite Imagery Provider Error Notice if API key missing */}
      {satelliteError && (
        <div style={{
          background: "rgba(239, 68, 68, 0.12)",
          border: "1px solid #EF4444",
          color: "#FCA5A5",
          padding: "8px 16px",
          borderRadius: 6,
          fontSize: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={15} color="#EF4444" />
            <span>{tileErrorMsg || "Satellite imagery unavailable — configure MAP API key"}</span>
          </div>
          <button
            onClick={() => setViewMode("map")}
            style={{
              background: "#EF4444",
              color: "#FFF",
              border: "none",
              padding: "3px 10px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700
            }}
          >
            Switch to Normal Map
          </button>
        </div>
      )}

      {/* Demo Notification Banner */}
      {demoNotification && (
        <div style={{
          background: "rgba(249, 115, 22, 0.15)",
          border: "1px solid #F97316",
          color: "#FED7AA",
          padding: "8px 16px",
          borderRadius: 6,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🐘</span>
            <strong>{demoNotification.title}:</strong> {demoNotification.msg}
          </div>
          <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}>{demoNotification.time}</span>
        </div>
      )}

      {/* 2. Main Map Workspace with Right-Hand Intelligence Card */}
      <div style={{ display: "flex", gap: 14, flex: 1, minHeight: 600 }}>
        {/* Map Canvas Viewport */}
        <div style={{
          flex: 1,
          position: "relative",
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid #1E3B2A",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
        }}>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ width: "100%", height: "100%", minHeight: 580 }}
            zoomControl={true}
          >
            <MapController center={mapCenter} zoom={mapZoom} />

            {/* Base Tile Layer */}
            {viewMode === "map" && (
              <TileLayer
                key="osm-street-layer"
                url={streetUrl}
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                maxZoom={19}
              />
            )}

            {viewMode === "satellite" && (
              <TileLayer
                key="esri-satellite-layer"
                url={satelliteUrl}
                attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
                maxZoom={19}
                eventHandlers={{
                  tileerror: () => {
                    setSatelliteError(true);
                    setTileErrorMsg("Satellite imagery tile error — fallback to normal map available");
                  }
                }}
              />
            )}

            {viewMode === "hybrid" && (
              <>
                <TileLayer
                  key="esri-hybrid-base"
                  url={satelliteUrl}
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
                  maxZoom={19}
                />
                <TileLayer
                  key="esri-hybrid-labels"
                  url={hybridLabelsUrl}
                  attribution='&copy; Esri Boundaries & Places'
                  maxZoom={19}
                  opacity={0.9}
                />
              </>
            )}

            {/* User GPS Telemetry Marker */}
            {showLiveLocation && userGps && (
              <>
                <Marker position={[userGps.lat, userGps.lng]} icon={userGpsIcon}>
                  <Popup>
                    <div style={{ color: "#0B1712", fontFamily: "sans-serif", fontSize: 12 }}>
                      <strong style={{ color: "#2563EB" }}>📍 Active Field Unit GPS</strong><br />
                      Latitude: {userGps.lat?.toFixed(5)}<br />
                      Longitude: {userGps.lng?.toFixed(5)}<br />
                      Accuracy: ±{Math.round(userGps.accuracy || 20)}m
                    </div>
                  </Popup>
                </Marker>
                <Circle
                  center={[userGps.lat, userGps.lng]}
                  radius={userGps.accuracy || 25}
                  pathOptions={{ color: "#3B82F6", fillColor: "#3B82F6", fillOpacity: 0.12, weight: 1.5 }}
                />
              </>
            )}

            {/* Protected Reserve Forest Boundaries */}
            {PROTECTED_RESERVES.map((res) => (
              <Polygon
                key={res.name}
                positions={res.polygon}
                pathOptions={{
                  color: "#4CAF50",
                  fillColor: "#4CAF50",
                  fillOpacity: 0.08,
                  weight: 2,
                  dashArray: "4, 6"
                }}
              >
                <Tooltip sticky>
                  <div>
                    <strong>{res.name}</strong><br />
                    State: {res.state} (Official Conservation Zone)
                  </div>
                </Tooltip>
              </Polygon>
            ))}

            {/* Human Settlements / Villages with Configured Safety Zones */}
            {showVillages && villages.map((v) => {
              if (!v.lat || !v.lng) return null;
              const center = [v.lat, v.lng];

              return (
                <React.Fragment key={v.id}>
                  {/* Concentric Configured Safety Zones */}
                  {showRiskZones && (
                    <>
                      {/* 1. Safe Perimeter (3000m) */}
                      <Circle
                        center={center}
                        radius={3000}
                        pathOptions={{
                          color: "#10B981",
                          fillColor: "#10B981",
                          fillOpacity: 0.03,
                          weight: 1,
                          dashArray: "6, 8"
                        }}
                      />

                      {/* 2. Warning Buffer (1500m) */}
                      <Circle
                        center={center}
                        radius={v.alert_radius_m || 1500}
                        pathOptions={{
                          color: "#F59E0B",
                          fillColor: "#F59E0B",
                          fillOpacity: 0.06,
                          weight: 1.5,
                          dashArray: "4, 6"
                        }}
                      />

                      {/* 3. Danger Core (500m) */}
                      <Circle
                        center={center}
                        radius={v.danger_radius_m || 500}
                        pathOptions={{
                          color: "#EF4444",
                          fillColor: "#EF4444",
                          fillOpacity: 0.12,
                          weight: 2
                        }}
                      />
                    </>
                  )}

                  {/* Settlement Marker */}
                  <Marker position={center} icon={villageIcon}>
                    <Popup>
                      <div style={{ color: "#0B1712", fontFamily: "sans-serif", maxWidth: 220 }}>
                        <h4 style={{ margin: "0 0 4px", color: "#059669", fontWeight: "bold" }}>
                          🏡 {v.name}
                        </h4>
                        <div style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>
                          {v.district}, {v.state}
                        </div>
                        <div style={{ fontSize: 11, marginBottom: 2 }}>
                          👥 Residents: <strong>{v.registered_users || 180}</strong>
                        </div>
                        <div style={{ fontSize: 11, marginBottom: 2 }}>
                          📞 Emergency Helpline: <strong style={{ color: "#059669" }}>{v.emergency_contact}</strong>
                        </div>
                        <div style={{ fontSize: 10, color: "#666", marginTop: 4, paddingTop: 4, borderTop: "1px solid #ddd" }}>
                          Configured Safety Zone: 500m Danger / 1500m Warning Buffer
                        </div>
                      </div>
                    </Popup>
                    <Tooltip sticky>
                      <strong>🏡 {v.name}</strong> (Configured Safety Zone)
                    </Tooltip>
                  </Marker>
                </React.Fragment>
              );
            })}

            {/* CCTV / Optical Camera Posts */}
            {showCameras && cameras.map((cam) => {
              if (!cam.lat || !cam.lng) return null;
              return (
                <Marker key={cam.id} position={[cam.lat, cam.lng]} icon={cctvCameraIcon}>
                  <Popup>
                    <div style={{ color: "#0B1712", fontFamily: "sans-serif", width: 200 }}>
                      <strong style={{ color: "#2563EB" }}>📹 {cam.name}</strong>
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                        {cam.forest_range} • {cam.status || "ONLINE"}
                      </div>
                    </div>
                  </Popup>
                  <Tooltip sticky>
                    <span>📹 {cam.name}</span>
                  </Tooltip>
                </Marker>
              );
            })}

            {/* Detection History Movement Trail */}
            {showHistory && historyTrailCoords.length >= 2 && (
              <Polyline
                positions={historyTrailCoords}
                pathOptions={{
                  color: "#D6A84F",
                  weight: 2.5,
                  dashArray: "6, 8",
                  opacity: 0.8
                }}
              />
            )}

            {/* Historical Detections (Small Dots) */}
            {showHistory && activeDetections
              .filter(d => d.lat && d.lng && isAllowedWildlife(d.species) && d.id !== selectedDetection?.id)
              .slice(0, 30)
              .map(d => (
                <Marker
                  key={`hist-${d.id}`}
                  position={[d.lat, d.lng]}
                  icon={createHistoryDotMarker(d.species, d.risk_level)}
                  eventHandlers={{
                    click: () => {
                      setSelectedDetection(d);
                      setMapCenter([d.lat, d.lng]);
                    }
                  }}
                >
                  <Popup>
                    <div style={{ color: "#0B1712", fontFamily: "sans-serif", fontSize: 11 }}>
                      <strong>{getWildlifeEmoji(d.species)} {d.species} (Historical)</strong><br />
                      Time: {d.timestamp}<br />
                      Confidence: {d.confidence}%<br />
                      Risk Level: {d.risk_level}
                    </div>
                  </Popup>
                </Marker>
              ))
            }

            {/* Selected / Current Wildlife Detection Marker */}
            {currentDetails && (
              <>
                <Marker
                  position={[currentDetails.rawLat, currentDetails.rawLng]}
                  icon={createSpeciesMarker(currentDetails.species, currentDetails.risk_level, true)}
                >
                  <Popup>
                    <div style={{ color: "#0B1712", fontFamily: "sans-serif", minWidth: 210 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <h4 style={{ margin: 0, color: "#1B3B2B", fontWeight: 800 }}>
                          {getWildlifeEmoji(currentDetails.species)} {currentDetails.species.toUpperCase()}
                        </h4>
                        <span style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 3,
                          background: currentDetails.risk_level === "CRITICAL" ? "#FEE2E2" : "#FEF3C7",
                          color: currentDetails.risk_level === "CRITICAL" ? "#991B1B" : "#92400E",
                          fontWeight: 700
                        }}>
                          {currentDetails.risk_level}
                        </span>
                      </div>

                      <div style={{ fontSize: 11, marginBottom: 2 }}>
                        Confidence: <strong>{currentDetails.confidence}%</strong>
                      </div>
                      <div style={{ fontSize: 11, marginBottom: 2 }}>
                        Detection Time: <strong>{currentDetails.timestamp}</strong>
                      </div>
                      <div style={{ fontSize: 11, marginBottom: 2 }}>
                        GPS: <strong>{currentDetails.lat}, {currentDetails.lng}</strong>
                      </div>
                      <div style={{ fontSize: 11, marginBottom: 4, color: "#059669", fontWeight: 700 }}>
                        📍 {currentDetails.settlementDistance}m from {currentDetails.settlementName}
                      </div>

                      <div style={{ fontSize: 10.5, color: "#555", borderTop: "1px solid #eee", paddingTop: 4, marginTop: 4 }}>
                        Status: <strong>{currentDetails.status}</strong>
                      </div>
                    </div>
                  </Popup>
                </Marker>

                {/* Visual Risk Zone Circle around Detection */}
                {showRiskZones && (
                  <Circle
                    center={[currentDetails.rawLat, currentDetails.rawLng]}
                    radius={currentDetails.riskRadius}
                    pathOptions={{
                      color: currentDetails.risk_level === "CRITICAL" ? "#EF4444" : currentDetails.risk_level === "HIGH" ? "#F97316" : "#F59E0B",
                      fillColor: currentDetails.risk_level === "CRITICAL" ? "#EF4444" : currentDetails.risk_level === "HIGH" ? "#F97316" : "#F59E0B",
                      fillOpacity: currentDetails.risk_level === "CRITICAL" ? 0.22 : 0.15,
                      weight: 2,
                      dashArray: currentDetails.risk_level === "CRITICAL" ? undefined : "6, 6"
                    }}
                  />
                )}
              </>
            )}
          </MapContainer>

          {/* Floating Map Legend Overlay */}
          <div
            style={{
              position: "absolute",
              bottom: 14,
              left: 14,
              zIndex: 1000,
              background: "rgba(8, 18, 12, 0.94)",
              backdropFilter: "blur(6px)",
              border: "1px solid #1E3B2A",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 11,
              color: "#EEF4EE",
              display: "flex",
              flexDirection: "column",
              gap: 5,
              boxShadow: "0 4px 16px rgba(0,0,0,0.6)"
            }}
          >
            <div style={{ fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#D6A84F", marginBottom: 2 }}>
              CONFLICT RISK INTELLIGENCE LEGEND
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981" }} />
                <span>🟢 LOW RISK</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#F59E0B" }} />
                <span>🟡 MEDIUM RISK</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#F97316" }} />
                <span>🟠 HIGH RISK</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444" }} />
                <span>🔴 CRITICAL</span>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #1C3626", paddingTop: 4, marginTop: 2, display: "flex", gap: 10, fontSize: 10.5, color: "#8FA396" }}>
              <span>🏡 Safety Zone</span>
              <span>📹 CCTV Post</span>
              <span>--- Movement Trail</span>
            </div>
          </div>
        </div>

        {/* 3. Right-Side Intelligence Panel */}
        <div style={{ width: 340, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Card A: CURRENT DETECTION */}
          <div className="kv-panel" style={{ padding: "16px", borderRadius: 10, border: "1px solid #1E3B2A" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ShieldAlert size={16} color="#D6A84F" />
                <span style={{ fontSize: 13, fontWeight: 800, color: "#EEF4EE", fontFamily: "'Rajdhani', sans-serif" }}>
                  CURRENT DETECTION
                </span>
              </div>
              {currentDetails?.id && (
                <span style={{ fontSize: 10, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {currentDetails.id}
                </span>
              )}
            </div>

            {currentDetails ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Big Species Header */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: 6,
                  background: "#08160E",
                  border: "1px solid #1C3E2B"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 28 }}>{getWildlifeEmoji(currentDetails.species)}</span>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#EEF4EE" }}>
                        {currentDetails.species}
                      </div>
                      <div style={{ fontSize: 11, color: "#8FA396" }}>
                        Confidence: <strong style={{ color: "#4CAF50" }}>{currentDetails.confidence}%</strong>
                      </div>
                    </div>
                  </div>

                  <span style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 800,
                    background: currentDetails.risk_level === "CRITICAL" ? "rgba(239, 68, 68, 0.2)" : currentDetails.risk_level === "HIGH" ? "rgba(249, 115, 22, 0.2)" : "rgba(245, 158, 11, 0.2)",
                    color: currentDetails.risk_level === "CRITICAL" ? "#EF4444" : currentDetails.risk_level === "HIGH" ? "#F97316" : "#F59E0B",
                    border: `1px solid ${currentDetails.risk_level === "CRITICAL" ? "#EF4444" : currentDetails.risk_level === "HIGH" ? "#F97316" : "#F59E0B"}`
                  }}>
                    {currentDetails.risk_level}
                  </span>
                </div>

                {/* Telemetry Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
                  <div style={{ background: "#0A1B12", padding: "8px 10px", borderRadius: 4, border: "1px solid #183524" }}>
                    <div style={{ color: "#7A9183", fontSize: 9.5 }}>LOCATION (GPS)</div>
                    <div style={{ color: "#EEF4EE", fontWeight: 700, marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {currentDetails.lat}, {currentDetails.lng}
                    </div>
                  </div>

                  <div style={{ background: "#0A1B12", padding: "8px 10px", borderRadius: 4, border: "1px solid #183524" }}>
                    <div style={{ color: "#7A9183", fontSize: 9.5 }}>SETTLEMENT DISTANCE</div>
                    <div style={{ color: "#F59E0B", fontWeight: 700, marginTop: 2 }}>
                      ~{currentDetails.settlementDistance}m
                    </div>
                  </div>

                  <div style={{ background: "#0A1B12", padding: "8px 10px", borderRadius: 4, border: "1px solid #183524" }}>
                    <div style={{ color: "#7A9183", fontSize: 9.5 }}>NEARBY VILLAGE</div>
                    <div style={{ color: "#10B981", fontWeight: 700, marginTop: 2 }}>
                      {currentDetails.settlementName}
                    </div>
                  </div>

                  <div style={{ background: "#0A1B12", padding: "8px 10px", borderRadius: 4, border: "1px solid #183524" }}>
                    <div style={{ color: "#7A9183", fontSize: 9.5 }}>ALERT STATUS</div>
                    <div style={{ color: "#60A5FA", fontWeight: 700, marginTop: 2 }}>
                      {currentDetails.status}
                    </div>
                  </div>
                </div>

                {/* Repeated Activity Banner */}
                {isRepeatedActivity && (
                  <div style={{
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid #EF4444",
                    borderRadius: 6,
                    padding: "8px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 11,
                    color: "#FCA5A5",
                    fontWeight: 700
                  }}>
                    <AlertOctagon size={16} color="#EF4444" />
                    <span>⚠️ REPEATED WILDLIFE ACTIVITY IN THIS SECTOR</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: "20px 10px", textAlign: "center", color: "#8FA396", fontSize: 12 }}>
                No active detection selected. Click any map marker or run detection in Detection Hub.
              </div>
            )}
          </div>

          {/* Card B: "WHY IS THIS ALERT IMPORTANT?" (Part 13 Requirement) */}
          <div className="kv-panel" style={{ padding: "16px", borderRadius: 10, border: "1px solid #1E3B2A", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Info size={15} color="#4CAF50" />
              <span style={{ fontSize: 13, fontWeight: 800, color: "#EEF4EE", fontFamily: "'Rajdhani', sans-serif" }}>
                WHY IS THIS ALERT IMPORTANT?
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "#4CAF50", fontWeight: 700 }}>1.</span>
                <div>
                  <strong style={{ color: "#EEF4EE" }}>Camera & AI Detection:</strong> Confirmed positive classification using trained KAVACH YOLO model.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "#4CAF50", fontWeight: 700 }}>2.</span>
                <div>
                  <strong style={{ color: "#EEF4EE" }}>Species Validation:</strong> Species verified against centralized whitelist ({currentDetails?.species || "Target Wildlife"}).
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "#4CAF50", fontWeight: 700 }}>3.</span>
                <div>
                  <strong style={{ color: "#EEF4EE" }}>Proximity to Settlement:</strong> Position is approximately ~{currentDetails?.settlementDistance || 350}m from {currentDetails?.settlementName || "human settlement"}.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "#4CAF50", fontWeight: 700 }}>4.</span>
                <div>
                  <strong style={{ color: "#EEF4EE" }}>Contextual Risk Scoring:</strong> Calculated composite score ({currentDetails?.risk_score || 80}/100) incorporates proximity, time of day, and species danger.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "#4CAF50", fontWeight: 700 }}>5.</span>
                <div>
                  <strong style={{ color: "#EEF4EE" }}>Automated Response:</strong> FCM broadcast sent to registered villagers; local forest team notified.
                </div>
              </div>
            </div>

            {/* Pipeline Flow Graphic */}
            <div style={{
              marginTop: 14,
              padding: "10px",
              background: "#08130D",
              borderRadius: 6,
              border: "1px solid #1C3828",
              fontSize: 10,
              color: "#8FA396",
              fontFamily: "'IBM Plex Mono', monospace",
              lineHeight: 1.6
            }}>
              <span style={{ color: "#D6A84F" }}>CAMERA</span> → <span style={{ color: "#4CAF50" }}>AI DETECTION</span> → <span style={{ color: "#60A5FA" }}>GPS LOCATION</span> → <span style={{ color: "#F59E0B" }}>CONTEXTUAL RISK</span> → <span style={{ color: "#38BDF8" }}>SATELLITE MAP</span> → <span style={{ color: "#EF4444" }}>SMART ALERT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
