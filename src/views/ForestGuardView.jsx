import React, { useState, useEffect } from "react";
import {
  MapContainer, TileLayer, Marker, Popup
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, MapPin,
  Camera, MessageSquare, ArrowRight, UserCheck, RefreshCw,
  Send, FileText, Check, Layers, Radio, Navigation, Phone,
  Eye, CheckSquare, XCircle, ArrowUpRight, ShieldAlert,
  Flame, Crosshair, ChevronRight, Video, AlertCircle
} from "lucide-react";
import { API_BASE_URL } from "../KavachApp";

// Custom Leaflet Marker Icon to prevent missing asset errors
const createGuardMarker = (riskLevel, status) => {
  let color = "#3B82F6"; // default blue
  if (status === "RESOLVED" || status === "CLOSED") {
    color = "#10B981"; // green
  } else if (riskLevel === "CRITICAL" || status === "REPORTED") {
    color = "#EF4444"; // red
  } else if (riskLevel === "HIGH" || status === "RESPONDING") {
    color = "#F59E0B"; // amber
  } else if (status === "ASSIGNED") {
    color = "#8B5CF6"; // purple
  }

  return L.divIcon({
    className: "kavach-guard-marker",
    html: `
      <div style="
        position: relative;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: ${color};
        border: 2.5px solid #FFFFFF;
        box-shadow: 0 0 14px ${color}88;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 11px;
      ">
        <div style="width: 10px; height: 10px; border-radius: 50%; background: #FFFFFF;"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

const LIFECYCLE_STAGES = [
  { key: "REPORTED", label: "1. REPORTED", desc: "Citizen / AI detection logged" },
  { key: "UNDER_REVIEW", label: "2. UNDER REVIEW", desc: "Acknowledged by guard" },
  { key: "ASSIGNED", label: "3. ASSIGNED", desc: "Assigned to field officer" },
  { key: "RESPONDING", label: "4. RESPONDING", desc: "Active patrol deployed" },
  { key: "RESOLVED", label: "5. RESOLVED", desc: "Area safe / resolved" },
  { key: "CLOSED", label: "6. CLOSED", desc: "Incident archived" }
];

export default function ForestGuardView({ onNavigate }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("ACTIVE"); // "ACTIVE" | "RESPONDING" | "UNDER_REVIEW" | "RESOLVED" | "ALL"
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Operational state
  const [guardNotes, setGuardNotes] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [guardName, setGuardName] = useState("Beat Guard S. Jadhav (Range 4)");
  const [updating, setUpdating] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  const fetchIncidents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/incidents`);
      const data = await res.json();
      if (data.success && data.incidents) {
        setIncidents(data.incidents);
        // Retain current selection if present, else pick first
        setSelectedIncident(prev => {
          if (prev) {
            const updated = data.incidents.find(i => i.id === prev.id);
            return updated || prev;
          }
          return data.incidents.length > 0 ? data.incidents[0] : null;
        });
      }
    } catch (err) {
      console.warn("Failed to load incidents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 6000);
    return () => clearInterval(interval);
  }, []);

  // Execute Guard Action via POST /api/incidents/{id}/action
  const executeAction = async (actionType, customPayload = {}) => {
    if (!selectedIncident) return;
    setUpdating(true);
    setActionSuccess(null);
    setActionError(null);

    // If START_RESPONSE, attempt to capture guard's current GPS location
    let currentCoords = {};
    if (actionType === "START_RESPONSE" && navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
        });
        currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (geoErr) {
        console.warn("Could not capture guard geolocation:", geoErr);
      }
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/incidents/${selectedIncident.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          officer_name: guardName,
          notes: customPayload.notes || guardNotes || "",
          ...currentCoords,
          ...customPayload
        })
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(data.message || `Action ${actionType} recorded successfully.`);
        setGuardNotes("");
        setResolutionNote("");
        setShowResolveModal(false);
        await fetchIncidents();
      } else {
        setActionError(data.detail || "Action could not be executed.");
      }
    } catch (err) {
      console.warn("Lifecycle action failed:", err);
      setActionError("Failed to reach server. Please check your network connection.");
    } finally {
      setUpdating(false);
    }
  };

  const getStageIndex = (status) => {
    const map = {
      "REPORTED": 0,
      "UNDER_REVIEW": 1,
      "ASSIGNED": 2,
      "RESPONDING": 3,
      "INVESTIGATING": 3,
      "CONFIRMED": 3,
      "RESOLVED": 4,
      "CLOSED": 5
    };
    return map[status] ?? 0;
  };

  const filteredIncidents = incidents.filter(i => {
    if (activeFilter === "ACTIVE") return !["RESOLVED", "CLOSED"].includes(i.status);
    if (activeFilter === "RESPONDING") return ["RESPONDING", "INVESTIGATING"].includes(i.status);
    if (activeFilter === "UNDER_REVIEW") return ["REPORTED", "UNDER_REVIEW", "ASSIGNED"].includes(i.status);
    if (activeFilter === "RESOLVED") return ["RESOLVED", "CLOSED"].includes(i.status);
    return true;
  });

  const activeCount = incidents.filter(i => !["RESOLVED", "CLOSED"].includes(i.status)).length;
  const respondingCount = incidents.filter(i => ["RESPONDING", "INVESTIGATING"].includes(i.status)).length;
  const underReviewCount = incidents.filter(i => ["REPORTED", "UNDER_REVIEW"].includes(i.status)).length;
  const resolvedCount = incidents.filter(i => ["RESOLVED", "CLOSED"].includes(i.status)).length;

  return (
    <div className="space-y-6">
      {/* Guard Header & Stats Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md p-6 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              Forest Beat Guard Action Terminal
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                PATROL ON DUTY
              </span>
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Rapid conflict dispatch: acknowledge citizen sightings, deploy patrols, secure perimeters & resolve incidents
            </p>
          </div>
        </div>

        {/* Guard Identity & Summary Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700 flex items-center gap-2 text-xs">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <input
              type="text"
              value={guardName}
              onChange={(e) => setGuardName(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none border-b border-dashed border-slate-600 focus:border-emerald-400 text-xs w-48"
              title="Click to edit Guard Officer name"
            />
          </div>

          <button
            onClick={fetchIncidents}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Refresh Incidents"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Operational Metrics Counter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Active Incidents</div>
            <div className="text-xl font-bold text-white mt-0.5">{activeCount}</div>
          </div>
          <AlertTriangle className="w-5 h-5 text-amber-400 opacity-80" />
        </div>

        <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">In Field Response</div>
            <div className="text-xl font-bold text-blue-400 mt-0.5">{respondingCount}</div>
          </div>
          <Crosshair className="w-5 h-5 text-blue-400 opacity-80" />
        </div>

        <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Pending Review</div>
            <div className="text-xl font-bold text-rose-400 mt-0.5">{underReviewCount}</div>
          </div>
          <Clock className="w-5 h-5 text-rose-400 opacity-80" />
        </div>

        <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Resolved / Closed</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{resolvedCount}</div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-400 opacity-80" />
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident Queue Column */}
        <div className="space-y-4">
          {/* Queue Filter Tabs */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1 overflow-x-auto">
            {[
              { id: "ACTIVE", label: `Active (${activeCount})` },
              { id: "RESPONDING", label: `Responding (${respondingCount})` },
              { id: "UNDER_REVIEW", label: `Review (${underReviewCount})` },
              { id: "RESOLVED", label: `Resolved (${resolvedCount})` },
              { id: "ALL", label: `All (${incidents.length})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  activeFilter === tab.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Incident Queue List */}
          <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
            {filteredIncidents.length === 0 ? (
              <div className="bg-slate-900/60 p-8 rounded-2xl border border-slate-800 text-center text-slate-400 text-xs">
                No incidents match the selected filter.
              </div>
            ) : (
              filteredIncidents.map((inc) => {
                const isSelected = selectedIncident?.id === inc.id;
                const status = inc.status || "REPORTED";

                let statusBadgeColor = "bg-slate-500/10 text-slate-300 border-slate-500/30";
                if (status === "REPORTED") statusBadgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse";
                else if (status === "UNDER_REVIEW") statusBadgeColor = "bg-blue-500/10 text-blue-300 border-blue-500/30";
                else if (status === "ASSIGNED") statusBadgeColor = "bg-indigo-500/10 text-indigo-300 border-indigo-500/30";
                else if (status === "RESPONDING" || status === "INVESTIGATING") statusBadgeColor = "bg-amber-500/10 text-amber-300 border-amber-500/30";
                else if (status === "RESOLVED" || status === "CLOSED") statusBadgeColor = "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";

                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className={`p-4 rounded-2xl border cursor-pointer transition ${
                      isSelected
                        ? "bg-slate-800/95 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50"
                        : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-emerald-400 font-bold truncate">
                        {inc.incident_code || inc.id}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadgeColor}`}>
                        {status}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-sm mt-1.5 flex items-center gap-1.5">
                      <span>{inc.animal || "Wildlife"} Sighting</span>
                      {inc.risk_level === "CRITICAL" && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold">
                          CRITICAL
                        </span>
                      )}
                    </h4>

                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{inc.village_name || "Buffer Zone"}</span>
                      <span>•</span>
                      <span className="whitespace-nowrap">{inc.timestamp || inc.first_detected || "Recently"}</span>
                    </div>

                    {inc.source && (
                      <div className="mt-2 text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                        <span className="text-slate-400">Source:</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {inc.source}
                        </span>
                        {inc.assigned_officer && inc.assigned_officer !== "Unassigned" && (
                          <span className="ml-auto text-emerald-400/80 truncate">
                            {inc.assigned_officer}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Incident Detail & Operational Workbench */}
        <div className="lg:col-span-2 space-y-4">
          {selectedIncident ? (
            <div className="bg-slate-900/90 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-6">
              {/* Header & Meta */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                      {selectedIncident.incident_code || selectedIncident.id}
                    </span>

                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                      selectedIncident.risk_level === "CRITICAL"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : selectedIncident.risk_level === "HIGH"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                    }`}>
                      {selectedIncident.risk_level || "MEDIUM"} RISK
                    </span>

                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      STATUS: {selectedIncident.status}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-white mt-2">
                    {selectedIncident.title || `${selectedIncident.animal} Sighting Investigation`}
                  </h2>

                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                    <span>Village: <strong className="text-slate-200">{selectedIncident.village_name || "Buffer Zone"}</strong></span>
                    <span>•</span>
                    <span>Source: <strong className="text-slate-200">{selectedIncident.source || "CITIZEN_REPORT"}</strong></span>
                    <span>•</span>
                    <span>Assigned: <strong className="text-emerald-400">{selectedIncident.assigned_officer || "Unassigned"}</strong></span>
                  </div>
                </div>

                {/* Reporter Contact Quick Action */}
                <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 text-xs space-y-1.5 shrink-0 min-w-[210px]">
                  <div className="text-slate-400 font-medium">Reporter Information:</div>
                  <div className="text-white font-bold">{selectedIncident.reporter || "Citizen Sighting"}</div>
                  {selectedIncident.reporter && selectedIncident.reporter.match(/\d{10}/) ? (
                    <a
                      href={`tel:${selectedIncident.reporter.match(/\d{10}/)[0]}`}
                      className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold"
                    >
                      <Phone className="w-3.5 h-3.5" /> Call Reporter
                    </a>
                  ) : (
                    <div className="text-slate-500 text-[11px]">Reporter direct contact unavailable</div>
                  )}
                </div>
              </div>

              {/* Status Stepper: Real 6-Stage Lifecycle Progression */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Incident Response Lifecycle</span>
                  <span className="text-emerald-400 lowercase font-normal font-mono">
                    stage {getStageIndex(selectedIncident.status) + 1} of 6
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {LIFECYCLE_STAGES.map((step, idx) => {
                    const currentIdx = getStageIndex(selectedIncident.status);
                    const isCurrent = currentIdx === idx;
                    const isPassed = currentIdx > idx;

                    return (
                      <div
                        key={step.key}
                        className={`p-2.5 rounded-xl border text-center transition ${
                          isCurrent
                            ? "bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30"
                            : isPassed
                            ? "bg-emerald-950/40 text-emerald-300 border-emerald-800"
                            : "bg-slate-950/40 text-slate-500 border-slate-800"
                        }`}
                      >
                        <div className="text-[10px] font-mono opacity-80">{step.label.split(" ")[0]}</div>
                        <div className="text-xs font-bold truncate mt-0.5">{step.label.split(" ").slice(1).join(" ")}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Location & Mini-Map Integration */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Sighting Location & Navigation
                  </h4>

                  {selectedIncident.lat && selectedIncident.lng && (
                    <a
                      href={`https://www.google.com/maps?q=${selectedIncident.lat},${selectedIncident.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20"
                    >
                      <Navigation className="w-3.5 h-3.5" /> Navigate (Google Maps) <ArrowUpRight className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {selectedIncident.lat && selectedIncident.lng ? (
                  <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-52 relative z-0">
                    <MapContainer
                      center={[selectedIncident.lat, selectedIncident.lng]}
                      zoom={14}
                      scrollWheelZoom={false}
                      style={{ width: "100%", height: "100%" }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker
                        position={[selectedIncident.lat, selectedIncident.lng]}
                        icon={createGuardMarker(selectedIncident.risk_level, selectedIncident.status)}
                      >
                        <Popup>
                          <div className="p-1 text-slate-900 text-xs">
                            <strong className="block text-emerald-700">{selectedIncident.incident_code || selectedIncident.id}</strong>
                            <div>{selectedIncident.animal} ({selectedIncident.risk_level} Risk)</div>
                            <div>Status: {selectedIncident.status}</div>
                            <div>Time: {selectedIncident.timestamp || "Recently"}</div>
                          </div>
                        </Popup>
                      </Marker>
                    </MapContainer>
                    <div className="absolute bottom-2 left-2 z-[400] bg-slate-900/90 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] text-slate-300 font-mono">
                      GPS: {selectedIncident.lat.toFixed(4)}°N, {selectedIncident.lng.toFixed(4)}°E
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Location coordinates unavailable for this report. Sector: {selectedIncident.village_name || "Buffer Zone"}</span>
                  </div>
                )}
              </div>

              {/* Evidence Sighting Photo/Video Preview if attached */}
              {selectedIncident.image_path && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-blue-400" /> Sighting Evidence / Capture
                  </h4>
                  <div className="aspect-video max-h-56 bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center relative">
                    {selectedIncident.image_path.toLowerCase().endsWith(".mp4") || selectedIncident.image_path.toLowerCase().endsWith(".webm") ? (
                      <video
                        src={`${API_BASE_URL}${selectedIncident.image_path}`}
                        controls
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <img
                        src={`${API_BASE_URL}${selectedIncident.image_path}`}
                        alt="Evidence Capture"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Action Feedback Messages */}
              {actionSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-600/60 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}
              {actionError && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-600/60 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Guard Action Workflow Panel */}
              <div className="p-5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-400" />
                    Field Action Controls (State: {selectedIncident.status})
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Acting Guard: <strong className="text-slate-200">{guardName}</strong>
                  </span>
                </div>

                {/* Primary State-Advancing Buttons */}
                <div className="flex flex-wrap gap-2.5">
                  {/* Step 1: ACKNOWLEDGE */}
                  {selectedIncident.status === "REPORTED" && (
                    <button
                      onClick={() => executeAction("ACKNOWLEDGE")}
                      disabled={updating}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-blue-600/20"
                    >
                      <CheckSquare className="w-4 h-4" /> 1. Acknowledge Sighting Alert
                    </button>
                  )}

                  {/* Step 2: ASSIGN */}
                  {(selectedIncident.status === "UNDER_REVIEW" || (!selectedIncident.assigned_officer || selectedIncident.assigned_officer === "Unassigned")) && (
                    <button
                      onClick={() => executeAction("ASSIGN")}
                      disabled={updating}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-indigo-600/20"
                    >
                      <UserCheck className="w-4 h-4" /> 2. Assign Sighting to Myself
                    </button>
                  )}

                  {/* Step 3: START RESPONSE */}
                  {(selectedIncident.status === "ASSIGNED" || selectedIncident.status === "UNDER_REVIEW") && (
                    <button
                      onClick={() => executeAction("START_RESPONSE")}
                      disabled={updating}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-amber-600/20"
                    >
                      <Navigation className="w-4 h-4" /> 3. Deploy Patrol / Start Response
                    </button>
                  )}

                  {/* Step 4: RESOLVE */}
                  {["RESPONDING", "INVESTIGATING", "CONFIRMED", "ASSIGNED"].includes(selectedIncident.status) && (
                    <button
                      onClick={() => setShowResolveModal(true)}
                      disabled={updating}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-emerald-600/20 ml-auto"
                    >
                      <Check className="w-4 h-4" /> Mark Area Safe & Resolve Incident
                    </button>
                  )}

                  {/* Step 5: CLOSE */}
                  {selectedIncident.status === "RESOLVED" && (
                    <button
                      onClick={() => executeAction("CLOSE")}
                      disabled={updating}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 ml-auto"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Close & Archive Incident
                    </button>
                  )}
                </div>

                {/* Tactical Operational Actions (Available during response) */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Tactical Field Status Updates
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => executeAction("REACHED_LOCATION")}
                      disabled={updating}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
                    >
                      📍 Reached Location
                    </button>
                    <button
                      onClick={() => executeAction("ANIMAL_NOT_FOUND")}
                      disabled={updating}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
                    >
                      🔍 Animal Not Found
                    </button>
                    <button
                      onClick={() => executeAction("ANIMAL_MOVED_AWAY")}
                      disabled={updating}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
                    >
                      🐾 Animal Moved Away
                    </button>
                    <button
                      onClick={() => executeAction("AREA_SAFE")}
                      disabled={updating}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
                    >
                      🛡️ Perimeter Swept & Safe
                    </button>
                  </div>
                </div>

                {/* Field Observation Notes Input */}
                <div className="pt-2 border-t border-slate-800/80">
                  <label className="text-xs text-slate-400 font-medium">Record Field Log Entry / Verification Notes</label>
                  <div className="flex gap-2 mt-1.5">
                    <input
                      type="text"
                      placeholder="e.g. Pugmarks verified heading north away from village boundary. Acoustic horn deployed."
                      value={guardNotes}
                      onChange={(e) => setGuardNotes(e.target.value)}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => {
                        if (guardNotes.trim()) {
                          executeAction("ADD_NOTE", { notes: guardNotes.trim() });
                        }
                      }}
                      disabled={updating || !guardNotes.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" /> Save Note
                    </button>
                  </div>
                </div>
              </div>

              {/* Incident Audit Timeline */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" /> Incident Response Timeline & Audit Trail
                </h4>

                {selectedIncident.timeline && selectedIncident.timeline.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selectedIncident.timeline.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-800/40 rounded-xl border border-slate-700/40 flex items-start gap-3 text-xs"
                      >
                        <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0"></div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white">{item.stage}</span>
                            <span className="text-slate-400 text-[11px] font-mono">{item.time}</span>
                          </div>
                          <p className="text-slate-300 text-xs mt-0.5">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-500 text-center">
                    No timeline events recorded yet.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/60 p-12 rounded-3xl border border-slate-800 text-center text-slate-400">
              Select an incident from the queue to view details and execute response actions.
            </div>
          )}
        </div>
      </div>

      {/* Resolve Incident Modal (Requires Resolution Note) */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
              <CheckCircle2 className="w-5 h-5" /> Mark Incident Resolved
            </div>
            <p className="text-xs text-slate-300">
              Please enter an official resolution summary describing actions taken and confirming area safety.
            </p>

            <textarea
              rows={3}
              placeholder="e.g. Animal escorted back into core reserve sector. Perimeter siren sounded. Area verified safe for villagers."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-emerald-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  executeAction("RESOLVE", {
                    notes: resolutionNote.trim() || "Area verified safe by forest guard patrol."
                  });
                }}
                disabled={updating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
