import React, { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RefreshCw, Eye, EyeOff, ShieldAlert } from "lucide-react";

export default function BoundingBoxCanvas({
  imageUrl,
  detections = [],
  confidenceThreshold = 20,
  riskLevel = "HIGH",
  onSelectDetection
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef(null);

  const getRiskColor = (level) => {
    switch (level?.toUpperCase()) {
      case "CRITICAL":
      case "HIGH":
        return "#E54D4D";
      case "MEDIUM":
        return "#E5A93C";
      case "LOW":
      default:
        return "#4CAF50";
    }
  };

  useEffect(() => {
    if (!imageUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
      draw();
    };
  }, [imageUrl]);

  useEffect(() => {
    if (imgLoaded) {
      draw();
    }
  }, [imgLoaded, detections, confidenceThreshold, showBoxes, showLabels, zoom]);

  const draw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Draw background image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (!showBoxes || !detections || detections.length === 0) return;

    const boxColor = getRiskColor(riskLevel);

    detections.forEach((det, index) => {
      if (det.confidence < confidenceThreshold) return;

      const [x1, y1, x2, y2] = det.bbox || [];
      if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) return;

      const w = x2 - x1;
      const h = y2 - y1;

      // Outer bounding box with tactical glow
      ctx.save();
      ctx.shadowColor = boxColor;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = Math.max(3, Math.round(canvas.width / 350));
      ctx.strokeRect(x1, y1, w, h);
      ctx.restore();

      // Translucent fill
      ctx.fillStyle = `${boxColor}18`;
      ctx.fillRect(x1, y1, w, h);

      // Corner tactical targeting brackets
      const bracketLen = Math.min(w, h) * 0.25;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = Math.max(4, Math.round(canvas.width / 300));
      ctx.beginPath();
      // Top-left
      ctx.moveTo(x1, y1 + bracketLen); ctx.lineTo(x1, y1); ctx.lineTo(x1 + bracketLen, y1);
      // Top-right
      ctx.moveTo(x2 - bracketLen, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + bracketLen);
      // Bottom-left
      ctx.moveTo(x1, y2 - bracketLen); ctx.lineTo(x1, y2); ctx.lineTo(x1 + bracketLen, y2);
      // Bottom-right
      ctx.moveTo(x2 - bracketLen, y2); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - bracketLen);
      ctx.stroke();

      // Label Header Pill
      if (showLabels) {
        const text = `${det.species.toUpperCase()} [${det.confidence}%]`;
        const fontSize = Math.max(16, Math.round(canvas.width / 42));
        ctx.font = `bold ${fontSize}px 'Rajdhani', sans-serif`;

        const textMetrics = ctx.measureText(text);
        const padding = fontSize * 0.35;
        const pillW = textMetrics.width + padding * 2;
        const pillH = fontSize + padding * 1.5;

        // Label background
        ctx.fillStyle = boxColor;
        const labelY = Math.max(0, y1 - pillH);
        ctx.fillRect(x1, labelY, pillW, pillH);

        // Label text
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(text, x1 + padding, labelY + fontSize + (padding * 0.2));
      }
    });
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        background: "#080E0B",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid #1E382B",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 360,
        width: "100%"
      }}
    >
      {/* Control Overlay Bar */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 10,
          display: "flex",
          gap: 6,
          background: "rgba(10, 20, 15, 0.85)",
          backdropFilter: "blur(6px)",
          border: "1px solid #234634",
          borderRadius: 6,
          padding: 4
        }}
      >
        <button
          onClick={() => setShowBoxes(!showBoxes)}
          title="Toggle Bounding Boxes"
          style={{
            background: showBoxes ? "#1A3D2C" : "transparent",
            border: "1px solid #2E5C42",
            color: showBoxes ? "#4CAF50" : "#8FA396",
            borderRadius: 4,
            padding: "5px 8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11
          }}
        >
          {showBoxes ? <Eye size={14} /> : <EyeOff size={14} />}
          <span>{showBoxes ? "Boxes ON" : "Boxes OFF"}</span>
        </button>

        <button
          onClick={() => setZoom(prev => Math.min(2.5, prev + 0.25))}
          title="Zoom In"
          style={{ background: "transparent", border: "1px solid #234634", color: "#EEF4EE", borderRadius: 4, padding: "5px 8px", cursor: "pointer" }}
        >
          <ZoomIn size={14} />
        </button>

        <button
          onClick={() => setZoom(prev => Math.max(0.75, prev - 0.25))}
          title="Zoom Out"
          style={{ background: "transparent", border: "1px solid #234634", color: "#EEF4EE", borderRadius: 4, padding: "5px 8px", cursor: "pointer" }}
        >
          <ZoomOut size={14} />
        </button>

        <button
          onClick={() => setZoom(1)}
          title="Reset Zoom"
          style={{ background: "transparent", border: "1px solid #234634", color: "#EEF4EE", borderRadius: 4, padding: "5px 8px", cursor: "pointer" }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Canvas Viewport */}
      <div
        style={{
          width: "100%",
          maxHeight: 520,
          overflow: "auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 12
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: "100%",
            height: "auto",
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
            transition: "transform 0.15s ease-out",
            borderRadius: 6,
            boxShadow: "0 6px 24px rgba(0,0,0,0.5)"
          }}
        />
      </div>

      {/* Bounding Box Legend */}
      <div
        style={{
          width: "100%",
          padding: "8px 14px",
          background: "rgba(9, 17, 13, 0.95)",
          borderTop: "1px solid #1A3326",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 11,
          fontFamily: "'IBM Plex Mono', monospace"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ color: "#8FA396" }}>DETECTED WILDLIFE: <strong style={{ color: "#EEF4EE" }}>{detections.length}</strong></span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: getRiskColor(riskLevel) }}>
            <ShieldAlert size={13} /> {riskLevel} RISK TARGET
          </span>
        </div>
        <span style={{ color: "#728A7C" }}>ZOOM: {Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}
