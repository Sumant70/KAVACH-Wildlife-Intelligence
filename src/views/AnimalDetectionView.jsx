import React, { useState, useRef, useEffect } from "react";
import {
  Upload, Camera, Video, Play, RefreshCw, AlertTriangle, CheckCircle2,
  MapPin, ShieldAlert, Sliders, ExternalLink, ArrowRight, Radio,
  Film, Activity, Compass, Gauge, Zap, CheckCircle, Info
} from "lucide-react";
import BoundingBoxCanvas from "../components/BoundingBoxCanvas";
import WebcamDetector from "../components/WebcamDetector";
import VideoBoundingBoxPlayer from "../components/VideoBoundingBoxPlayer";
import VideoErrorBoundary from "../components/VideoErrorBoundary";
import { SAMPLE_WILDLIFE_CASES } from "../assets/sample_animals";
import { playRadarPing, playEmergencyAlarm } from "../components/AudioAlerts";
import { API_BASE_URL } from "../KavachApp";
import { isAllowedWildlife, getWildlifeEmoji } from "../allowedWildlife";

const ALLOWED_VIDEO_EXTS = [".mp4", ".mov", ".avi", ".webm"];

export default function AnimalDetectionView({
  apiBaseUrl,
  userGps,
  onDetectionAdded,
  onNavigateToMap
}) {
  const effectiveApiUrl = apiBaseUrl || API_BASE_URL;

  // Tabs: "upload" | "webcam" | "presets" | "video"
  const [activeTab, setActiveTab] = useState("upload");

  // Image Detection States
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(35);
  const [selectedZone, setSelectedZone] = useState("Z-04");
  const [backendStatus, setBackendStatus] = useState("CHECKING"); // "ONLINE" | "OFFLINE" | "CHECKING"
  const [modelStatus, setModelStatus] = useState(null);
  const fileInputRef = useRef(null);

  // Video Movement Detection States
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [videoAnalyzing, setVideoAnalyzing] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoStatusText, setVideoStatusText] = useState("");
  const [videoResult, setVideoResult] = useState(null);
  const [videoConfidence, setVideoConfidence] = useState(35);
  const [videoErrorMessage, setVideoErrorMessage] = useState(null);
  const videoFileInputRef = useRef(null);
  const videoPollingTimerRef = useRef(null);

  // Periodically check backend health
  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`${effectiveApiUrl}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        setBackendStatus("ONLINE");
      } else {
        setBackendStatus("OFFLINE");
      }
    } catch {
      setBackendStatus("OFFLINE");
    }
  };

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 8000);
    return () => clearInterval(interval);
  }, [effectiveApiUrl]);

  // Load model validation status (supported vs unsupported species)
  useEffect(() => {
    fetch(`${effectiveApiUrl}/api/model/status`)
      .then(r => r.json())
      .then(d => setModelStatus(d))
      .catch(() => null);
  }, [effectiveApiUrl]);

  // Clean up object URLs & polling timer on unmount
  useEffect(() => {
    return () => {
      if (videoPollingTimerRef.current) {
        clearInterval(videoPollingTimerRef.current);
      }
    };
  }, []);

  // ==========================================
  // IMAGE DETECTION HANDLERS
  // ==========================================
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/") || ALLOWED_VIDEO_EXTS.some(ext => file.name.toLowerCase().endsWith(ext));
    if (isVideo) {
      setActiveTab("video");
      validateAndSetVideoFile(file, true);
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setDetectionResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/") || ALLOWED_VIDEO_EXTS.some(ext => file.name.toLowerCase().endsWith(ext));
    if (isVideo) {
      setActiveTab("video");
      validateAndSetVideoFile(file, true);
      return;
    }

    if (file.type.startsWith("image/")) {
      setErrorMessage(null);
      setInfoMessage(null);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setDetectionResult(null);
    }
  };

  const handlePresetSelect = async (preset) => {
    setErrorMessage(null);
    setPreviewUrl(preset.imageUrl);
    setSelectedZone(preset.zoneId);

    try {
      const resp = await fetch(preset.imageUrl);
      if (!resp.ok) throw new Error(`Could not fetch ${preset.imageUrl}`);
      const blob = await resp.blob();
      const file = new File([blob], `${preset.species.toLowerCase().replace(/\s+/g, '_')}_sample.jpg`, { type: "image/jpeg" });
      setSelectedFile(file);
      runDetection(file, preset.lat, preset.lng, preset.zoneId);
    } catch (err) {
      console.warn("Using preset image fetch error:", err);
      setErrorMessage(`Failed to load preset sample image: ${err.message}`);
    }
  };

  const handleWebcamCapture = (capturedFile) => {
    setSelectedFile(capturedFile);
    setPreviewUrl(URL.createObjectURL(capturedFile));
    runDetection(capturedFile, userGps?.lat, userGps?.lng);
  };

  const runDetection = async (fileToRun, overrideLat, overrideLng, overrideZone) => {
    const file = fileToRun || selectedFile;
    if (!file) {
      setErrorMessage("Please select or capture a wildlife image first.");
      return;
    }

    setAnalyzing(true);
    setErrorMessage(null);
    setInfoMessage(null);

    const lat = overrideLat !== undefined ? overrideLat : 20.2667;
    const lng = overrideLng !== undefined ? overrideLng : 79.4000;
    const zone = overrideZone ?? selectedZone ?? "Z-04";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("lat", lat.toString());
    formData.append("lng", lng.toString());
    formData.append("zone_id", zone);
    formData.append("accuracy", (userGps?.accuracy || 10).toString());
    formData.append("confidence_threshold", (confidenceThreshold / 100).toString());

    try {
      const response = await fetch(`${effectiveApiUrl}/api/detect/image`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        let customMsg = errData.detail || errData.message;
        if (response.status === 400) {
          if (customMsg?.toLowerCase().includes("format") || customMsg?.toLowerCase().includes("extension")) {
            customMsg = "Invalid image format. Supported formats: JPG, JPEG, PNG, WEBP.";
          } else if (customMsg?.toLowerCase().includes("size") || customMsg?.toLowerCase().includes("25mb")) {
            customMsg = "Image is too large. Maximum supported image size is 25MB.";
          }
        } else if (response.status === 500) {
          if (customMsg?.toLowerCase().includes("yolo") || customMsg?.toLowerCase().includes("model")) {
            customMsg = "YOLO model could not be loaded or executed by backend.";
          }
        }
        throw new Error(customMsg || `Detection failed (Server returned HTTP ${response.status})`);
      }

      const data = await response.json();
      setBackendStatus("ONLINE");
      setDetectionResult(data);

      if (data.detected && isAllowedWildlife(data.species)) {
        playRadarPing();
        if (data.risk?.risk_level === "HIGH" || data.risk?.risk_level === "CRITICAL") {
          playEmergencyAlarm();
        }
        onDetectionAdded?.(data);
      } else {
        setInfoMessage("No Wildlife Detected");
      }
    } catch (err) {
      console.error("Detection failed:", err);
      let friendlyMsg = "";
      if (err.name === "TypeError" || (err.message && err.message.toLowerCase().includes("fetch"))) {
        setBackendStatus("OFFLINE");
        friendlyMsg = `Detection server is offline. Unable to connect to KAVACH backend at ${effectiveApiUrl}. Please start backend with: python backend/predict.py`;
      } else {
        friendlyMsg = err.message || "Detection failed. Please check backend connection and retry.";
      }
      setErrorMessage(friendlyMsg);
    } finally {
      setAnalyzing(false);
    }
  };

  // ==========================================
  // VIDEO MOVEMENT DETECTION HANDLERS
  // ==========================================
  const handleVideoFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndSetVideoFile(file);
  };

  const handleVideoDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetVideoFile(file);
    }
  };

  const validateAndSetVideoFile = (file, autoStart = true) => {
    setVideoErrorMessage(null);
    setVideoResult(null);

    const name = file.name.toLowerCase();
    const isAllowed = ALLOWED_VIDEO_EXTS.some(ext => name.endsWith(ext));
    if (!isAllowed) {
      setVideoErrorMessage(`Unsupported video format. Allowed formats: MP4, MOV, AVI, WebM.`);
      return;
    }

    setVideoFile(file);
    if (videoPreviewUrl && videoPreviewUrl.startsWith("blob:")) {
      try { URL.revokeObjectURL(videoPreviewUrl); } catch (e) {}
    }
    const blobUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(blobUrl);

    if (autoStart) {
      executeVideoAnalysis(file);
    }
  };

  // 1-Click Sample Tiger Video Trigger
  const handleSampleVideoDemo = async () => {
    setVideoErrorMessage(null);
    setVideoResult(null);
    setVideoAnalyzing(true);
    setVideoProgress(10);
    setVideoStatusText("Uploading...");

    try {
      const sampleRes = await fetch(`${effectiveApiUrl}/api/detect/video/sample`, { method: "POST" });
      if (!sampleRes.ok) throw new Error("Could not prepare sample video on server.");
      const sampleData = await sampleRes.json();

      // Set video preview from backend uploads
      const sampleVidUrl = `${effectiveApiUrl}${sampleData.video_url}`;
      setVideoPreviewUrl(sampleVidUrl);

      // Fetch the generated video as blob to submit to detection endpoint
      const vidResp = await fetch(sampleVidUrl);
      const vidBlob = await vidResp.blob();
      const sampleFile = new File([vidBlob], "sample_tiger_movement.mp4", { type: "video/mp4" });
      setVideoFile(sampleFile);

      // Start video detection pipeline
      executeVideoAnalysis(sampleFile);
    } catch (err) {
      console.error("Sample video demo failed:", err);
      setVideoErrorMessage(`Video analysis failed: ${err.message}`);
      setVideoAnalyzing(false);
    }
  };

  const executeVideoAnalysis = async (fileToRun) => {
    const file = fileToRun || videoFile;
    if (!file) {
      setVideoErrorMessage("Please select or upload a video file first.");
      return;
    }

    if (videoPollingTimerRef.current) {
      clearInterval(videoPollingTimerRef.current);
    }

    // Step 1: Uploading...
    setVideoAnalyzing(true);
    setVideoProgress(15);
    setVideoStatusText("Uploading...");
    setVideoErrorMessage(null);
    setVideoResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("lat", "20.2667");
    formData.append("lng", "79.4000");
    formData.append("zone_id", selectedZone || "Z-04");
    formData.append("confidence_threshold", (videoConfidence / 100).toString());

    try {
      const uploadResp = await fetch(`${effectiveApiUrl}/api/detect/video`, {
        method: "POST",
        body: formData
      });

      if (!uploadResp.ok) {
        const errJson = await uploadResp.json().catch(() => ({}));
        throw new Error(errJson.detail || `Upload failed with HTTP ${uploadResp.status}`);
      }

      const uploadData = await uploadResp.json();
      const jobId = uploadData.job_id;

      // Step 2: Analyzing Wildlife Video...
      setVideoProgress(25);
      setVideoStatusText("Analyzing Wildlife Video...");

      // Poll progress every 750ms
      videoPollingTimerRef.current = setInterval(async () => {
        try {
          const pollResp = await fetch(`${effectiveApiUrl}/api/detect/video/progress/${jobId}`);
          if (!pollResp.ok) return;

          const pollData = await pollResp.json();
          const currentPct = pollData.progress || 30;
          setVideoProgress(currentPct);

          if (pollData.status === "PROCESSING") {
            // Progression: Analyzing Wildlife Video... -> Processing...
            if (currentPct >= 50) {
              setVideoStatusText("Processing...");
            } else {
              setVideoStatusText("Analyzing Wildlife Video...");
            }
          } else if (pollData.status === "COMPLETED") {
            clearInterval(videoPollingTimerRef.current);
            setVideoAnalyzing(false);
            setVideoProgress(100);
            setVideoStatusText("Video analysis complete.");
            setVideoResult(pollData.result);

            if (pollData.result?.detected && pollData.result?.species) {
              playRadarPing();
              if (pollData.result?.risk?.risk_level === "HIGH" || pollData.result?.risk?.risk_level === "CRITICAL") {
                playEmergencyAlarm();
              }
              onDetectionAdded?.(pollData.result);
            }
          } else if (pollData.status === "FAILED") {
            clearInterval(videoPollingTimerRef.current);
            setVideoAnalyzing(false);
            setVideoErrorMessage(pollData.error || "Video analysis failed. Please verify format and try again.");
          }
        } catch (pollErr) {
          console.warn("Polling error:", pollErr);
        }
      }, 750);
    } catch (err) {
      console.error("Video submission error:", err);
      setVideoErrorMessage(err.message ? `Video analysis failed: ${err.message}` : "Video analysis failed. Detection backend unreachable.");
      setVideoAnalyzing(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Studio Header */}
      <div className="kv-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 24, fontWeight: 700, margin: 0, color: "#EEF4EE", letterSpacing: "0.04em" }}>
              AI WILDLIFE DETECTION STUDIO
            </h1>
            {/* Live Backend Connection Indicator */}
            {backendStatus === "ONLINE" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(76, 175, 80, 0.15)", border: "1px solid #4CAF50", padding: "3px 10px", borderRadius: 20, fontSize: 11, color: "#81C784", fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4CAF50", boxShadow: "0 0 8px #4CAF50" }}></span>
                Detection Server Connected
              </span>
            )}
            {backendStatus === "OFFLINE" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(229, 77, 77, 0.15)", border: "1px solid #E54D4D", padding: "3px 10px", borderRadius: 20, fontSize: 11, color: "#FF8A80", fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E54D4D", boxShadow: "0 0 8px #E54D4D" }}></span>
                Detection Server Offline
              </span>
            )}
            {backendStatus === "CHECKING" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(214, 168, 79, 0.15)", border: "1px solid #D6A84F", padding: "3px 10px", borderRadius: 20, fontSize: 11, color: "#D6A84F", fontWeight: 600 }}>
                <RefreshCw size={10} style={{ animation: "spin 1s linear infinite" }} />
                Checking Server...
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#8FA396", marginTop: 4 }}>
            Ultralytics YOLO inference engine with automated spatial risk scoring, frame-by-frame movement tracking & real-time community broadcast
          </div>

          {/* Model Capabilities & Supported Species Indicator */}
          {modelStatus && (
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontSize: 11 }}>
              <span style={{ color: "#8FA396", fontWeight: 700, textTransform: "uppercase" }}>TARGET SPECIES STATUS:</span>
              <span style={{ background: "rgba(76, 175, 80, 0.15)", border: "1px solid #4CAF50", color: "#81C784", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                ✓ SUPPORTED ({modelStatus.supported_count}): {modelStatus.supported_species?.map(s => s.canonical).join(", ")}
              </span>
              <span style={{ background: "rgba(143, 163, 150, 0.12)", border: "1px solid #3F5245", color: "#8FA396", padding: "2px 8px", borderRadius: 4 }} title="These species are absent from model weights and will return NO TARGET WILDLIFE DETECTED">
                ✗ UNSUPPORTED ({modelStatus.unsupported_count}): {modelStatus.unsupported_species?.map(s => s.canonical).join(", ")}
              </span>
            </div>
          )}
        </div>

        {/* Tab Switcher: Image Detection vs Video Movement Detection */}
        <div style={{ display: "flex", gap: 6, background: "var(--panel-raised)", padding: 4, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
          <button
            onClick={() => setActiveTab("upload")}
            style={{
              background: activeTab === "upload" ? "#1B3B2B" : "transparent",
              border: `1px solid ${activeTab === "upload" ? "#2F6B4C" : "transparent"}`,
              color: activeTab === "upload" ? "#EEF4EE" : "#8FA396",
              padding: "6px 14px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Upload size={14} /> Upload Image
          </button>

          <button
            onClick={() => setActiveTab("webcam")}
            style={{
              background: activeTab === "webcam" ? "#1B3B2B" : "transparent",
              border: `1px solid ${activeTab === "webcam" ? "#2F6B4C" : "transparent"}`,
              color: activeTab === "webcam" ? "#EEF4EE" : "#8FA396",
              padding: "6px 14px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Camera size={14} /> Live Webcam
          </button>

          <button
            onClick={() => setActiveTab("presets")}
            style={{
              background: activeTab === "presets" ? "#1B3B2B" : "transparent",
              border: `1px solid ${activeTab === "presets" ? "#2F6B4C" : "transparent"}`,
              color: activeTab === "presets" ? "#D6A84F" : "#8FA396",
              padding: "6px 14px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Play size={14} /> 1-Click Samples
          </button>

          {/* New Video Movement Detection Tab */}
          <button
            onClick={() => setActiveTab("video")}
            style={{
              background: activeTab === "video" ? "#10382B" : "rgba(16, 185, 129, 0.1)",
              border: `1px solid ${activeTab === "video" ? "#10B981" : "rgba(16, 185, 129, 0.3)"}`,
              color: activeTab === "video" ? "#00FFAA" : "#34D399",
              padding: "6px 14px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: activeTab === "video" ? "0 0 12px rgba(16, 185, 129, 0.4)" : "none"
            }}
          >
            <Film size={14} color="#00FFAA" />
            <span>Video Movement Detection</span>
            <span style={{ background: "#10B981", color: "#0A140F", padding: "1px 5px", borderRadius: 10, fontSize: 9, fontWeight: 900 }}>
              NEW
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODE 1: VIDEO MOVEMENT DETECTION VIEW                     */}
      {/* ========================================================= */}
      {activeTab === "video" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Video Control & Upload Panel */}
          <div className="kv-panel" style={{ padding: "20px 24px", border: "1px solid #1E3A2B" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, color: "#EEF4EE", display: "flex", alignItems: "center", gap: 8 }}>
                  <Film size={20} color="#00FFAA" />
                  WILDLIFE VIDEO MOVEMENT & TRAJECTORY TRACKING
                </div>
                <div style={{ fontSize: 12, color: "#8FA396", marginTop: 4 }}>
                  Processes video frame-by-frame with YOLO, tracks animals across consecutive frames, calculates smoothed displacement, and classifies motion status & direction.
                </div>
              </div>

              {/* 1-Click Sample Tiger Video Demo Button */}
              <button
                onClick={handleSampleVideoDemo}
                disabled={videoAnalyzing}
                style={{
                  background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                  border: "none",
                  color: "#0A140F",
                  padding: "9px 16px",
                  borderRadius: 6,
                  cursor: videoAnalyzing ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 0 16px rgba(16, 185, 129, 0.4)",
                  transition: "all 0.2s"
                }}
              >
                <Zap size={16} fill="#0A140F" />
                <span>1-Click Demo (Moving Tiger Video)</span>
              </button>
            </div>

            {/* Drag & Drop Zone for Video */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleVideoDrop}
              onClick={() => videoFileInputRef.current?.click()}
              style={{
                border: "2px dashed #28543C",
                background: "rgba(18, 36, 26, 0.4)",
                borderRadius: 8,
                padding: "26px 20px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "#10B981"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "#28543C"}
            >
              <input
                ref={videoFileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
                onChange={handleVideoFileSelect}
                style={{ display: "none" }}
              />
              <Video size={36} color="#00FFAA" style={{ margin: "0 auto 10px" }} />
              <div style={{ fontWeight: 700, fontSize: 14, color: "#EEF4EE" }}>
                {videoFile ? `Selected: ${videoFile.name}` : "Click to browse or Drag & Drop Camera Trap Video"}
              </div>
              <div style={{ fontSize: 12, color: "#8FA396", marginTop: 4 }}>
                Supported Formats: MP4, MOV, AVI, WebM · Frame-by-frame YOLO motion tracking
              </div>
            </div>

            {/* Video Controls Bar: Confidence Threshold & Run Detection */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "#8FA396" }}>
                <Sliders size={14} color="#00FFAA" />
                <span>Confidence Cutoff: <strong style={{ color: "#EEF4EE" }}>{videoConfidence}%</strong></span>
                <input
                  type="range"
                  min="20"
                  max="85"
                  value={videoConfidence}
                  onChange={(e) => setVideoConfidence(Number(e.target.value))}
                  style={{ accentColor: "#10B981", width: 110 }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {videoFile && !videoAnalyzing && (
                  <button
                    onClick={() => executeVideoAnalysis()}
                    style={{
                      background: "#2E6B48",
                      border: "1px solid #10B981",
                      color: "#FFFFFF",
                      padding: "8px 18px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 2px 10px rgba(16, 185, 129, 0.3)"
                    }}
                  >
                    <Play size={15} fill="#FFFFFF" />
                    <span>ANALYZE VIDEO MOVEMENT</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Progress Bar during Asynchronous Processing */}
            {videoAnalyzing && (
              <div style={{ marginTop: 16, background: "rgba(10, 20, 15, 0.95)", border: "1px solid #10B981", borderRadius: 8, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#00FFAA", display: "flex", alignItems: "center", gap: 10 }}>
                    <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
                    {videoStatusText || "Analyzing Wildlife Video..."}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 900, color: "#00FFAA" }}>
                    {videoProgress}%
                  </span>
                </div>

                {/* Explicit Stage Sequence: 0% → 25% → 50% → 75% → 100% */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "8px 14px", background: "rgba(16, 185, 129, 0.08)", borderRadius: 6, border: "1px solid rgba(16, 185, 129, 0.2)", fontSize: 12, fontWeight: 800 }}>
                  <span style={{ color: videoProgress >= 0 ? "#00FFAA" : "#4A6354" }}>0%</span>
                  <span style={{ color: "#3A5243" }}>→</span>
                  <span style={{ color: videoProgress >= 25 ? "#00FFAA" : "#4A6354" }}>25%</span>
                  <span style={{ color: "#3A5243" }}>→</span>
                  <span style={{ color: videoProgress >= 50 ? "#00FFAA" : "#4A6354" }}>50%</span>
                  <span style={{ color: "#3A5243" }}>→</span>
                  <span style={{ color: videoProgress >= 75 ? "#00FFAA" : "#4A6354" }}>75%</span>
                  <span style={{ color: "#3A5243" }}>→</span>
                  <span style={{ color: videoProgress >= 100 ? "#00FFAA" : "#4A6354" }}>100%</span>
                </div>

                <div style={{ width: "100%", height: 8, background: "#1E3A2B", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${videoProgress}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #10B981, #00FFAA)",
                      boxShadow: "0 0 10px #00FFAA",
                      transition: "width 0.3s ease"
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: "#8FA396", marginTop: 8 }}>
                  Sequential OpenCV frame extraction with YOLO inference & trajectory smoothing.
                </div>
              </div>
            )}

            {/* Video Error Message Card */}
            {videoErrorMessage && (
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "16px 20px",
                  background: "rgba(229, 77, 77, 0.15)",
                  border: "1px solid #E54D4D",
                  borderRadius: 8,
                  color: "#FF8A80",
                  boxShadow: "0 4px 20px rgba(229, 77, 77, 0.2)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, fontWeight: 800, color: "#FFA4A4" }}>
                  <AlertTriangle size={20} color="#E54D4D" style={{ flexShrink: 0 }} />
                  <span>Video analysis failed</span>
                </div>
                <div style={{ fontSize: 13, color: "#EEF4EE", lineHeight: 1.5 }}>
                  {videoErrorMessage}
                </div>
              </div>
            )}
          </div>

          {/* Results Display wrapped in VideoErrorBoundary */}
          {videoResult && (
            <VideoErrorBoundary onReset={() => setVideoResult(null)}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(460px, 1fr))", gap: 20 }}>
                {/* Left Column: Synchronized Video Bounding Box Player */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#8FA396", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    TELEMETRY SYNCHRONIZED VIDEO PLAYBACK:
                  </div>
                  <VideoErrorBoundary onReset={() => setVideoResult(null)}>
                    <VideoBoundingBoxPlayer
                      videoUrl={videoPreviewUrl}
                      frameDetections={videoResult.frame_detections || []}
                      tracks={videoResult.tracks || []}
                      width={videoResult.width || 640}
                      height={videoResult.height || 480}
                      overallSummary={videoResult.movement_summary}
                    />
                  </VideoErrorBoundary>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--panel-raised)", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--line-soft)", fontSize: 12, color: "#8FA396" }}>
                  <span>Sampled Frames: <strong style={{ color: "#EEF4EE" }}>{videoResult.sampled_frames_count}</strong></span>
                  <span>Total Video Frames: <strong style={{ color: "#EEF4EE" }}>{videoResult.total_frames}</strong></span>
                  <span>Duration: <strong style={{ color: "#EEF4EE" }}>{videoResult.duration_sec}s</strong></span>
                  <span>FPS: <strong style={{ color: "#EEF4EE" }}>{videoResult.fps}</strong></span>
                </div>
              </div>

              {/* Right Column: Movement Telemetry & Threat Intelligence */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {videoResult.detected ? (
                  <div className="kv-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18, border: "1px solid #1E3A2B" }}>
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#00FFAA", display: "flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle2 size={13} /> VIDEO TELEMETRY VERIFIED · TRACKS: {videoResult.tracks?.length || 1}
                        </div>
                        <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 28, fontWeight: 800, margin: "4px 0 0", color: "#EEF4EE", display: "flex", alignItems: "center", gap: 8 }}>
                          <span>🐾</span> {videoResult.species}
                        </h2>
                        <div style={{ fontSize: 12, color: "#8FA396", marginTop: 2 }}>
                          {videoResult.message}
                        </div>
                      </div>

                      {/* Movement Status Badge */}
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 12px",
                            borderRadius: 6,
                            background: videoResult.movement_summary?.is_moving ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                            border: `1px solid ${videoResult.movement_summary?.is_moving ? "#10B981" : "#F59E0B"}`,
                            color: videoResult.movement_summary?.is_moving ? "#00FFAA" : "#FBBF24",
                            fontSize: 12,
                            fontWeight: 800
                          }}
                        >
                          <Activity size={14} />
                          {videoResult.movement_summary?.movement_status || "UNKNOWN"}
                        </div>
                        <div style={{ fontSize: 10, color: "#8FA396", marginTop: 4 }}>
                          HEADING: {videoResult.movement_summary?.dominant_direction}
                        </div>
                      </div>
                    </div>

                    {/* Key Movement Metrics Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                      <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
                        <div style={{ fontSize: 10, color: "#8FA396", display: "flex", alignItems: "center", gap: 4 }}>
                          <Activity size={12} /> MOVEMENT STATE
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: videoResult.movement_summary?.is_moving ? "#00FFAA" : "#FBBF24", marginTop: 4 }}>
                          {videoResult.movement_summary?.movement_status}
                        </div>
                      </div>

                      <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
                        <div style={{ fontSize: 10, color: "#8FA396", display: "flex", alignItems: "center", gap: 4 }}>
                          <Compass size={12} /> DIRECTION
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#EEF4EE", marginTop: 4 }}>
                          {videoResult.movement_summary?.dominant_direction}
                        </div>
                      </div>

                      <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
                        <div style={{ fontSize: 10, color: "#8FA396", display: "flex", alignItems: "center", gap: 4 }}>
                          <Gauge size={12} /> MAX SPEED
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#D6A84F", marginTop: 4 }}>
                          {videoResult.movement_summary?.max_speed_px_per_sec || 0} px/s
                        </div>
                      </div>
                    </div>

                    {/* Mandatory Wildlife Detection Telemetry Display for Every Animal */}
                    <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid #10B981", borderRadius: 8, padding: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#8FA396", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                        OFFICIAL WILDLIFE VERIFICATION TELEMETRY:
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
                          <span style={{ fontSize: 11, color: "#8FA396", display: "block", fontWeight: 700 }}>Animal:</span>
                          <strong style={{ fontSize: 16, color: "#00FFAA" }}>{videoResult.species}</strong>
                        </div>
                        <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
                          <span style={{ fontSize: 11, color: "#8FA396", display: "block", fontWeight: 700 }}>Confidence:</span>
                          <strong style={{ fontSize: 16, color: "#EEF4EE" }}>
                            {Math.round(videoResult.confidence || videoResult.tracks?.[0]?.confidence || videoResult.tracks?.[0]?.max_confidence || 0)}%
                          </strong>
                        </div>
                        <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
                          <span style={{ fontSize: 11, color: "#8FA396", display: "block", fontWeight: 700 }}>Movement:</span>
                          <strong style={{ fontSize: 16, color: videoResult.movement_summary?.is_moving ? "#00FFAA" : "#FBBF24" }}>
                            {videoResult.movement_summary?.movement_status || "STATIONARY"}
                          </strong>
                        </div>
                        <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
                          <span style={{ fontSize: 11, color: "#8FA396", display: "block", fontWeight: 700 }}>Direction:</span>
                          <strong style={{ fontSize: 16, color: "#EEF4EE" }}>
                            {videoResult.movement_summary?.dominant_direction || "UNKNOWN"}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown of Every Tracked Animal Instance */}
                    {videoResult.tracks && videoResult.tracks.length > 1 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#8FA396", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          ALL DETECTED ANIMALS ({videoResult.tracks.length}):
                        </div>
                        {videoResult.tracks.map((t, idx) => (
                          <div
                            key={t.track_id || idx}
                            style={{
                              background: "var(--panel-raised)",
                              border: "1px solid var(--line-soft)",
                              borderRadius: 6,
                              padding: "10px 14px",
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                              gap: 8,
                              fontSize: 12
                            }}
                          >
                            <div>
                              <span style={{ color: "#8FA396" }}>Animal: </span>
                              <strong style={{ color: "#EEF4EE" }}>{t.emoji || "🐾"} {t.species}</strong>
                            </div>
                            <div>
                              <span style={{ color: "#8FA396" }}>Confidence: </span>
                              <strong style={{ color: "#00FFAA" }}>{Math.round(t.confidence || t.max_confidence)}%</strong>
                            </div>
                            <div>
                              <span style={{ color: "#8FA396" }}>Movement: </span>
                              <strong style={{ color: t.movement_status === "MOVING" ? "#00FFAA" : "#FBBF24" }}>
                                {t.movement_status}
                              </strong>
                            </div>
                            <div>
                              <span style={{ color: "#8FA396" }}>Direction: </span>
                              <strong style={{ color: "#EEF4EE" }}>{t.direction}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Conflict Risk Assessment Card */}
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 6,
                        background: videoResult.risk?.risk_level === "CRITICAL" || videoResult.risk?.risk_level === "HIGH"
                          ? "rgba(229, 77, 77, 0.12)"
                          : "rgba(217, 154, 50, 0.12)",
                        border: `1px solid ${videoResult.risk?.risk_level === "CRITICAL" || videoResult.risk?.risk_level === "HIGH" ? "#E54D4D" : "#D99A32"}`
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#EEF4EE", display: "flex", alignItems: "center", gap: 6 }}>
                          <ShieldAlert size={16} color={videoResult.risk?.risk_level === "HIGH" ? "#E54D4D" : "#D99A32"} />
                          CONFLICT RISK ASSESSMENT
                        </span>
                        <span
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontWeight: 800,
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: 3,
                            background: videoResult.risk?.risk_level === "HIGH" ? "#E54D4D" : "#D99A32",
                            color: "#FFFFFF"
                          }}
                        >
                          {videoResult.risk?.risk_level} ({videoResult.risk?.risk_score}/100)
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#CCD8D0", lineHeight: 1.5 }}>
                        {videoResult.risk?.reason}
                      </div>
                    </div>

                    {/* Settlement Proximity & Geofence */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div style={{ background: "var(--panel-raised)", padding: 10, borderRadius: 4, border: "1px solid var(--line-soft)" }}>
                        <div style={{ fontSize: 10, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>NEAREST VILLAGE</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#EEF4EE", marginTop: 2 }}>
                          {videoResult.village_name}
                        </div>
                      </div>

                      <div style={{ background: "var(--panel-raised)", padding: 10, borderRadius: 4, border: "1px solid var(--line-soft)" }}>
                        <div style={{ fontSize: 10, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>DISTANCE TO SETTLEMENT</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#D6A84F", marginTop: 2 }}>
                          {videoResult.distance_str}
                        </div>
                      </div>
                    </div>

                    {/* Debounced Alert Dispatch Status */}
                    <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid #10B981", padding: 12, borderRadius: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#00FFAA", display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckCircle size={14} />
                        {videoResult.alert_id ? `DEBOUNCED ALERT DISPATCHED (ID: ${videoResult.alert_id})` : "NO ALERT REQUIRED"}
                      </div>
                      <div style={{ fontSize: 12, color: "#EEF4EE", marginTop: 4 }}>
                        {videoResult.alert_id
                          ? "Broadcasted once via WebSocket, FCM Push Notifications to connected phones, Field Siren, and Incident Log."
                          : "Risk score below threshold; logged to telemetry registry without disturbing community."}
                      </div>
                    </div>

                    {/* Plot on Live GIS Map */}
                    <button
                      onClick={() => onNavigateToMap?.({ lat: videoResult.lat, lng: videoResult.lng })}
                      style={{
                        background: "#1E3D2A",
                        border: "1px solid #3A7350",
                        color: "#D2E8DA",
                        padding: "10px 16px",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        marginTop: 4
                      }}
                    >
                      <span>Plot Video Movement Track on Live GIS Map</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                ) : (
                  /* No Supported Wildlife Detected in Video */
                  <div className="kv-panel" style={{ padding: 28, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, border: "1px solid #2F6B48" }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(76, 175, 80, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                      <CheckCircle2 size={32} color="#4CAF50" />
                    </div>
                    <div style={{ fontSize: 12, color: "#8FA396", fontWeight: 700, textTransform: "uppercase" }}>VIDEO ANALYSIS STATUS:</div>
                    <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 24, fontWeight: 800, color: "#81C784", margin: "4px 0" }}>
                      No supported wildlife detected in this video.
                    </h3>
                    <p style={{ fontSize: 13, color: "#A4C7B0", maxWidth: 380, lineHeight: 1.6, marginTop: 12 }}>
                      YOLO evaluated sampled frames against the approved KAVACH wildlife classes (Tiger, Elephant, Leopard, Wild Boar). No approved target was identified. Non-wildlife subjects or empty scenes do not trigger movement tracks or community alerts.
                    </p>
                    <div style={{ marginTop: 14, padding: "8px 16px", background: "var(--panel-raised)", borderRadius: 6, fontSize: 12, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>
                      Risk Score: 0/100 (NONE) · Alerts Dispatched: 0
                    </div>
                  </div>
                )}
              </div>
            </div>
            </VideoErrorBoundary>
          )}
        </div>
      ) : (
        /* ========================================================= */
        /* MODE 2: IMAGE DETECTION VIEW (PRESERVED IN FULL)          */
        /* ========================================================= */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 20 }}>
          {/* Left Column: Input & Canvas */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {activeTab === "upload" && (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed #28543C",
                  background: "rgba(18, 36, 26, 0.4)",
                  borderRadius: 8,
                  padding: "28px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "#4CAF50"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#28543C"}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/bmp"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
                <Upload size={36} color="#4CAF50" style={{ margin: "0 auto 10px" }} />
                <div style={{ fontWeight: 600, fontSize: 14, color: "#EEF4EE" }}>
                  Click to browse or Drag & Drop Camera-Trap Image
                </div>
                <div style={{ fontSize: 12, color: "#8FA396", marginTop: 4 }}>
                  Supports JPEG, PNG, WebP · Max 25MB
                </div>
              </div>
            )}

            {activeTab === "webcam" && (
              <WebcamDetector onFrameCaptured={handleWebcamCapture} isAnalyzing={analyzing} />
            )}

            {activeTab === "presets" && (
              <div className="kv-panel" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: "#D6A84F", fontWeight: 600, marginBottom: 10, fontFamily: "'IBM Plex Mono', monospace" }}>
                  SELECT HIGH-RESOLUTION TEST CASE (1-CLICK SIH DEMO):
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  {SAMPLE_WILDLIFE_CASES.map(preset => (
                    <div
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset)}
                      style={{
                        border: "1px solid #234634",
                        background: "var(--panel-raised)",
                        borderRadius: 6,
                        overflow: "hidden",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "#D6A84F"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "#234634"}
                    >
                      <div style={{ height: 80, overflow: "hidden" }}>
                        <img src={preset.imageUrl} alt={preset.species} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div style={{ padding: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: "#EEF4EE" }}>{preset.species}</div>
                        <div style={{ fontSize: 10, color: "#8FA396", marginTop: 2 }}>{preset.zoneName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bounding Box Image Preview Canvas */}
            {previewUrl && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <BoundingBoxCanvas
                  imageUrl={previewUrl}
                  detections={detectionResult?.detections || []}
                  confidenceThreshold={confidenceThreshold}
                  riskLevel={detectionResult?.risk?.risk_level || "HIGH"}
                />

                {/* Action Toolbar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--panel-raised)", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--line-soft)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#8FA396" }}>
                    <Sliders size={14} />
                    <span>Conf Threshold: <strong>{confidenceThreshold}%</strong></span>
                    <input
                      type="range"
                      min="10"
                      max="90"
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                      style={{ accentColor: "#4CAF50", width: 100 }}
                    />
                  </div>

                  <button
                    onClick={() => runDetection()}
                    disabled={analyzing}
                    style={{
                      background: analyzing ? "#1B3B2B" : "#2E6B48",
                      border: "1px solid #4CAF50",
                      color: "#FFFFFF",
                      padding: "8px 18px",
                      borderRadius: 4,
                      cursor: analyzing ? "not-allowed" : "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: "0 2px 8px rgba(46, 107, 72, 0.3)"
                    }}
                  >
                    {analyzing ? (
                      <>
                        <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} />
                        <span>Analyzing image...</span>
                      </>
                    ) : (
                      <>
                        <Play size={15} />
                        <span>DETECT WILDLIFE</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Info Banner when no wildlife is detected */}
            {infoMessage && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px", background: "rgba(76, 175, 80, 0.12)", border: "1px solid rgba(76, 175, 80, 0.4)", borderRadius: 6, color: "#A5D6A7", fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={18} color="#4CAF50" style={{ flexShrink: 0 }} />
                  <span>{infoMessage}</span>
                </div>
                <button
                  onClick={() => { setInfoMessage(null); runDetection(); }}
                  style={{ background: "#1B3B2B", border: "1px solid #4CAF50", color: "#EEF4EE", padding: "4px 10px", borderRadius: 4, cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                >
                  Scan Again
                </button>
              </div>
            )}

            {/* Error / Diagnostic message with Retry */}
            {errorMessage && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px", background: "rgba(229, 77, 77, 0.12)", border: "1px solid rgba(229, 77, 77, 0.4)", borderRadius: 6, color: "#FFB0B0", fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AlertTriangle size={18} color="#E54D4D" style={{ flexShrink: 0 }} />
                  <div>{errorMessage}</div>
                </div>
                <button
                  onClick={() => { checkBackendHealth(); runDetection(); }}
                  style={{
                    background: "#E54D4D",
                    border: "none",
                    color: "#FFFFFF",
                    padding: "6px 14px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap"
                  }}
                >
                  <RefreshCw size={12} />
                  <span>Retry Detection</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Column: AI Detection & Conflict Risk Intelligence Results */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {detectionResult?.detected ? (
              <div className="kv-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Header Badge */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#4CAF50", display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={13} /> DETECTION VERIFIED · ID: {detectionResult.detection_id}
                    </div>
                    <div style={{ fontSize: 12, color: "#8FA396", marginTop: 6, fontWeight: 600 }}>DETECTED ANIMAL:</div>
                    <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 30, fontWeight: 800, margin: "2px 0 0", color: "#EEF4EE", display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{getWildlifeEmoji(detectionResult.species)}</span> {detectionResult.species.toUpperCase()} DETECTED
                    </h2>
                    <div style={{
                      marginTop: 6,
                      display: "inline-block",
                      padding: "3px 10px",
                      borderRadius: 4,
                      background: detectionResult.risk?.risk_level === "CRITICAL" || detectionResult.risk?.risk_level === "HIGH" ? "rgba(229, 77, 77, 0.2)" : "rgba(217, 154, 50, 0.2)",
                      border: `1px solid ${detectionResult.risk?.risk_level === "CRITICAL" || detectionResult.risk?.risk_level === "HIGH" ? "#E54D4D" : "#D99A32"}`,
                      color: detectionResult.risk?.risk_level === "CRITICAL" || detectionResult.risk?.risk_level === "HIGH" ? "#FF8A80" : "#F6D386",
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.05em"
                    }}>
                      STATUS: {detectionResult.status || `${detectionResult.risk?.risk_level || "HIGH"}-RISK WILDLIFE DETECTED`}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#8FA396", fontWeight: 600 }}>CONFIDENCE:</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 26, fontWeight: 700, color: "#D6A84F" }}>
                      {detectionResult.confidence}%
                    </div>
                    <div style={{ fontSize: 10, color: "#8FA396" }}>YOLO INFERENCE</div>
                  </div>
                </div>

                {/* Conflict Risk Score Banner */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 6,
                    background: detectionResult.risk?.risk_level === "CRITICAL" || detectionResult.risk?.risk_level === "HIGH"
                      ? "rgba(229, 77, 77, 0.12)"
                      : "rgba(217, 154, 50, 0.12)",
                    border: `1px solid ${
                      detectionResult.risk?.risk_level === "CRITICAL" || detectionResult.risk?.risk_level === "HIGH"
                        ? "rgba(229, 77, 77, 0.4)"
                        : "rgba(217, 154, 50, 0.4)"
                    }`
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#EEF4EE", display: "flex", alignItems: "center", gap: 6 }}>
                      <ShieldAlert size={16} color={detectionResult.risk?.risk_level === "HIGH" ? "#E54D4D" : "#D99A32"} />
                      CONFLICT RISK ASSESSMENT
                    </span>
                    <span
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 800,
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 3,
                        background: detectionResult.risk?.risk_level === "HIGH" ? "#E54D4D" : "#D99A32",
                        color: "#FFFFFF"
                      }}
                    >
                      {detectionResult.risk?.risk_level} ({detectionResult.risk?.risk_score}/100)
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#CCD8D0", lineHeight: 1.5 }}>
                    {detectionResult.risk?.reason}
                  </div>
                </div>

                {/* Telemetry & Spatial Context */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ background: "var(--panel-raised)", padding: 10, borderRadius: 4, border: "1px solid var(--line-soft)" }}>
                    <div style={{ fontSize: 10, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>LOCATION COORDS</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#EEF4EE", marginTop: 2 }}>
                      {detectionResult.lat?.toFixed(4)}, {detectionResult.lng?.toFixed(4)}
                    </div>
                  </div>

                  <div style={{ background: "var(--panel-raised)", padding: 10, borderRadius: 4, border: "1px solid var(--line-soft)" }}>
                    <div style={{ fontSize: 10, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>DISTANCE TO SETTLEMENT</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#D6A84F", marginTop: 2 }}>
                      ~{detectionResult.geofence?.est_dist_to_settlement_m || 350} meters
                    </div>
                  </div>
                </div>

                {/* Geofence Status */}
                <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 4, border: "1px solid var(--line-soft)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#8FA396", marginBottom: 4 }}>GEOFENCE STATUS:</div>
                  {detectionResult.geofence?.has_breach ? (
                    <div style={{ color: "#E57373", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertTriangle size={14} /> Active Geofence Breach: {detectionResult.geofence.breached_geofences[0]?.name}
                    </div>
                  ) : (
                    <div style={{ color: "#4CAF50", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                      <CheckCircle2 size={14} /> Within Designated Sanctuary Corridor (No Breach)
                    </div>
                  )}
                </div>

                {/* Action Recommendation */}
                <div style={{ background: "rgba(46, 107, 72, 0.15)", border: "1px solid #2F6B48", padding: 12, borderRadius: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#A4C7B0", textTransform: "uppercase" }}>
                    RECOMMENDED RANGER DISPATCH
                  </div>
                  <div style={{ fontSize: 12, color: "#EEF4EE", marginTop: 4 }}>
                    {detectionResult.risk?.recommendation}
                  </div>
                </div>

                {/* Navigation Button */}
                <button
                  onClick={() => onNavigateToMap?.({ lat: detectionResult.lat, lng: detectionResult.lng })}
                  style={{
                    background: "#1E3D2A",
                    border: "1px solid #3A7350",
                    color: "#D2E8DA",
                    padding: "10px 16px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 4
                  }}
                >
                  <span>Plot & Track on Live GIS Map</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : detectionResult && !detectionResult.detected ? (
              <div className="kv-panel" style={{ padding: 28, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380, border: "1px solid #2F6B48" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(76, 175, 80, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <CheckCircle2 size={32} color="#4CAF50" />
                </div>
                <div style={{ fontSize: 12, color: "#8FA396", fontWeight: 700, textTransform: "uppercase" }}>SCAN STATUS:</div>
                <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 24, fontWeight: 800, color: "#81C784", margin: "4px 0" }}>
                  NO WILDLIFE DETECTED
                </h3>
                <div style={{
                  marginTop: 6,
                  padding: "3px 12px",
                  borderRadius: 4,
                  background: "rgba(76, 175, 80, 0.1)",
                  border: "1px solid rgba(76, 175, 80, 0.3)",
                  color: "#A5D6A7",
                  fontSize: 11,
                  fontWeight: 700
                }}>
                  STATUS: NO TARGET WILDLIFE DETECTED
                </div>
                <p style={{ fontSize: 13, color: "#A4C7B0", maxWidth: 380, lineHeight: 1.6, marginTop: 12 }}>
                  YOLO evaluated the image against the target dangerous wildlife species at threshold {confidenceThreshold}%. No approved target was identified. Non-target animals/objects do not trigger alerts.
                </p>
                <div style={{ marginTop: 14, padding: "8px 16px", background: "var(--panel-raised)", borderRadius: 6, fontSize: 12, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>
                  Risk Score: 0/100 (NONE) · Alert Dispatched: NONE
                </div>
              </div>
            ) : (
              <div className="kv-panel" style={{ padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 380 }}>
                <Camera size={44} color="#2A4837" style={{ marginBottom: 12 }} />
                <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, color: "#EEF4EE", margin: 0 }}>
                  Awaiting Wildlife Observation
                </h3>
                <p style={{ fontSize: 12, color: "#8FA396", maxWidth: 320, lineHeight: 1.5, marginTop: 8 }}>
                  Upload an image, activate your live camera, or click one of the preset wildlife samples above to execute YOLO detection and risk intelligence.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
