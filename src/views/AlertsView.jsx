import React, { useState } from "react";
import {
  Bell, AlertTriangle, ShieldAlert, Volume2, VolumeX, MapPin,
  CheckCircle2, ArrowRight, Radio, ExternalLink
} from "lucide-react";
import { playEmergencyAlarm, playSuccessChime, setAudioMuted, getAudioMuted } from "../components/AudioAlerts";

export default function AlertsView({
  alerts = [],
  apiBaseUrl,
  onNavigateToMap,
  onAlertUpdated
}) {
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [muted, setMuted] = useState(getAudioMuted());

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
  };

  const filteredAlerts = alerts.filter(a => {
    if (priorityFilter === "all") return true;
    return a.priority === priorityFilter;
  });

  const handleAcknowledge = async (alertId) => {
    try {
      const resp = await fetch(`${apiBaseUrl}/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACKNOWLEDGED" })
      });
      if (resp.ok) {
        playSuccessChime();
        onAlertUpdated?.(alertId, "ACKNOWLEDGED");
      }
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div className="kv-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 24, fontWeight: 700, margin: 0, color: "#EEF4EE", display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={22} color="#E54D4D" />
            EARLY WARNING ALERT COMMAND FEED
          </h1>
          <div style={{ fontSize: 13, color: "#8FA396", marginTop: 4 }}>
            Intelligent risk escalation, settlement proximity detection, and rapid dispatch protocol
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={toggleMute}
            style={{
              background: muted ? "#3D1E1E" : "#1E3D2A",
              border: `1px solid ${muted ? "#803737" : "#37734E"}`,
              color: muted ? "#FFB0B0" : "#C5E6D0",
              padding: "8px 14px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <span>{muted ? "Alert Siren Muted" : "Alert Siren Active"}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        {["all", "CRITICAL", "HIGH", "MEDIUM"].map(p => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            style={{
              background: priorityFilter === p ? "#1E3D2A" : "var(--panel)",
              border: `1px solid ${priorityFilter === p ? "#37734E" : "var(--line-soft)"}`,
              color: priorityFilter === p ? "#EEF4EE" : "#8FA396",
              padding: "6px 14px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600
            }}
          >
            {p === "all" ? `All Alerts (${alerts.length})` : `${p} Priority (${alerts.filter(a => a.priority === p).length})`}
          </button>
        ))}
      </div>

      {/* Alert Cards Stream */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {filteredAlerts.map(alert => {
          const isCrit = alert.priority === "CRITICAL";
          const isHigh = alert.priority === "HIGH";
          const borderColor = isCrit ? "#E54D4D" : isHigh ? "#E55C5C" : "#D99A32";

          return (
            <div
              key={alert.id}
              className="kv-panel"
              style={{
                padding: 18,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                borderLeft: `5px solid ${borderColor}`,
                background: isCrit ? "rgba(229, 77, 77, 0.05)" : "var(--panel)"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 3,
                      background: `${borderColor}20`,
                      color: borderColor,
                      border: `1px solid ${borderColor}50`
                    }}
                  >
                    {alert.priority} PRIORITY
                  </span>

                  <h3 style={{ margin: 0, fontSize: 16, color: "#EEF4EE" }}>
                    {alert.title}
                  </h3>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#8FA396" }}>
                    {alert.timestamp}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 3,
                      background: alert.status === "PENDING" ? "rgba(214, 168, 79, 0.15)" : "rgba(76, 175, 80, 0.15)",
                      color: alert.status === "PENDING" ? "#D6A84F" : "#4CAF50",
                      border: "1px solid currentColor"
                    }}
                  >
                    {alert.status}
                  </span>
                </div>
              </div>

              {/* Rationale & Conflict Metrics */}
              <div style={{ fontSize: 13, color: "#CCD8D0", lineHeight: 1.5 }}>
                {alert.reason}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, background: "var(--panel-raised)", padding: 10, borderRadius: 4, border: "1px solid var(--line-soft)", fontSize: 11 }}>
                <div>
                  <span style={{ color: "#8FA396" }}>HABITATION PROXIMITY: </span>
                  <strong style={{ color: "#D6A84F" }}>~{alert.distance_to_settlement || 320}m</strong>
                </div>
                <div>
                  <span style={{ color: "#8FA396" }}>CONFLICT RISK SCORE: </span>
                  <strong style={{ color: borderColor }}>{alert.risk_score}/100</strong>
                </div>
                <div>
                  <span style={{ color: "#8FA396" }}>COORDINATES: </span>
                  <span style={{ color: "#EEF4EE", fontFamily: "'IBM Plex Mono', monospace" }}>
                    {alert.lat?.toFixed(4)}, {alert.lng?.toFixed(4)}
                  </span>
                </div>
              </div>

              {/* Action Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, paddingTop: 6, borderTop: "1px solid var(--line-soft)" }}>
                <div style={{ fontSize: 12, color: "#8FA396" }}>
                  <strong style={{ color: "#A8D8B9" }}>Recommendation:</strong> {alert.recommendation}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => onNavigateToMap?.({ lat: alert.lat, lng: alert.lng })}
                    style={{
                      background: "transparent",
                      border: "1px solid #234634",
                      color: "#A4B7AC",
                      padding: "6px 12px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 11,
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <MapPin size={13} /> View on GIS Map
                  </button>

                  {/* Official Verification Action Bar */}
                  <button
                    onClick={async () => {
                      try {
                        await fetch(`${apiBaseUrl}/api/alerts/${alert.id}/verify`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "CONFIRMED", officer_name: "Range Officer (Command)", notes: "Verified via telemetry and visual check" })
                        });
                        playSuccessChime();
                        onAlertUpdated?.(alert.id, "CONFIRMED");
                      } catch (e) { console.warn(e); }
                    }}
                    style={{
                      background: "#1E3D2A",
                      border: "1px solid #37734E",
                      color: "#4ADE80",
                      padding: "6px 12px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <CheckCircle2 size={13} /> Confirm Alert
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await fetch(`${apiBaseUrl}/api/alerts/${alert.id}/verify`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "FALSE_POSITIVE", officer_name: "Range Officer (Command)", notes: "Optical artifact or non-threat animal" })
                        });
                        onAlertUpdated?.(alert.id, "FALSE_POSITIVE");
                      } catch (e) { console.warn(e); }
                    }}
                    style={{
                      background: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid rgba(239, 68, 68, 0.3)",
                      color: "#F87171",
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
                    Mark False Positive
                  </button>

                  <button
                    onClick={async () => {
                      try {
                        await fetch(`${apiBaseUrl}/api/alerts/${alert.id}/verify`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "INVESTIGATING", officer_name: "Range Officer (Command)", notes: "QRT and Beat Guard dispatched to sector" })
                        });
                        onAlertUpdated?.(alert.id, "INVESTIGATING");
                      } catch (e) { console.warn(e); }
                    }}
                    style={{
                      background: "#5C2020",
                      border: "1px solid #9C3838",
                      color: "#FFE5E5",
                      padding: "6px 14px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <Radio size={13} /> Dispatch QRT Response
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
