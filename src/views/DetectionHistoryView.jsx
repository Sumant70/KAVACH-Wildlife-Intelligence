

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Camera, Video, Radio, Search, Filter, ShieldAlert, Eye,
  MapPin, CheckCircle2, Clock, X, ExternalLink, RefreshCw,
  Play, Pause, Compass, Activity, ArrowUpRight, AlertTriangle,
  ChevronRight, ChevronLeft, Layers, ShieldCheck, Zap,
  Navigation, Check, Wifi, WifiOff, FileText, ArrowRight,
  TrendingUp, Award, Maximize2
} from "lucide-react";
import { API_BASE_URL } from "../KavachApp";

// 15 Standard KAVACH Wildlife Species with normalized names and emoji icons
const SPECIES_CONFIG = {
  "Tiger": { name: "Tiger", icon: "🐅", aliases: ["tiger", "bengal tiger"] },
  "Leopard": { name: "Leopard", icon: "🐆", aliases: ["leopard", "panther"] },
  "Elephant": { name: "Elephant", icon: "🐘", aliases: ["elephant", "asian elephant", "wild elephant"] },
  "Wild Boar": { name: "Wild Boar", icon: "🐗", aliases: ["wild boar", "wildboar", "boar"] },
  "Spotted Deer": { name: "Spotted Deer", icon: "🦌", aliases: ["spotted deer", "spotted_deer", "chital", "deer"] },
  "Sloth Bear": { name: "Sloth Bear", icon: "🐻", aliases: ["sloth bear", "sloth_bear", "bear"] },
  "Gaur": { name: "Gaur", icon: "🦬", aliases: ["gaur", "indian bison", "bison"] },
  "Rhinoceros": { name: "Rhinoceros", icon: "🦏", aliases: ["rhinoceros", "rhino", "indian rhino"] },
  "Wild Buffalo": { name: "Wild Buffalo", icon: "🐃", aliases: ["wild buffalo", "wild_buffalo", "water buffalo"] },
  "Crocodile": { name: "Crocodile", icon: "🐊", aliases: ["crocodile", "mugger"] },
  "Snake": { name: "Snake", icon: "🐍", aliases: ["snake"] },
  "Cobra": { name: "Cobra", icon: "🐍", aliases: ["cobra", "indian cobra"] },
  "Indian Python": { name: "Indian Python", icon: "🐍", aliases: ["indian python", "python"] },
  "Russell's Viper": { name: "Russell's Viper", icon: "🐍", aliases: ["russell's viper", "russells_viper", "viper"] },
  "Krait": { name: "Krait", icon: "🐍", aliases: ["krait", "common krait"] }
};

// Normalize raw backend species string into standard clean label and emoji
const normalizeSpecies = (raw) => {
  if (!raw) return { name: "Unknown Wildlife", icon: "🐾" };
  const lower = raw.trim().toLowerCase();
  for (const [key, cfg] of Object.entries(SPECIES_CONFIG)) {
    if (key.toLowerCase() === lower || cfg.aliases.includes(lower)) {
      return { name: cfg.name, icon: cfg.icon };
    }
  }
  // Title case fallback
  const fallbackName = raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, " ");
  return { name: fallbackName, icon: "🐾" };
};

// Clean source labels and emojis
const SOURCE_MAP = {
  "IMAGE_UPLOAD": { label: "IMAGE", emoji: "📷", color: "#A855F7", bg: "rgba(168, 85, 247, 0.12)", border: "rgba(168, 85, 247, 0.35)" },
  "IMAGE": { label: "IMAGE", emoji: "📷", color: "#A855F7", bg: "rgba(168, 85, 247, 0.12)", border: "rgba(168, 85, 247, 0.35)" },
  "VIDEO_UPLOAD": { label: "VIDEO", emoji: "🎬", color: "#06B6D4", bg: "rgba(6, 182, 212, 0.12)", border: "rgba(6, 182, 212, 0.35)" },
  "VIDEO": { label: "VIDEO", emoji: "🎬", color: "#06B6D4", bg: "rgba(6, 182, 212, 0.12)", border: "rgba(6, 182, 212, 0.35)" },
  "WEBCAM": { label: "WEBCAM", emoji: "🎥", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.35)" },
  "LIVE_CAMERA": { label: "WEBCAM", emoji: "🎥", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.35)" },
  "CCTV": { label: "CCTV", emoji: "📹", color: "#3B82F6", bg: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.35)" },
  "PHONE_CAMERA": { label: "FIELD CAM", emoji: "📱", color: "#EC4899", bg: "rgba(236, 72, 153, 0.12)", border: "rgba(236, 72, 153, 0.35)" },
  "FIELD_CAMERA": { label: "FIELD CAM", emoji: "📱", color: "#EC4899", bg: "rgba(236, 72, 153, 0.12)", border: "rgba(236, 72, 153, 0.35)" }
};

const getSourceConfig = (src) => {
  const norm = (src || "IMAGE_UPLOAD").toUpperCase();
  return SOURCE_MAP[norm] || { label: norm, emoji: "📡", color: "#10B981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.35)" };
};

// Direction vector symbols
const getDirectionArrow = (dir) => {
  if (!dir) return "";
  const d = dir.toUpperCase();
  if (d.includes("UP_RIGHT") || d.includes("NORTH_EAST")) return "↗";
  if (d.includes("UP_LEFT") || d.includes("NORTH_WEST")) return "↖";
  if (d.includes("DOWN_RIGHT") || d.includes("SOUTH_EAST")) return "↘";
  if (d.includes("DOWN_LEFT") || d.includes("SOUTH_WEST")) return "↙";
  if (d.includes("UP") || d.includes("NORTH")) return "↑";
  if (d.includes("DOWN") || d.includes("SOUTH")) return "↓";
  if (d.includes("RIGHT") || d.includes("EAST")) return "→";
  if (d.includes("LEFT") || d.includes("WEST")) return "←";
  return "";
};

export default function DetectionHistoryView({ onNavigate }) {
  const [telemetryEvents, setTelemetryEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [refreshState, setRefreshState] = useState("idle"); // "idle" | "refreshing" | "updated"
  const [newlyAddedIds, setNewlyAddedIds] = useState(new Set());

  // Filter States
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [speciesFilter, setSpeciesFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [timeFilter, setTimeFilter] = useState("ALL"); // "ALL" | "TODAY" | "24H" | "7D"
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Drawer / Inspection
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [escalating, setEscalating] = useState(false);
  const [escalateSuccess, setEscalateSuccess] = useState(null);

  // Stats from backend
  const [totalHistoricalCount, setTotalHistoricalCount] = useState(0);
  const [highRiskHistoricalCount, setHighRiskHistoricalCount] = useState(0);

  const wsRef = useRef(null);

  // 1. Fetch real telemetry events from backend
  const fetchTelemetry = async (silent = false) => {
    if (!silent) setRefreshState("refreshing");
    setFetchError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/telemetry?limit=250`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        const events = data.telemetry || data.detections || [];
        setTelemetryEvents(events);
        setTotalHistoricalCount(data.total_count ?? events.length);
        setHighRiskHistoricalCount(data.high_risk_count ?? events.filter(e => ["HIGH", "CRITICAL"].includes(e.risk_level)).length);
        if (!silent) {
          setRefreshState("updated");
          setTimeout(() => setRefreshState("idle"), 2500);
        }
      }
    } catch (err) {
      console.warn("Failed to load telemetry stream:", err);
      setFetchError("Unable to retrieve detection events from vision pipeline.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Real-Time WebSocket Connection to /ws/live-feed
  const setupWebSocket = () => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) {}
    }

    try {
      const wsUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws/live-feed";
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "NEW_TELEMETRY" && payload.detection) {
            const newDet = payload.detection;
            setTelemetryEvents(prev => [newDet, ...prev.filter(d => d.id !== newDet.id)]);
            setTotalHistoricalCount(c => c + 1);
            if (["HIGH", "CRITICAL"].includes(newDet.risk_level)) {
              setHighRiskHistoricalCount(c => c + 1);
            }
            setNewlyAddedIds(prev => new Set([...prev, newDet.id]));
            setTimeout(() => {
              setNewlyAddedIds(prev => {
                const next = new Set(prev);
                next.delete(newDet.id);
                return next;
              });
            }, 3000);
          } else if (payload.type === "INCIDENT_ESCALATED") {
            setTelemetryEvents(prev => prev.map(d => {
              if (d.id === payload.detection_id) {
                return { ...d, incident_id: payload.incident_id, incident_code: payload.incident_code };
              }
              return d;
            }));
            if (selectedEvent && selectedEvent.id === payload.detection_id) {
              setSelectedEvent(prev => ({
                ...prev,
                incident_id: payload.incident_id,
                incident_code: payload.incident_code
              }));
            }
          }
        } catch (e) {
          // ignore ping/non-json
        }
      };

      ws.onclose = () => {
        setIsWsConnected(false);
      };

      ws.onerror = () => {
        setIsWsConnected(false);
      };

      wsRef.current = ws;
    } catch (e) {
      setIsWsConnected(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    setupWebSocket();

    // Fallback polling interval (every 6 seconds if WS is disconnected)
    const interval = setInterval(() => {
      if (!isWsConnected) {
        fetchTelemetry(true);
      }
    }, 6000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) {}
      }
    };
  }, []);

  // 3. Manual Operator Escalation Action
  const handleEscalateDetection = async (detId) => {
    if (!detId) return;
    setEscalating(true);
    setEscalateSuccess(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/detections/${detId}/escalate`, {
        method: "POST"
      });
      const data = await res.json();
      if (data.success) {
        setEscalateSuccess(`Escalated to Incident ${data.incident_code || data.incident_id}!`);
        // Update local state
        setTelemetryEvents(prev => prev.map(d => {
          if (d.id === detId) {
            return { ...d, incident_id: data.incident_id, incident_code: data.incident_code };
          }
          return d;
        }));
        if (selectedEvent && selectedEvent.id === detId) {
          setSelectedEvent(prev => ({
            ...prev,
            incident_id: data.incident_id,
            incident_code: data.incident_code
          }));
        }
      }
    } catch (err) {
      console.warn("Escalation failed:", err);
    } finally {
      setEscalating(false);
    }
  };

  // 4. Client-side Filtering
  const filteredEvents = useMemo(() => {
    return telemetryEvents.filter(d => {
      // Source filter
      if (sourceFilter !== "ALL") {
        const s = (d.source || "").toUpperCase();
        if (sourceFilter === "IMAGE_UPLOAD" && !["IMAGE_UPLOAD", "IMAGE"].includes(s)) return false;
        if (sourceFilter === "VIDEO_UPLOAD" && !["VIDEO_UPLOAD", "VIDEO"].includes(s)) return false;
        if (sourceFilter === "WEBCAM" && !["WEBCAM", "LIVE_CAMERA"].includes(s)) return false;
        if (sourceFilter === "CCTV" && s !== "CCTV") return false;
        if (sourceFilter === "PHONE_CAMERA" && !["PHONE_CAMERA", "FIELD_CAMERA"].includes(s)) return false;
      }

      // Species filter
      if (speciesFilter !== "ALL") {
        const norm = normalizeSpecies(d.species).name;
        if (norm !== speciesFilter) return false;
      }

      // Risk filter
      if (riskFilter !== "ALL") {
        if ((d.risk_level || "MEDIUM").toUpperCase() !== riskFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const norm = normalizeSpecies(d.species).name.toLowerCase();
        const match =
          (d.id && d.id.toLowerCase().includes(q)) ||
          norm.includes(q) ||
          (d.species && d.species.toLowerCase().includes(q)) ||
          (d.village_name && d.village_name.toLowerCase().includes(q)) ||
          (d.camera_name && d.camera_name.toLowerCase().includes(q)) ||
          (d.camera_id && d.camera_id.toLowerCase().includes(q)) ||
          (d.movement_status && d.movement_status.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [telemetryEvents, sourceFilter, speciesFilter, riskFilter, timeFilter, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEvents.slice(start, start + pageSize);
  }, [filteredEvents, currentPage]);

  // Metric counters
  const escalatedCount = useMemo(() => {
    return telemetryEvents.filter(d => d.incident_id || d.incident_code).length;
  }, [telemetryEvents]);

  const activeSourcesSet = useMemo(() => {
    return new Set(telemetryEvents.map(d => (d.source || "IMAGE").toUpperCase()));
  }, [telemetryEvents]);

  // Is source active in current stream?
  const isImageActive = activeSourcesSet.has("IMAGE") || activeSourcesSet.has("IMAGE_UPLOAD");
  const isVideoActive = activeSourcesSet.has("VIDEO") || activeSourcesSet.has("VIDEO_UPLOAD");
  const isWebcamActive = activeSourcesSet.has("WEBCAM") || activeSourcesSet.has("LIVE_CAMERA");
  const isCctvActive = activeSourcesSet.has("CCTV");
  const isFieldCamActive = activeSourcesSet.has("PHONE_CAMERA") || activeSourcesSet.has("FIELD_CAMERA");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, color: "#EEF4EE", fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Scoped CSS Styles for Forest-Tech Theme */}
      <style>{`
        .kv-tele-card {
          background: #0D1913;
          border: 1px solid #1C3828;
          border-radius: 10px;
          padding: 16px 20px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .kv-tele-card:hover {
          border-color: #2D583E;
        }
        .kv-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .kv-badge-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .kv-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 12px;
        }
        .kv-table th {
          background: #09140E;
          color: #7D9B89;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 12px 14px;
          border-bottom: 1.5px solid #1C3828;
          text-transform: uppercase;
        }
        .kv-table td {
          padding: 12px 14px;
          border-bottom: 1px solid #14281E;
          vertical-align: middle;
        }
        .kv-table tr:hover {
          background: rgba(19, 37, 28, 0.6);
        }
        .kv-flash-new {
          animation: kvRowGlow 2.5s ease-out;
        }
        @keyframes kvRowGlow {
          0% { background: rgba(16, 185, 129, 0.35); }
          100% { background: transparent; }
        }
        .kv-pulse-dot {
          animation: kvDotPulse 1.6s infinite;
        }
        @keyframes kvDotPulse {
          0% { transform: scale(0.9); opacity: 0.7; }
          50% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.7; }
        }
        .kv-select {
          background: #112219;
          border: 1px solid #1C3828;
          color: #EEF4EE;
          padding: 7px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          outline: none;
          cursor: pointer;
        }
        .kv-select:focus {
          border-color: #10B981;
        }
        .kv-btn-inspect {
          background: #152B1F;
          border: 1px solid #234833;
          color: #A3CFB5;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s ease;
        }
        .kv-btn-inspect:hover {
          background: #1C3B2A;
          color: #FFFFFF;
          border-color: #10B981;
        }
        /* Mobile Card View (switches under 800px) */
        @media (max-width: 800px) {
          .kv-desktop-table { display: none !important; }
          .kv-mobile-cards { display: flex !important; flex-direction: column; gap: 12px; }
        }
        @media (min-width: 801px) {
          .kv-desktop-table { display: block !important; }
          .kv-mobile-cards { display: none !important; }
        }
      `}</style>

      {/* 1. Header Section */}
      <div style={{
        background: "#0D1913",
        border: "1px solid #1C3828",
        borderRadius: 12,
        padding: "18px 24px",
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              color: "#34D399",
              padding: "2px 8px",
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em"
            }}>
              CV OPTICAL INTELLIGENCE
            </span>
            <span style={{ fontSize: 11, color: "#6C8A78", fontFamily: "monospace" }}>
              PIPELINE v2.0
            </span>
          </div>

          <h1 style={{
            fontSize: 22,
            fontWeight: 800,
            margin: "6px 0 2px 0",
            color: "#FFFFFF",
            letterSpacing: "-0.01em",
            display: "flex",
            alignItems: "center",
            gap: 10
          }}>
            AI TELEMETRY
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#8FA396" }}>
            Real-time optical detections from KAVACH vision pipelines
          </p>
        </div>

        {/* Header Right: Live Status & Refresh Button */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Live / Offline Indicator Badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            background: isWsConnected ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
            border: `1px solid ${isWsConnected ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)"}`,
            color: isWsConnected ? "#34D399" : "#F87171"
          }}>
            <span
              className={isWsConnected ? "kv-pulse-dot" : ""}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isWsConnected ? "#10B981" : "#EF4444"
              }}
            />
            <span>{isWsConnected ? "● LIVE" : "○ OFFLINE"}</span>
            {!isWsConnected && (
              <button
                onClick={setupWebSocket}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#FCA5A5",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: 11,
                  padding: 0,
                  marginLeft: 4
                }}
              >
                Reconnect
              </button>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchTelemetry(false)}
            disabled={refreshState === "refreshing"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              background: "#152B1F",
              border: "1px solid #234833",
              color: refreshState === "updated" ? "#34D399" : "#D2E8DA",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            <RefreshCw
              size={13}
              style={{
                animation: refreshState === "refreshing" ? "spin 0.8s linear infinite" : "none"
              }}
              aria-hidden="true"
            />
            <span>
              {refreshState === "refreshing" ? "Refreshing..." :
               refreshState === "updated" ? "Updated just now" : "Refresh"}
            </span>
          </button>
        </div>
      </div>

      {/* Modality Status Badges Bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        padding: "10px 16px",
        background: "#09140E",
        border: "1px solid #172D21",
        borderRadius: 8
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#6C8A78", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Vision Ingest Modalities:
          </span>

          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: isImageActive ? "rgba(168, 85, 247, 0.15)" : "#0F1E16",
            border: `1px solid ${isImageActive ? "rgba(168, 85, 247, 0.4)" : "#1C3828"}`,
            color: isImageActive ? "#D8B4FE" : "#5B7063"
          }}>
            <span>📷</span> Image {isImageActive ? <span style={{ color: "#4ADE80", fontSize: 10, fontWeight: 800 }}>ACTIVE</span> : <span style={{ fontSize: 10 }}>STANDBY</span>}
          </span>

          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: isVideoActive ? "rgba(6, 182, 212, 0.15)" : "#0F1E16",
            border: `1px solid ${isVideoActive ? "rgba(6, 182, 212, 0.4)" : "#1C3828"}`,
            color: isVideoActive ? "#67E8F9" : "#5B7063"
          }}>
            <span>🎬</span> Video {isVideoActive ? <span style={{ color: "#4ADE80", fontSize: 10, fontWeight: 800 }}>ACTIVE</span> : <span style={{ fontSize: 10 }}>STANDBY</span>}
          </span>

          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: isWebcamActive ? "rgba(245, 158, 11, 0.15)" : "#0F1E16",
            border: `1px solid ${isWebcamActive ? "rgba(245, 158, 11, 0.4)" : "#1C3828"}`,
            color: isWebcamActive ? "#FCD34D" : "#5B7063"
          }}>
            <span>🎥</span> Webcam {isWebcamActive ? <span style={{ color: "#4ADE80", fontSize: 10, fontWeight: 800 }}>ACTIVE</span> : <span style={{ fontSize: 10 }}>STANDBY</span>}
          </span>

          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 10px",
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            background: isCctvActive ? "rgba(59, 130, 246, 0.15)" : "#0F1E16",
            border: `1px solid ${isCctvActive ? "rgba(59, 130, 246, 0.4)" : "#1C3828"}`,
            color: isCctvActive ? "#93C5FD" : "#5B7063"
          }}>
            <span>📹</span> CCTV {isCctvActive ? <span style={{ color: "#4ADE80", fontSize: 10, fontWeight: 800 }}>ACTIVE</span> : <span style={{ fontSize: 10 }}>STANDBY</span>}
          </span>
        </div>

        <span style={{ fontSize: 11, color: "#6C8A78", fontFamily: "monospace" }}>
          Buffer: {telemetryEvents.length} events
        </span>
      </div>

      {/* 2. Summary KPI Cards (4 Cards) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        gap: 14
      }}>
        {/* Card 1: TOTAL EVENTS */}
        <div className="kv-tele-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#7D9B89", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              TOTAL EVENTS
            </span>
            <span style={{ fontSize: 16 }}>📊</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#FFFFFF", marginTop: 4, fontFamily: "'Rajdhani', sans-serif" }}>
            {totalHistoricalCount.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: "#6C8A78", marginTop: 4 }}>
            Historical detections ({telemetryEvents.length} in stream)
          </div>
        </div>

        {/* Card 2: HIGH / CRITICAL */}
        <div className="kv-tele-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#F87171", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              HIGH / CRITICAL
            </span>
            <span style={{ fontSize: 16 }}>🚨</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#EF4444", marginTop: 4, fontFamily: "'Rajdhani', sans-serif" }}>
            {highRiskHistoricalCount}
          </div>
          <div style={{ fontSize: 11, color: "#6C8A78", marginTop: 4 }}>
            Threat threshold breached
          </div>
        </div>

        {/* Card 3: ESCALATED */}
        <div className="kv-tele-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#C084FC", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ESCALATED
            </span>
            <span style={{ fontSize: 16 }}>⚡</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#A855F7", marginTop: 4, fontFamily: "'Rajdhani', sans-serif" }}>
            {escalatedCount}
          </div>
          <div style={{ fontSize: 11, color: "#6C8A78", marginTop: 4 }}>
            Dispatched to Forest Guards
          </div>
        </div>

        {/* Card 4: ACTIVE SOURCES */}
        <div className="kv-tele-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#34D399", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ACTIVE SOURCES
            </span>
            <span style={{ fontSize: 16 }}>📡</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#10B981", marginTop: 4, fontFamily: "'Rajdhani', sans-serif" }}>
            {activeSourcesSet.size}
          </div>
          <div style={{ fontSize: 11, color: "#6C8A78", marginTop: 4 }}>
            Ingestion channels online
          </div>
        </div>
      </div>

      {/* 3. Compact Pipeline Visual (Workflow Bar) */}
      <div style={{
        background: "#09140E",
        border: "1px solid #1A3525",
        borderRadius: 10,
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
        fontSize: 11,
        fontWeight: 700
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#4ADE80" }}>
          <span>👁️ 1. AI VISION</span>
          <span style={{ color: "#3E6B4F" }}>→</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#60A5FA" }}>
          <span>⚡ 2. RAW DETECTION</span>
          <span style={{ color: "#3E6B4F" }}>→</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#38BDF8" }}>
          <span>🎯 3. TRACKING</span>
          <span style={{ color: "#3E6B4F" }}>→</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#FBBF24" }}>
          <span>🛡️ 4. RISK ENGINE</span>
          <span style={{ color: "#3E6B4F" }}>→</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#F87171" }}>
          <span>🚨 5. INCIDENT</span>
          <span style={{ color: "#3E6B4F" }}>→</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#34D399" }}>
          <span>🌲 6. GUARD RESPONSE</span>
        </div>
      </div>

      {/* 4. Modern Filter Bar */}
      <div style={{
        background: "#0D1913",
        border: "1px solid #1C3828",
        borderRadius: 10,
        padding: "12px 18px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12
      }}>
        {/* Left Filters Group */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Source Filter */}
          <select
            className="kv-select"
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="ALL">All Sources ▼</option>
            <option value="IMAGE_UPLOAD">📷 Image</option>
            <option value="VIDEO_UPLOAD">🎬 Video</option>
            <option value="WEBCAM">🎥 Webcam</option>
            <option value="CCTV">📹 CCTV</option>
            <option value="PHONE_CAMERA">📱 Field Camera</option>
          </select>

          {/* Species Filter */}
          <select
            className="kv-select"
            value={speciesFilter}
            onChange={(e) => { setSpeciesFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="ALL">All Species ▼</option>
            {Object.keys(SPECIES_CONFIG).map(sp => (
              <option key={sp} value={sp}>
                {SPECIES_CONFIG[sp].icon} {sp}
              </option>
            ))}
          </select>

          {/* Risk Filter */}
          <select
            className="kv-select"
            value={riskFilter}
            onChange={(e) => { setRiskFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="ALL">All Risk ▼</option>
            <option value="CRITICAL">🔴 Critical Risk</option>
            <option value="HIGH">🟠 High Risk</option>
            <option value="MEDIUM">🟡 Medium Risk</option>
            <option value="LOW">🟢 Low Risk</option>
          </select>

          {/* Reset Filters button if any filter active */}
          {(sourceFilter !== "ALL" || speciesFilter !== "ALL" || riskFilter !== "ALL" || searchQuery) && (
            <button
              onClick={() => {
                setSourceFilter("ALL");
                setSpeciesFilter("ALL");
                setRiskFilter("ALL");
                setSearchQuery("");
                setCurrentPage(1);
              }}
              style={{
                background: "transparent",
                border: "1px dashed #3A7350",
                color: "#7D9B89",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Right Search Input */}
        <div style={{ position: "relative", minWidth: 260 }}>
          <Search
            size={14}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#5B7063" }}
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Search Detection ID / Species / Village..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{
              width: "100%",
              background: "#112219",
              border: "1px solid #1C3828",
              borderRadius: 8,
              padding: "7px 30px 7px 32px",
              color: "#EEF4EE",
              fontSize: 12,
              outline: "none"
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "#7D9B89",
                cursor: "pointer",
                padding: 0
              }}
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* 5. Error State Banner (if backend fails) */}
      {fetchError && (
        <div style={{
          background: "rgba(239, 68, 68, 0.12)",
          border: "1px solid rgba(239, 68, 68, 0.4)",
          borderRadius: 10,
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16
        }}>
          <div>
            <div style={{ fontWeight: 800, color: "#F87171", fontSize: 13 }}>
              TELEMETRY CONNECTION ERROR
            </div>
            <div style={{ color: "#FCA5A5", fontSize: 12, marginTop: 2 }}>
              {fetchError}
            </div>
          </div>
          <button
            onClick={() => fetchTelemetry(false)}
            style={{
              background: "#EF4444",
              border: "none",
              color: "#FFFFFF",
              borderRadius: 6,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* 6. Desktop Telemetry Table (Strict 9 Columns) */}
      <div className="kv-desktop-table" style={{
        background: "#0D1913",
        border: "1px solid #1C3828",
        borderRadius: 12,
        overflow: "hidden"
      }}>
        <table className="kv-table">
          <thead>
            <tr>
              <th style={{ width: "12%" }}>TIME</th>
              <th style={{ width: "11%" }}>SOURCE</th>
              <th style={{ width: "16%" }}>SPECIES</th>
              <th style={{ width: "12%" }}>CONFIDENCE</th>
              <th style={{ width: "12%" }}>MOVEMENT</th>
              <th style={{ width: "11%" }}>RISK</th>
              <th style={{ width: "13%" }}>LOCATION</th>
              <th style={{ width: "8%" }}>STATUS</th>
              <th style={{ width: "7%", textAlign: "right" }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEvents.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: "48px 20px", textAlign: "center" }}>
                  <div style={{ maxWidth: 360, margin: "0 auto" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📡</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#D2E8DA" }}>
                      AI TELEMETRY IS QUIET
                    </div>
                    <p style={{ fontSize: 12, color: "#6C8A78", margin: "6px 0 16px 0" }}>
                      No detection events have been received yet or match your active filters.
                    </p>
                    <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                      <button
                        onClick={() => onNavigate && onNavigate("detection_hub")}
                        style={{
                          background: "#152B1F",
                          border: "1px solid #28543B",
                          color: "#D2E8DA",
                          borderRadius: 6,
                          padding: "6px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        📷 Image Upload
                      </button>
                      <button
                        onClick={() => onNavigate && onNavigate("detection_hub")}
                        style={{
                          background: "#152B1F",
                          border: "1px solid #28543B",
                          color: "#D2E8DA",
                          borderRadius: 6,
                          padding: "6px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        🎬 Video Upload
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedEvents.map((det) => {
                const srcCfg = getSourceConfig(det.source);
                const speciesNorm = normalizeSpecies(det.species);
                const hasIncident = !!(det.incident_id || det.incident_code);
                const confVal = Math.round(det.confidence || 85);
                const riskLvl = (det.risk_level || "MEDIUM").toUpperCase();
                const isNew = newlyAddedIds.has(det.id);

                // Movement vector formatting
                const moveRaw = (det.movement_status || "UNKNOWN").toUpperCase();
                const dirArrow = getDirectionArrow(det.direction);
                let moveText = "UNKNOWN";
                let moveColor = "#7D9B89";
                if (moveRaw === "STATIONARY") {
                  moveText = "STATIONARY";
                  moveColor = "#9CA3AF";
                } else if (moveRaw.includes("FAST") || moveRaw.includes("MOVING") || moveRaw.includes("TOWARDS")) {
                  moveText = dirArrow ? `MOVING ${dirArrow}` : "MOVING";
                  moveColor = "#F59E0B";
                }

                // Risk pill styling
                let riskColor = "#3B82F6";
                let riskBg = "rgba(59, 130, 246, 0.12)";
                let riskBorder = "rgba(59, 130, 246, 0.35)";
                if (riskLvl === "CRITICAL") {
                  riskColor = "#EF4444"; riskBg = "rgba(239, 68, 68, 0.12)"; riskBorder = "rgba(239, 68, 68, 0.35)";
                } else if (riskLvl === "HIGH") {
                  riskColor = "#F59E0B"; riskBg = "rgba(245, 158, 11, 0.12)"; riskBorder = "rgba(245, 158, 11, 0.35)";
                } else if (riskLvl === "LOW") {
                  riskColor = "#10B981"; riskBg = "rgba(16, 185, 129, 0.12)"; riskBorder = "rgba(16, 185, 129, 0.35)";
                }

                return (
                  <tr key={det.id} className={isNew ? "kv-flash-new" : ""}>
                    {/* 1. TIME */}
                    <td>
                      <div style={{ fontWeight: 700, color: "#FFFFFF", fontSize: 12 }}>
                        {det.timestamp || "Today, 12:09"}
                      </div>
                      <div style={{ fontSize: 10, color: "#6C8A78", fontFamily: "monospace", marginTop: 2 }}>
                        {det.id}
                      </div>
                    </td>

                    {/* 2. SOURCE */}
                    <td>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 800,
                        background: srcCfg.bg,
                        border: `1px solid ${srcCfg.border}`,
                        color: srcCfg.color
                      }}>
                        <span>{srcCfg.emoji}</span>
                        <span>{srcCfg.label}</span>
                      </span>
                    </td>

                    {/* 3. SPECIES */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, color: "#FFFFFF", fontSize: 13 }}>
                        <span style={{ fontSize: 15 }}>{speciesNorm.icon}</span>
                        <span>{speciesNorm.name}</span>
                      </div>
                      {det.count && det.count > 1 ? (
                        <div style={{ fontSize: 10, color: "#F59E0B", marginTop: 1 }}>
                          {det.count} individuals
                        </div>
                      ) : null}
                    </td>

                    {/* 4. CONFIDENCE */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }} title="Model confidence">
                        <span style={{ fontWeight: 700, color: "#34D399", fontSize: 12, minWidth: 32 }}>
                          {confVal}%
                        </span>
                        <div style={{
                          width: 44,
                          height: 5,
                          background: "#163022",
                          borderRadius: 3,
                          overflow: "hidden"
                        }}>
                          <div style={{
                            width: `${Math.min(100, Math.max(0, confVal))}%`,
                            height: "100%",
                            background: confVal >= 80 ? "#10B981" : confVal >= 60 ? "#F59E0B" : "#EF4444"
                          }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: "#5B7063", marginTop: 2 }}>
                        best.pt
                      </div>
                    </td>

                    {/* 5. MOVEMENT */}
                    <td>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 7px",
                        borderRadius: 5,
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: "monospace",
                        background: moveRaw === "UNKNOWN" ? "rgba(107, 114, 128, 0.12)" : "rgba(245, 158, 11, 0.12)",
                        border: `1px solid ${moveRaw === "UNKNOWN" ? "rgba(107, 114, 128, 0.3)" : "rgba(245, 158, 11, 0.35)"}`,
                        color: moveColor
                      }}>
                        {moveText}
                      </span>
                    </td>

                    {/* 6. RISK */}
                    <td>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        background: riskBg,
                        border: `1px solid ${riskBorder}`,
                        color: riskColor
                      }}>
                        <span>{det.risk_score ? det.risk_score.toFixed(1) : "45.0"}</span>
                        <span style={{ fontSize: 9, opacity: 0.85 }}>{riskLvl}</span>
                      </span>
                    </td>

                    {/* 7. LOCATION */}
                    <td>
                      <div
                        onClick={() => setSelectedEvent(det)}
                        style={{ fontWeight: 600, color: "#D2E8DA", cursor: "pointer" }}
                        title="Click to view location details"
                      >
                        {det.village_name || "Moharli Village"}
                      </div>
                      {det.lat && det.lng ? (
                        <div style={{ fontSize: 10, color: "#6C8A78", fontFamily: "monospace", marginTop: 1 }}>
                          {det.lat.toFixed(3)}, {det.lng.toFixed(3)}
                        </div>
                      ) : null}
                    </td>

                    {/* 8. STATUS */}
                    <td>
                      {hasIncident ? (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 800,
                          background: "rgba(16, 185, 129, 0.15)",
                          border: "1px solid rgba(16, 185, 129, 0.35)",
                          color: "#34D399",
                          letterSpacing: "0.04em"
                        }}>
                          INCIDENT
                        </span>
                      ) : (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 800,
                          background: "#112219",
                          border: "1px solid #1C3828",
                          color: "#6C8A78",
                          letterSpacing: "0.04em"
                        }} title="Raw optical detection — escalation threshold not reached">
                          RAW
                        </span>
                      )}
                    </td>

                    {/* 9. ACTION */}
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="kv-btn-inspect"
                        onClick={() => setSelectedEvent(det)}
                      >
                        <Eye size={12} aria-hidden="true" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 7. Mobile Card View (< 800px Breakpoint) */}
      <div className="kv-mobile-cards">
        {paginatedEvents.map((det) => {
          const srcCfg = getSourceConfig(det.source);
          const speciesNorm = normalizeSpecies(det.species);
          const hasIncident = !!(det.incident_id || det.incident_code);
          const confVal = Math.round(det.confidence || 85);
          const riskLvl = (det.risk_level || "MEDIUM").toUpperCase();

          return (
            <div
              key={det.id}
              style={{
                background: "#0D1913",
                border: "1px solid #1C3828",
                borderRadius: 10,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 800, fontSize: 15, color: "#FFFFFF" }}>
                  <span>{speciesNorm.icon}</span>
                  <span>{speciesNorm.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#34D399" }}>({confVal}%)</span>
                </div>
                <span style={{
                  padding: "2px 7px",
                  borderRadius: 5,
                  fontSize: 10,
                  fontWeight: 800,
                  background: srcCfg.bg,
                  border: `1px solid ${srcCfg.border}`,
                  color: srcCfg.color
                }}>
                  {srcCfg.emoji} {srcCfg.label}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8FA396" }}>
                <div>📍 {det.village_name || "Moharli Village"}</div>
                <div>{det.timestamp || "Today, 12:09"}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6, borderTop: "1px solid #172D21" }}>
                <span style={{
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 800,
                  background: hasIncident ? "rgba(16, 185, 129, 0.15)" : "#112219",
                  border: `1px solid ${hasIncident ? "#10B981" : "#1C3828"}`,
                  color: hasIncident ? "#34D399" : "#6C8A78"
                }}>
                  {hasIncident ? "INCIDENT CREATED" : "RAW OPTICAL"}
                </span>

                <button
                  className="kv-btn-inspect"
                  onClick={() => setSelectedEvent(det)}
                >
                  <Eye size={12} aria-hidden="true" />
                  <span>Inspect</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 8. Pagination Toolbar */}
      {totalPages > 1 && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "10px 4px",
          fontSize: 12,
          color: "#7D9B89"
        }}>
          <div>
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to <strong>{Math.min(currentPage * pageSize, filteredEvents.length)}</strong> of <strong>{filteredEvents.length}</strong> events
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                background: "#112219",
                border: "1px solid #1C3828",
                color: currentPage === 1 ? "#3E6B4F" : "#D2E8DA",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 11,
                fontWeight: 700,
                cursor: currentPage === 1 ? "not-allowed" : "pointer"
              }}
            >
              Previous
            </button>

            <span style={{ padding: "0 8px", fontWeight: 700, color: "#EEF4EE", fontSize: 11 }}>
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                background: "#112219",
                border: "1px solid #1C3828",
                color: currentPage === totalPages ? "#3E6B4F" : "#D2E8DA",
                borderRadius: 6,
                padding: "5px 10px",
                fontSize: 11,
                fontWeight: 700,
                cursor: currentPage === totalPages ? "not-allowed" : "pointer"
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* 9. Inspect Slide-Over Drawer (Right-Side Panel) */}
      {selectedEvent && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 2000,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          display: "flex",
          justifyContent: "flex-end"
        }}>
          <div style={{
            width: "100%",
            maxWidth: 520,
            background: "#0A140E",
            borderLeft: "1.5px solid #1C3828",
            height: "100%",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            boxShadow: "-8px 0 30px rgba(0,0,0,0.8)"
          }}>
            {/* Drawer Header */}
            <div style={{
              padding: "16px 20px",
              background: "#08100B",
              borderBottom: "1px solid #1C3828",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: "#10B981", letterSpacing: "0.08em" }}>
                  DETECTION DOSSIER
                </span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF", fontFamily: "monospace", marginTop: 2 }}>
                  {selectedEvent.id}
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  background: "#152B1F",
                  border: "1px solid #234833",
                  color: "#D2E8DA",
                  borderRadius: 6,
                  padding: 6,
                  cursor: "pointer"
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Drawer Body Sections */}
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Escalation Success Alert */}
              {escalateSuccess && (
                <div style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid #10B981",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#34D399",
                  fontWeight: 700
                }}>
                  ✅ {escalateSuccess}
                </div>
              )}

              {/* SECTION: OVERVIEW */}
              <div style={{ background: "#0D1913", border: "1px solid #1C3828", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#7D9B89", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  OVERVIEW
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
                  <div>
                    <span style={{ color: "#6C8A78", fontSize: 11 }}>Species:</span>
                    <div style={{ fontWeight: 800, color: "#FFFFFF", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{normalizeSpecies(selectedEvent.species).icon}</span>
                      <span>{normalizeSpecies(selectedEvent.species).name}</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ color: "#6C8A78", fontSize: 11 }}>Confidence:</span>
                    <div style={{ fontWeight: 800, color: "#34D399", marginTop: 2 }}>
                      {Math.round(selectedEvent.confidence || 85)}% (Model confidence)
                    </div>
                  </div>

                  <div>
                    <span style={{ color: "#6C8A78", fontSize: 11 }}>Movement:</span>
                    <div style={{ fontWeight: 700, color: "#F59E0B", marginTop: 2 }}>
                      {selectedEvent.movement_status || "STATIONARY"} {getDirectionArrow(selectedEvent.direction)}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: "#6C8A78", fontSize: 11 }}>Risk Assessment:</span>
                    <div style={{ fontWeight: 800, color: "#FFFFFF", marginTop: 2 }}>
                      {selectedEvent.risk_score ? selectedEvent.risk_score.toFixed(1) : "45.0"} ({selectedEvent.risk_level || "MEDIUM"})
                    </div>
                  </div>

                  <div>
                    <span style={{ color: "#6C8A78", fontSize: 11 }}>Source:</span>
                    <div style={{ fontWeight: 700, color: "#D2E8DA", marginTop: 2 }}>
                      {selectedEvent.source || "IMAGE_UPLOAD"}
                    </div>
                  </div>

                  <div>
                    <span style={{ color: "#6C8A78", fontSize: 11 }}>Timestamp:</span>
                    <div style={{ fontWeight: 700, color: "#D2E8DA", marginTop: 2 }}>
                      {selectedEvent.timestamp || "Recently"}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: LOCATION */}
              <div style={{ background: "#0D1913", border: "1px solid #1C3828", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#7D9B89", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  LOCATION & GEOGRAPHY
                </div>
                <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div>
                    <span style={{ color: "#6C8A78", fontSize: 11 }}>Settlement / Sector:</span>{" "}
                    <strong style={{ color: "#FFFFFF" }}>{selectedEvent.village_name || "Buffer Zone"}</strong>
                  </div>
                  {selectedEvent.lat && selectedEvent.lng ? (
                    <div>
                      <span style={{ color: "#6C8A78", fontSize: 11 }}>GPS Coordinates:</span>{" "}
                      <span style={{ color: "#34D399", fontFamily: "monospace" }}>
                        {selectedEvent.lat.toFixed(4)}°N, {selectedEvent.lng.toFixed(4)}°E
                      </span>
                    </div>
                  ) : (
                    <div style={{ color: "#6C8A78", fontSize: 11 }}>GPS coordinates not available</div>
                  )}

                  {selectedEvent.lat && selectedEvent.lng && (
                    <div style={{ marginTop: 8 }}>
                      <a
                        href={`https://www.google.com/maps?q=${selectedEvent.lat},${selectedEvent.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "#152B1F",
                          border: "1px solid #28543B",
                          color: "#34D399",
                          borderRadius: 6,
                          padding: "6px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          textDecoration: "none"
                        }}
                      >
                        <Navigation size={13} aria-hidden="true" />
                        <span>View on Google Maps</span>
                        <ArrowUpRight size={12} aria-hidden="true" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION: MODEL & VISION PIPELINE */}
              <div style={{ background: "#0D1913", border: "1px solid #1C3828", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#7D9B89", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  MODEL & VISION PIPELINE
                </div>
                <div style={{ fontSize: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <span style={{ color: "#6C8A78", fontSize: 11 }}>Active Weights:</span>
                    <div style={{ color: "#FFFFFF", fontWeight: 700 }}>YOLOv11n (best.pt)</div>
                  </div>
                  <div>
                    <span style={{ color: "#6C8A78", fontSize: 11 }}>Pipeline:</span>
                    <div style={{ color: "#FFFFFF", fontWeight: 700 }}>KAVACH CV Core</div>
                  </div>
                  <div>
                    <span style={{ color: "#6C8A78", fontSize: 11 }}>Native Classes:</span>
                    <div style={{ color: "#34D399", fontWeight: 700 }}>15 Trained Wildlife</div>
                  </div>
                  {selectedEvent.frame_id && (
                    <div>
                      <span style={{ color: "#6C8A78", fontSize: 11 }}>Frame ID:</span>
                      <div style={{ color: "#FFFFFF", fontWeight: 700 }}>Frame #{selectedEvent.frame_id}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION: INCIDENT ESCALATION */}
              <div style={{ background: "#0D1913", border: "1px solid #1C3828", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#7D9B89", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  INCIDENT LIFECYCLE
                </div>
                {selectedEvent.incident_id || selectedEvent.incident_code ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#34D399", fontSize: 12, fontWeight: 700 }}>
                      <CheckCircle2 size={16} aria-hidden="true" />
                      <span>Linked to Incident: <strong>{selectedEvent.incident_code || selectedEvent.incident_id}</strong></span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: "#8FA396" }}>
                      Risk Engine evaluated threat criteria and escalated this telemetry event into an active operational case.
                    </p>
                    <button
                      onClick={() => onNavigate && onNavigate("incidents")}
                      style={{
                        background: "#152B1F",
                        border: "1px solid #10B981",
                        color: "#34D399",
                        borderRadius: 6,
                        padding: "7px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 4,
                        width: "fit-content"
                      }}
                    >
                      <ArrowRight size={13} aria-hidden="true" />
                      <span>View in Incidents Terminal</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "#8FA396" }}>
                      Raw optical detection — escalation threshold not reached.
                    </div>
                    <button
                      onClick={() => handleEscalateDetection(selectedEvent.id)}
                      disabled={escalating}
                      style={{
                        background: "#2D583E",
                        border: "1px solid #3E7B57",
                        color: "#FFFFFF",
                        borderRadius: 6,
                        padding: "7px 14px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: escalating ? "not-allowed" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        width: "fit-content"
                      }}
                    >
                      <Zap size={13} aria-hidden="true" />
                      <span>{escalating ? "Escalating..." : "Escalate to Incident"}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION: EVIDENCE CAPTURE */}
              <div style={{ background: "#0D1913", border: "1px solid #1C3828", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#7D9B89", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  EVIDENCE CAPTURE
                </div>
                {selectedEvent.image_path ? (
                  <div style={{ borderRadius: 8, overflow: "hidden", background: "#000000", border: "1px solid #1C3828", maxHeight: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {selectedEvent.image_path.toLowerCase().endsWith(".mp4") ? (
                      <video
                        src={`${API_BASE_URL}${selectedEvent.image_path}`}
                        controls
                        style={{ width: "100%", maxHeight: 240, objectFit: "contain" }}
                      />
                    ) : (
                      <img
                        src={`${API_BASE_URL}${selectedEvent.image_path}`}
                        alt="Detection Snapshot"
                        style={{ width: "100%", maxHeight: 240, objectFit: "contain" }}
                      />
                    )}
                  </div>
                ) : (
                  <div style={{ padding: "18px 12px", textAlign: "center", color: "#6C8A78", fontSize: 12, background: "#08120B", borderRadius: 6 }}>
                    Evidence capture unavailable for this telemetry record
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div style={{
              marginTop: "auto",
              padding: "14px 20px",
              background: "#08100B",
              borderTop: "1px solid #1C3828",
              display: "flex",
              justifyContent: "flex-end"
            }}>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  background: "#152B1F",
                  border: "1px solid #234833",
                  color: "#D2E8DA",
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
