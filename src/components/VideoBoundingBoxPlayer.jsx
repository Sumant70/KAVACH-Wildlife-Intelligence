import React, { useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Eye, Navigation } from "lucide-react";

/**
 * Direction emoji & symbol helper
 */
const getDirectionSymbol = (direction) => {
  switch (direction) {
    case "RIGHT": return "➡️ RIGHT";
    case "LEFT": return "⬅️ LEFT";
    case "UP": return "⬆️ UP";
    case "DOWN": return "⬇️ DOWN";
    case "APPROACHING": return "↘️ APPROACHING";
    case "MOVING AWAY": return "↖️ MOVING AWAY";
    default: return "🧭 UNKNOWN";
  }
};

export default function VideoBoundingBoxPlayer({
  videoUrl,
  frameDetections = [],
  tracks = [],
  width = 640,
  height = 480,
  overallSummary = null
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showTrails, setShowTrails] = useState(true);

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Find nearest detections within 0.35s of video current time
  const getDetectionsForTime = useCallback((timeSec) => {
    if (!frameDetections || frameDetections.length === 0) return [];
    let closest = null;
    let minDiff = Infinity;
    for (const f of frameDetections) {
      const diff = Math.abs(f.timestamp_sec - timeSec);
      if (diff < minDiff) {
        minDiff = diff;
        closest = f;
      }
    }
    // Only return if within 0.35s tolerance window
    return (minDiff <= 0.35 && closest) ? closest.detections : [];
  }, [frameDetections]);

  // Main canvas drawing function
  const drawOverlay = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Synchronize canvas buffer dimensions with rendered video size
    const rect = video.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
        canvas.width = Math.round(rect.width);
        canvas.height = Math.round(rect.height);
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showBoxes && !showTrails) return;

    const scaleX = canvas.width / (width || 640);
    const scaleY = canvas.height / (height || 480);
    const curTime = video.currentTime;
    const currentDets = getDetectionsForTime(curTime);

    // 1. Draw motion trajectory trails if enabled
    if (showTrails && Array.isArray(tracks) && tracks.length > 0) {
      tracks.forEach((track) => {
        if (!track) return;
        const history = Array.isArray(track.trajectory)
          ? track.trajectory
          : (Array.isArray(track.centroid_history) ? track.centroid_history : []);
        if (history.length < 2) return;

        // Filter points up to current video time
        const visiblePoints = history.filter(p => {
          if (!p || typeof p.x !== "number" || typeof p.y !== "number" || isNaN(p.x) || isNaN(p.y)) return false;
          const ptTime = p.t ?? p.time ?? p.timestamp_sec ?? 0;
          return ptTime <= curTime + 0.1;
        });
        if (visiblePoints.length < 2) return;

        ctx.save();
        ctx.beginPath();
        const startX = visiblePoints[0].x * scaleX;
        const startY = visiblePoints[0].y * scaleY;
        ctx.moveTo(startX, startY);

        for (let i = 1; i < visiblePoints.length; i++) {
          const px = visiblePoints[i].x * scaleX;
          const py = visiblePoints[i].y * scaleY;
          ctx.lineTo(px, py);
        }

        const isMoving = track.is_moving ?? (track.movement_status === "MOVING");
        ctx.strokeStyle = isMoving ? "#00FFAA" : "#F59E0B";
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.shadowColor = isMoving ? "#00FFAA" : "#F59E0B";
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();

        // Draw small dot on latest trajectory point
        const latest = visiblePoints[visiblePoints.length - 1];
        ctx.save();
        ctx.beginPath();
        ctx.arc(latest.x * scaleX, latest.y * scaleY, 4, 0, Math.PI * 2);
        ctx.fillStyle = isMoving ? "#00FFAA" : "#F59E0B";
        ctx.shadowColor = "#FFFFFF";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.restore();
      });
    }

    // 2. Draw bounding boxes & telemetry tags if enabled
    if (showBoxes && Array.isArray(currentDets) && currentDets.length > 0) {
      currentDets.forEach((det) => {
        if (!det || !Array.isArray(det.bbox) || det.bbox.length < 4) return;
        const [rawX1, rawY1, rawX2, rawY2] = det.bbox;
        if (typeof rawX1 !== "number" || typeof rawY1 !== "number" || typeof rawX2 !== "number" || typeof rawY2 !== "number") return;
        if (isNaN(rawX1) || isNaN(rawY1) || isNaN(rawX2) || isNaN(rawY2)) return;

        const x1 = rawX1 * scaleX;
        const y1 = rawY1 * scaleY;
        const w = (rawX2 - rawX1) * scaleX;
        const h = (rawY2 - rawY1) * scaleY;

        const isMoving = det.movement_status === "MOVING";
        const themeColor = isMoving ? "#00FFAA" : (det.movement_status === "STATIONARY" ? "#F59E0B" : "#3B82F6");

        ctx.save();

        // Outer Bounding Box
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = themeColor;
        ctx.shadowBlur = 10;
        ctx.strokeRect(x1, y1, w, h);

        // Tech Corner Brackets for High-Tech Aesthetic
        const cornerLen = Math.min(18, Math.min(w, h) / 3);
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#FFFFFF";
        ctx.shadowBlur = 0;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(x1, y1 + cornerLen);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x1 + cornerLen, y1);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(x1 + w - cornerLen, y1);
        ctx.lineTo(x1 + w, y1);
        ctx.lineTo(x1 + w, y1 + cornerLen);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(x1, y1 + h - cornerLen);
        ctx.lineTo(x1, y1 + h);
        ctx.lineTo(x1 + cornerLen, y1 + h);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(x1 + w - cornerLen, y1 + h);
        ctx.lineTo(x1 + w, y1 + h);
        ctx.lineTo(x1 + w, y1 + h - cornerLen);
        ctx.stroke();

        // Centroid Crosshair
        const cx = x1 + w / 2;
        const cy = y1 + h / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = themeColor;
        ctx.fill();

        // Label Badges (Species + Confidence + Movement + Direction)
        const confNum = typeof det.confidence === "number"
          ? (det.confidence > 1 ? Math.round(det.confidence) : Math.round(det.confidence * 100))
          : 0;
        const speciesText = (det.species || "Unknown").toUpperCase();
        const labelText = `${det.emoji || "🐾"} ${speciesText} ${confNum}%`;
        const moveText = isMoving
          ? `🟢 MOVING • ${det.direction || "UNKNOWN"}`
          : (det.movement_status === "STATIONARY" ? "🟡 STATIONARY" : "⚪ DETECTED");

        ctx.font = "bold 12px 'Rajdhani', sans-serif";
        const labelWidth = ctx.measureText(labelText).width;
        ctx.font = "bold 10px 'Rajdhani', sans-serif";
        const moveWidth = ctx.measureText(moveText).width;
        const totalBadgeW = Math.max(labelWidth, moveWidth) + 16;
        const badgeH = 34;

        // Clamp badge position inside canvas
        const badgeX = Math.max(0, Math.min(x1, canvas.width - totalBadgeW));
        const badgeY = y1 > badgeH + 6 ? y1 - badgeH - 4 : y1 + 4;

        // Badge Background
        ctx.fillStyle = "rgba(10, 20, 15, 0.88)";
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, totalBadgeW, badgeH, 4);
        ctx.fill();
        ctx.stroke();

        // Species text
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 12px 'Rajdhani', sans-serif";
        ctx.fillText(labelText, badgeX + 8, badgeY + 14);

        // Movement Status text
        ctx.fillStyle = themeColor;
        ctx.font = "bold 10px 'Rajdhani', sans-serif";
        ctx.fillText(moveText, badgeX + 8, badgeY + 28);

        ctx.restore();
      });
    }
  }, [width, height, showBoxes, showTrails, tracks, getDetectionsForTime]);

  // Continuous animation loop synchronized with video playback
  const renderLoop = useCallback(() => {
    drawOverlay();
    if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
      animationFrameId.current = requestAnimationFrame(renderLoop);
    }
  }, [drawOverlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setIsPlaying(true);
      animationFrameId.current = requestAnimationFrame(renderLoop);
    };

    const onPause = () => {
      setIsPlaying(false);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      drawOverlay();
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      drawOverlay();
    };

    const onLoadedMetadata = () => {
      setDuration(video.duration || 0);
      drawOverlay();
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [renderLoop, drawOverlay]);

  // Trigger draw when toggles or frameDetections change
  useEffect(() => {
    drawOverlay();
  }, [showBoxes, showTrails, frameDetections, drawOverlay]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      drawOverlay();
    }
  };

  const handleSpeedChange = (rate) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => null);
    } else {
      document.exitFullscreen().catch(() => null);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        background: "#080F0B",
        borderRadius: 10,
        border: "1px solid #1E3A2B",
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
        position: "relative",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Video + Canvas Stage */}
      <div style={{ position: "relative", width: "100%", maxHeight: 520, background: "#000", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <video
          ref={videoRef}
          src={videoUrl || undefined}
          playsInline
          muted
          loop
          onClick={togglePlay}
          style={{
            maxWidth: "100%",
            maxHeight: 520,
            display: "block",
            cursor: "pointer",
            objectFit: "contain"
          }}
        />
        <canvas
          ref={canvasRef}
          onClick={togglePlay}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none"
          }}
        />

        {/* Live Tracking HUD Banner on Top of Video */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            right: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            pointerEvents: "none",
            zIndex: 10
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(10, 20, 15, 0.8)", backdropFilter: "blur(6px)", border: "1px solid #1E3A2B", padding: "4px 10px", borderRadius: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isPlaying ? "#00FFAA" : "#6B7280", boxShadow: isPlaying ? "0 0 8px #00FFAA" : "none" }}></span>
            <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 12, fontWeight: 700, color: "#EEF4EE", letterSpacing: "0.05em" }}>
              {isPlaying ? "LIVE TRACKING RUNNING" : "PAUSED (FRAME INSPECT)"}
            </span>
          </div>

          {overallSummary && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(10, 20, 15, 0.85)", backdropFilter: "blur(6px)", border: `1px solid ${overallSummary?.is_moving ? "#10B981" : "#F59E0B"}`, padding: "4px 12px", borderRadius: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: overallSummary?.is_moving ? "#34D399" : "#FBBF24" }}>
                {overallSummary?.movement_status || "UNKNOWN"} • {getDirectionSymbol(overallSummary?.dominant_direction)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Control Bar */}
      <div
        style={{
          padding: "10px 16px",
          background: "rgba(13, 26, 19, 0.95)",
          borderTop: "1px solid #1E3A2B",
          display: "flex",
          flexDirection: "column",
          gap: 8
        }}
      >
        {/* Scrubber Range */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#8FA396", fontFamily: "monospace", minWidth: 42 }}>
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.01}
            value={currentTime}
            onChange={handleSeek}
            style={{
              flex: 1,
              accentColor: "#10B981",
              cursor: "pointer",
              height: 4
            }}
          />
          <span style={{ fontSize: 11, color: "#8FA396", fontFamily: "monospace", minWidth: 42 }}>
            {formatTime(duration)}
          </span>
        </div>

        {/* Buttons & Toggles */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={togglePlay}
              style={{
                background: isPlaying ? "#1E3A2B" : "#10B981",
                border: "none",
                color: isPlaying ? "#EEF4EE" : "#0A140F",
                padding: "6px 12px",
                borderRadius: 4,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 700
              }}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} fill="#0A140F" />}
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play();
                }
              }}
              style={{
                background: "transparent",
                border: "1px solid #234533",
                color: "#8FA396",
                padding: "6px 10px",
                borderRadius: 4,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12
              }}
              title="Replay from start"
            >
              <RotateCcw size={14} /> Replay
            </button>

            {/* Playback speed buttons */}
            <div style={{ display: "inline-flex", background: "#0A140F", borderRadius: 4, border: "1px solid #1E3A2B", overflow: "hidden" }}>
              {[0.5, 1, 1.5].map((rate) => (
                <button
                  key={rate}
                  onClick={() => handleSpeedChange(rate)}
                  style={{
                    background: playbackRate === rate ? "#1E3A2B" : "transparent",
                    color: playbackRate === rate ? "#10B981" : "#8FA396",
                    border: "none",
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Overlay visibility toggles */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setShowBoxes(!showBoxes)}
              style={{
                background: showBoxes ? "rgba(16, 185, 129, 0.15)" : "transparent",
                border: `1px solid ${showBoxes ? "#10B981" : "#234533"}`,
                color: showBoxes ? "#34D399" : "#6B7280",
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5
              }}
            >
              <Eye size={12} /> Bounding Boxes {showBoxes ? "ON" : "OFF"}
            </button>

            <button
              onClick={() => setShowTrails(!showTrails)}
              style={{
                background: showTrails ? "rgba(16, 185, 129, 0.15)" : "transparent",
                border: `1px solid ${showTrails ? "#10B981" : "#234533"}`,
                color: showTrails ? "#34D399" : "#6B7280",
                padding: "4px 10px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5
              }}
            >
              <Navigation size={12} /> Motion Trails {showTrails ? "ON" : "OFF"}
            </button>

            <button
              onClick={toggleFullscreen}
              style={{
                background: "transparent",
                border: "1px solid #234533",
                color: "#8FA396",
                padding: "4px 8px",
                borderRadius: 4,
                cursor: "pointer"
              }}
              title="Fullscreen"
            >
              <Maximize size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
