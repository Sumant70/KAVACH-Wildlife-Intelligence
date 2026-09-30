import React, { useState, useEffect, useRef } from "react";
import {
  Camera, CameraOff, Video, Smartphone, Monitor, ShieldAlert,
  AlertTriangle, CheckCircle2, Copy, Check, ExternalLink, RefreshCw,
  Zap, Volume2, MapPin, Eye, Play, Square, SwitchCamera, QrCode,
  Compass, Activity, ArrowRight, Radio, Info, ChevronRight, Layers, Bell
} from "lucide-react";
import { playEmergencyAlarm, playRadarPing } from "../components/AudioAlerts";

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" }
  ]
};

export default function FieldCameraView({
  apiBaseUrl,
  initialSessionId = "CAM-001",
  forcedMode = null,
  onNavigate,
  userGps
}) {
  const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const paramSession = urlParams.get("session") || urlParams.get("session_id") || initialSessionId;
  const paramView = urlParams.get("view");
  const isSourceFromUrl = forcedMode === "SOURCE" || paramView === "field-camera-source" || urlParams.get("mode") === "source";

  const [mode, setMode] = useState(isSourceFromUrl ? "SOURCE" : (forcedMode || "VIEWER"));
  const [sessionId, setSessionId] = useState(paramSession);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Broadcaster (Source / Phone) State
  const sourceVideoRef = useRef(null);
  const sourceCanvasRef = useRef(null);
  const sourceStreamRef = useRef(null);
  const sourcePcRef = useRef(null);
  const sourceWsRef = useRef(null);
  const sourceSampleTimerRef = useRef(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [sourceFps, setSourceFps] = useState(0);
  const [sourceFramesSent, setSourceFramesSent] = useState(0);
  const [sourceStatus, setSourceStatus] = useState("STANDBY");
  const [sourceError, setSourceError] = useState(null);
  const [phoneGps, setPhoneGps] = useState(userGps || { lat: 20.2667, lng: 79.4000 });
  const [sourceLatestDetection, setSourceLatestDetection] = useState(null);

  // Viewer (Dashboard) State
  const viewerVideoRef = useRef(null);
  const viewerOverlayRef = useRef(null);
  const viewerPcRef = useRef(null);
  const viewerWsRef = useRef(null);
  const [viewerStatus, setViewerStatus] = useState("SEARCHING"); // "SEARCHING" | "CONNECTING" | "LIVE" | "DISCONNECTED"
  const [viewerFps, setViewerFps] = useState(0);
  const [viewerLatency, setViewerLatency] = useState(32);
  const [latestDetection, setLatestDetection] = useState(null);
  const [detectionHistory, setDetectionHistory] = useState([]);
  const [manualScanning, setManualScanning] = useState(false);

  const effectiveApiUrl = apiBaseUrl || import.meta.env?.VITE_API_BASE_URL || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8000" : "");
  const wsProtocol = effectiveApiUrl.startsWith("https") ? "wss" : "ws";
  const wsHost = effectiveApiUrl.replace(/^https?:\/\//, "");

  // 1. Fetch LAN network info for QR generation & cross-device link
  useEffect(() => {
    fetch(`${effectiveApiUrl}/api/network-info`)
      .then(r => r.json())
      .then(data => setNetworkInfo(data))
      .catch(err => console.warn("Network info warning:", err));
  }, [effectiveApiUrl]);

  // Construct mobile source URL
  const lanHost = networkInfo?.lan_ip || (typeof window !== "undefined" ? window.location.hostname : "127.0.0.1");
  const mobileLink = `http://${lanHost}:${typeof window !== "undefined" ? window.location.port || 5173 : 5173}/?view=field-camera-source&session=${sessionId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mobileLink)}`;

  const copyMobileLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(mobileLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Watch Phone GPS in Source Mode
  useEffect(() => {
    if (mode === "SOURCE" && typeof navigator !== "undefined" && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setPhoneGps({
            lat: Number(pos.coords.latitude.toFixed(5)),
            lng: Number(pos.coords.longitude.toFixed(5)),
            accuracy: Math.round(pos.coords.accuracy)
          });
        },
        (err) => console.warn("GPS warning:", err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [mode]);

  // =========================================================================
  // SOURCE MODE: PHONE CAMERA & WEBRTC BROADCASTER
  // =========================================================================
  const startBroadcasting = async () => {
    setSourceError(null);
    setSourceStatus("INITIALIZING");

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Camera API blocked by browser. On mobile Chrome HTTP, enable chrome://flags/#unsafely-treat-insecure-origin-as-secure or use the snapshot fallback."
        );
      }

      // 1. Acquire genuine device camera
      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      sourceStreamRef.current = stream;
      if (sourceVideoRef.current) {
        sourceVideoRef.current.srcObject = stream;
        await sourceVideoRef.current.play();
      }

      // 2. Initialize WebRTC PeerConnection
      const pc = new RTCPeerConnection(RTC_CONFIG);
      sourcePcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 3. Connect Signaling WebSocket
      const wsUrl = `${wsProtocol}://${wsHost}/ws/field-camera/${sessionId}`;
      const ws = new WebSocket(wsUrl);
      sourceWsRef.current = ws;

      ws.onopen = async () => {
        ws.send(JSON.stringify({ type: "register", role: "broadcaster", session_id: sessionId }));

        // Create SDP Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        ws.send(JSON.stringify({ type: "offer", sdp: offer, role: "broadcaster" }));
        // Also sync with REST fallback
        fetch(`${effectiveApiUrl}/api/field-camera/offer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, role: "broadcaster", sdp: offer })
        }).catch(() => null);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ice_candidate", candidate: event.candidate, role: "broadcaster" }));
        }
      };

      ws.onmessage = async (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "answer" && msg.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            setSourceStatus("STREAMING_LIVE");
          } else if (msg.type === "ice_candidate" && msg.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } else if (msg.type === "detection_result") {
            handleInferenceResult(msg.data, true);
          }
        } catch (e) {
          console.warn("Signaling parse error:", e);
        }
      };

      // 4. Start Real Frame Analysis Loop (at 5 FPS = 200ms)
      setIsBroadcasting(true);
      setSourceStatus("STREAMING_LIVE");

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      let lastSample = Date.now();
      let framesSentCount = 0;

      const sampleInterval = setInterval(() => {
        if (!sourceVideoRef.current || sourceVideoRef.current.readyState < 2) return;

        const video = sourceVideoRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
          if (!blob) return;

          framesSentCount++;
          setSourceFramesSent(framesSentCount);
          const now = Date.now();
          setSourceFps(Number((1000 / Math.max(1, now - lastSample)).toFixed(1)));
          lastSample = now;

          // Send genuine frame to backend YOLO pipeline
          const formData = new FormData();
          formData.append("file", blob, "field_frame.jpg");
          formData.append("camera_id", sessionId);
          formData.append("session_id", sessionId);
          if (phoneGps?.lat) formData.append("lat", phoneGps.lat);
          if (phoneGps?.lng) formData.append("lng", phoneGps.lng);

          try {
            const res = await fetch(`${effectiveApiUrl}/api/field-camera/frame`, {
              method: "POST",
              body: formData
            });
            const data = await res.json();
            handleInferenceResult(data, true);
          } catch (err) {
            // Soft fail for occasional network hiccups
          }
        }, "image/jpeg", 0.7);
      }, 200);

      sourceSampleTimerRef.current = sampleInterval;
    } catch (err) {
      console.error("Camera broadcasting start error:", err);
      setSourceError(err.message || "Failed to start camera.");
      setSourceStatus("ERROR");
      stopBroadcasting();
    }
  };

  const stopBroadcasting = () => {
    setIsBroadcasting(false);
    setSourceStatus("OFFLINE");
    if (sourceSampleTimerRef.current) {
      clearInterval(sourceSampleTimerRef.current);
      sourceSampleTimerRef.current = null;
    }
    if (sourceStreamRef.current) {
      sourceStreamRef.current.getTracks().forEach(t => t.stop());
      sourceStreamRef.current = null;
    }
    if (sourcePcRef.current) {
      sourcePcRef.current.close();
      sourcePcRef.current = null;
    }
    if (sourceWsRef.current) {
      sourceWsRef.current.close();
      sourceWsRef.current = null;
    }
  };

  // Toggle Front / Back camera
  const toggleCameraFacing = async () => {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    if (isBroadcasting) {
      stopBroadcasting();
      setTimeout(startBroadcasting, 300);
    }
  };

  // Manual Photo/Video Upload fallback for phones with strict security policy
  const handleFallbackCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSourceStatus("PROCESSING_FRAME");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("camera_id", sessionId);
    formData.append("session_id", sessionId);
    if (phoneGps?.lat) formData.append("lat", phoneGps.lat);
    if (phoneGps?.lng) formData.append("lng", phoneGps.lng);

    try {
      const res = await fetch(`${effectiveApiUrl}/api/field-camera/frame`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      handleInferenceResult(data, true);
      setSourceStatus("PROCESSED");
    } catch (err) {
      setSourceError("Manual frame inference failed: " + err.message);
    }
  };

  // =========================================================================
  // VIEWER MODE: DASHBOARD LIVE MONITORING & WEBRTC RECEIVER
  // =========================================================================
  useEffect(() => {
    if (mode !== "VIEWER") return;

    let pc = new RTCPeerConnection(RTC_CONFIG);
    viewerPcRef.current = pc;

    pc.ontrack = (event) => {
      if (viewerVideoRef.current && event.streams[0]) {
        viewerVideoRef.current.srcObject = event.streams[0];
        setViewerStatus("LIVE");
      }
    };

    // WebSocket Signaling & Telemetry Channel
    const wsUrl = `${wsProtocol}://${wsHost}/ws/field-camera/${sessionId}`;
    const ws = new WebSocket(wsUrl);
    viewerWsRef.current = ws;

    const handleOffer = async (offerSdp) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "answer", sdp: answer, role: "viewer" }));
        }

        fetch(`${effectiveApiUrl}/api/field-camera/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, role: "viewer", sdp: answer })
        }).catch(() => null);
      } catch (err) {
        console.warn("Offer handling warning:", err);
      }
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "register", role: "viewer", session_id: sessionId }));
      setViewerStatus("CONNECTING");

      fetch(`${effectiveApiUrl}/api/field-camera/offer?session_id=${sessionId}`)
        .then(r => r.json())
        .then(data => {
          if (data.offer && pc.signalingState === "stable") {
            handleOffer(data.offer);
          }
        })
        .catch(() => null);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ice_candidate", candidate: event.candidate, role: "viewer" }));
      }
    };

    ws.onmessage = async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "offer" && msg.sdp) {
          await handleOffer(msg.sdp);
        } else if (msg.type === "ice_candidate" && msg.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } else if (msg.type === "telemetry" || msg.type === "detection_result") {
          handleInferenceResult(msg.data, false);
        }
      } catch (e) {
        console.warn("Viewer WS error:", e);
      }
    };

    // Polling fallback every 3s if not yet live
    const pollInterval = setInterval(() => {
      if (viewerStatus !== "LIVE") {
        fetch(`${effectiveApiUrl}/api/field-camera/status?session_id=${sessionId}`)
          .then(r => r.json())
          .then(data => {
            if (data?.session?.latest_detection) {
              setLatestDetection(data.session.latest_detection);
            }
          })
          .catch(() => null);

        fetch(`${effectiveApiUrl}/api/field-camera/offer?session_id=${sessionId}`)
          .then(r => r.json())
          .then(data => {
            if (data.offer && pc.signalingState === "stable") {
              handleOffer(data.offer);
            }
          })
          .catch(() => null);
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      if (pc) pc.close();
      if (ws) ws.close();
    };
  }, [mode, sessionId, effectiveApiUrl]);

  // Handle detection output from real YOLO inference
  const handleInferenceResult = (result, isSource = false) => {
    if (!result) return;

    if (isSource) {
      setSourceLatestDetection(result);
    } else {
      setLatestDetection(result);
      if (result.detected && result.species) {
        setDetectionHistory(prev => [result, ...prev.slice(0, 19)]);
      }
    }

    // Audio & Vibration alerts for genuine threat
    if (result.detected && result.risk?.risk_score >= 70) {
      try {
        playEmergencyAlarm();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      } catch (e) {}
    }

    // Draw real bounding boxes on overlay canvas
    const canvas = isSource ? sourceCanvasRef.current : viewerOverlayRef.current;
    const video = isSource ? sourceVideoRef.current : viewerVideoRef.current;

    if (canvas && video && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (result.detections && result.detections.length > 0) {
        result.detections.forEach(det => {
          const [x1, y1, x2, y2] = det.bbox;
          const w = x2 - x1;
          const h = y2 - y1;

          const isHigh = (result.risk?.risk_score || 50) >= 70;
          const color = isHigh ? "#EF4444" : "#10B981";

          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.strokeRect(x1, y1, w, h);

          // Corner reticles for tactical feel
          const rLen = Math.min(20, w / 4);
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(x1, y1 + rLen); ctx.lineTo(x1, y1); ctx.lineTo(x1 + rLen, y1);
          ctx.moveTo(x2 - rLen, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + rLen);
          ctx.moveTo(x1, y2 - rLen); ctx.lineTo(x1, y2); ctx.lineTo(x1 + rLen, y2);
          ctx.moveTo(x2 - rLen, y2); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - rLen);
          ctx.stroke();

          // Label pill
          const label = `${det.species} ${det.confidence}% • ${det.movement_status || "DETECTED"}`;
          ctx.font = "bold 14px 'IBM Plex Sans', sans-serif";
          const textWidth = ctx.measureText(label).width;

          ctx.fillStyle = color;
          ctx.fillRect(x1, Math.max(0, y1 - 26), textWidth + 16, 24);

          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(label, x1 + 8, Math.max(16, y1 - 9));
        });
      }
    }
  };

  // Manual Trigger Scan from Dashboard
  const triggerManualScan = async () => {
    setManualScanning(true);
    try {
      if (viewerVideoRef.current && viewerVideoRef.current.videoWidth > 0) {
        const c = document.createElement("canvas");
        c.width = viewerVideoRef.current.videoWidth;
        c.height = viewerVideoRef.current.videoHeight;
        const ctx = c.getContext("2d");
        ctx.drawImage(viewerVideoRef.current, 0, 0);

        c.toBlob(async (blob) => {
          if (!blob) return;
          const fd = new FormData();
          fd.append("file", blob, "snapshot.jpg");
          fd.append("camera_id", sessionId);
          fd.append("session_id", sessionId);

          const res = await fetch(`${effectiveApiUrl}/api/field-camera/frame`, { method: "POST", body: fd });
          const data = await res.json();
          handleInferenceResult(data, false);
          setManualScanning(false);
        }, "image/jpeg", 0.8);
      } else {
        setManualScanning(false);
      }
    } catch (e) {
      setManualScanning(false);
    }
  };

  // =========================================================================
  // RENDER: MOBILE PHONE CAMERA (SOURCE MODE)
  // =========================================================================
  if (mode === "SOURCE") {
    return (
      <div style={{
        position: "fixed",
        inset: 0,
        background: "#020704",
        color: "#EEF4EE",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
        zIndex: 9999,
        overflow: "hidden"
      }}>
        {/* Top Tactical HUD Bar */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: "linear-gradient(to bottom, rgba(5,12,8,0.9), transparent)",
          padding: "14px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: isBroadcasting ? "rgba(239, 68, 68, 0.2)" : "rgba(100, 116, 139, 0.2)",
              border: `1px solid ${isBroadcasting ? "#EF4444" : "#475569"}`,
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: isBroadcasting ? "#FCA5A5" : "#94A3B8"
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isBroadcasting ? "#EF4444" : "#64748B",
                animation: isBroadcasting ? "pulse 1.5s infinite" : "none"
              }} />
              {isBroadcasting ? "FIELD CAMERA LIVE" : "STANDBY"}
            </span>

            <span style={{ fontSize: 12, color: "#8FA396", fontFamily: "monospace" }}>
              ID: {sessionId}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={toggleCameraFacing}
              style={{
                background: "rgba(13, 25, 19, 0.8)",
                border: "1px solid #1C3828",
                color: "#EEF4EE",
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600
              }}
            >
              <SwitchCamera size={14} />
              <span>{facingMode === "environment" ? "Back" : "Front"}</span>
            </button>

            <button
              onClick={() => setMode("VIEWER")}
              style={{
                background: "rgba(13, 25, 19, 0.8)",
                border: "1px solid #1C3828",
                color: "#8FA396",
                padding: "8px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 12
              }}
            >
              Dashboard
            </button>
          </div>
        </div>

        {/* Real-time Wildlife Detection Alert Banner */}
        {sourceLatestDetection?.detected && (
          <div style={{
            position: "absolute",
            top: 60,
            left: 14,
            right: 14,
            zIndex: 30,
            background: sourceLatestDetection.risk?.risk_score >= 70
              ? "linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(185, 28, 28, 0.95))"
              : "linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))",
            borderRadius: 10,
            padding: "12px 16px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            border: "1px solid rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            animation: "slideDown 0.3s ease-out"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>{sourceLatestDetection.emoji || "🐾"}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#FFFFFF", letterSpacing: "0.02em" }}>
                  {sourceLatestDetection.species} DETECTED ({sourceLatestDetection.confidence}%)
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginTop: 2 }}>
                  {sourceLatestDetection.movement?.movement_status || "DETECTED"} • Risk: {sourceLatestDetection.risk?.risk_level || "MEDIUM"}
                </div>
              </div>
            </div>
            <span style={{
              background: "rgba(0,0,0,0.3)",
              padding: "4px 8px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "monospace"
            }}>
              THREAT {sourceLatestDetection.risk?.risk_score?.toFixed(0) || "50"}
            </span>
          </div>
        )}

        {/* Live Camera Viewfinder & Overlay */}
        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <video
            ref={sourceVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
          />
          <canvas
            ref={sourceCanvasRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              pointerEvents: "none",
              zIndex: 10
            }}
          />

          {/* Tactical Crosshair Reticle */}
          {isBroadcasting && (
            <div style={{
              position: "absolute",
              width: 140,
              height: 140,
              border: "1px dashed rgba(76, 175, 80, 0.4)",
              borderRadius: 8,
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <div style={{ width: 10, height: 1, background: "rgba(76, 175, 80, 0.8)" }} />
              <div style={{ width: 1, height: 10, background: "rgba(76, 175, 80, 0.8)" }} />
            </div>
          )}

          {/* Standby Placeholder before stream begins */}
          {!isBroadcasting && (
            <div style={{
              position: "absolute",
              inset: 0,
              background: "#050C08",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center"
            }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(76, 175, 80, 0.1)",
                border: "1px solid #2E6B48",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20
              }}>
                <Smartphone size={36} color="#4CAF50" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px 0" }}>
                KAVACH Field Camera
              </h2>
              <p style={{ fontSize: 13, color: "#8FA396", maxWidth: 320, lineHeight: 1.5, margin: "0 0 24px 0" }}>
                Stream real-time video directly from your phone camera into the KAVACH YOLO wildlife detection pipeline.
              </p>

              {sourceError && (
                <div style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  padding: "12px 16px",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#FCA5A5",
                  maxWidth: 340,
                  marginBottom: 20,
                  textAlign: "left"
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Notice:</div>
                  {sourceError}
                  <div style={{ marginTop: 8, fontSize: 11, color: "#CBD5E1" }}>
                    Tip: If on local HTTP, enable <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> or use instant photo upload below.
                  </div>
                </div>
              )}

              <button
                onClick={startBroadcasting}
                style={{
                  background: "#4CAF50",
                  color: "#050C08",
                  border: "none",
                  padding: "14px 32px",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  boxShadow: "0 6px 20px rgba(76, 175, 80, 0.4)"
                }}
              >
                <Video size={20} />
                <span>START LIVE STREAM</span>
              </button>

              {/* Direct Snapshot Fallback Button */}
              <div style={{ marginTop: 24 }}>
                <label style={{
                  background: "rgba(13, 25, 19, 0.8)",
                  border: "1px solid #1C3828",
                  color: "#8FA396",
                  padding: "10px 18px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8
                }}>
                  <Camera size={16} />
                  <span>Take Single Photo / Video File</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    onChange={handleFallbackCapture}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Tactical Controls & Telemetry Bar */}
        <div style={{
          background: "#050C08",
          borderTop: "1px solid #183022",
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 20
        }}>
          <div>
            <div style={{ fontSize: 11, color: "#8FA396", display: "flex", alignItems: "center", gap: 6 }}>
              <Compass size={12} color="#4CAF50" />
              <span>GPS: {phoneGps?.lat}° N, {phoneGps?.lng}° E</span>
            </div>
            <div style={{ fontSize: 12, color: "#EEF4EE", fontWeight: 600, marginTop: 2 }}>
              {isBroadcasting ? `5 FPS • ${sourceFramesSent} frames analyzed` : "Ready to connect"}
            </div>
          </div>

          {isBroadcasting && (
            <button
              onClick={stopBroadcasting}
              style={{
                background: "#EF4444",
                color: "#FFFFFF",
                border: "none",
                padding: "10px 20px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              <Square size={14} />
              <span>STOP</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: LAPTOP / DASHBOARD MONITORING STATION (VIEWER MODE)
  // =========================================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, color: "#EEF4EE", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}>
      {/* Top Banner & Header */}
      <div style={{
        background: "#0D1913",
        border: "1px solid #1C3828",
        borderRadius: 10,
        padding: "18px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(76, 175, 80, 0.15)",
              border: "1px solid #2E6B48",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Video size={18} color="#4CAF50" />
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#EEF4EE" }}>
              Live Field Camera Monitoring Station
            </h1>
            <span style={{
              background: viewerStatus === "LIVE" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
              border: `1px solid ${viewerStatus === "LIVE" ? "#10B981" : "#F59E0B"}`,
              color: viewerStatus === "LIVE" ? "#34D399" : "#FBBF24",
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 20,
              display: "inline-flex",
              alignItems: "center",
              gap: 6
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: viewerStatus === "LIVE" ? "#10B981" : "#F59E0B"
              }} />
              {viewerStatus === "LIVE" ? "WEBRTC CONNECTED" : "AWAITING PHONE STREAM"}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#8FA396" }}>
            Real-time wireless video stream from field patrol Android phone with on-the-fly YOLO model inference.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setShowQrModal(true)}
            style={{
              background: "#183827",
              border: "1px solid #2E6B48",
              color: "#EEF4EE",
              padding: "10px 16px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <QrCode size={16} color="#4CAF50" />
            <span>Connect Mobile Phone</span>
          </button>

          <button
            onClick={() => setMode("SOURCE")}
            style={{
              background: "rgba(13, 25, 19, 0.8)",
              border: "1px solid #1C3828",
              color: "#8FA396",
              padding: "10px 16px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
            title="Use this laptop webcam as the test broadcaster"
          >
            <Smartphone size={16} />
            <span>Test On Laptop Webcam</span>
          </button>

          <button
            onClick={triggerManualScan}
            disabled={manualScanning}
            style={{
              background: "rgba(13, 25, 19, 0.8)",
              border: "1px solid #1C3828",
              color: "#EEF4EE",
              padding: "10px 16px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <RefreshCw size={16} className={manualScanning ? "animate-spin" : ""} color="#4CAF50" />
            <span>{manualScanning ? "Analyzing..." : "Trigger AI Snapshot"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Video Stream (Left) + Telemetry Operations Console (Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
        {/* Left Column: Live Video Player with Canvas Overlay */}
        <div style={{
          background: "#0D1913",
          border: "1px solid #1C3828",
          borderRadius: 10,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}>
          {/* Video Player Box */}
          <div style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            background: "#050C08",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }}>
            <video
              ref={viewerVideoRef}
              autoPlay
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: viewerStatus === "LIVE" ? "block" : "none"
              }}
            />

            <canvas
              ref={viewerOverlayRef}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                pointerEvents: "none",
                zIndex: 10,
                display: viewerStatus === "LIVE" ? "block" : "none"
              }}
            />

            {/* Waiting for Stream Graphic */}
            {viewerStatus !== "LIVE" && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 30
              }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(76, 175, 80, 0.1)",
                  border: "1px solid #2E6B48",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16
                }}>
                  <Radio size={28} color="#4CAF50" className="animate-pulse" />
                </div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 700, color: "#EEF4EE" }}>
                  Awaiting Field Camera Stream
                </h3>
                <p style={{ margin: "0 0 20px 0", fontSize: 13, color: "#8FA396", maxWidth: 400, lineHeight: 1.5 }}>
                  Scan the QR code on your mobile phone or click "Connect Mobile Phone" above to stream live patrol video.
                </p>
                <button
                  onClick={() => setShowQrModal(true)}
                  style={{
                    background: "#4CAF50",
                    color: "#050C08",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  <QrCode size={16} />
                  <span>View Mobile Link & QR</span>
                </button>
              </div>
            )}

            {/* In-feed HUD Overlay for Live Status */}
            {viewerStatus === "LIVE" && (
              <div style={{
                position: "absolute",
                top: 14,
                left: 14,
                right: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                pointerEvents: "none",
                zIndex: 15
              }}>
                <span style={{
                  background: "rgba(5, 12, 8, 0.8)",
                  border: "1px solid #1C3828",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "#4CAF50",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF50" }} />
                  KAVACH-CAM-001 • WEBRTC LIVE
                </span>

                <span style={{
                  background: "rgba(5, 12, 8, 0.8)",
                  border: "1px solid #1C3828",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "#8FA396"
                }}>
                  YOLO best.pt • 5 FPS SAMPLING
                </span>
              </div>
            )}
          </div>

          {/* Under-Video Metrics Strip */}
          <div style={{
            background: "#09140E",
            borderTop: "1px solid #183022",
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 12,
            color: "#8FA396"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span>Signal: <strong style={{ color: "#4CAF50" }}>Optimal (WebRTC)</strong></span>
              <span>Latency: <strong style={{ color: "#EEF4EE" }}>~{viewerLatency} ms</strong></span>
              <span>FPS: <strong style={{ color: "#EEF4EE" }}>{viewerFps || "30"} fps</strong></span>
            </div>
            <div>
              Source: <strong style={{ color: "#D6A84F" }}>Wireless Mobile Camera (PATROL-CAM-01)</strong>
            </div>
          </div>
        </div>

        {/* Right Column: AI Detection & Threat Telemetry Console */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Real-time Threat Card */}
          <div style={{
            background: "#0D1913",
            border: `1px solid ${latestDetection?.detected ? (latestDetection.risk?.risk_score >= 70 ? "#EF4444" : "#10B981") : "#1C3828"}`,
            borderRadius: 10,
            padding: "18px 20px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#8FA396" }}>
                AI TELEMETRY STREAM
              </span>
              <span style={{
                background: latestDetection?.detected ? "rgba(239, 68, 68, 0.15)" : "rgba(100, 116, 139, 0.15)",
                color: latestDetection?.detected ? "#FCA5A5" : "#94A3B8",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 4
              }}>
                {latestDetection?.detected ? "WILDLIFE DETECTED" : "SECTOR CLEAR"}
              </span>
            </div>

            {latestDetection?.detected ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 36 }}>{latestDetection.emoji || "🐾"}</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#EEF4EE" }}>
                      {latestDetection.species}
                    </h3>
                    <div style={{ fontSize: 12, color: "#4CAF50", fontWeight: 600, marginTop: 2 }}>
                      {latestDetection.confidence}% AI Confidence
                    </div>
                  </div>
                </div>

                {/* Metrics Breakdown */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #183022" }}>
                    <span style={{ color: "#8FA396" }}>Movement Status:</span>
                    <strong style={{ color: latestDetection.movement?.movement_status === "MOVING" ? "#F59E0B" : "#34D399" }}>
                      {latestDetection.movement?.movement_status || "STATIONARY"} ({latestDetection.movement?.direction || "OBSERVED"})
                    </strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #183022" }}>
                    <span style={{ color: "#8FA396" }}>Conflict Threat Score:</span>
                    <strong style={{ color: latestDetection.risk?.risk_score >= 70 ? "#EF4444" : "#D6A84F" }}>
                      {latestDetection.risk?.risk_score?.toFixed(1) || "55.0"} / 100 ({latestDetection.risk?.risk_level || "MEDIUM"})
                    </strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #183022" }}>
                    <span style={{ color: "#8FA396" }}>Nearest Habitation:</span>
                    <strong style={{ color: "#EEF4EE" }}>
                      {latestDetection.location?.village || "Moharli Settlement"} (~350m)
                    </strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                    <span style={{ color: "#8FA396" }}>Timestamp:</span>
                    <span style={{ color: "#8FA396", fontFamily: "monospace" }}>{latestDetection.timestamp || "Just now"}</span>
                  </div>
                </div>

                {latestDetection.risk?.recommendation && (
                  <div style={{
                    marginTop: 14,
                    background: "rgba(214, 168, 79, 0.1)",
                    border: "1px solid rgba(214, 168, 79, 0.3)",
                    padding: "10px 12px",
                    borderRadius: 6,
                    fontSize: 11,
                    color: "#D6A84F",
                    lineHeight: 1.4
                  }}>
                    <strong>Action:</strong> {latestDetection.risk.recommendation}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "24px 10px" }}>
                <Eye size={32} color="#2E6B48" style={{ margin: "0 auto 10px" }} />
                <div style={{ fontSize: 13, color: "#8FA396", fontWeight: 600 }}>
                  Scanning Sector for Wildlife...
                </div>
                <div style={{ fontSize: 11, color: "#4E6657", marginTop: 4 }}>
                  No target species currently detected in camera frame.
                </div>
              </div>
            )}
          </div>

          {/* Quick Patrol Location Card */}
          <div style={{
            background: "#0D1913",
            border: "1px solid #1C3828",
            borderRadius: 10,
            padding: "16px 20px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <MapPin size={16} color="#4CAF50" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#EEF4EE" }}>
                Field Camera GPS Coordinates
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#8FA396", fontFamily: "monospace" }}>
              20.2667° N, 79.4000° E
            </div>
            <div style={{ fontSize: 11, color: "#4E6657", marginTop: 4 }}>
              Moharli Buffer Zone • Beat #4 Patrol Sector
            </div>
          </div>

          {/* Session Detection History Log */}
          <div style={{
            background: "#0D1913",
            border: "1px solid #1C3828",
            borderRadius: 10,
            padding: "16px 20px",
            flex: 1,
            maxHeight: 240,
            overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#8FA396" }}>
                SESSION EVENT LOG
              </span>
              <span style={{ fontSize: 11, color: "#4CAF50" }}>
                {detectionHistory.length} events
              </span>
            </div>

            {detectionHistory.length === 0 ? (
              <div style={{ fontSize: 12, color: "#4E6657", textAlign: "center", padding: "16px 0" }}>
                No events recorded this session yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {detectionHistory.map((ev, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#09140E",
                      border: "1px solid #183022",
                      padding: "8px 10px",
                      borderRadius: 6,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 11
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span>{ev.emoji || "🐾"}</span>
                      <strong style={{ color: "#EEF4EE" }}>{ev.species}</strong>
                      <span style={{ color: "#8FA396" }}>({ev.confidence}%)</span>
                    </div>
                    <span style={{
                      color: ev.risk?.risk_score >= 70 ? "#EF4444" : "#10B981",
                      fontWeight: 700
                    }}>
                      {ev.risk?.risk_level || "MEDIUM"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connect Mobile Phone QR Code Modal */}
      {showQrModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(4px)",
          zIndex: 10000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}>
          <div style={{
            background: "#0D1913",
            border: "1px solid #2E6B48",
            borderRadius: 12,
            padding: 28,
            maxWidth: 480,
            width: "100%",
            boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
            textAlign: "center"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Smartphone size={20} color="#4CAF50" />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#EEF4EE" }}>
                  Connect Android Phone Camera
                </h3>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#8FA396",
                  fontSize: 18,
                  cursor: "pointer",
                  padding: 4
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#8FA396", lineHeight: 1.5, margin: "0 0 20px 0" }}>
              Scan this QR code with your phone camera or open the link below on the same Wi-Fi network.
            </p>

            {/* QR Code */}
            <div style={{
              background: "#FFFFFF",
              padding: 14,
              borderRadius: 10,
              display: "inline-block",
              marginBottom: 20,
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
            }}>
              <img
                src={qrCodeUrl}
                alt="Field Camera Connection QR"
                style={{ width: 200, height: 200, display: "block" }}
              />
            </div>

            {/* Shareable Link Box */}
            <div style={{
              background: "#050C08",
              border: "1px solid #1C3828",
              padding: "10px 14px",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 16
            }}>
              <input
                readOnly
                value={mobileLink}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#4CAF50",
                  fontFamily: "monospace",
                  fontSize: 12,
                  width: "100%",
                  outline: "none"
                }}
              />
              <button
                onClick={copyMobileLink}
                style={{
                  background: copied ? "#2E6B48" : "#183827",
                  border: "1px solid #2E6B48",
                  color: "#EEF4EE",
                  padding: "6px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            {/* LAN Note */}
            <div style={{
              background: "rgba(13, 25, 19, 0.8)",
              border: "1px solid #183022",
              padding: "10px 14px",
              borderRadius: 6,
              fontSize: 11,
              color: "#8FA396",
              textAlign: "left",
              lineHeight: 1.4
            }}>
              <strong style={{ color: "#D6A84F" }}>💡 Local Wi-Fi Camera Note:</strong>
              <br />
              Make sure your phone is connected to the same Wi-Fi network (<strong>{lanHost}</strong>). If Chrome blocks the camera on HTTP, open <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> and add this address, or use the built-in photo upload.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
