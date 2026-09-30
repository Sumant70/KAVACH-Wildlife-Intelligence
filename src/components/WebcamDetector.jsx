import React, { useRef, useState, useEffect } from "react";
import { Camera, CameraOff, RefreshCw, Play, Square, AlertCircle, CheckCircle2 } from "lucide-react";

export default function WebcamDetector({ onFrameCaptured, isAnalyzing = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [autoScan, setAutoScan] = useState(false);
  const autoScanTimer = useRef(null);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (autoScan && cameraActive && !isAnalyzing) {
      autoScanTimer.current = setTimeout(() => {
        captureFrame();
      }, 2500);
    }
    return () => {
      if (autoScanTimer.current) clearTimeout(autoScanTimer.current);
    };
  }, [autoScan, cameraActive, isAnalyzing]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam API is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError(err.message || "Camera permission denied or camera device unavailable.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    setAutoScan(false);
    if (autoScanTimer.current) clearTimeout(autoScanTimer.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || !cameraActive) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob && onFrameCaptured) {
        const file = new File([blob], `live_capture_${Date.now()}.jpg`, { type: "image/jpeg" });
        onFrameCaptured(file);
      }
    }, "image/jpeg", 0.9);
  };

  return (
    <div style={{ background: "#0D1813", border: "1px solid #1D3D2B", borderRadius: 8, padding: 16, width: "100%" }}>
      {/* Header Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Camera size={18} color="#D6A84F" />
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 16, color: "#EEF4EE" }}>
            LIVE CAMERA / SENSOR FEED
          </span>
          {cameraActive && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#4CAF50", background: "rgba(76, 175, 80, 0.15)", padding: "2px 6px", borderRadius: 3, border: "1px solid rgba(76,175,80,0.3)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF50", display: "inline-block" }} />
              LIVE 30FPS
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {!cameraActive ? (
            <button
              onClick={startCamera}
              style={{
                background: "#1E4A32",
                border: "1px solid #378057",
                color: "#EEF4EE",
                padding: "6px 14px",
                borderRadius: 4,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600
              }}
            >
              <Camera size={14} /> Start Camera
            </button>
          ) : (
            <>
              <button
                onClick={() => setAutoScan(!autoScan)}
                style={{
                  background: autoScan ? "#7A5012" : "#193325",
                  border: `1px solid ${autoScan ? "#D6A84F" : "#2E5C42"}`,
                  color: autoScan ? "#FFD580" : "#A4B7AC",
                  padding: "6px 12px",
                  borderRadius: 4,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12
                }}
              >
                {autoScan ? <Square size={13} /> : <Play size={13} />}
                {autoScan ? "Auto-Scanning..." : "Auto-Detect"}
              </button>

              <button
                onClick={captureFrame}
                disabled={isAnalyzing}
                style={{
                  background: "#2A6E46",
                  border: "1px solid #48A870",
                  color: "#FFFFFF",
                  padding: "6px 14px",
                  borderRadius: 4,
                  cursor: isAnalyzing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  opacity: isAnalyzing ? 0.6 : 1
                }}
              >
                {isAnalyzing ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Camera size={14} />}
                Capture & Detect
              </button>

              <button
                onClick={stopCamera}
                style={{
                  background: "#4A1E1E",
                  border: "1px solid #803737",
                  color: "#FFB0B0",
                  padding: "6px 10px",
                  borderRadius: 4,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12
                }}
              >
                <CameraOff size={14} /> Stop
              </button>
            </>
          )}
        </div>
      </div>

      {/* Camera View Area */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 320,
          background: "#070D0A",
          borderRadius: 6,
          overflow: "hidden",
          border: "1px dashed #20402E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: cameraActive ? "block" : "none"
          }}
        />

        {/* Reticle HUD overlay when active */}
        {cameraActive && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 140, height: 140, border: "1px dashed rgba(214, 168, 79, 0.4)", borderRadius: 8 }}>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 8, height: 8, background: "#D6A84F", borderRadius: "50%" }} />
            </div>
            <div style={{ position: "absolute", bottom: 8, left: 12, color: "#A4B7AC", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}>
              AI INFERENCE TARGETING GRID · STANDBY
            </div>
          </div>
        )}

        {!cameraActive && (
          <div style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
            {cameraError ? (
              <div style={{ color: "#E57373", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <AlertCircle size={28} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>Camera Permission or Device Error</div>
                <div style={{ fontSize: 11, color: "#A4B7AC" }}>{cameraError}</div>
                <button
                  onClick={startCamera}
                  style={{ marginTop: 8, background: "#1E382A", border: "1px solid #306348", color: "#EEF4EE", padding: "5px 12px", borderRadius: 4, cursor: "pointer", fontSize: 11 }}
                >
                  Retry Camera Access
                </button>
              </div>
            ) : (
              <div style={{ color: "#7A9183", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Camera size={36} color="#355A44" />
                <div style={{ fontSize: 13, fontWeight: 600, color: "#EEF4EE" }}>Live Camera Standby</div>
                <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                  Connect your laptop webcam, USB field camera, or mobile sensor to run real-time wildlife detection right from the browser.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
