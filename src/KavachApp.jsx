import React, { useState, useEffect, useRef } from "react";
import {
  LayoutGrid, Camera, ShieldAlert, Map as MapIcon, Bell, GitBranch,
  Search, X, Play, Upload, CheckCircle2, AlertTriangle, MapPin,
  Layers, ArrowRight, Clock, Radio, Target, ChevronRight, Menu,
  TreePine, Activity, Crosshair, RefreshCw, Check, ChevronDown,
  Volume2, VolumeX, Sun, Moon, Accessibility, Wifi, WifiOff,
  User, Smartphone, BarChart3, Database, FileText, Video, HeartHandshake, Radar
} from "lucide-react";

import KavachLogo from "./components/KavachLogo";
import { setAudioMuted, getAudioMuted, playEmergencyAlarm, playRadarPing } from "./components/AudioAlerts";

// Views
import CommandCenterView from "./views/CommandCenterView";
import AnimalDetectionView from "./views/AnimalDetectionView";
import DetectionHubView from "./views/DetectionHubView";
import LiveCameraView from "./views/LiveCameraView";
import CCTVMonitoringView from "./views/CCTVMonitoringView";
import VillagerPortalView from "./views/VillagerPortalView";
import ForestGuardView from "./views/ForestGuardView";
import VillagesManagementView from "./views/VillagesManagementView";
import DetectionHistoryView from "./views/DetectionHistoryView";
import WildlifeReportsView from "./views/WildlifeReportsView";
import GISMapView from "./views/GISMapView";
import LiveMonitoringView from "./views/LiveMonitoringView";
import IncidentsView from "./views/IncidentsView";
import AlertsView from "./views/AlertsView";
import GeofencingView from "./views/GeofencingView";
import AnalyticsView from "./views/AnalyticsView";
import DistrictHierarchyView from "./views/DistrictHierarchyView";
import MobileFieldAppView from "./views/MobileFieldAppView";
import SystemArchitectureView from "./views/SystemArchitectureView";
import DemoModeView from "./views/DemoModeView";
import LandingPageView from "./views/LandingPageView";
import RemoteCameraView from "./views/RemoteCameraView";
import MobileAlertDeviceView from "./views/MobileAlertDeviceView";
import AIScanningMapView from "./views/AIScanningMapView";
import FieldCameraView from "./views/FieldCameraView";

// --- Centralized API Base URL ---
// In production: set VITE_API_BASE_URL to your deployed backend URL (e.g. https://kavach-api.onrender.com)
// In local dev: leave unset to auto-detect localhost:8000
const _envApiUrl = typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_BASE_URL : undefined;
const _hostname = typeof window !== "undefined" ? window.location.hostname : "";
const _isLocalhost = _hostname === "localhost" || _hostname === "127.0.0.1" || _hostname === "";
export const API_BASE_URL = (
  _envApiUrl ||
  (_isLocalhost ? `http://localhost:8000` : "")
).replace(/\/+$/, "");

const NAV_ITEMS = [
  { id: "command", label: "Dashboard", icon: LayoutGrid },
  { id: "wildlife", label: "AI Detection", icon: Camera },
  { id: "detection_hub", label: "Detection Hub", icon: Target },
  { id: "cctv", label: "CCTV 4-Grid", icon: Video },
  { id: "scanning_map", label: "Wildlife Radar / GPS", icon: Radar },
  { id: "field_camera", label: "Field Camera", icon: Smartphone },
  { id: "alert_device", label: "Phone Connection", icon: Smartphone },
  { id: "gis", label: "GIS Map", icon: MapIcon },
  { id: "incidents", label: "Incidents", icon: Activity },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "villages", label: "Villages", icon: MapPin },
  { id: "reports", label: "Citizen Reports", icon: FileText },
  { id: "detection_history", label: "Detections Log", icon: Layers },
  { id: "villager_portal", label: "Villager Portal", icon: HeartHandshake },
  { id: "field_guard", label: "Guard Action", icon: Radio },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "architecture", label: "Architecture", icon: GitBranch },
  { id: "demo", label: "Demo Pipeline", icon: Play },
  { id: "landing", label: "Home Overview", icon: TreePine }
];


export default function KavachApp() {
  // Default to command center dashboard on localhost
  const [activeTab, setActiveTab] = useState("command");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState("FOREST_DEPARTMENT"); // "ADMIN" | "FOREST_DEPARTMENT" | "FOREST_GUARD" | "VILLAGER"

  const handleRoleChange = (newRole) => {
    setUserRole(newRole);
    if (newRole === "VILLAGER") {
      setActiveTab("villager_portal");
    } else if (newRole === "FOREST_GUARD") {
      setActiveTab("field_guard");
    } else if (newRole === "FOREST_DEPARTMENT") {
      setActiveTab("command");
    }
  };

  const handleTabSwitch = (tab, params) => {
    if (params?.lat && params?.lng) setTargetMapCoords([params.lat, params.lng]);
    if (tab === "animal_detection") tab = "wildlife";
    if (tab === "radar") tab = "scanning_map";
    if (tab === "phone") tab = "alert_device";
    if (tab === "logs") tab = "detection_history";
    setActiveTab(tab);
  };

  // System Health & Telemetry
  const [systemHealth, setSystemHealth] = useState(null);
  const [detections, setDetections] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [devices, setDevices] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [analyticsData, setAnalyticsData] = useState({});

  // Real Browser GPS State
  const [userGps, setUserGps] = useState({ lat: 20.2667, lng: 79.4000, accuracy: 25 });
  const [gpsStatus, setGpsStatus] = useState("ACQUIRING"); // "ACTIVE" | "DENIED" | "UNAVAILABLE"
  const [targetMapCoords, setTargetMapCoords] = useState(null);

  // Connectivity & Offline Support
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("kavach_offline_queue") || "[]");
    } catch {
      return [];
    }
  });

  // Accessibility & Localization
  const [language, setLanguage] = useState("en"); // "en" | "hi"
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [muted, setMuted] = useState(getAudioMuted());

  // Remote Camera Session from URL Parameter (e.g. ?remote_cam=KAVACH-CAM-001 or ?view=field-camera-source)
  const [remoteCamSession, setRemoteCamSession] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get("view");
      const camParam = params.get("remote_cam") || params.get("session");

      if (viewParam === "landing") {
        setActiveTab("landing");
      } else if (viewParam === "field-camera-source" || params.get("mode") === "source") {
        setActiveTab("field_camera");
      } else if (path.includes("alert-device") || path.includes("alert_device") || viewParam === "alert-device") {
        setActiveTab("alert_device");
      } else if (camParam) {
        setRemoteCamSession(camParam);
        setActiveTab("remote_camera_source");
      }
    }
  }, []);

  // 1. Initial Data Fetch & Health Polling
  const refreshBackendData = async () => {
    try {
      const [hRes, dRes, aRes, iRes, devRes, gRes, anaRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/health`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE_URL}/api/detections?limit=50`).then(r => r.json()).catch(() => ({ detections: [] })),
        fetch(`${API_BASE_URL}/api/alerts`).then(r => r.json()).catch(() => ({ alerts: [] })),
        fetch(`${API_BASE_URL}/api/incidents`).then(r => r.json()).catch(() => ({ incidents: [] })),
        fetch(`${API_BASE_URL}/api/devices`).then(r => r.json()).catch(() => ({ devices: [] })),
        fetch(`${API_BASE_URL}/api/geofences`).then(r => r.json()).catch(() => ({ geofences: [] })),
        fetch(`${API_BASE_URL}/api/analytics`).then(r => r.json()).catch(() => ({}))
      ]);

      if (hRes) setSystemHealth(hRes);
      if (dRes?.detections) setDetections(dRes.detections);
      if (aRes?.alerts) setAlerts(aRes.alerts);
      if (iRes?.incidents) setIncidents(iRes.incidents);
      if (devRes?.devices) setDevices(devRes.devices);
      if (gRes?.geofences) setGeofences(gRes.geofences);
      if (anaRes?.kpis) setAnalyticsData(anaRes);
    } catch (err) {
      console.warn("Backend synchronization warning:", err);
    }
  };

  useEffect(() => {
    refreshBackendData();
    const interval = setInterval(refreshBackendData, 12000);
    return () => clearInterval(interval);
  }, []);

  // Real-time Push Telemetry via WebSocket (/ws/live-feed)
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWs = () => {
      try {
        const wsProtocol = (API_BASE_URL.startsWith("https") || window.location.protocol === "https:") ? "wss:" : "ws:";
        const wsHost = (API_BASE_URL || `${window.location.hostname}:8000`).replace(/^https?:\/\//, "");
        ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/live-feed`);

        ws.onopen = () => {
          console.log("[KAVACH] Live Feed WebSocket connected to", wsHost);
        };

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            if (msg.type === "DETECTION_ALERT" && msg.data) {
              setDetections(prev => [msg.data, ...prev]);
              if (msg.data.risk_level === "CRITICAL" || msg.data.risk_level === "HIGH") {
                playEmergencyAlarm();
              } else {
                playRadarPing();
              }
              refreshBackendData();
            } else if (msg.type === "NEW_TELEMETRY" && msg.detection) {
              setDetections(prev => [msg.detection, ...prev]);
            }
          } catch (e) {
            console.error("WS Parse error", e);
          }
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWs, 5000);
        };

        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch (err) {
        reconnectTimeout = setTimeout(connectWs, 5000);
      }
    };

    connectWs();
    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // 2. Real Browser GPS Telemetry
  const acquireGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("UNAVAILABLE");
      setUserGps({ lat: 20.2667, lng: 79.4000, accuracy: 50 }); // Tadoba fallback
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserGps({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          accuracy: Math.round(pos.coords.accuracy),
          timestamp: new Date(pos.timestamp).toLocaleTimeString()
        });
        setGpsStatus("ACTIVE");
      },
      (err) => {
        console.warn("Geolocation warning:", err.message);
        setGpsStatus(err.code === 1 ? "DENIED" : "UNAVAILABLE");
        setUserGps({ lat: 20.2667, lng: 79.4000, accuracy: 25 }); // Tadoba fallback
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  useEffect(() => {
    acquireGps();
  }, []);

  // 3. Online/Offline Network Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 4. Offline Sync Handler
  const handleSyncOffline = async () => {
    if (offlineQueue.length === 0) return;
    try {
      const resp = await fetch(`${API_BASE_URL}/api/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queued_detections: offlineQueue })
      });
      if (resp.ok) {
        setOfflineQueue([]);
        localStorage.removeItem("kavach_offline_queue");
        refreshBackendData();
      }
    } catch (err) {
      console.error("Sync failed:", err);
    }
  };

  const handleNavigateToMapWithCoords = (coords) => {
    if (coords?.lat && coords?.lng) {
      setTargetMapCoords([coords.lat, coords.lng]);
    }
    setActiveTab("gis");
  };

  const handleDetectionAdded = (newDet) => {
    setDetections(prev => [newDet, ...prev]);
    refreshBackendData();
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
  };

  return (
    <div
      className={`kavach ${dyslexiaFont ? "dyslexia-font" : ""}`}
      data-high-contrast={highContrast}
      style={{
        minHeight: "100vh",
        background: "#070E0A",
        color: "#EEF4EE",
        fontFamily: dyslexiaFont ? "'Atkinson Hyperlegible', sans-serif" : "'IBM Plex Sans', sans-serif"
      }}
    >
      {/* Global CSS Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #070E0A; color: #EEF4EE; }

        .kv-panel {
          background: #0D1913;
          border: 1px solid #1C3828;
          border-radius: 8px;
        }

        :root {
          --panel: #0D1913;
          --panel-raised: #13241C;
          --panel-hi: #1A3327;
          --line: #1F3D2C;
          --line-soft: #172D21;
          --text: #EEF4EE;
          --text-muted: #8FA396;
        }

        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Scrollbar styles */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: #1C3828; border-radius: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* Top Application Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1100,
          background: "rgba(9, 18, 13, 0.95)",
          backdropFilter: "blur(8px)",
          borderBottom: "1.5px solid #1E3B2A",
          padding: "10px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        {/* Left: Brand Identity Logo */}
        <div onClick={() => setActiveTab("command")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          <KavachLogo size="default" />
        </div>

        {/* Center: Top Navigation Bar */}
        <nav
          style={{
            display: "none",
            alignItems: "center",
            gap: 2,
            background: "#0A140F",
            padding: "3px 6px",
            borderRadius: 6,
            border: "1px solid #1A3326",
            overflowX: "auto",
            maxWidth: "calc(100vw - 640px)"
          }}
          className="desktop-nav"
        >
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabSwitch(item.id)}
                style={{
                  background: isActive ? "#183827" : "transparent",
                  border: `1px solid ${isActive ? "#2E6B48" : "transparent"}`,
                  color: isActive ? "#EEF4EE" : "#8FA396",
                  padding: "6px 10px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  whiteSpace: "nowrap",
                  transition: "all 0.12s ease"
                }}
              >
                <Icon size={13} color={isActive ? (item.id === "demo" ? "#D6A84F" : "#4CAF50") : "#7A9183"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Status Badges & Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* GPS Status Badge */}
          <div
            onClick={() => {
              acquireGps();
              setActiveTab("scanning_map");
            }}
            title={gpsStatus === "ACTIVE" ? `GPS Active (${userGps?.lat}°N, ${userGps?.lng}°E) - Click for Radar` : "Click to Acquire GPS"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 8px",
              borderRadius: 4,
              background: gpsStatus === "ACTIVE" ? "rgba(76, 175, 80, 0.12)" : "rgba(229, 77, 77, 0.12)",
              border: `1px solid ${gpsStatus === "ACTIVE" ? "#388E3C" : "#E54D4D"}`,
              fontSize: 11,
              fontFamily: "'IBM Plex Mono', monospace",
              color: gpsStatus === "ACTIVE" ? "#81C784" : "#E57373",
              cursor: "pointer"
            }}
          >
            <Crosshair size={12} />
            <span>GPS: {gpsStatus}</span>
          </div>

          {/* AI Engine Status Badge */}
          <div
            title={systemHealth?.ai_engine?.status || "5-Class YOLOv11 Active"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 8px",
              borderRadius: 4,
              background: "rgba(214, 168, 79, 0.12)",
              border: "1px solid #D6A84F",
              fontSize: 11,
              fontFamily: "'IBM Plex Mono', monospace",
              color: "#FFD580"
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D6A84F" }} />
            <span>YOLO AI ACTIVE</span>
          </div>

          {/* Sound Siren Toggle */}
          <button
            onClick={handleToggleMute}
            title={muted ? "Unmute Alarm" : "Mute Alarm"}
            style={{
              background: muted ? "#331A1A" : "#1A3326",
              border: `1px solid ${muted ? "#662A2A" : "#2E6B48"}`,
              color: muted ? "#FFB0B0" : "#C5E6D0",
              padding: "6px",
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center"
            }}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          {/* Role Selector Dropdown */}
          <select
            value={userRole}
            onChange={(e) => handleRoleChange(e.target.value)}
            style={{
              background: "#13241C",
              border: "1px solid #234634",
              color: "#EEF4EE",
              borderRadius: 4,
              padding: "4px 8px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            <option value="FOREST_DEPARTMENT">Forest Dept (Control)</option>
            <option value="FOREST_GUARD">Forest Guard (Field)</option>
            <option value="VILLAGER">Villager Portal</option>
            <option value="ADMIN">Administrator</option>
          </select>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: "#1A3326",
              border: "1px solid #2E6B48",
              color: "#EEF4EE",
              padding: "6px 8px",
              borderRadius: 4,
              cursor: "pointer",
              display: "flex",
              alignItems: "center"
            }}
            className="mobile-menu-btn"
          >
            <Menu size={16} />
          </button>
        </div>
      </header>

      {/* Responsive CSS for Top Navigation */}
      <style>{`
        @media (min-width: 1100px) {
          .desktop-nav { display: flex !important; }
          .mobile-menu-btn { display: none !important; }
        }
      `}</style>

      {/* Mobile Drawer Navigation if open */}
      {mobileMenuOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            top: 56,
            background: "rgba(7, 14, 10, 0.98)",
            zIndex: 1050,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            overflowY: "auto"
          }}
        >
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { handleTabSwitch(item.id); setMobileMenuOpen(false); }}
                style={{
                  background: isActive ? "#183827" : "#0D1913",
                  border: `1px solid ${isActive ? "#2E6B48" : "#1C3828"}`,
                  color: isActive ? "#EEF4EE" : "#8FA396",
                  padding: "14px 18px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  textAlign: "left"
                }}
              >
                <Icon size={18} color={isActive ? "#4CAF50" : "#7A9183"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sub-Header Breadcrumb Status Bar */}
      <div style={{ background: "#09140E", borderBottom: "1px solid #183022", padding: "6px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#8FA396" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#4CAF50", fontWeight: 700 }}>KAVACH INTELLIGENCE</span>
          <ChevronRight size={12} />
          <span style={{ color: "#EEF4EE", textTransform: "uppercase" }}>{activeTab.replace("_", " ")}</span>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          <span>Active Beats: <strong>18</strong></span>
          <span>Sensors Online: <strong>{devices.filter(d => d.status === "ONLINE").length || 6}</strong></span>
          <span>Role: <strong style={{ color: "#D6A84F" }}>{userRole.replace('_', ' ')}</strong></span>
          <span>GPS: <strong style={{ color: "#81C784" }}>{userGps.lat}°N, {userGps.lng}°E</strong></span>
        </div>
      </div>

      {/* Main View Render Area */}
      <main style={{ padding: "20px", maxWidth: 1440, margin: "0 auto" }}>
        {activeTab === "landing" && (
          <LandingPageView
            onEnterCommandCenter={() => setActiveTab("command")}
            onStartDetection={() => setActiveTab("wildlife")}
          />
        )}

        {activeTab === "command" && (
          <CommandCenterView
            detections={detections}
            alerts={alerts}
            devices={devices}
            incidents={incidents}
            kpis={analyticsData.kpis}
            onNavigate={handleTabSwitch}
            onInspectDetection={(det) => handleNavigateToMapWithCoords(det)}
            onAcknowledgeAlert={async (alertId) => {
              await fetch(`${API_BASE_URL}/api/alerts/${alertId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "ACKNOWLEDGED" })
              });
              refreshBackendData();
            }}
            onDispatchTeam={(alert) => {
              window.alert(`Dispatching Quick Response Team to coordinates ${alert.lat}, ${alert.lng}`);
            }}
          />
        )}

        {activeTab === "wildlife" && (
          <AnimalDetectionView
            apiBaseUrl={API_BASE_URL}
            userGps={userGps}
            onDetectionAdded={handleDetectionAdded}
            onNavigateToMap={handleNavigateToMapWithCoords}
          />
        )}

        {activeTab === "detection_hub" && (
          <DetectionHubView
            apiBaseUrl={API_BASE_URL}
            userGps={userGps}
            onNavigate={handleTabSwitch}
            onDetectionComplete={handleDetectionAdded}
          />
        )}

        {activeTab === "cctv" && (
          <CCTVMonitoringView
            apiBaseUrl={API_BASE_URL}
            onNavigate={handleTabSwitch}
          />
        )}

        {activeTab === "scanning_map" && (
          <AIScanningMapView
            apiBaseUrl={API_BASE_URL}
            userGps={userGps}
            gpsStatus={gpsStatus}
            onRefreshGps={acquireGps}
            onNavigate={handleTabSwitch}
          />
        )}

        {activeTab === "field_camera" && (
          <FieldCameraView
            apiBaseUrl={API_BASE_URL}
            initialSessionId={remoteCamSession || "CAM-001"}
            userGps={userGps}
            onNavigate={handleTabSwitch}
          />
        )}

        {activeTab === "alert_device" && (
          <MobileAlertDeviceView onNavigateBack={() => setActiveTab("command")} />
        )}

        {activeTab === "gis" && (
          <GISMapView
            detections={detections}
            incidents={incidents}
            geofences={geofences}
            userGps={userGps}
            targetCoords={targetMapCoords}
          />
        )}

        {activeTab === "incidents" && (
          <IncidentsView
            incidents={incidents}
            apiBaseUrl={API_BASE_URL}
            onIncidentUpdated={refreshBackendData}
          />
        )}

        {activeTab === "alerts" && (
          <AlertsView
            alerts={alerts}
            apiBaseUrl={API_BASE_URL}
            onNavigateToMap={handleNavigateToMapWithCoords}
            onAlertUpdated={refreshBackendData}
          />
        )}

        {activeTab === "villages" && (
          <VillagesManagementView
            onNavigate={handleTabSwitch}
          />
        )}

        {activeTab === "reports" && (
          <WildlifeReportsView />
        )}

        {activeTab === "detection_history" && (
          <DetectionHistoryView
            onNavigate={handleTabSwitch}
          />
        )}

        {activeTab === "villager_portal" && (
          <VillagerPortalView
            onNavigate={handleTabSwitch}
          />
        )}

        {activeTab === "field_guard" && (
          <ForestGuardView
            onNavigate={handleTabSwitch}
          />
        )}

        {activeTab === "analytics" && (
          <AnalyticsView
            analyticsData={analyticsData}
            detections={detections}
            alerts={alerts}
          />
        )}

        {activeTab === "architecture" && (
          <SystemArchitectureView />
        )}

        {activeTab === "hierarchy" && (
          <DistrictHierarchyView />
        )}

        {activeTab === "mobile" && (
          <MobileFieldAppView
            userGps={userGps}
            onRefreshGps={acquireGps}
            isOnline={isOnline}
            offlineQueue={offlineQueue}
            onSyncOffline={handleSyncOffline}
            onNavigate={handleTabSwitch}
          />
        )}

        {activeTab === "demo" && (
          <DemoModeView
            apiBaseUrl={API_BASE_URL}
            userGps={userGps}
            onDemoCompleted={() => refreshBackendData()}
            onNavigate={(tab, coords) => {
              if (coords?.lat && coords?.lng) setTargetMapCoords([coords.lat, coords.lng]);
              handleTabSwitch(tab);
            }}
          />
        )}

        {activeTab === "remote_camera_source" && (
          <RemoteCameraView
            apiBaseUrl={API_BASE_URL}
            forcedMode="SOURCE"
            initialSessionId={remoteCamSession || "KAVACH-CAM-001"}
            userGps={userGps}
            onNavigate={handleTabSwitch}
          />
        )}

        {activeTab === "remote_camera" && (
          <RemoteCameraView
            apiBaseUrl={API_BASE_URL}
            initialSessionId={remoteCamSession || "KAVACH-CAM-001"}
            userGps={userGps}
            onNavigate={handleTabSwitch}
            onDetectionAdded={handleDetectionAdded}
          />
        )}

        {activeTab === "geofencing" && (
          <GeofencingView
            geofences={geofences}
            apiBaseUrl={API_BASE_URL}
            onGeofenceCreated={refreshBackendData}
            onGeofenceDeleted={refreshBackendData}
          />
        )}

        {activeTab === "monitoring" && (
          <LiveMonitoringView devices={devices} />
        )}
      </main>
    </div>
  );
}