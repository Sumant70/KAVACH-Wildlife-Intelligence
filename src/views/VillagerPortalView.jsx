import React, { useState, useEffect } from "react";
import {
  ShieldAlert, CheckCircle2, AlertTriangle, PhoneCall, Camera,
  MapPin, Clock, ArrowRight, Upload, Info, HeartHandshake, Eye,
  RefreshCw, Check, Sparkles, Volume2, Video, Navigation, ShieldCheck,
  Send, AlertCircle
} from "lucide-react";
import { API_BASE_URL } from "../KavachApp";
import { playEmergencyAlarm } from "../components/AudioAlerts";

// Official 15 KAVACH Wildlife Classes
const KAVACH_WILDLIFE_SPECIES = [
  "Elephant",
  "Tiger",
  "Leopard",
  "Wild Boar",
  "Spotted Deer",
  "Sloth Bear",
  "Gaur",
  "Rhinoceros",
  "Wild Buffalo",
  "Crocodile",
  "Snake",
  "Cobra",
  "Indian Python",
  "Russell's Viper",
  "Krait"
];

// Official Incident Lifecycle Statuses
const LIFECYCLE_STATUSES = [
  "REPORTED",
  "UNDER_REVIEW",
  "ASSIGNED",
  "RESPONDING",
  "RESOLVED",
  "CLOSED"
];

export default function VillagerPortalView({ onNavigate }) {
  const [villages, setVillages] = useState([]);
  const [selectedVillageId, setSelectedVillageId] = useState("VIL-01");
  const [villageStatus, setVillageStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myReports, setMyReports] = useState([]);
  const [nearbyIncidents, setNearbyIncidents] = useState([]);

  // Sighting Report Form State
  const [reportForm, setReportForm] = useState({
    reporter_name: "",
    reporter_contact: "",
    animal_reported: "Tiger",
    date_time: new Date().toISOString().slice(0, 16),
    lat: "20.2667",
    lng: "79.4000",
    description: "",
    severity: "HIGH",
    photo: null,
    video: null
  });

  const [photoPreview, setPhotoPreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [locationStatus, setLocationStatus] = useState(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportResult, setReportResult] = useState(null);
  const [submissionError, setSubmissionError] = useState(null);

  // 1. Fetch Villages list
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/villages`)
      .then(r => r.json())
      .then(data => {
        if (data.villages && data.villages.length > 0) {
          setVillages(data.villages);
          const first = data.villages[0];
          setSelectedVillageId(first.id);
          setReportForm(prev => ({
            ...prev,
            lat: first.lat?.toString() || "20.2667",
            lng: first.lng?.toString() || "79.4000"
          }));
        }
      })
      .catch(err => console.warn("Failed to fetch villages:", err));
  }, []);

  // 2. Fetch Village Status, My Reports, and Nearby Incidents
  const fetchVillageData = async (vId) => {
    try {
      // Village alert status
      const resStatus = await fetch(`${API_BASE_URL}/api/villager/status?village_id=${vId}`);
      const dataStatus = await resStatus.json();
      if (dataStatus.success) {
        setVillageStatus(dataStatus);
        if (dataStatus.has_active_threat && (dataStatus.threat_level === "DANGER" || dataStatus.threat_level === "CRITICAL")) {
          try { playEmergencyAlarm(); } catch (e) {}
        }
      }

      // My submitted reports
      const resReports = await fetch(`${API_BASE_URL}/api/reports/wildlife?village_id=${vId}`);
      const dataReports = await resReports.json();
      if (dataReports.success && dataReports.reports) {
        setMyReports(dataReports.reports);
      }

      // Nearby incidents for this village
      const resIncidents = await fetch(`${API_BASE_URL}/api/incidents?village_id=${vId}`);
      const dataIncidents = await resIncidents.json();
      if (dataIncidents.success && dataIncidents.incidents) {
        setNearbyIncidents(dataIncidents.incidents);
      }
    } catch (err) {
      console.warn("Failed to load village data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVillageData(selectedVillageId);
    const interval = setInterval(() => {
      fetchVillageData(selectedVillageId);
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedVillageId]);

  // Handle Village dropdown change
  const handleVillageChange = (vId) => {
    setSelectedVillageId(vId);
    const matched = villages.find(v => v.id === vId);
    if (matched) {
      setReportForm(prev => ({
        ...prev,
        lat: matched.lat.toString(),
        lng: matched.lng.toString()
      }));
    }
  };

  // Browser Geolocation: "Use My Location"
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation is not supported by your browser.");
      return;
    }
    setLocatingUser(true);
    setLocationStatus("Acquiring GPS coordinates...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude.toFixed(4);
        const uLng = pos.coords.longitude.toFixed(4);
        setReportForm(prev => ({
          ...prev,
          lat: uLat,
          lng: uLng
        }));
        setLocatingUser(false);
        setLocationStatus(`GPS Locked: ${uLat}° N, ${uLng}° E (±${Math.round(pos.coords.accuracy)}m)`);
      },
      (err) => {
        setLocatingUser(false);
        setLocationStatus("GPS acquisition failed. Please enter location or select village.");
        console.warn("Geolocation error:", err);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Photo & Video selection
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setReportForm(prev => ({ ...prev, photo: file }));
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setReportForm(prev => ({ ...prev, video: file }));
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  // Submit Wildlife Sighting
  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportForm.reporter_name.trim()) {
      setSubmissionError("Please enter your full name.");
      return;
    }

    setSubmittingReport(true);
    setReportResult(null);
    setSubmissionError(null);

    const formData = new FormData();
    formData.append("reporter_name", reportForm.reporter_name.trim());
    formData.append("reporter_contact", reportForm.reporter_contact.trim());
    formData.append("animal_reported", reportForm.animal_reported);
    formData.append("village_id", selectedVillageId);
    formData.append("lat", reportForm.lat);
    formData.append("lng", reportForm.lng);
    formData.append("description", reportForm.description.trim());
    formData.append("severity", reportForm.severity);
    formData.append("custom_timestamp", reportForm.date_time.replace("T", " "));

    if (reportForm.photo) {
      formData.append("photo", reportForm.photo);
    }
    if (reportForm.video) {
      formData.append("video", reportForm.video);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/wildlife`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        setReportResult(data);
        setReportForm(prev => ({
          ...prev,
          reporter_name: "",
          reporter_contact: "",
          description: "",
          photo: null,
          video: null
        }));
        setPhotoPreview(null);
        setVideoPreview(null);
        // Refresh data
        fetchVillageData(selectedVillageId);
      } else {
        setSubmissionError(data.message || "Failed to submit report.");
      }
    } catch (err) {
      console.error("Report submission failed:", err);
      setSubmissionError(`Submission failed: ${err.message}`);
    } finally {
      setSubmittingReport(false);
    }
  };

  const isThreat = villageStatus?.has_active_threat;
  const selectedVillageObj = villages.find(v => v.id === selectedVillageId) || villageStatus?.village;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Village Header & Village Selector */}
      <div className="bg-slate-900/90 backdrop-blur-md p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Gram Panchayat Community Safety Module
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              KAVACH Village Suraksha Portal
            </h1>
          </div>
        </div>

        {/* Village Selection Dropdown */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">Select Your Village:</span>
          <select
            value={selectedVillageId}
            onChange={(e) => handleVillageChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white font-semibold text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500"
          >
            {villages.map((v) => (
              <option key={v.id} value={v.id}>
                📍 {v.name} ({v.district || "Tadoba Range"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. VILLAGE ALERT SYSTEM BANNER */}
      {isThreat && (
        <div className="p-6 md:p-8 rounded-3xl border shadow-2xl transition-all bg-gradient-to-br from-rose-950 via-red-950 to-slate-950 border-rose-600 animate-pulse">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-rose-500 animate-ping" />
                <span className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  ⚠ WILDLIFE ALERT
                </span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-600 text-white">
                  RISK: {villageStatus?.threat_level || "HIGH"}
                </span>
              </div>

              <h2 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
                {villageStatus?.animal || "Dangerous Wildlife"} Movement Alert near {selectedVillageObj?.name || "Village"}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-200">
                <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-rose-500/30">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                  <span><strong>Location:</strong> {selectedVillageObj?.name || "Village Perimeter"}</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-rose-500/30">
                  <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Distance:</strong> {villageStatus?.distance_str || "Near Boundary"}</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-rose-500/30">
                  <Clock className="w-4 h-4 text-rose-400 shrink-0" />
                  <span><strong>Time:</strong> {villageStatus?.detected_time || "Active Now"}</span>
                </div>
              </div>

              {/* Recommended Action / Guidance */}
              <div className="bg-rose-950/70 p-4 rounded-2xl border border-rose-700/60 space-y-1.5 text-xs text-rose-100">
                <div className="font-black uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  RECOMMENDED ACTION:
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-200">
                  <li>Do not approach the animal</li>
                  <li>Stay indoors if advised</li>
                  <li>Keep children and livestock away from the area</li>
                  <li>Contact forest/wildlife response team</li>
                  <li>Do not attempt to chase or capture the animal</li>
                </ul>
              </div>
            </div>

            {/* Emergency Department Contact */}
            <div className="flex flex-col gap-2 shrink-0 md:min-w-[240px]">
              <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 text-center">
                <div className="text-xs text-slate-400 font-semibold mb-1">Official Forest Emergency</div>
                {villageStatus?.emergency_contacts && villageStatus.emergency_contacts.length > 0 ? (
                  <a
                    href={`tel:${villageStatus.emergency_contacts[0].number}`}
                    className="px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>Call {villageStatus.emergency_contacts[0].number}</span>
                  </a>
                ) : (
                  <div className="p-3 bg-slate-800/80 rounded-xl text-slate-400 text-xs italic">
                    Forest Department contact not configured
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* When Area is Safe */}
      {!isThreat && villageStatus && (
        <div className="p-6 rounded-3xl border bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/50" />
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                🟢 AREA SECURE · NORMAL CONDITIONS
              </span>
              <h3 className="text-xl font-bold text-white mt-0.5">
                No active wildlife conflicts detected at {selectedVillageObj?.name}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                AI optical sensors & camera traps reporting clear perimeters. Regular community activities may proceed safely.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate?.("map")}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>View Radar Map</span>
          </button>
        </div>
      )}

      {/* CITIZEN SIGHTING REPORT FORM */}
      <div className="bg-slate-900/90 p-6 md:p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Report Wildlife Sighting</h3>
              <p className="text-xs text-slate-400">
                Spotted wildlife near your village? Submit your report below. A real incident record with unique ID will be logged immediately.
              </p>
            </div>
          </div>
        </div>

        {/* Confirmation Banner */}
        {reportResult && (
          <div className="p-5 rounded-2xl bg-emerald-950/60 border border-emerald-500 flex items-start gap-4 animate-in fade-in">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h4 className="text-base font-bold text-emerald-200">
                Incident Created: #{reportResult.incident_code || reportResult.incident_id} (Status: REPORTED)
              </h4>
              <p className="text-xs text-emerald-300/90 leading-relaxed">
                {reportResult.message}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <span className="bg-emerald-900/60 px-3 py-1 rounded-lg border border-emerald-500/30 text-emerald-200 font-semibold">
                  Status: REPORTED
                </span>
                <span className="bg-emerald-900/60 px-3 py-1 rounded-lg border border-emerald-500/30 text-emerald-200 font-semibold">
                  Species: {reportResult.animal_reported}
                </span>
                <span className="bg-emerald-900/60 px-3 py-1 rounded-lg border border-emerald-500/30 text-emerald-200 font-semibold">
                  Severity: {reportResult.severity}
                </span>
                {reportResult.ai_verified_species && (
                  <span className="bg-emerald-800/80 px-3 py-1 rounded-lg border border-emerald-400 text-white font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                    AI Verified: {reportResult.ai_verified_species} ({reportResult.ai_confidence}%)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {submissionError && (
          <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{submissionError}</span>
          </div>
        )}

        <form onSubmit={handleReportSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Reporter Name */}
            <div>
              <label className="text-xs font-semibold text-slate-300">Reporter Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Patil"
                value={reportForm.reporter_name}
                onChange={(e) => setReportForm({ ...reportForm, reporter_name: e.target.value })}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Village Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300">Village</label>
              <select
                value={selectedVillageId}
                onChange={(e) => handleVillageChange(e.target.value)}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                {villages.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            {/* Mobile Number */}
            <div>
              <label className="text-xs font-semibold text-slate-300">Mobile Number (For Alerts)</label>
              <input
                type="tel"
                placeholder="e.g. 94221 00000"
                value={reportForm.reporter_contact}
                onChange={(e) => setReportForm({ ...reportForm, reporter_contact: e.target.value })}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 15 Allowed Wildlife Species Dropdown */}
            <div>
              <label className="text-xs font-semibold text-slate-300">Animal / Species *</label>
              <select
                value={reportForm.animal_reported}
                onChange={(e) => setReportForm({ ...reportForm, animal_reported: e.target.value })}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 font-medium"
              >
                {KAVACH_WILDLIFE_SPECIES.map((species) => (
                  <option key={species} value={species}>🐾 {species}</option>
                ))}
              </select>
            </div>

            {/* Date / Time */}
            <div>
              <label className="text-xs font-semibold text-slate-300">Date & Time *</label>
              <input
                type="datetime-local"
                value={reportForm.date_time}
                onChange={(e) => setReportForm({ ...reportForm, date_time: e.target.value })}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Severity */}
            <div>
              <label className="text-xs font-semibold text-slate-300">Severity Assessment</label>
              <select
                value={reportForm.severity}
                onChange={(e) => setReportForm({ ...reportForm, severity: e.target.value })}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 font-bold"
              >
                <option value="LOW" className="text-emerald-400">🟢 LOW — Distant / Non-aggressive</option>
                <option value="MEDIUM" className="text-amber-400">🟡 MEDIUM — Near grazing land</option>
                <option value="HIGH" className="text-orange-400">🟠 HIGH — Close to village houses</option>
                <option value="CRITICAL" className="text-rose-400">🔴 CRITICAL — Imminent settlement entry</option>
              </select>
            </div>
          </div>

          {/* Location Section: "Use My Location" + Manual Coordinates */}
          <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-400" /> Location Coordinates
                </label>
                <div className="text-[11px] text-slate-400">
                  Click 'Use My Location' for browser GPS or enter coordinates manually.
                </div>
              </div>
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locatingUser}
                className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0"
              >
                {locatingUser ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                <span>{locatingUser ? "Locating..." : "Use My Location"}</span>
              </button>
            </div>

            {locationStatus && (
              <div className="text-xs font-mono text-emerald-400 bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/40">
                {locationStatus}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-400">Latitude</span>
                <input
                  type="text"
                  value={reportForm.lat}
                  onChange={(e) => setReportForm({ ...reportForm, lat: e.target.value })}
                  className="mt-0.5 w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Longitude</span>
                <input
                  type="text"
                  value={reportForm.lng}
                  onChange={(e) => setReportForm({ ...reportForm, lng: e.target.value })}
                  className="mt-0.5 w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Description & Landmark</label>
            <textarea
              rows={2}
              placeholder="e.g. Spotted tiger near northern canal crossing at agricultural perimeter."
              value={reportForm.description}
              onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })}
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Optional Photo & Video Upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300">Optional Photo (For YOLO Verification)</label>
              <div className="mt-1 flex items-center gap-3">
                <label className="cursor-pointer px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium text-slate-200 flex items-center gap-2 transition">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span>Attach Photo</span>
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                </label>
                {photoPreview && (
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-emerald-500 shrink-0">
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Optional Video</label>
              <div className="mt-1 flex items-center gap-3">
                <label className="cursor-pointer px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium text-slate-200 flex items-center gap-2 transition">
                  <Video className="w-4 h-4 text-emerald-400" />
                  <span>Attach Video</span>
                  <input type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
                </label>
                {videoPreview && (
                  <span className="text-xs text-emerald-400 font-mono">Video attached ✓</span>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submittingReport}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition"
          >
            {submittingReport ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Logging Incident Record & Running AI Verification...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Wildlife Sighting Report</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* DASHBOARD: MY REPORTS & NEARBY INCIDENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Reports with Real Status Lifecycle */}
        <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Eye className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">My Sighting Reports</h3>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
              {myReports.length} Submitted
            </span>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 text-xs">
            {myReports.length === 0 ? (
              <div className="p-8 text-center text-slate-500 italic">
                No sighting reports logged yet for {selectedVillageObj?.name}.
              </div>
            ) : (
              myReports.map((rep) => (
                <div key={rep.id} className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-emerald-400 font-bold">{rep.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      rep.status === "RESOLVED" || rep.status === "CLOSED"
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                        : rep.status === "RESPONDING"
                        ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                        : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                    }`}>
                      {rep.status}
                    </span>
                  </div>

                  <div className="text-white font-bold text-sm">🐾 {rep.animal_reported}</div>
                  <div className="text-slate-300 text-xs">{rep.description || "No landmark specified"}</div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/50">
                    <span>By: {rep.reporter_name}</span>
                    <span>{rep.created_at || rep.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Nearby Incidents in Sector */}
        <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">Active Sector Incidents</h3>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
              {nearbyIncidents.length} In Sector
            </span>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 text-xs">
            {nearbyIncidents.length === 0 ? (
              <div className="p-8 text-center text-slate-500 italic">
                No active incidents reported in this village sector.
              </div>
            ) : (
              nearbyIncidents.map((inc) => (
                <div key={inc.id} className="p-3.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-amber-400 font-bold">{inc.incident_code || inc.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      inc.status === "RESOLVED" || inc.status === "CLOSED"
                        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                        : inc.status === "RESPONDING"
                        ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                        : "bg-orange-500/10 text-orange-300 border-orange-500/30"
                    }`}>
                      {inc.status}
                    </span>
                  </div>

                  <div className="text-white font-bold text-sm">{inc.title || `${inc.animal} Movement`}</div>
                  <div className="text-slate-300 text-xs">
                    Assigned: <strong className="text-emerald-400">{inc.assigned_officer || "Unassigned"}</strong>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/50">
                    <span>Priority: {inc.risk_level}</span>
                    <span>{inc.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Safety Instructions & Guidance */}
      <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white">Community Wildlife Safety Protocol</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {[
            "Do not approach the animal under any circumstances.",
            "Stay indoors if advised by the Forest Beat Guard or Siren alert.",
            "Keep children and livestock safely secured in enclosures away from boundary lines.",
            "Contact forest/wildlife response team immediately through the portal or field line.",
            "Do not attempt to chase, corner, provoke or capture the animal.",
            "Avoid carrying open foodstuffs, bananas, or raw harvest near forest buffer edges."
          ].map((inst, idx) => (
            <div key={idx} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 flex items-start gap-2.5 text-slate-200">
              <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                {idx + 1}
              </span>
              <span className="leading-relaxed">{inst}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
