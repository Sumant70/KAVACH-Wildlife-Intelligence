import React, { useState } from "react";
import {
  Radio, Camera, Battery, Wifi, AlertTriangle, CheckCircle2,
  RefreshCw, Plus, Video, Play, Power, ExternalLink
} from "lucide-react";
import WebcamDetector from "../components/WebcamDetector";

export default function LiveMonitoringView({ devices = [], onAddDevice }) {
  const [filter, setFilter] = useState("all");
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [liveStreamMode, setLiveStreamMode] = useState(false);

  const filteredDevices = devices.filter(d => {
    if (filter === "all") return true;
    return d.status === filter;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "ONLINE": return "#4CAF50";
      case "WARNING": return "#D99A32";
      case "OFFLINE":
      default: return "#E54D4D";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div className="kv-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 24, fontWeight: 700, margin: 0, color: "#EEF4EE" }}>
            LIVE CAMERA & SENSOR MONITORING NETWORK
          </h1>
          <div style={{ fontSize: 13, color: "#8FA396", marginTop: 4 }}>
            Optical trail cameras, IP surveillance feeds, drone units, and ranger handhelds
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setLiveStreamMode(!liveStreamMode)}
            style={{
              background: liveStreamMode ? "#1E4A32" : "#16281E",
              border: `1px solid ${liveStreamMode ? "#4CAF50" : "#284A36"}`,
              color: liveStreamMode ? "#FFFFFF" : "#A4B7AC",
              padding: "8px 16px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Video size={14} /> {liveStreamMode ? "Close Live Stream" : "Open Live Stream Test Feed"}
          </button>
        </div>
      </div>

      {/* Live Stream Test Unit if toggled */}
      {liveStreamMode && (
        <div className="kv-panel" style={{ padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#D6A84F", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Radio size={16} /> LIVE SENSOR INTEGRATION INTERFACE (CCTV / RTSP / WEBCAM)
          </div>
          <WebcamDetector />
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        {["all", "ONLINE", "WARNING", "OFFLINE"].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              background: filter === status ? "#1E3D2A" : "var(--panel)",
              border: `1px solid ${filter === status ? "#37734E" : "var(--line-soft)"}`,
              color: filter === status ? "#EEF4EE" : "#8FA396",
              padding: "6px 14px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              textTransform: "capitalize"
            }}
          >
            {status.toLowerCase()} ({status === "all" ? devices.length : devices.filter(d => d.status === status).length})
          </button>
        ))}
      </div>

      {/* Device Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 16 }}>
        {filteredDevices.map(dev => {
          const statusColor = getStatusColor(dev.status);

          return (
            <div
              key={dev.id}
              className="kv-panel"
              style={{
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                borderTop: `3px solid ${statusColor}`
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#8FA396" }}>{dev.id}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#EEF4EE", marginTop: 2 }}>{dev.name}</div>
                  <div style={{ fontSize: 12, color: "#A4B7AC" }}>{dev.location_name}</div>
                </div>

                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    color: statusColor,
                    background: `${statusColor}18`,
                    border: `1px solid ${statusColor}40`,
                    padding: "3px 8px",
                    borderRadius: 3
                  }}
                >
                  {dev.status}
                </span>
              </div>

              {/* Telemetry info */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "var(--panel-raised)", padding: 10, borderRadius: 4, border: "1px solid var(--line-soft)", fontSize: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Battery size={13} color={dev.battery < 20 ? "#E54D4D" : "#4CAF50"} />
                  <span style={{ color: "#8FA396" }}>Battery:</span>
                  <strong style={{ color: "#EEF4EE" }}>{dev.battery}%</strong>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Wifi size={13} color={dev.network < 50 ? "#D99A32" : "#4CAF50"} />
                  <span style={{ color: "#8FA396" }}>Signal:</span>
                  <strong style={{ color: "#EEF4EE" }}>{dev.network}%</strong>
                </div>
              </div>

              {/* Last Detection Event */}
              <div style={{ fontSize: 11, color: "#D6A84F", background: "rgba(214, 168, 79, 0.08)", padding: "6px 8px", borderRadius: 4, border: "1px solid rgba(214, 168, 79, 0.15)" }}>
                <strong>Last Sighting:</strong> {dev.last_detection || "No activity recorded"}
              </div>

              {/* Coordinates */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#7A9183", fontFamily: "'IBM Plex Mono', monospace" }}>
                <span>LAT {dev.lat?.toFixed(3)}, LNG {dev.lng?.toFixed(3)}</span>
                <span>TYPE: {dev.type}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
