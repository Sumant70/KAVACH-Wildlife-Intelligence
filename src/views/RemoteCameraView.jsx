import React, { useState, useEffect, useRef } from "react";
import {
  Camera, CameraOff, Radio, Smartphone, Monitor, ShieldAlert,
  AlertTriangle, CheckCircle2, Copy, Check, ExternalLink, RefreshCw,
  Zap, Volume2, MapPin, Eye, Play, Square, SwitchCamera
} from "lucide-react";
import { playEmergencyAlarm, playRadarPing } from "../components/AudioAlerts";

export default function RemoteCameraView({
  apiBaseUrl,
  initialSessionId = "KAVACH-CAM-001",
  forcedMode = null, // "SOURCE" | "VIEWER" | null (auto)
  onNavigate,
  userGps
}) {
  const urlParams = new URLSearchParams(window.location.search);
  const paramSession = urlParams.get("remote_cam");
  const isDirectMobile = forcedMode === "SOURCE" || Boolean(paramSession);

  const [activeMode, setActiveMode] = useState(isDirectMobile ? "SOURCE" : (forcedMode || "VIEWER"));
  const [sessionId, setSessionId] = useState(paramSession || initialSessionId || "KAVACH-CAM-001");
  const [networkInfo, setNetworkInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  // Phone Camera (Source) State
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const sourceWsRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [sourceStatus, setSourceStatus] = useState("DISCONNECTED");
  const [sourceError, setSourceError] = useState(null);
  const [sourceDetections, setSourceDetections] = useState([]);
  const [sourceRisk, setSourceRisk] = useState(null);
  const sourceOverlayCanvasRef = useRef(null);

  // Dashboard (Viewer) State
  const viewerWsRef = useRef(null);
  const [viewerStatus, setViewerStatus] = useState("CONNECTING");
  const [incomingFrame, setIncomingFrame] = useState(null);
  const [viewerDetections, setViewerDetections] = useState([]);
  const [viewerRisk, setViewerRisk] = useState(null);
  const [viewerFps, setViewerFps] = useState(0);
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  const viewerCanvasRef = useRef(null);
  const frameCountRef = useRef(0);

  const effectiveApiUrl = apiBaseUrl || import.meta.env?.VITE_API_BASE_URL || "";
  const wsProtocol = effectiveApiUrl.startsWith("https") ? "wss" : "ws";
  const wsHost = effectiveApiUrl.replace(/^https?:\/\//, "");

  // 1. Fetch server LAN network info
  useEffect(() => {
    fetch(`${effectiveApiUrl}/api/network-info`)
      .then(r => r.json())
      .then(data => setNetworkInfo(data))
      .catch(err => console.warn("Network info fetch warning:", err));
  }, [effectiveApiUrl]);

  // Construct mobile join link
  const hostForPhone = networkInfo?.lan_ip || window.location.hostname;
  const shareableUrl = `http://${hostForPhone}:${window.location.port || 5173}/?remote_cam=${sessionId}`;

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // -------------------------------------------------------------
  // SOURCE MODE: Phone Camera Capture & Streaming over WebSocket
  // -------------------------------------------------------------
  const startCameraStream = async () => {
    setSourceError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam / Camera API is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Connect WebSocket to backend
      const wsUrl = `${wsProtocol}://${wsHost}/ws/remote-camera/${sessionId}`;
      const ws = new WebSocket(wsUrl);
      sourceWsRef.current = ws;

      ws.onopen = () => {
        setSourceStatus("CONNECTED");
        setIsStreaming(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "telemetry" && msg.detections) {
            setSourceDetections(msg.detections);
            setSourceRisk(msg.risk);
            drawSourceOverlay(msg.detections);

            if (msg.detections.length > 0) {
              playRadarPing();
              if (msg.risk?.risk_level === "HIGH" || msg.risk?.risk_level === "CRITICAL") {
                playEmergencyAlarm();
              }
            }
          }
        } catch (e) { }
      };

      ws.onerror = (e) => {
        console.warn("Source WebSocket error:", e);
        setSourceStatus("ERROR");
      };

      ws.onclose = () => {
        setSourceStatus("DISCONNECTED");
        setIsStreaming(false);
      };

    } catch (err) {
      console.error("Camera access failed:", err);
      setSourceError(err.message || "Failed to access camera.");
      setSourceStatus("ERROR");
      setIsStreaming(false);
    }
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (sourceWsRef.current) {
      sourceWsRef.current.close();
      sourceWsRef.current = null;
    }
    setIsStreaming(false);
    setSourceStatus("DISCONNECTED");
    setSourceDetections([]);
    clearSourceOverlay();
  };

  // Capture frame and send over WebSocket at ~6-8 FPS
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      const ws = sourceWsRef.current;
      if (!video || !ws || ws.readyState !== WebSocket.OPEN) return;
      if (video.videoWidth === 0) return;

      const canvas = document.createElement("canvas");
      canvas.width = Math.min(640, video.videoWidth);
      canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const base64Data = canvas.toDataURL("image/jpeg", 0.7);

      ws.send(JSON.stringify({
        type: "frame",
        image: base64Data,
        lat: userGps?.lat ?? 20.2667,
        lng: userGps?.lng ?? 79.4000,
        timestamp: Date.now()
      }));
    }, 140);

    return () => clearInterval(interval);
  }, [isStreaming, userGps]);

  const drawSourceOverlay = (detections) => {
    const canvas = sourceOverlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    detections.forEach(det => {
      const [x1, y1, x2, y2] = det.bbox;
      const w = x2 - x1;
      const h = y2 - y1;

      const isApex = ["Tiger", "Lion", "Leopard", "Asian Elephant"].includes(det.species);
      const color = isApex ? "#EF4444" : "#F59E0B";

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(x1, y1, w, h);

      ctx.fillStyle = color;
      ctx.fillRect(x1, Math.max(0, y1 - 22), 160, 22);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(`${det.species} ${det.confidence}%`, x1 + 6, Math.max(16, y1 - 6));
    });
  };

  const clearSourceOverlay = () => {
    const canvas = sourceOverlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // -------------------------------------------------------------
  // VIEWER MODE: Laptop Dashboard Displaying Remote Stream
  // -------------------------------------------------------------
  useEffect(() => {
    if (activeMode !== "VIEWER") return;

    const wsUrl = `${wsProtocol}://${wsHost}/ws/remote-camera/${sessionId}`;
    const ws = new WebSocket(wsUrl);
    viewerWsRef.current = ws;

    ws.onopen = () => {
      setViewerStatus("LISTENING");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "telemetry") {
          if (msg.frame_preview) {
            setIncomingFrame(msg.frame_preview);
            setViewerStatus("LIVE_STREAMING");
          }
          if (msg.detections) {
            setViewerDetections(msg.detections);
            setViewerRisk(msg.risk);
            setLastHeartbeat(new Date().toLocaleTimeString());
            frameCountRef.current += 1;

            if (msg.detections.length > 0) {
              playRadarPing();
              if (msg.risk?.risk_level === "HIGH" || msg.risk?.risk_level === "CRITICAL") {
                playEmergencyAlarm();
              }
            }
          }
        }
      } catch (err) { }
    };

    ws.onerror = () => setViewerStatus("ERROR");
    ws.onclose = () => setViewerStatus("DISCONNECTED");

    // FPS counter
    const fpsInterval = setInterval(() => {
      setViewerFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    return () => {
      ws.close();
      clearInterval(fpsInterval);
    };
  }, [activeMode, sessionId, wsHost, wsProtocol]);

  // If user opens URL directly on phone
  if (activeMode === "SOURCE") {
    return (
      <div className="max-w-md mx-auto bg-slate-950 min-h-[85vh] text-white p-4 rounded-3xl border border-emerald-500/30 flex flex-col justify-between shadow-2xl">
        {/* Mobile Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isStreaming ? "bg-emerald-400 animate-ping" : "bg-rose-500"}`} />
            <div>
              <h2 className="font-bold text-sm tracking-wider uppercase">KAVACH Remote Camera</h2>
              <div className="text-[10px] text-slate-400 font-mono">ID: {sessionId}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextFacing = facingMode === "environment" ? "user" : "environment";
                setFacingMode(nextFacing);
                if (isStreaming) {
                  stopCameraStream();
                  setTimeout(startCameraStream, 300);
                }
              }}
              className="p-2 bg-slate-800 rounded-xl text-slate-300 active:bg-slate-700"
              title="Switch Camera"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isStreaming
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-slate-800 text-slate-400 border-slate-700"
              }`}>
              {sourceStatus}
            </span>
          </div>
        </div>

        {/* Video Viewport with HUD Canvas */}
        <div className="relative aspect-[3/4] bg-black rounded-2xl overflow-hidden my-4 border border-slate-800 flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas
            ref={sourceOverlayCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {!isStreaming && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 p-6 text-center space-y-3">
              <div className="p-4 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400">
                <Camera className="w-8 h-8" />
              </div>
              <p className="text-xs text-slate-300">
                Ready to stream live video to KAVACH central dashboard with real-time YOLO wildlife detection.
              </p>
              {sourceError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/30">
                  {sourceError}
                </div>
              )}
            </div>
          )}

          {/* Real-time Detection Badge on Phone Screen */}
          {sourceDetections.length > 0 && (
            <div className="absolute top-3 left-3 right-3 bg-black/85 backdrop-blur-md p-2.5 rounded-xl border border-amber-500/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-bold text-amber-400">{sourceDetections[0].species}</span>
                <span className="text-slate-300">({sourceDetections[0].confidence}%)</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sourceRisk?.risk_level === "HIGH" || sourceRisk?.risk_level === "CRITICAL"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                }`}>
                {sourceRisk?.risk_level || "ALERT"}
              </span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="space-y-3">
          {isStreaming ? (
            <button
              onClick={stopCameraStream}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition"
            >
              <Square className="w-5 h-5 fill-current" />
              <span>STOP STREAM</span>
            </button>
          ) : (
            <button
              onClick={startCameraStream}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>START STREAM</span>
            </button>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-2">
            <span>Facing: <strong className="text-white">{facingMode === "environment" ? "Back Camera" : "Front Camera"}</strong></span>
            <button
              onClick={() => setActiveMode("VIEWER")}
              className="text-emerald-400 hover:underline"
            >
              Switch to Dashboard Mode
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEWER MODE (Default Laptop Dashboard View)
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Top Banner / Session Connector */}
      <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide uppercase">
              Cross-Device Remote Camera Receiver
            </h2>
            <p className="text-xs text-slate-400">
              Transform any smartphone into a real-time field camera connected to KAVACH YOLO intelligence
            </p>
          </div>
        </div>

        {/* Session ID & Join Pill */}
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-mono">Session:</span>
          <input
            type="text"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value.toUpperCase())}
            className="bg-transparent text-emerald-400 font-mono text-xs font-bold w-32 border-none outline-none"
          />
          <button
            onClick={copyShareLink}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1 transition"
            title="Copy Mobile Stream Link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy Link"}</span>
          </button>
          <a
            href={shareableUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg text-xs flex items-center gap-1 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Phone UI</span>
          </a>
        </div>
      </div>

      {/* Main Grid: Stream Viewer (Left) + Telemetry & Instructions (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stream Viewer (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${viewerStatus === "LIVE_STREAMING" ? "bg-emerald-400 animate-ping" : "bg-amber-400"
                }`} />
              <span className="font-semibold text-white text-sm">Remote Camera Feed: {sessionId}</span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-slate-400">{viewerFps} FPS</span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold border ${viewerStatus === "LIVE_STREAMING"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }`}>
                {viewerStatus === "LIVE_STREAMING" ? "● STREAM ACTIVE" : viewerStatus}
              </span>
            </div>
          </div>

          {/* Video / Frame Screen */}
          <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
            {incomingFrame ? (
              <img
                src={incomingFrame}
                alt="Remote Phone Camera Stream"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center p-8 space-y-3">
                <Radio className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
                <p className="text-sm font-semibold text-slate-300">Waiting for Remote Camera Stream</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Open the link on your phone (connected to the same Wi-Fi) and tap <strong>START STREAM</strong>.
                </p>
                <div className="pt-2">
                  <span className="font-mono text-[11px] bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-emerald-400 select-all">
                    {shareableUrl}
                  </span>
                </div>
              </div>
            )}

            {/* Tactical Telemetry HUD Overlay */}
            {viewerStatus === "LIVE_STREAMING" && (
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-mono text-white flex items-center gap-3 border border-white/10">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>REMOTE STREAM</span>
                </span>
                <span>|</span>
                <span>{viewerFps} FPS</span>
                <span>|</span>
                <span>{lastHeartbeat || "Live"}</span>
              </div>
            )}

            {/* Detected Animal Alert Banner */}
            {viewerDetections.length > 0 && (
              <div className="absolute bottom-3 left-3 right-3 bg-black/85 backdrop-blur-md p-3 rounded-xl border border-amber-500/50 flex items-center justify-between text-white shadow-xl">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                  <div>
                    <span className="font-bold text-amber-400 text-sm tracking-wide">
                      {viewerDetections[0].species.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-300 ml-2">
                      ({viewerDetections[0].confidence}% AI Confidence)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${viewerRisk?.risk_level === "HIGH" || viewerRisk?.risk_level === "CRITICAL"
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}>
                    {viewerRisk?.risk_level || "ALERT"} ({viewerRisk?.risk_score || 75}/100)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Device: <strong className="text-white">Mobile Handheld Sensor</strong></span>
            <span>Transmission: <strong className="text-emerald-400">WebSocket Binary</strong></span>
          </div>
        </div>

        {/* Right Column: Connection Guide & Telemetry */}
        <div className="space-y-4 flex flex-col justify-between">
          {/* Quick Connect Guide Card */}
          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              How to Connect Another Device
            </h3>

            <ol className="text-xs text-slate-300 space-y-2.5 list-decimal pl-4">
              <li>Connect your phone to the same Wi-Fi as this machine.</li>
              <li>Open the URL below in your phone's browser:</li>
            </ol>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 break-all font-mono text-xs text-emerald-400 flex items-center justify-between gap-2">
              <span>{shareableUrl}</span>
              <button
                onClick={copyShareLink}
                className="shrink-0 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tap <strong>START STREAM</strong> on the phone. The live video will stream immediately to this dashboard, and KAVACH will run YOLO detection in real time.
            </p>
          </div>

          {/* Telemetry & Risk Assessment Card */}
          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Real-Time Risk Intelligence
            </h3>

            {viewerRisk ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Threat Level:</span>
                  <span className="font-bold text-xs text-amber-400">{viewerRisk.risk_level}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Composite Score:</span>
                  <span className="font-mono font-bold text-sm text-white">{viewerRisk.risk_score}/100</span>
                </div>
                <p className="text-xs text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  {viewerRisk.reason}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No active wildlife detected on remote camera session.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
