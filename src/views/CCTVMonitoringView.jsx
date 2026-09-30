import React, { useState, useEffect, useRef } from "react";
import {
  Video, Play, Square, Plus, Shield, RefreshCw, AlertTriangle,
  CheckCircle2, MapPin, Eye, Maximize2, X, Lock, Key, Radio,
  Activity, Compass, Layers, Sliders, ExternalLink, Zap, Trash2,
  Check, Wifi, WifiOff, AlertCircle
} from "lucide-react";
import { API_BASE_URL } from "../KavachApp";

export default function CCTVMonitoringView({ apiBaseUrl, onNavigate }) {
  const effectiveApiUrl = apiBaseUrl || API_BASE_URL;
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [selectedCam, setSelectedCam] = useState(null);

  // Add Camera Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    type: "RTSP",
    rtsp_url: "",
    ip_address: "",
    port: "554",
    username: "",
    password: "",
    location: "South Buffer Watchtower",
    forest_range: "Tadoba Core Range",
    village_id: "VIL-01",
    district: "Chandrapur",
    state: "Maharashtra",
    lat: "20.2667",
    lng: "79.4000",
    resolution: "1920x1080",
    fps: "15",
    confidence_threshold: "0.45",
    alert_radius_m: "1500"
  });

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState(null);

  // 1. Fetch Cameras from Backend
  const fetchCameras = async () => {
    try {
      const res = await fetch(`${effectiveApiUrl}/api/cameras`);
      const data = await res.json();
      if (data.success && data.cameras) {
        setCameras(data.cameras);
      }
    } catch (err) {
      console.warn("Failed to fetch cameras:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
    // Fast frame refresher interval (every 1000ms for live CCTV tiles)
    const frameInterval = setInterval(() => {
      setRefreshKey(Date.now());
    }, 1000);

    // Metadata refresher interval (every 4s)
    const metaInterval = setInterval(() => {
      fetchCameras();
    }, 4000);

    return () => {
      clearInterval(frameInterval);
      clearInterval(metaInterval);
    };
  }, [effectiveApiUrl]);

  // 2. Start / Stop Camera Stream Worker
  const handleToggleStream = async (cam) => {
    const isLive = cam.is_streaming || cam.status === "ONLINE";
    const endpoint = isLive ? "stop" : "start";
    try {
      await fetch(`${effectiveApiUrl}/api/cameras/${cam.id}/${endpoint}`, {
        method: "POST"
      });
      fetchCameras();
    } catch (err) {
      console.warn(`Error toggling camera ${cam.id}:`, err);
    }
  };

  // 3. Test Active Camera Connection
  const handleTestExistingCamera = async (camId) => {
    try {
      const res = await fetch(`${effectiveApiUrl}/api/cameras/${camId}/test`, { method: "POST" });
      const data = await res.json();
      alert(data.message || (data.success ? "RTSP Connection Successful" : "RTSP Connection Failed"));
      fetchCameras();
    } catch (err) {
      alert("Error testing camera: " + err.message);
    }
  };

  // 4. Delete Camera
  const handleDeleteCamera = async (camId) => {
    if (!window.confirm(`Are you sure you want to remove camera ${camId}?`)) return;
    try {
      await fetch(`${effectiveApiUrl}/api/cameras/${camId}`, { method: "DELETE" });
      fetchCameras();
    } catch (err) {
      console.warn("Delete error:", err);
    }
  };

  // 5. One-Click Demo Reconnect for Hackathon Testing
  const connectAllDemoCameras = async () => {
    setLoading(true);
    try {
      for (const cam of cameras) {
        await fetch(`${effectiveApiUrl}/api/cameras/${cam.id}/start`, { method: "POST" });
      }
      await fetchCameras();
    } finally {
      setLoading(false);
    }
  };

  // 6. Test RTSP Connection in Add Modal
  const handleTestModalConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const payload = {
        rtsp_url: formData.rtsp_url,
        ip_address: formData.ip_address,
        port: parseInt(formData.port) || 554,
        username: formData.username,
        password: formData.password
      };
      const res = await fetch(`${effectiveApiUrl}/api/cameras/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({
        success: false,
        message: "Failed to communicate with backend camera service."
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // 7. Handle Add Camera Form
  const handleAddCamera = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    setSubmitting(true);
    setFormMsg(null);

    try {
      const res = await fetch(`${effectiveApiUrl}/api/cameras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: formData.id || undefined,
          name: formData.name,
          type: formData.type,
          rtsp_url: formData.rtsp_url,
          ip_address: formData.ip_address,
          port: parseInt(formData.port) || 554,
          username: formData.username,
          password: formData.password,
          location: formData.location,
          forest_range: formData.forest_range,
          village_id: formData.village_id,
          district: formData.district,
          state: formData.state,
          lat: parseFloat(formData.lat) || 20.2667,
          lng: parseFloat(formData.lng) || 79.4000,
          resolution: formData.resolution,
          fps: parseInt(formData.fps) || 15,
          confidence_threshold: parseFloat(formData.confidence_threshold) || 0.45,
          alert_radius_m: parseFloat(formData.alert_radius_m) || 1500
        })
      });
      const data = await res.json();
      if (data.success) {
        setFormMsg({ type: "success", text: `Camera ${data.name || formData.name} registered and initialized successfully.` });
        setTimeout(() => {
          setAddModalOpen(false);
          setFormMsg(null);
          setTestResult(null);
          fetchCameras();
        }, 1200);
      } else {
        setFormMsg({ type: "error", text: data.detail || "Failed to register camera." });
      }
    } catch (err) {
      setFormMsg({ type: "error", text: "Network error connecting to camera service." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                CCTV & RTSP Wildlife Surveillance Grid
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {cameras.filter(c => c.is_streaming || c.status === "ONLINE").length} / {cameras.length} CAMERAS ONLINE
                </span>
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Centralized IP camera management with credential encryption, background OpenCV frame ingestion & real-time YOLO predator tracking
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={connectAllDemoCameras}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <Zap className="w-4 h-4" /> 1-Click Connect Feeds
          </button>

          <button
            onClick={() => {
              setTestResult(null);
              setFormMsg(null);
              setAddModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" /> Register New Camera
          </button>
        </div>
      </div>

      {/* Telemetry KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Configured Endpoints</div>
          <div className="text-2xl font-bold text-white mt-1">{cameras.length} Cameras</div>
          <div className="text-[11px] text-slate-500 mt-1">RTSP & CCTV Stream Buffer</div>
        </div>
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Streaming Status</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {cameras.filter(c => c.is_streaming || c.status === "ONLINE").length} Online
          </div>
          <div className="text-[11px] text-emerald-500/80 mt-1">● Real-time ingestion active</div>
        </div>
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Mean Optical FPS</div>
          <div className="text-2xl font-bold text-white mt-1">15.0 FPS</div>
          <div className="text-[11px] text-slate-500 mt-1">Hardware throttled to avoid starving CPU</div>
        </div>
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Credential Security</div>
          <div className="text-2xl font-bold text-teal-400 mt-1 flex items-center gap-1.5">
            <Lock className="w-5 h-5" /> Masked
          </div>
          <div className="text-[11px] text-teal-500/80 mt-1">Password sanitization enabled</div>
        </div>
      </div>

      {/* Cameras Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cameras.map((cam) => {
          const isLive = cam.is_streaming || cam.status === "ONLINE";
          const isReconnecting = cam.status === "RECONNECTING";
          const hasDetection = Boolean(cam.latest_detection);

          return (
            <div
              key={cam.id}
              className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl flex flex-col group hover:border-slate-700 transition"
            >
              {/* Camera Tile Header */}
              <div className="p-4 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    isLive ? "bg-emerald-400 animate-ping" : isReconnecting ? "bg-amber-400 animate-pulse" : "bg-rose-500"
                  }`} />
                  <div>
                    <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                      {cam.name}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {cam.id}
                      </span>
                    </h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      <span>{cam.forest_range || "Tadoba Core"}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-500">{cam.lat?.toFixed(3)}°N, {cam.lng?.toFixed(3)}°E</span>
                    </div>
                  </div>
                </div>

                {/* Status Pill & Actions */}
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isLive
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : isReconnecting
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}>
                    {isLive ? "● LIVE" : isReconnecting ? `RETRY (${cam.retry_count || 1})` : "OFFLINE"}
                  </span>
                  <button
                    onClick={() => setSelectedCam(cam)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                    title="Expand Viewport"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Camera Video Viewport */}
              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                {isLive ? (
                  <img
                    src={`${effectiveApiUrl}/api/cameras/${cam.id}/frame?t=${refreshKey}`}
                    alt={cam.name}
                    className="w-full h-full object-cover transition duration-300"
                    onError={(e) => {
                      e.target.style.opacity = "0.7";
                    }}
                  />
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <Video className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">
                      {isReconnecting ? `Attempting exponential reconnect...` : "Camera Feed Disconnected"}
                    </p>
                    {cam.error_message && (
                      <p className="text-[10px] text-rose-400 font-mono max-w-xs mx-auto truncate">
                        {cam.error_message}
                      </p>
                    )}
                    <button
                      onClick={() => handleToggleStream(cam)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition"
                    >
                      Start Stream
                    </button>
                  </div>
                )}

                {/* Stream Telemetry Overlay */}
                {isLive && (
                  <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono text-white flex items-center gap-2 border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{cam.fps || 15} FPS</span>
                    <span className="text-slate-400">|</span>
                    <span>{cam.resolution || "1080p"}</span>
                  </div>
                )}

                {/* Wildlife Detection Badge Overlay */}
                {hasDetection && (
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-black/80 backdrop-blur-md p-2 rounded-xl border border-amber-500/40 flex items-center justify-between text-xs text-white">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="font-bold text-amber-400">{cam.latest_detection}</span>
                      <span className="text-slate-300">({cam.latest_confidence || 88}% AI Conf)</span>
                    </div>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-semibold">
                      INSPECTION REQUIRED
                    </span>
                  </div>
                )}
              </div>

              {/* Camera Tile Footer */}
              <div className="p-3.5 bg-slate-950/40 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2 truncate max-w-[220px]">
                  <Lock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="font-mono text-[11px] text-slate-300 truncate" title={cam.rtsp_url_masked}>
                    {cam.rtsp_url_masked || "demo://wildlife-reserve-feed"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestExistingCamera(cam.id)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                    title="Test socket and frame grab"
                  >
                    Test
                  </button>

                  <button
                    onClick={() => handleToggleStream(cam)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                      isLive
                        ? "bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20"
                    }`}
                  >
                    {isLive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isLive ? "Stop" : "Start"}
                  </button>

                  <button
                    onClick={() => handleDeleteCamera(cam.id)}
                    className="p-1.5 bg-slate-800 hover:bg-rose-950/50 hover:text-rose-400 text-slate-400 rounded-lg transition"
                    title="Delete camera"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fullscreen Expanded Camera Modal */}
      {selectedCam && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-950 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{selectedCam.name}</h3>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{selectedCam.forest_range}</span>
                    <span>•</span>
                    <span className="font-mono">{selectedCam.rtsp_url_masked}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedCam(null)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-video bg-black flex items-center justify-center">
              <img
                src={`${effectiveApiUrl}/api/cameras/${selectedCam.id}/frame?t=${refreshKey}`}
                alt={selectedCam.name}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-mono text-white flex items-center gap-3 border border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>LIVE FEED • {selectedCam.resolution || "1920x1080"}</span>
                <span>|</span>
                <span>{selectedCam.fps || 15} FPS</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Geofence radius: {selectedCam.alert_radius_m || 1000} m</span>
                <span>•</span>
                <span>Village link: {selectedCam.village_id || "VIL-01"}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedCam(null);
                    onNavigate && onNavigate("gis");
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition"
                >
                  Locate on GIS Map
                </button>
                <button
                  onClick={() => setSelectedCam(null)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl transition"
                >
                  Close Inspection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Camera Modal with Full Configuration & Connection Testing */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Register RTSP / IP Camera</h3>
                  <p className="text-xs text-slate-400">Configure parameters and verify connectivity with real RTSP socket handshake</p>
                </div>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCamera} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {formMsg && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  formMsg.type === "success"
                    ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800"
                    : "bg-rose-950/40 text-rose-300 border border-rose-800"
                }`}>
                  {formMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span>{formMsg.text}</span>
                </div>
              )}

              {/* Test Connection Banner if run */}
              {testResult && (
                <div className={`p-3.5 rounded-xl text-xs border flex items-start gap-2.5 ${
                  testResult.success
                    ? "bg-emerald-950/50 border-emerald-600/50 text-emerald-200"
                    : "bg-rose-950/50 border-rose-600/50 text-rose-200"
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <p className="font-semibold">{testResult.message}</p>
                    {testResult.resolution && (
                      <p className="text-[11px] text-slate-300 font-mono">
                        Frame: {testResult.resolution} | FPS: {testResult.fps} | Latency: {testResult.latency_ms}ms
                      </p>
                    )}
                    {testResult.diagnostic && (
                      <p className="text-[11px] text-rose-300 font-mono">{testResult.diagnostic}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Basic Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300">Camera Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. South Buffer Watchtower CAM-05"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Camera ID (Unique)</label>
                  <input
                    type="text"
                    placeholder="e.g. CAM-005 (auto-generated if empty)"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* RTSP URL & Test Button */}
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>RTSP Stream URL</span>
                    <span className="text-[11px] text-teal-400 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Credentials Auto-Masked
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="rtsp://admin:password@192.168.1.100:554/stream1"
                    value={formData.rtsp_url}
                    onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400">IP Address</label>
                    <input
                      type="text"
                      placeholder="192.168.1.100"
                      value={formData.ip_address}
                      onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                      className="mt-0.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Port</label>
                    <input
                      type="number"
                      placeholder="554"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      className="mt-0.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Username</label>
                    <input
                      type="text"
                      placeholder="admin"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="mt-0.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="mt-0.5 w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleTestModalConnection}
                    disabled={testingConnection || (!formData.rtsp_url && !formData.ip_address)}
                    className="px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 rounded-lg text-xs font-semibold transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {testingConnection ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                    <span>{testingConnection ? "Testing RTSP Handshake..." : "Test Connection"}</span>
                  </button>
                </div>
              </div>

              {/* Geographic & Geofence Fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300">Forest Range</label>
                  <input
                    type="text"
                    value={formData.forest_range}
                    onChange={(e) => setFormData({ ...formData, forest_range: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Village ID</label>
                  <input
                    type="text"
                    value={formData.village_id}
                    onChange={(e) => setFormData({ ...formData, village_id: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Technical Video & Detection Parameters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300">Resolution</label>
                  <select
                    value={formData.resolution}
                    onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="1920x1080">1920x1080 (1080p)</option>
                    <option value="1280x720">1280x720 (720p)</option>
                    <option value="640x480">640x480 (VGA)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Target FPS</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={formData.fps}
                    onChange={(e) => setFormData({ ...formData, fps: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Confidence Cutoff</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="0.9"
                    value={formData.confidence_threshold}
                    onChange={(e) => setFormData({ ...formData, confidence_threshold: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Alert Radius (m)</label>
                  <input
                    type="number"
                    step="100"
                    value={formData.alert_radius_m}
                    onChange={(e) => setFormData({ ...formData, alert_radius_m: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl transition flex items-center gap-2 shadow-lg shadow-blue-600/30"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Register & Initialize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
