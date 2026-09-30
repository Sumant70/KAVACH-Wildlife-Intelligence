import React, { useState } from "react";
import {
  Activity, CheckCircle2, AlertTriangle, Clock, User, FileText,
  ChevronRight, ArrowRight, Printer, Filter, ShieldAlert
} from "lucide-react";
import { playSuccessChime } from "../components/AudioAlerts";

export default function IncidentsView({
  incidents = [],
  apiBaseUrl,
  onIncidentUpdated
}) {
  const [selectedIncident, setSelectedIncident] = useState(incidents[0] || null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [updating, setUpdating] = useState(false);
  const [newOfficer, setNewOfficer] = useState("");
  const [newNote, setNewNote] = useState("");

  const filtered = incidents.filter(inc => {
    if (statusFilter === "all") return true;
    return inc.status === statusFilter;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "RESOLVED":
        return { label: "RESOLVED", color: "#4CAF50", bg: "rgba(76, 175, 80, 0.15)" };
      case "TEAM_DISPATCHED":
        return { label: "TEAM DISPATCHED", color: "#2196F3", bg: "rgba(33, 150, 243, 0.15)" };
      case "UNDER_INVESTIGATION":
        return { label: "UNDER INVESTIGATION", color: "#D99A32", bg: "rgba(217, 154, 50, 0.15)" };
      case "ACKNOWLEDGED":
        return { label: "ACKNOWLEDGED", color: "#8E24AA", bg: "rgba(142, 36, 170, 0.15)" };
      case "NEW":
      default:
        return { label: "NEW ALERT", color: "#E54D4D", bg: "rgba(229, 77, 77, 0.15)" };
    }
  };

  const handleUpdateStatus = async (nextStatus, stageTitle) => {
    if (!selectedIncident) return;
    setUpdating(true);

    try {
      const resp = await fetch(`${apiBaseUrl}/api/incidents/${selectedIncident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          new_stage: stageTitle,
          stage_detail: `Updated to ${nextStatus.replace('_', ' ')} by commanding officer.`
        })
      });

      if (resp.ok) {
        playSuccessChime();
        const updated = {
          ...selectedIncident,
          status: nextStatus,
          timeline: [
            ...(selectedIncident.timeline || []),
            { stage: stageTitle, time: "Just now", detail: `Status updated to ${nextStatus}` }
          ]
        };
        setSelectedIncident(updated);
        onIncidentUpdated?.(updated);
      }
    } catch (err) {
      console.error("Failed to update incident:", err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div className="kv-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 24, fontWeight: 700, margin: 0, color: "#EEF4EE" }}>
            WILDLIFE CONFLICT INCIDENT MANAGEMENT
          </h1>
          <div style={{ fontSize: 13, color: "#8FA396", marginTop: 4 }}>
            Official lifecycle dispatch tracking, ranger assignment, and incident resolution audit logs
          </div>
        </div>

        <button
          onClick={() => window.print()}
          style={{
            background: "#1E382A",
            border: "1px solid #36664D",
            color: "#A8D8B9",
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
          <Printer size={14} /> Export Incident Dossier
        </button>
      </div>

      {/* Main Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
        {/* Left Column: Incidents List */}
        <div className="kv-panel" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Status Filter */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
            {["all", "NEW", "TEAM_DISPATCHED", "UNDER_INVESTIGATION", "RESOLVED"].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  background: statusFilter === st ? "#1B3B2B" : "transparent",
                  border: `1px solid ${statusFilter === st ? "#2F6B4C" : "var(--line-soft)"}`,
                  color: statusFilter === st ? "#EEF4EE" : "#8FA396",
                  padding: "4px 10px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 11,
                  whiteSpace: "nowrap"
                }}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(inc => {
              const badge = getStatusBadge(inc.status);
              const isSelected = selectedIncident?.id === inc.id;

              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  style={{
                    padding: 14,
                    background: isSelected ? "var(--panel-hi)" : "var(--panel-raised)",
                    border: `1px solid ${isSelected ? "#4CAF50" : "var(--line-soft)"}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#D6A84F" }}>
                      {inc.id}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: badge.color,
                        background: badge.bg,
                        padding: "2px 6px",
                        borderRadius: 3,
                        border: `1px solid ${badge.color}40`
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: 14, color: "#EEF4EE" }}>
                    {inc.title}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8FA396" }}>
                    <span>{inc.animal} ({inc.confidence}%)</span>
                    <span>{inc.timestamp}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Incident Detailed Dossier & Timeline */}
        {selectedIncident ? (
          <div className="kv-panel" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#D6A84F" }}>
                  INCIDENT DOSSIER #{selectedIncident.id}
                </span>
                <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 22, fontWeight: 700, margin: "4px 0 0", color: "#EEF4EE" }}>
                  {selectedIncident.title}
                </h2>
                <div style={{ fontSize: 12, color: "#8FA396", marginTop: 4 }}>
                  Reported by: <strong>{selectedIncident.reporter}</strong> · Time: {selectedIncident.timestamp}
                </div>
              </div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: getStatusBadge(selectedIncident.status).color,
                  background: getStatusBadge(selectedIncident.status).bg,
                  padding: "4px 10px",
                  borderRadius: 4,
                  border: `1px solid ${getStatusBadge(selectedIncident.status).color}50`
                }}
              >
                {getStatusBadge(selectedIncident.status).label}
              </span>
            </div>

            {/* Officer Assignment Banner */}
            <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 6, border: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <User size={16} color="#4F8A64" />
                <div>
                  <div style={{ fontSize: 10, color: "#8FA396", textTransform: "uppercase" }}>ASSIGNED OFFICER</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#EEF4EE" }}>
                    {selectedIncident.assigned_officer || "Ranger Rajesh Sharma (Beat Guard #2)"}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: "#D6A84F", background: "rgba(214, 168, 79, 0.1)", padding: "4px 8px", borderRadius: 3 }}>
                Range: Central Sanctuary Division
              </div>
            </div>

            {/* Field Notes & Description */}
            <div style={{ background: "var(--panel-raised)", padding: 14, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#8FA396", textTransform: "uppercase", marginBottom: 6 }}>
                OPERATIONAL FIELD NOTES
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: "#CCD8D0", lineHeight: 1.5 }}>
                {selectedIncident.notes || "Automated wildlife observation. Team alerted for monitoring."}
              </p>
            </div>

            {/* Interactive 5-Stage Lifecycle Timeline */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8FA396", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={14} /> INCIDENT LIFECYCLE TIMELINE
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 10 }}>
                {(selectedIncident.timeline || []).map((stage, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, position: "relative" }}>
                    {/* Circle icon */}
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#1E3D2A", border: "1.5px solid #4CAF50", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, zIndex: 2 }}>
                      <CheckCircle2 size={12} color="#4CAF50" />
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <strong style={{ fontSize: 13, color: "#EEF4EE" }}>{stage.stage}</strong>
                        <span style={{ fontSize: 10, color: "#D6A84F", fontFamily: "'IBM Plex Mono', monospace" }}>{stage.time}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#8FA396", marginTop: 2 }}>{stage.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action State Dispatcher Buttons */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid #1A3326" }}>
              {selectedIncident.status === "NEW" && (
                <button
                  onClick={() => handleUpdateStatus("ACKNOWLEDGED", "Officer Acknowledged")}
                  disabled={updating}
                  style={{
                    background: "#1E3D2A",
                    border: "1px solid #37734E",
                    color: "#EEF4EE",
                    padding: "8px 16px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  Acknowledge Incident
                </button>
              )}

              {(selectedIncident.status === "NEW" || selectedIncident.status === "ACKNOWLEDGED") && (
                <button
                  onClick={() => handleUpdateStatus("TEAM_DISPATCHED", "Team Dispatched")}
                  disabled={updating}
                  style={{
                    background: "#1E4A6E",
                    border: "1px solid #3780BA",
                    color: "#FFFFFF",
                    padding: "8px 16px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  Dispatch Quick Response Team (QRT)
                </button>
              )}

              {selectedIncident.status === "TEAM_DISPATCHED" && (
                <button
                  onClick={() => handleUpdateStatus("UNDER_INVESTIGATION", "Under Active Investigation")}
                  disabled={updating}
                  style={{
                    background: "#66481E",
                    border: "1px solid #BA8E37",
                    color: "#FFFFFF",
                    padding: "8px 16px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  Mark Under Investigation
                </button>
              )}

              {selectedIncident.status !== "RESOLVED" && (
                <button
                  onClick={() => handleUpdateStatus("RESOLVED", "Incident Resolved")}
                  disabled={updating}
                  style={{
                    background: "#2A663E",
                    border: "1px solid #48A868",
                    color: "#FFFFFF",
                    padding: "8px 16px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  Mark Incident Resolved
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="kv-panel" style={{ padding: 32, textAlign: "center" }}>
            Select an incident to review detailed dossier and dispatch controls.
          </div>
        )}
      </div>
    </div>
  );
}
