import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MapContainer, TileLayer, Marker, Popup, Circle, Tooltip, useMap
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  Radar, Radio, AlertTriangle, ShieldAlert, ShieldCheck, MapPin,
  Crosshair, Navigation, Volume2, VolumeX, RefreshCw, ZoomIn, ZoomOut,
  Maximize2, Eye, Sliders, Layers, ChevronRight, Activity, Clock, Info
} from "lucide-react";
import { API_BASE_URL } from "../KavachApp";
import { playEmergencyAlarm, playRadarPing } from "../components/AudioAlerts";
import { ALLOWED_SPECIES_CANONICAL, isAllowedWildlife, getWildlifeEmoji } from "../allowedWildlife";

// Fix standard Leaflet default icon paths in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Map Controller for smooth panning/zooming
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || 15, { animate: true, duration: 1.0 });
    }
  }, [center, zoom, map]);
  return null;
}

// Target Species Specification (Strict 15-Animal Configuration)
const TARGET_SPECIES = ALLOWED_SPECIES_CANONICAL;

function getSpeciesEmoji(species) {
  return getWildlifeEmoji(species);
}

// Radar sweep and pulse icon centered at monitoring position with transparent satellite-friendly layers
function createRadarIcon(isLiveGps = false) {
  const pulseColor = isLiveGps ? "rgba(59, 130, 246, 0.6)" : "rgba(16, 185, 129, 0.6)";
  const coneColor = isLiveGps ? "rgba(59, 130, 246, 0.12)" : "rgba(16, 185, 129, 0.10)";
  const beaconBg = isLiveGps ? "#1E3A8A" : "#064E3B";
  const beaconBorder = isLiveGps ? "#60A5FA" : "#34D399";
  const beaconGlow = isLiveGps ? "#3B82F6" : "#10B981";
  const iconEmoji = isLiveGps ? "📍" : "📡";

  return L.divIcon({
    className: "kavach-radar-beacon-icon",
    html: `
      <div style="
        position: relative;
        width: 160px;
        height: 160px;
        margin-left: -80px;
        margin-top: -80px;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Expanding Sonar Pulse Waves (semi-transparent so satellite imagery is 100% visible) -->
        <div style="
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1.5px solid ${pulseColor};
          box-shadow: 0 0 12px ${coneColor};
          animation: radarWave 2.8s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
        "></div>
        <div style="
          position: absolute;
          inset: 20px;
          border-radius: 50%;
          border: 1px dashed ${pulseColor};
          animation: radarWave 2.8s cubic-bezier(0.2, 0.8, 0.2, 1) infinite 1.4s;
        "></div>

        <!-- 360-Degree Rotating Radar Sweep Cone (light transparency over satellite terrain) -->
        <div style="
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(255,255,255,0.02) 310deg, ${coneColor} 360deg);
          animation: radarSweep 3.2s linear infinite;
        "></div>

        <!-- Reticle Crosshairs (thin subtle lines) -->
        <div style="position: absolute; width: 100%; height: 1px; background: rgba(255, 255, 255, 0.2);"></div>
        <div style="position: absolute; height: 100%; width: 1px; background: rgba(255, 255, 255, 0.2);"></div>

        <!-- Center Monitoring Beacon -->
        <div style="
          position: relative;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${beaconBg};
          border: 2.5px solid ${beaconBorder};
          box-shadow: 0 0 14px ${beaconGlow};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          z-index: 10;
        ">
          ${iconEmoji}
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
}

// Custom Wildlife Detection Pulsing Marker
function createWildlifeMarker(species, riskLevel) {
  const emoji = getSpeciesEmoji(species);
  const isHighRisk = (riskLevel === "CRITICAL" || riskLevel === "HIGH");
  const borderColor = isHighRisk ? "#EF4444" : riskLevel === "MEDIUM" ? "#F59E0B" : "#10B981";
  const glowColor = isHighRisk ? "rgba(239, 68, 68, 0.8)" : "rgba(245, 158, 11, 0.7)";

  return L.divIcon({
    className: "kavach-wildlife-detection-marker",
    html: `
      <div style="
        position: relative;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: #0A140F;
        border: 2.5px solid ${borderColor};
        box-shadow: 0 0 16px ${glowColor};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        cursor: pointer;
        animation: wildlifePulse 1.6s infinite ease-in-out;
      ">
        ${emoji}
        <div style="
          position: absolute;
          bottom: -3px;
          right: -3px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${borderColor};
          border: 2px solid #FFFFFF;
        "></div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19]
  });
}

// Camera Marker Icon
const cameraIcon = L.divIcon({
  className: "kavach-cctv-marker",
  html: `
    <div style="
      position: relative;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: #1E3A8A;
      border: 2px solid #60A5FA;
      box-shadow: 0 0 10px rgba(96, 165, 250, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-size: 13px;
    ">
      📹
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14]
});

export default function AIScanningMapView({
  apiBaseUrl,
  userGps,
  gpsStatus,
  onRefreshGps,
  onNavigate
}) {
  const effectiveApiUrl = apiBaseUrl || API_BASE_URL;

  // Scanning Radius & Risk Zone States (in meters)
  const [scanningRadiusM, setScanningRadiusM] = useState(500);
  const [innerZoneM, setInnerZoneM] = useState(100);
  const [middleZoneM, setMiddleZoneM] = useState(300);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [tileMode, setTileMode] = useState("satellite"); // "satellite" | "dark" | "osm"
  const [showZoneControls, setShowZoneControls] = useState(false);
  const [showCameras, setShowCameras] = useState(true);

  // Data States
  const [targets, setTargets] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastScanTime, setLastScanTime] = useState(new Date().toLocaleTimeString());
  const [selectedTarget, setSelectedTarget] = useState(null);

  // Map Coordinates & Focus
  // Default to user GPS if available; otherwise Tadoba Core fallback
  const monitoringLocation = useMemo(() => {
    if (userGps && userGps.lat && userGps.lng) {
      return [userGps.lat, userGps.lng];
    }
    return [20.2667, 79.4000]; // Tadoba Forest Baseline
  }, [userGps]);

  const [mapCenter, setMapCenter] = useState(monitoringLocation);
  const [mapZoom, setMapZoom] = useState(15);

  // Update map center when user GPS updates
  useEffect(() => {
    if (userGps && userGps.lat && userGps.lng) {
      setMapCenter([userGps.lat, userGps.lng]);
    }
  }, [userGps]);

  // 1. Fetch active targets from backend scanning API
  const fetchActiveTargets = async () => {
    try {
      const params = new URLSearchParams({
        radius_m: scanningRadiusM.toString(),
        inner_m: innerZoneM.toString(),
        middle_m: middleZoneM.toString(),
        limit: "40"
      });

      if (userGps && userGps.lat && userGps.lng) {
        params.append("lat", userGps.lat.toString());
        params.append("lng", userGps.lng.toString());
      }

      const res = await fetch(`${effectiveApiUrl}/api/scanning-map/active-targets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.targets)) {
          setTargets(data.targets);
          setLastScanTime(new Date().toLocaleTimeString());
        }
      }
    } catch (err) {
      console.warn("[SCANNING-MAP] Target fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Immediate purge of active radar markers
  const handleClearRadar = async () => {
    try {
      await fetch(`${effectiveApiUrl}/api/scanning-map/clear-targets`, { method: "POST" });
      setTargets([]);
      setSelectedTarget(null);
    } catch (err) {
      console.warn("[SCANNING-MAP] Clear targets failed:", err);
    }
  };

  // 2. Fetch cameras from backend
  const fetchCameras = async () => {
    try {
      const res = await fetch(`${effectiveApiUrl}/api/cameras`);
      if (res.ok) {
        const data = await res.json();
        setCameras(Array.isArray(data) ? data : data.cameras || []);
      }
    } catch (err) {
      console.warn("[SCANNING-MAP] Cameras fetch failed:", err);
    }
  };

  useEffect(() => {
    fetchActiveTargets();
    fetchCameras();
    const pollInterval = setInterval(fetchActiveTargets, 8000);
    return () => clearInterval(pollInterval);
  }, [effectiveApiUrl, userGps, scanningRadiusM, innerZoneM, middleZoneM]);

  // 3. Real-time WebSocket Alert Integration
  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;

    const connectWs = () => {
      try {
        const wsProtocol = (effectiveApiUrl.startsWith("https") || window.location.protocol === "https:") ? "wss:" : "ws:";
        const wsHost = (effectiveApiUrl || `${window.location.hostname}:8000`).replace(/^https?:\/\//, "");
        ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/alerts`);

        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: "REGISTER_DEVICE",
            device_name: "AI Wildlife Scanning Map Client"
          }));
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            const msgType = msg.type || msg.event_type;

            // Strict rule: Ignore tests, demos, or sirens - genuine AI detections ONLY
            if (msg.is_test || msg.demo || msgType === "TEST_ALERT" || msgType === "TEST_SIREN" || msgType === "INIT_STATE") {
              return;
            }

            if (msgType === "ANIMAL_DETECTED" || msgType === "WILDLIFE_ALERT") {
              const sp = msg.animal || msg.species;
              // Check if genuine supported target (Strict 15-Animal Filter)
              if (!isAllowedWildlife(sp)) return;

              // Play audio alert if enabled
              if (soundAlerts) {
                if (msg.risk_level === "CRITICAL" || msg.risk_level === "HIGH") {
                  playEmergencyAlarm();
                } else {
                  playRadarPing();
                }
              }

              // Trigger immediate refresh of radar targets
              fetchActiveTargets();
            }
          } catch (e) {
            console.error("[SCANNING-MAP] WS message parse error:", e);
          }
        };

        ws.onclose = () => {
          reconnectTimer = setTimeout(connectWs, 5000);
        };
      } catch (e) {
        reconnectTimer = setTimeout(connectWs, 5000);
      }
    };

    connectWs();
    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [effectiveApiUrl, soundAlerts]);

  // Filter targets inside scanning radius
  const activeTargetsInsideRadius = useMemo(() => {
    return targets.filter(t => t.is_inside_radius === true || (!userGps && t.distance_m === null));
  }, [targets, userGps]);

  // Calculate highest risk level among active targets
  const currentRiskStatus = useMemo(() => {
    const riskRank = { "CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "NONE": 0 };
    let highest = "NONE";
    activeTargetsInsideRadius.forEach(t => {
      const r = t.risk_level || "LOW";
      if (riskRank[r] > riskRank[highest]) highest = r;
    });
    return highest;
  }, [activeTargetsInsideRadius]);

  // Legitimate satellite/aerial imagery & place reference layers (works without paid API key)
  const tileUrls = {
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  };

  // Center on a specific target
  const handleLocateTarget = (t) => {
    if (t.lat && t.lng) {
      setMapCenter([t.lat, t.lng]);
      setMapZoom(16);
      setSelectedTarget(t.id);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* CSS Keyframe Animations for Radar & Markers */}
      <style>{`
        @keyframes radarSweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes radarWave {
          0% { transform: scale(0.3); opacity: 0.9; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes wildlifePulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8); }
          70% { transform: scale(1.08); box-shadow: 0 0 0 16px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes radarBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .scanning-active-dot {
          animation: radarBlink 1.4s ease-in-out infinite;
        }
      `}</style>

      {/* Top Header Bar */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        background: "#0A140F",
        padding: "14px 18px",
        borderRadius: 10,
        border: "1px solid #1D3B2A"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid #10B981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#10B981"
          }}>
            <Radar size={22} className="scanning-active-dot" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#EEF4EE", letterSpacing: 0.5 }}>
                AI WILDLIFE SCANNING
              </h1>
              <span style={{
                background: "rgba(16, 185, 129, 0.18)",
                border: "1px solid #10B981",
                color: "#34D399",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} className="scanning-active-dot" />
                AI SCANNING ACTIVE
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#8FA396", marginTop: 2, display: "flex", gap: 12 }}>
              <span>Scanning Radius: <strong style={{ color: "#34D399" }}>{scanningRadiusM} m</strong></span>
              <span>•</span>
              <span>Monitoring Status: <strong style={{ color: userGps ? "#34D399" : "#F59E0B" }}>{userGps ? "ACTIVE" : "GPS PENDING"}</strong></span>
              <span>•</span>
              <span>Last Sweep: <strong>{lastScanTime}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowZoneControls(!showZoneControls)}
            title="Configure Scanning & Risk Zones"
            style={{
              background: showZoneControls ? "#1F4230" : "#13271C",
              border: `1px solid ${showZoneControls ? "#10B981" : "#234634"}`,
              color: "#EEF4EE",
              padding: "7px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Sliders size={14} color="#34D399" />
            <span>Zone Ranges</span>
          </button>

          <button
            onClick={() => setSoundAlerts(!soundAlerts)}
            title={soundAlerts ? "Mute Radar Audio" : "Enable Radar Audio"}
            style={{
              background: soundAlerts ? "#13271C" : "#2A1818",
              border: `1px solid ${soundAlerts ? "#234634" : "#662A2A"}`,
              color: soundAlerts ? "#C5E6D0" : "#FFB0B0",
              padding: "7px 10px",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center"
            }}
          >
            {soundAlerts ? <Volume2 size={15} color="#34D399" /> : <VolumeX size={15} color="#EF4444" />}
          </button>

          <button
            onClick={handleClearRadar}
            title="Clear all active radar targets"
            style={{
              background: "#1C1313",
              border: "1px solid #4A2323",
              color: "#FCA5A5",
              padding: "7px 11px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5
            }}
          >
            <ShieldAlert size={13} color="#EF4444" />
            <span>Clear Radar</span>
          </button>

          <button
            onClick={fetchActiveTargets}
            title="Refresh Scan Data"
            style={{
              background: "#13271C",
              border: "1px solid #234634",
              color: "#EEF4EE",
              padding: "7px 12px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} color="#8FA396" />
            <span>Rescan</span>
          </button>
        </div>
      </div>

      {/* Configurable Risk Zones Drawer (if opened) */}
      {showZoneControls && (
        <div style={{
          background: "#0D1E16",
          border: "1px solid #1E4630",
          borderRadius: 8,
          padding: "14px 18px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16
        }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#EEF4EE", marginBottom: 6 }}>
              <span>Scanning Radius (Outer Boundary):</span>
              <strong style={{ color: "#10B981" }}>{scanningRadiusM} m</strong>
            </div>
            <input
              type="range"
              min="200"
              max="2000"
              step="50"
              value={scanningRadiusM}
              onChange={(e) => {
                const val = Number(e.target.value);
                setScanningRadiusM(val);
                if (middleZoneM >= val) setMiddleZoneM(val - 100);
              }}
              style={{ width: "100%", accentColor: "#10B981", cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#6A8272" }}>
              <span>200 m</span>
              <span>1000 m</span>
              <span>2000 m</span>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#EEF4EE", marginBottom: 6 }}>
              <span>Inner Zone (High Risk):</span>
              <strong style={{ color: "#EF4444" }}>0 – {innerZoneM} m</strong>
            </div>
            <input
              type="range"
              min="50"
              max={middleZoneM - 50}
              step="25"
              value={innerZoneM}
              onChange={(e) => setInnerZoneM(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#EF4444", cursor: "pointer" }}
            />
            <div style={{ fontSize: 10, color: "#6A8272" }}>Critical immediate response zone</div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#EEF4EE", marginBottom: 6 }}>
              <span>Middle Zone (Medium Risk):</span>
              <strong style={{ color: "#F59E0B" }}>{innerZoneM} – {middleZoneM} m</strong>
            </div>
            <input
              type="range"
              min={innerZoneM + 50}
              max={scanningRadiusM}
              step="50"
              value={middleZoneM}
              onChange={(e) => setMiddleZoneM(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#F59E0B", cursor: "pointer" }}
            />
            <div style={{ fontSize: 10, color: "#6A8272" }}>Heightened watch & guard patrol zone</div>
          </div>
        </div>
      )}

      {/* 4 Telemetry Information Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12
      }}>
        {/* 1. MONITORING LOCATION CARD */}
        <div style={{
          background: "#0A140F",
          border: `1px solid ${userGps ? "#1D3B2A" : "#8A2323"}`,
          borderRadius: 8,
          padding: 14
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8FA396", textTransform: "uppercase" }}>
              MONITORING LOCATION
            </span>
            <Crosshair size={14} color={userGps ? "#10B981" : "#EF4444"} />
          </div>
          {userGps && userGps.lat && userGps.lng ? (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#EEF4EE", fontFamily: "'IBM Plex Mono', monospace" }}>
                {userGps.lat.toFixed(5)}° N, {userGps.lng.toFixed(5)}° E
              </div>
              <div style={{ fontSize: 11, color: "#34D399", marginTop: 3 }}>
                GPS Active (±{Math.round(userGps.accuracy || 10)}m accuracy)
              </div>
            </div>
          ) : (
            <div>
              <div style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid #EF4444",
                color: "#FCA5A5",
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 6px",
                borderRadius: 4,
                display: "inline-block"
              }}>
                GPS LOCATION UNAVAILABLE
              </div>
              <div style={{ marginTop: 6 }}>
                <button
                  onClick={onRefreshGps}
                  style={{
                    background: "#1E3A2F",
                    border: "1px solid #34D399",
                    color: "#EEF4EE",
                    fontSize: 10,
                    padding: "3px 8px",
                    borderRadius: 4,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <Navigation size={10} /> Acquire GPS
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. SCANNING RADIUS CARD */}
        <div style={{
          background: "#0A140F",
          border: "1px solid #1D3B2A",
          borderRadius: 8,
          padding: 14
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8FA396", textTransform: "uppercase" }}>
              SCANNING RADIUS
            </span>
            <Radar size={14} color="#10B981" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#10B981" }}>
            {scanningRadiusM} m
          </div>
          <div style={{ fontSize: 11, color: "#8FA396", marginTop: 2 }}>
            Inner: {innerZoneM}m | Middle: {middleZoneM}m
          </div>
        </div>

        {/* 3. ACTIVE TARGETS CARD */}
        <div style={{
          background: "#0A140F",
          border: `1px solid ${activeTargetsInsideRadius.length > 0 ? "#F59E0B" : "#1D3B2A"}`,
          borderRadius: 8,
          padding: 14
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8FA396", textTransform: "uppercase" }}>
              ACTIVE TARGETS
            </span>
            {activeTargetsInsideRadius.length > 0 ? (
              <AlertTriangle size={14} color="#F59E0B" />
            ) : (
              <ShieldCheck size={14} color="#10B981" />
            )}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: activeTargetsInsideRadius.length > 0 ? "#F59E0B" : "#EEF4EE" }}>
            {activeTargetsInsideRadius.length} {activeTargetsInsideRadius.length === 1 ? "Target" : "Targets"}
          </div>
          <div style={{ fontSize: 11, color: activeTargetsInsideRadius.length > 0 ? "#FCD34D" : "#34D399", marginTop: 2 }}>
            {activeTargetsInsideRadius.length > 0 ? "Inside active radar boundary" : "Perimeter Clear"}
          </div>
        </div>

        {/* 4. CURRENT RISK STATUS CARD */}
        <div style={{
          background: "#0A140F",
          border: `1px solid ${currentRiskStatus === "CRITICAL" || currentRiskStatus === "HIGH" ? "#EF4444" :
              currentRiskStatus === "MEDIUM" ? "#F59E0B" : "#1D3B2A"
            }`,
          borderRadius: 8,
          padding: 14
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8FA396", textTransform: "uppercase" }}>
              CURRENT RISK
            </span>
            <Activity size={14} color={
              currentRiskStatus === "CRITICAL" || currentRiskStatus === "HIGH" ? "#EF4444" :
                currentRiskStatus === "MEDIUM" ? "#F59E0B" : "#10B981"
            } />
          </div>
          <div style={{
            fontSize: 18,
            fontWeight: 800,
            color: (
              currentRiskStatus === "CRITICAL" || currentRiskStatus === "HIGH" ? "#EF4444" :
                currentRiskStatus === "MEDIUM" ? "#F59E0B" : "#10B981"
            )
          }}>
            {currentRiskStatus} RISK
          </div>
          <div style={{ fontSize: 11, color: "#8FA396", marginTop: 2 }}>
            {currentRiskStatus === "NONE" ? "Routine perimeter monitoring" : "Active early warning active"}
          </div>
        </div>
      </div>

      {/* Main Map View & Right Detection Events Split View */}
      <div style={{
        display: "flex",
        flexDirection: "row",
        gap: 14,
        minHeight: 580,
        height: "calc(100vh - 290px)"
      }} className="scanning-map-split">
        {/* Interactive Leaflet Map Viewport */}
        <div style={{
          flex: 1,
          position: "relative",
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid #1D3B2A",
          background: "#07100B"
        }}>
          {/* Map Layer & Quick Controls Overlay */}
          <div style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 1000,
            display: "flex",
            gap: 6,
            background: "rgba(10, 20, 15, 0.9)",
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid #234634",
            backdropFilter: "blur(4px)"
          }}>
            <button
              onClick={() => setTileMode("satellite")}
              style={{
                background: tileMode === "satellite" ? "#1E4230" : "transparent",
                border: "none",
                color: tileMode === "satellite" ? "#34D399" : "#8FA396",
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
            >
              🛰️ Clear Satellite
            </button>
            <button
              onClick={() => setTileMode("dark")}
              style={{
                background: tileMode === "dark" ? "#1E4230" : "transparent",
                border: "none",
                color: tileMode === "dark" ? "#34D399" : "#8FA396",
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Dark Radar
            </button>
            <button
              onClick={() => setTileMode("osm")}
              style={{
                background: tileMode === "osm" ? "#1E4230" : "transparent",
                border: "none",
                color: tileMode === "osm" ? "#34D399" : "#8FA396",
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              Street Map
            </button>
            <button
              onClick={() => setShowCameras(!showCameras)}
              style={{
                background: showCameras ? "#1E4230" : "transparent",
                border: "none",
                color: showCameras ? "#60A5FA" : "#6B7280",
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 4,
                cursor: "pointer"
              }}
            >
              📹 Cameras
            </button>
          </div>

          {/* Zero Target / Perimeter Clear Floating Banner */}
          {activeTargetsInsideRadius.length === 0 && (
            <div style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
              background: "rgba(10, 20, 15, 0.92)",
              border: "1px solid #10B981",
              borderRadius: 20,
              padding: "6px 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
              backdropFilter: "blur(6px)"
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} className="scanning-active-dot" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#34D399" }}>
                NO TARGET WILDLIFE DETECTED IN SCANNING RADIUS ({scanningRadiusM}m)
              </span>
              <span style={{ fontSize: 11, color: "#8FA396" }}>• Perimeter Secure</span>
            </div>
          )}

          {/* Leaflet MapContainer */}
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ width: "100%", height: "100%" }}
            zoomControl={false}
          >
            <MapController center={mapCenter} zoom={mapZoom} />

            {/* Base Satellite / Aerial Imagery Tile Layer */}
            <TileLayer
              url={tileUrls[tileMode]}
              attribution='&copy; Esri, Maxar, Earthstar Geographics | OpenStreetMap'
              maxZoom={19}
            />

            {/* Place Names, Roads & Terrain Overlay (enables clear visibility of roads/places over satellite) */}
            {tileMode === "satellite" && (
              <TileLayer
                url={tileUrls.labels}
                attribution='&copy; Esri World Boundaries and Places'
                maxZoom={19}
                opacity={0.88}
              />
            )}

            {/* Real GPS Accuracy Ring (when user GPS is actively acquired) */}
            {userGps && userGps.lat && userGps.lng && (
              <Circle
                center={[userGps.lat, userGps.lng]}
                radius={Math.max(10, Math.min(250, Number(userGps.accuracy || 20)))}
                pathOptions={{
                  color: "#3B82F6",
                  fillColor: "#3B82F6",
                  fillOpacity: 0.05,
                  weight: 1.5,
                  dashArray: "3, 4"
                }}
              >
                <Tooltip sticky>
                  <div style={{ fontFamily: "sans-serif", fontSize: 11 }}>
                    <strong style={{ color: "#3B82F6" }}>📍 REAL GPS LOCATION</strong><br />
                    <span>Lat: {userGps.lat.toFixed(5)}°, Lng: {userGps.lng.toFixed(5)}°</span><br />
                    <span>Accuracy: ±{Math.round(userGps.accuracy || 15)}m</span>
                  </div>
                </Tooltip>
              </Circle>
            )}

            {/* Configurable Risk Zone Circles around monitoring position - subtle opacities so aerial imagery is visible */}
            {/* 1. Inner Zone (High Risk) */}
            <Circle
              center={monitoringLocation}
              radius={innerZoneM}
              pathOptions={{
                color: "#EF4444",
                fillColor: "#EF4444",
                fillOpacity: 0.08,
                dashArray: "4, 6",
                weight: 1.5
              }}
            >
              <Tooltip sticky>
                <div style={{ fontFamily: "sans-serif", fontSize: 11 }}>
                  <strong>INNER ZONE (0–{innerZoneM}m)</strong><br />
                  <span style={{ color: "#EF4444", fontWeight: 700 }}>HIGH RISK ZONE</span>
                </div>
              </Tooltip>
            </Circle>

            {/* 2. Middle Zone (Medium Risk) */}
            <Circle
              center={monitoringLocation}
              radius={middleZoneM}
              pathOptions={{
                color: "#F59E0B",
                fillColor: "#F59E0B",
                fillOpacity: 0.05,
                dashArray: "5, 5",
                weight: 1.2
              }}
            >
              <Tooltip sticky>
                <div style={{ fontFamily: "sans-serif", fontSize: 11 }}>
                  <strong>MIDDLE ZONE ({innerZoneM}–{middleZoneM}m)</strong><br />
                  <span style={{ color: "#F59E0B", fontWeight: 700 }}>MEDIUM RISK ZONE</span>
                </div>
              </Tooltip>
            </Circle>

            {/* 3. Outer Zone (Scanning Boundary) */}
            <Circle
              center={monitoringLocation}
              radius={scanningRadiusM}
              pathOptions={{
                color: "#10B981",
                fillColor: "#10B981",
                fillOpacity: 0.02,
                dashArray: "6, 6",
                weight: 1.5
              }}
            >
              <Tooltip sticky>
                <div style={{ fontFamily: "sans-serif", fontSize: 11 }}>
                  <strong>OUTER ZONE ({middleZoneM}–{scanningRadiusM}m)</strong><br />
                  <span style={{ color: "#10B981", fontWeight: 700 }}>MONITORING BOUNDARY ({scanningRadiusM}m)</span>
                </div>
              </Tooltip>
            </Circle>

            {/* Radar Center Beacon & Rotating Sweep Animation */}
            <Marker position={monitoringLocation} icon={createRadarIcon(!!(userGps && userGps.lat && userGps.lng))}>
              <Popup>
                <div style={{ color: "#0B1712", fontFamily: "sans-serif", padding: 4 }}>
                  <strong style={{ color: userGps ? "#1D4ED8" : "#064E3B", fontSize: 13 }}>
                    {userGps ? "📍 Real GPS Monitoring Location" : "📡 Forest Grid Monitoring Center"}
                  </strong><br />
                  <div style={{ fontSize: 11, color: "#374151", marginTop: 4 }}>
                    Coordinates: {monitoringLocation[0].toFixed(5)}° N, {monitoringLocation[1].toFixed(5)}° E<br />
                    Status: {userGps ? `Active Device GPS (±${Math.round(userGps.accuracy || 10)}m)` : "Default Sector (GPS Offline)"}<br />
                    Scanning Sweep: {scanningRadiusM}m active radius
                  </div>
                </div>
              </Popup>
            </Marker>

            {/* Real Camera Markers */}
            {showCameras && cameras.map((cam) => {
              if (!cam.lat || !cam.lng) return null;
              return (
                <Marker key={cam.id} position={[cam.lat, cam.lng]} icon={cameraIcon}>
                  <Popup>
                    <div style={{ color: "#0B1712", fontFamily: "sans-serif", padding: 4 }}>
                      <strong style={{ color: "#1E3A8A" }}>📹 {cam.name || cam.id}</strong><br />
                      <div style={{ fontSize: 11, color: "#4B5563", marginTop: 4 }}>
                        Status: <strong style={{ color: cam.status === "ONLINE" ? "#059669" : "#D97706" }}>{cam.status}</strong><br />
                        Location: {cam.village_name || "Sanctuary Perimeter"}<br />
                        FPS: {cam.fps || 15}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Genuine Target Wildlife Detection Markers */}
            {activeTargetsInsideRadius.map((det) => {
              if (!det.lat || !det.lng) return null;
              const isSelected = selectedTarget === det.id;

              return (
                <Marker
                  key={det.id || `${det.species}-${det.lat}-${det.lng}`}
                  position={[det.lat, det.lng]}
                  icon={createWildlifeMarker(det.species, det.risk_level)}
                >
                  <Popup>
                    <div style={{ color: "#0B1712", fontFamily: "sans-serif", minWidth: 200, padding: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                          {getSpeciesEmoji(det.species)} {det.species.toUpperCase()}
                        </span>
                        <span style={{
                          background: det.risk_level === "CRITICAL" || det.risk_level === "HIGH" ? "#FEE2E2" : "#FEF3C7",
                          color: det.risk_level === "CRITICAL" || det.risk_level === "HIGH" ? "#DC2626" : "#D97706",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4
                        }}>
                          {det.risk_level} RISK
                        </span>
                      </div>

                      <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.5 }}>
                        <div><strong>Status:</strong> <span style={{ color: "#059669", fontWeight: 600 }}>DETECTED</span></div>
                        <div><strong>Confidence:</strong> {det.confidence}% (Model Verified)</div>
                        <div><strong>Distance:</strong> <strong style={{ color: "#1E3A8A" }}>{det.distance_str}</strong></div>
                        <div><strong>Coordinates:</strong> {Number(det.lat).toFixed(5)}, {Number(det.lng).toFixed(5)}</div>
                        <div><strong>Timestamp:</strong> {det.timestamp || "Recently Recorded"}</div>
                        <div><strong>Source:</strong> {det.camera_name || det.source || "Sanctuary Camera"}</div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Right-Side DETECTION EVENTS Panel */}
        <div style={{
          width: 340,
          background: "#0A140F",
          border: "1px solid #1D3B2A",
          borderRadius: 10,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }} className="detection-events-panel">
          {/* Panel Header */}
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid #1D3B2A",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#0E1C15"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Activity size={16} color="#34D399" />
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#EEF4EE", textTransform: "uppercase" }}>
                DETECTION EVENTS
              </h3>
            </div>
            <span style={{
              background: "#1E4230",
              color: "#34D399",
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 10
            }}>
              {targets.length} Total
            </span>
          </div>

          {/* Events Scrollable List */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10
          }}>
            {targets.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "36px 16px",
                color: "#8FA396"
              }}>
                <ShieldCheck size={36} color="#10B981" style={{ margin: "0 auto 10px", opacity: 0.8 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: "#EEF4EE" }}>
                  NO TARGET WILDLIFE DETECTED
                </div>
                <div style={{ fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
                  No target species currently detected in this surveillance sector. Continuous scanning is active.
                </div>
              </div>
            ) : (
              targets.map((event) => {
                const isInside = event.is_inside_radius;
                const isSelected = selectedTarget === event.id;
                const isHigh = event.risk_level === "CRITICAL" || event.risk_level === "HIGH";

                return (
                  <div
                    key={event.id || `${event.species}-${event.timestamp}`}
                    onClick={() => handleLocateTarget(event)}
                    style={{
                      background: isSelected ? "#183827" : "#0D1E16",
                      border: `1px solid ${isSelected ? "#10B981" :
                          isInside ? (isHigh ? "#EF4444" : "#F59E0B") : "#1D3B2A"
                        }`,
                      borderRadius: 8,
                      padding: 12,
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 18 }}>{getSpeciesEmoji(event.species)}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#EEF4EE" }}>
                            {event.species}
                          </div>
                          <div style={{ fontSize: 10, color: "#8FA396" }}>
                            {event.timestamp || "Recently detected"}
                          </div>
                        </div>
                      </div>

                      <span style={{
                        background: isHigh ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                        border: `1px solid ${isHigh ? "#EF4444" : "#F59E0B"}`,
                        color: isHigh ? "#FCA5A5" : "#FCD34D",
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 5px",
                        borderRadius: 4
                      }}>
                        {event.risk_level}
                      </span>
                    </div>

                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 11,
                      marginTop: 6,
                      paddingTop: 6,
                      borderTop: "1px dashed #1D3B2A"
                    }}>
                      <div style={{ color: "#34D399", fontWeight: 600 }}>
                        {event.distance_str}
                      </div>
                      <div style={{ color: "#8FA396" }}>
                        Conf: <strong style={{ color: "#EEF4EE" }}>{event.confidence}%</strong>
                      </div>
                    </div>

                    {isInside && (
                      <div style={{
                        marginTop: 6,
                        fontSize: 10,
                        color: isHigh ? "#FCA5A5" : "#FCD34D",
                        background: isHigh ? "rgba(239, 68, 68, 0.12)" : "rgba(245, 158, 11, 0.12)",
                        padding: "3px 6px",
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}>
                        <AlertTriangle size={10} />
                        <span>Inside active {scanningRadiusM}m scanning perimeter</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
