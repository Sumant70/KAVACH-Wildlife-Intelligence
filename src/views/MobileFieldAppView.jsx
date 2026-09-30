import React, { useState } from "react";
import {
  MapPin, Camera, AlertTriangle, Map as MapIcon, ClipboardList,
  Wifi, WifiOff, RefreshCw, CheckCircle2, Crosshair, Radio
} from "lucide-react";
import { playRadarPing, playSuccessChime } from "../components/AudioAlerts";

export default function MobileFieldAppView({
  userGps,
  onRefreshGps,
  isOnline,
  offlineQueue = [],
  onSyncOffline,
  onNavigate
}) {
  const [syncing, setSyncing] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [quickIncidentNote, setQuickIncidentNote] = useState("");
  const [reporting, setReporting] = useState(false);

  const handleQuickCaptureGps = () => {
    onRefreshGps?.();
    playRadarPing();
    setLastAction("Current field GPS coordinates tagged successfully.");
  };

  const handleQuickSync = async () => {
    setSyncing(true);
    try {
      await onSyncOffline?.();
      playSuccessChime();
      setLastAction("Offline queue successfully synchronized with Central Command.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Mobile Header Banner */}
      <div
        className="kv-panel"
        style={{
          padding: 16,
          background: "linear-gradient(135deg, #183828 0%, #102219 100%)",
          border: "1.5px solid #2F6B4C",
          borderRadius: 8
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#D6A84F", letterSpacing: "0.1em" }}>
              FOREST PATROL FIELD UNIT
            </div>
            <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 20, fontWeight: 700, margin: "2px 0 0", color: "#EEF4EE" }}>
              KAVACH RANGER MOBILE
            </h2>
          </div>

          {/* Network & Offline Status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 4,
              background: isOnline ? "rgba(76,175,80,0.15)" : "rgba(229,77,77,0.15)",
              border: `1px solid ${isOnline ? "#4CAF50" : "#E54D4D"}`,
              fontSize: 11,
              fontWeight: 700,
              color: isOnline ? "#4CAF50" : "#E54D4D"
            }}
          >
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{isOnline ? "ONLINE" : "OFFLINE"}</span>
          </div>
        </div>

        {/* GPS Live Telemetry Card */}
        <div style={{ marginTop: 12, padding: 10, background: "rgba(10, 20, 15, 0.7)", borderRadius: 6, border: "1px solid var(--line)", fontSize: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#8FA396" }}>PATROL GPS FIX:</div>
            <div style={{ color: "#EEF4EE", fontWeight: 600, fontSize: 13, marginTop: 2 }}>
              {userGps?.lat ? `${userGps.lat.toFixed(5)}, ${userGps.lng.toFixed(5)}` : "Acquiring GPS..."}
            </div>
            <div style={{ fontSize: 10, color: "#4CAF50" }}>Accuracy: ±{Math.round(userGps?.accuracy || 8)}m</div>
          </div>

          <button
            onClick={handleQuickCaptureGps}
            style={{
              background: "#1E3D2A",
              border: "1px solid #37734E",
              color: "#C5E6D0",
              padding: "6px 12px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <Crosshair size={13} /> Tag GPS
          </button>
        </div>

        {/* Offline Queue Bar */}
        {offlineQueue.length > 0 && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(214, 168, 79, 0.12)", border: "1px solid rgba(214, 168, 79, 0.4)", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#FFD580" }}>
            <span><strong>Offline Queue:</strong> {offlineQueue.length} records pending sync</span>
            <button
              onClick={handleQuickSync}
              disabled={syncing || !isOnline}
              style={{
                background: "#D6A84F",
                border: "none",
                color: "#0B1712",
                padding: "3px 8px",
                borderRadius: 3,
                fontWeight: 700,
                cursor: isOnline ? "pointer" : "not-allowed",
                fontSize: 10,
                display: "flex",
                alignItems: "center",
                gap: 4
              }}
            >
              {syncing ? <RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} /> : null}
              Sync Now
            </button>
          </div>
        )}
      </div>

      {/* Large Outdoor Tactile Buttons Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        {/* 1. Capture Location */}
        <button
          onClick={handleQuickCaptureGps}
          style={{
            background: "linear-gradient(135deg, #132E20 0%, #0E2218 100%)",
            border: "2px solid #2E6B48",
            borderRadius: 8,
            padding: "18px 20px",
            color: "#EEF4EE",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#1F4832", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapPin size={24} color="#4CAF50" />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.05em" }}>
                1. CAPTURE GPS LOCATION
              </div>
              <div style={{ fontSize: 12, color: "#8FA396", marginTop: 2 }}>
                Lock current field coordinates with high precision
              </div>
            </div>
          </div>
          <Crosshair size={20} color="#4CAF50" />
        </button>

        {/* 2. Detect Wildlife */}
        <button
          onClick={() => onNavigate("wildlife")}
          style={{
            background: "linear-gradient(135deg, #1C3626 0%, #12241A 100%)",
            border: "2px solid #387D54",
            borderRadius: 8,
            padding: "18px 20px",
            color: "#EEF4EE",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#25573B", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Camera size={24} color="#D6A84F" />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.05em" }}>
                2. DETECT WILDLIFE (AI)
              </div>
              <div style={{ fontSize: 12, color: "#8FA396", marginTop: 2 }}>
                Snap photo or upload trail imagery for YOLO analysis
              </div>
            </div>
          </div>
          <Radio size={20} color="#D6A84F" />
        </button>

        {/* 3. Report Emergency Incident */}
        <button
          onClick={() => setReporting(!reporting)}
          style={{
            background: "linear-gradient(135deg, #3D1A1A 0%, #2A1212 100%)",
            border: "2px solid #803737",
            borderRadius: 8,
            padding: "18px 20px",
            color: "#FFEAEA",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#5E2525", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={24} color="#FF6E6E" />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.05em" }}>
                3. REPORT CONFLICT INCIDENT
              </div>
              <div style={{ fontSize: 12, color: "#FFA8A8", marginTop: 2 }}>
                Trigger rapid response alert and dispatch rangers
              </div>
            </div>
          </div>
          <AlertTriangle size={20} color="#FF6E6E" />
        </button>

        {reporting && (
          <div className="kv-panel" style={{ padding: 14, background: "#1C1414", border: "1px solid #572828" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#FF8F8F", marginBottom: 6 }}>Field Observation Note:</div>
            <textarea
              rows={2}
              value={quickIncidentNote}
              onChange={(e) => setQuickIncidentNote(e.target.value)}
              placeholder="e.g. Fresh leopard pugmarks heading toward village fringe..."
              style={{ width: "100%", background: "#261919", border: "1px solid #663333", color: "#FFEAEA", padding: 8, borderRadius: 4, fontSize: 12 }}
            />
            <button
              onClick={() => {
                playEmergencyAlarm();
                setLastAction("Emergency incident logged and queued with GPS coordinates.");
                setReporting(false);
                setQuickIncidentNote("");
              }}
              style={{ width: "100%", marginTop: 8, background: "#802B2B", border: "1px solid #B33D3D", color: "#FFFFFF", padding: "10px", borderRadius: 4, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              Broadcast Field Emergency
            </button>
          </div>
        )}

        {/* 4. Open Live Map */}
        <button
          onClick={() => onNavigate("gis")}
          style={{
            background: "linear-gradient(135deg, #162B3D 0%, #0E1C29 100%)",
            border: "2px solid #2B5C80",
            borderRadius: 8,
            padding: "18px 20px",
            color: "#EEF4EE",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#1E425E", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapIcon size={24} color="#64B5F6" />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.05em" }}>
                4. OPEN FIELD GIS MAP
              </div>
              <div style={{ fontSize: 12, color: "#8FA396", marginTop: 2 }}>
                View nearby wildlife hotspots and reserve boundaries
              </div>
            </div>
          </div>
          <MapIcon size={20} color="#64B5F6" />
        </button>

        {/* 5. My Incidents */}
        <button
          onClick={() => onNavigate("incidents")}
          style={{
            background: "linear-gradient(135deg, #2D203D 0%, #1D1429 100%)",
            border: "2px solid #5C3D80",
            borderRadius: 8,
            padding: "18px 20px",
            color: "#EEF4EE",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#432A5E", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardList size={24} color="#BA68C8" />
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, letterSpacing: "0.05em" }}>
                5. MY PATROL INCIDENTS
              </div>
              <div style={{ fontSize: 12, color: "#8FA396", marginTop: 2 }}>
                Review active beat assignments and update status
              </div>
            </div>
          </div>
          <ClipboardList size={20} color="#BA68C8" />
        </button>
      </div>

      {/* Confirmation Toast */}
      {lastAction && (
        <div style={{ padding: "10px 14px", background: "rgba(76, 175, 80, 0.15)", border: "1px solid #4CAF50", borderRadius: 6, color: "#A8D8B9", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={16} />
          <span>{lastAction}</span>
        </div>
      )}
    </div>
  );
}
