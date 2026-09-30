import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Camera, MapPin, Bell, Eye, Cpu, CheckCircle2,
  LayoutGrid, Smartphone, BarChart3, ShieldAlert, Radar, ChevronDown
} from "lucide-react";

// ─── Keyframe CSS injected once ───────────────────────────────────────────────
const HERO_STYLES = `
  @keyframes kavach3dFloat {
    0%, 100% { transform: translateY(0px) rotateX(0deg) rotateY(-4deg); }
    33%       { transform: translateY(-10px) rotateX(2deg) rotateY(4deg); }
    66%       { transform: translateY(-5px) rotateX(-1deg) rotateY(-2deg); }
  }
  @keyframes kavachGlowPulse {
    0%, 100% { box-shadow: 0 0 40px rgba(46,107,72,0.35), 0 0 80px rgba(76,175,80,0.12), inset 0 0 30px rgba(46,107,72,0.08); }
    50%       { box-shadow: 0 0 60px rgba(46,107,72,0.55), 0 0 120px rgba(76,175,80,0.22), inset 0 0 50px rgba(46,107,72,0.14); }
  }
  @keyframes kavachOrbitRing {
    from { transform: rotateZ(0deg); }
    to   { transform: rotateZ(360deg); }
  }
  @keyframes kavachOrbitRingRev {
    from { transform: rotateZ(0deg); }
    to   { transform: rotateZ(-360deg); }
  }
  @keyframes kavachScanLine {
    0%   { opacity: 0; top: 0%; }
    10%  { opacity: 0.7; }
    90%  { opacity: 0.7; }
    100% { opacity: 0; top: 100%; }
  }
  @keyframes kavachHeroFadeUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes kavachHeroFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes kavachSlideRight {
    from { opacity: 0; transform: translateX(-20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
  @keyframes kavachCornerBlink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
  @keyframes kavachLogoEntrance {
    0%   { opacity: 0; transform: translateY(30px) scale(0.88); }
    60%  { transform: translateY(-6px) scale(1.02); }
    100% { opacity: 1; transform: translateY(0px) scale(1); }
  }
  @keyframes kavachTextEntrance {
    from { opacity: 0; transform: translateX(24px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes kavachDescEntrance {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes kavachBtnEntrance {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes kavachDotOrbit {
    from { transform: rotate(0deg) translateX(52px) rotate(0deg); }
    to   { transform: rotate(360deg) translateX(52px) rotate(-360deg); }
  }
  @keyframes kavachDotOrbit2 {
    from { transform: rotate(180deg) translateX(38px) rotate(-180deg); }
    to   { transform: rotate(540deg) translateX(38px) rotate(-540deg); }
  }
  @keyframes kavachFeatureCardIn {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @media (max-width: 900px) {
    .kavach-home-hero-flex { flex-direction: column-reverse !important; align-items: center !important; }
    .kavach-home-logo-col  { flex: 0 0 auto !important; width: 260px !important; height: 260px !important; }
    .kavach-home-text-col  { flex: 1 1 auto !important; text-align: center !important; align-items: center !important; }
    .kavach-home-btn-row   { justify-content: center !important; }
  }
  @media (max-width: 600px) {
    .kavach-home-logo-col  { width: 200px !important; height: 200px !important; }
  }
`;

// ─── 3D KAVACH Emblem Component ───────────────────────────────────────────────
function Kavach3DEmblem() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: "800px"
      }}
    >
      {/* Floating 3D container */}
      <div
        style={{
          width: 280,
          height: 280,
          position: "relative",
          animation: "kavach3dFloat 6s ease-in-out infinite, kavachGlowPulse 4s ease-in-out infinite",
          transformStyle: "preserve-3d"
        }}
      >
        {/* Outer orbit ring */}
        <div style={{
          position: "absolute",
          inset: -18,
          borderRadius: "50%",
          border: "1.5px dashed rgba(76,175,80,0.25)",
          animation: "kavachOrbitRing 16s linear infinite",
          pointerEvents: "none"
        }}>
          {/* Orbiting dot */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: 8, height: 8, borderRadius: "50%",
            background: "#4CAF50",
            boxShadow: "0 0 10px #4CAF50",
            animation: "kavachDotOrbit 16s linear infinite",
            transformOrigin: "0 0",
            marginTop: -4, marginLeft: -4
          }} />
        </div>

        {/* Inner orbit ring */}
        <div style={{
          position: "absolute",
          inset: 12,
          borderRadius: "50%",
          border: "1px dashed rgba(214,168,79,0.2)",
          animation: "kavachOrbitRingRev 10s linear infinite",
          pointerEvents: "none"
        }}>
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: 6, height: 6, borderRadius: "50%",
            background: "#D6A84F",
            boxShadow: "0 0 8px #D6A84F",
            animation: "kavachDotOrbit2 10s linear infinite",
            transformOrigin: "0 0",
            marginTop: -3, marginLeft: -3
          }} />
        </div>

        {/* Main emblem circle */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "radial-gradient(circle at 38% 32%, #1E5C38 0%, #0D2A1C 45%, #071209 100%)",
            border: "2px solid rgba(76,175,80,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }}
        >
          {/* Scan line */}
          <div style={{
            position: "absolute",
            left: 0, right: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent, rgba(76,175,80,0.8), transparent)",
            animation: "kavachScanLine 3.5s ease-in-out infinite",
            pointerEvents: "none",
            zIndex: 5
          }} />

          {/* Hex grid overlay */}
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(circle, rgba(76,175,80,0.07) 1px, transparent 1px)`,
            backgroundSize: "18px 18px",
            borderRadius: "50%"
          }} />

          {/* KAVACH logo image */}
          <img
            src="/kavach-logo.png"
            alt="KAVACH Emblem"
            style={{
              width: "72%",
              height: "72%",
              objectFit: "contain",
              position: "relative",
              zIndex: 2,
              filter: "drop-shadow(0 0 12px rgba(76,175,80,0.6)) drop-shadow(0 4px 8px rgba(0,0,0,0.8)) brightness(1.05)"
            }}
            onError={(e) => { e.target.style.display = "none"; }}
          />

          {/* Fallback shield if no image */}
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1
          }}>
            <ShieldAlert size={80} color="rgba(76,175,80,0.15)" />
          </div>

          {/* 3D depth sheen */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%, rgba(0,0,0,0.2) 100%)",
            borderRadius: "50%",
            pointerEvents: "none",
            zIndex: 6
          }} />
        </div>

        {/* Bottom glow base */}
        <div style={{
          position: "absolute",
          bottom: -24,
          left: "50%",
          transform: "translateX(-50%)",
          width: 180,
          height: 20,
          background: "radial-gradient(ellipse, rgba(46,107,72,0.45) 0%, transparent 70%)",
          filter: "blur(6px)",
          pointerEvents: "none"
        }} />

        {/* HUD corner brackets */}
        {[
          { top: -4, left: -4, borderTop: "2.5px solid #D6A84F", borderLeft: "2.5px solid #D6A84F" },
          { top: -4, right: -4, borderTop: "2.5px solid #D6A84F", borderRight: "2.5px solid #D6A84F" },
          { bottom: -4, left: -4, borderBottom: "2.5px solid #4CAF50", borderLeft: "2.5px solid #4CAF50" },
          { bottom: -4, right: -4, borderBottom: "2.5px solid #4CAF50", borderRight: "2.5px solid #4CAF50" },
        ].map((s, i) => (
          <div key={i} style={{ position: "absolute", width: 16, height: 16, animation: "kavachCornerBlink 2s ease-in-out infinite", animationDelay: `${i * 0.5}s`, ...s }} />
        ))}

        {/* KAVACH label */}
        <div style={{
          position: "absolute",
          bottom: -44,
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "'Rajdhani', sans-serif",
          fontSize: 13,
          fontWeight: 800,
          color: "#4CAF50",
          letterSpacing: "0.22em",
          whiteSpace: "nowrap",
          textShadow: "0 0 12px rgba(76,175,80,0.7)"
        }}>
          KAVACH
        </div>
      </div>
    </div>
  );
}

// ─── Feature Cards ────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Cpu,
    color: "#4CAF50",
    title: "AI Wildlife Detection",
    desc: "Real-time YOLO-based computer vision identifies species, generates bounding boxes, and triggers automated incident records from live camera feeds and uploaded media."
  },
  {
    icon: MapPin,
    color: "#3A82EE",
    title: "GIS Intelligence",
    desc: "Interactive geospatial mapping overlays live detections, active alerts, and geofenced buffer zones onto a satellite GIS layer for district-wide threat visualization."
  },
  {
    icon: Bell,
    color: "#E54D4D",
    title: "Early Warning & Alerts",
    desc: "Automated high-risk alert workflows, Firebase Cloud Messaging push notifications, WebSocket-based live broadcasts, and acoustic siren triggers for rapid field response."
  },
  {
    icon: Camera,
    color: "#D6A84F",
    title: "Camera Monitoring",
    desc: "Centralized 4-grid CCTV monitoring, cross-device mobile camera relay over WebSocket, and remote field camera streaming with real-time AI inference overlay."
  },
  {
    icon: Smartphone,
    color: "#9C27B0",
    title: "Field Response",
    desc: "Mobile-first alert device interface for forest rangers with FCM push notifications, live siren playback, vibration alerts, and WebSocket incident updates in the field."
  },
  {
    icon: LayoutGrid,
    color: "#26C6DA",
    title: "Command Center",
    desc: "Centralized operational dashboard aggregating live KPIs, detection feeds, active incidents, device telemetry, and multi-channel alert management in one view."
  }
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function LandingPageView({ onEnterCommandCenter, onStartDetection, onNavigate }) {
  const featuresRef = useRef(null);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, paddingBottom: 80 }}>
      <style>{HERO_STYLES}</style>

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO SECTION — 3D Logo LEFT | Content RIGHT
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        style={{
          position: "relative",
          borderRadius: 14,
          padding: "60px 44px 72px",
          marginBottom: 52,
          background: "radial-gradient(ellipse at 20% 40%, rgba(46,107,72,0.38) 0%, rgba(13,26,19,0.97) 55%, #07100D 100%)",
          border: "1.5px solid rgba(46,107,72,0.45)",
          overflow: "hidden",
          boxShadow: "0 16px 60px rgba(0,0,0,0.7)"
        }}
      >
        {/* Background grid pattern */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `
            linear-gradient(rgba(46,107,72,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(46,107,72,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          borderRadius: 14
        }} />

        {/* Deep radial center glow */}
        <div style={{
          position: "absolute",
          top: "40%", left: "20%",
          width: 400, height: 400,
          background: "radial-gradient(circle, rgba(46,107,72,0.18) 0%, transparent 70%)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none"
        }} />

        {/* HUD corner brackets */}
        <div style={{ position: "absolute", top: 14, left: 14, borderTop: "2px solid rgba(214,168,79,0.5)", borderLeft: "2px solid rgba(214,168,79,0.5)", width: 22, height: 22, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 14, right: 14, borderTop: "2px solid rgba(214,168,79,0.5)", borderRight: "2px solid rgba(214,168,79,0.5)", width: 22, height: 22, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 14, left: 14, borderBottom: "2px solid rgba(76,175,80,0.5)", borderLeft: "2px solid rgba(76,175,80,0.5)", width: 22, height: 22, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 14, right: 14, borderBottom: "2px solid rgba(76,175,80,0.5)", borderRight: "2px solid rgba(76,175,80,0.5)", width: 22, height: 22, pointerEvents: "none" }} />

        {/* Two-column flex */}
        <div
          className="kavach-home-hero-flex"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 52,
            position: "relative",
            zIndex: 2
          }}
        >
          {/* ── LEFT: 3D KAVACH Logo ── */}
          <div
            className="kavach-home-logo-col"
            style={{
              flex: "0 0 300px",
              width: 300,
              height: 300,
              position: "relative",
              animation: "kavachLogoEntrance 1.0s cubic-bezier(0.22, 1, 0.36, 1) both"
            }}
          >
            <Kavach3DEmblem />
          </div>

          {/* ── RIGHT: Text Content ── */}
          <div
            className="kavach-home-text-col"
            style={{
              flex: "1 1 0",
              display: "flex",
              flexDirection: "column",
              gap: 20,
              alignItems: "flex-start"
            }}
          >
            {/* Status badge */}
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(214,168,79,0.12)",
                border: "1px solid rgba(214,168,79,0.38)",
                padding: "5px 14px", borderRadius: 4,
                animation: "kavachHeroFadeIn 0.6s ease both",
                animationDelay: "0.3s", opacity: 0
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#D6A84F", animation: "pulse 1.5s infinite" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 700, color: "#FFD580", letterSpacing: "0.1em" }}>
                KAVACH — NATIONAL WILDLIFE INTELLIGENCE PLATFORM
              </span>
            </div>

            {/* Main heading */}
            <h1
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: "clamp(28px, 3.6vw, 48px)",
                fontWeight: 800,
                color: "#EEF4EE",
                lineHeight: 1.08,
                margin: 0,
                letterSpacing: "0.02em",
                animation: "kavachTextEntrance 0.75s cubic-bezier(0.22, 1, 0.36, 1) both",
                animationDelay: "0.5s",
                opacity: 0
              }}
            >
              KAVACH – AI-POWERED<br />
              WILDLIFE DETECTION &amp;<br />
              <span style={{ color: "#4CAF50" }}>EARLY WARNING SYSTEM</span>
            </h1>

            {/* Description */}
            <p
              style={{
                fontSize: 15,
                color: "#A4B7AC",
                lineHeight: 1.68,
                margin: 0,
                maxWidth: 540,
                animation: "kavachDescEntrance 0.75s cubic-bezier(0.22, 1, 0.36, 1) both",
                animationDelay: "0.72s",
                opacity: 0
              }}
            >
              Combining Artificial Intelligence, GPS and Geospatial Intelligence to enable faster wildlife monitoring and proactive human-wildlife conflict response across India's protected reserves.
            </p>

            {/* Stat row */}
            <div
              style={{
                display: "flex", gap: 24, flexWrap: "wrap",
                animation: "kavachHeroFadeIn 0.6s ease both",
                animationDelay: "0.9s", opacity: 0
              }}
            >
              {[
                { label: "Species Monitored", value: "15+" },
                { label: "Detection Accuracy", value: "AI-Grade" },
                { label: "Alert Channels", value: "FCM · WS · SMS" }
              ].map(s => (
                <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 16, fontWeight: 800, color: "#4CAF50" }}>{s.value}</span>
                  <span style={{ fontSize: 10, color: "#6A8070", letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div
              className="kavach-home-btn-row"
              style={{
                display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8,
                animation: "kavachBtnEntrance 0.7s cubic-bezier(0.22, 1, 0.36, 1) both",
                animationDelay: "1.05s", opacity: 0
              }}
            >
              <button
                id="btn-enter-command-center"
                onClick={onEnterCommandCenter}
                style={{
                  background: "linear-gradient(90deg, #1E5C38, #2E6B48)",
                  border: "1px solid #4CAF50",
                  color: "#FFFFFF",
                  padding: "14px 28px",
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 13,
                  fontFamily: "'Rajdhani', sans-serif",
                  letterSpacing: "0.07em",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  boxShadow: "0 4px 18px rgba(46,107,72,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
                  transition: "all 0.18s ease"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(90deg, #2E6B48, #4CAF50)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(76,175,80,0.5)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(90deg, #1E5C38, #2E6B48)"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(46,107,72,0.45), inset 0 1px 0 rgba(255,255,255,0.08)"; }}
              >
                <LayoutGrid size={15} />
                ENTER COMMAND CENTER
                <ArrowRight size={14} />
              </button>

              <button
                id="btn-explore-kavach"
                onClick={scrollToFeatures}
                style={{
                  background: "rgba(76,175,80,0.06)",
                  border: "1.5px solid rgba(76,175,80,0.35)",
                  color: "#81C784",
                  padding: "14px 28px",
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 13,
                  fontFamily: "'Rajdhani', sans-serif",
                  letterSpacing: "0.07em",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  transition: "all 0.18s ease"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(76,175,80,0.14)"; e.currentTarget.style.borderColor = "rgba(76,175,80,0.65)"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(76,175,80,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(76,175,80,0.06)"; e.currentTarget.style.borderColor = "rgba(76,175,80,0.35)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <ChevronDown size={15} />
                EXPLORE KAVACH
              </button>
            </div>
          </div>
        </div>

        {/* Bottom scroll hint */}
        <div style={{
          position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          animation: "pulse 2.5s ease-in-out infinite"
        }}>
          <ChevronDown size={16} color="rgba(76,175,80,0.45)" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          HOW KAVACH WORKS — 5 Pillars
          ═══════════════════════════════════════════════════════════════════════ */}
      <section style={{ marginBottom: 52 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#D6A84F", fontWeight: 700, letterSpacing: "0.12em", marginBottom: 6 }}>
            OPERATIONAL LIFECYCLE
          </div>
          <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 700, margin: 0, color: "#EEF4EE" }}>
            HOW KAVACH PREVENTS CONFLICT
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
          {[
            { step: "1", title: "DETECT",   desc: "Ultralytics YOLO computer vision identifies species and bounding boxes from camera traps and video.",                               icon: Eye,          color: "#4CAF50" },
            { step: "2", title: "LOCATE",   desc: "Automated GPS telemetry and spatial mapping plot wildlife locations on live GIS layers.",                                         icon: MapPin,       color: "#3A82EE" },
            { step: "3", title: "ANALYZE",  desc: "Multi-factor conflict risk engine calculates 0–100 scores based on habitation proximity and time.",                              icon: Cpu,          color: "#D6A84F" },
            { step: "4", title: "ALERT",    desc: "Real-time acoustic alarms and automated tickets notify rangers when high-risk predators approach settlement buffers.",            icon: Bell,         color: "#E54D4D" },
            { step: "5", title: "RESPOND",  desc: "Quick Response Teams (QRT) are dispatched with audit trails, incident dossiers, and field notes.",                              icon: CheckCircle2, color: "#9C27B0" }
          ].map(p => {
            const Icon = p.icon;
            return (
              <div
                key={p.step}
                className="kv-panel"
                style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, borderTop: `3px solid ${p.color}` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${p.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={17} color={p.color} />
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 800, color: p.color, opacity: 0.45 }}>
                    0{p.step}
                  </span>
                </div>
                <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 17, fontWeight: 700, color: "#EEF4EE", margin: 0 }}>{p.title}</h3>
                <p style={{ margin: 0, fontSize: 12, color: "#8FA396", lineHeight: 1.55 }}>{p.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          KAVACH CAPABILITIES — Feature Cards
          ═══════════════════════════════════════════════════════════════════════ */}
      <section ref={featuresRef} style={{ scrollMarginTop: 72, marginBottom: 52 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: "#D6A84F", fontWeight: 700, letterSpacing: "0.12em", marginBottom: 6 }}>
            PLATFORM CAPABILITIES
          </div>
          <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(22px, 3vw, 30px)", fontWeight: 700, margin: 0, color: "#EEF4EE" }}>
            KAVACH INTELLIGENCE MODULES
          </h2>
          <p style={{ fontSize: 13, color: "#6A8070", marginTop: 8 }}>
            Integrated tools across detection, mapping, alerting, and command
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="kv-panel"
                style={{
                  padding: "24px 22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  border: `1px solid rgba(${f.color === "#4CAF50" ? "76,175,80" : f.color === "#3A82EE" ? "58,130,238" : f.color === "#E54D4D" ? "229,77,77" : f.color === "#D6A84F" ? "214,168,79" : f.color === "#9C27B0" ? "156,39,176" : "38,198,218"},0.2)`,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  cursor: "default",
                  animationFillMode: "both"
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 28px rgba(0,0,0,0.4), 0 0 0 1px ${f.color}30`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 8,
                    background: `${f.color}14`,
                    border: `1px solid ${f.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <Icon size={20} color={f.color} />
                  </div>
                  <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 16, fontWeight: 700, color: "#EEF4EE", margin: 0, lineHeight: 1.2 }}>
                    {f.title}
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: 12.5, color: "#8FA396", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TARGET USERS
          ═══════════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="kv-panel" style={{ padding: "32px 28px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(20px, 2.8vw, 26px)", fontWeight: 700, color: "#EEF4EE", margin: "0 0 6px" }}>
              BUILT FOR GOVERNMENT &amp; FIELD INTELLIGENCE
            </h2>
            <div style={{ fontSize: 12, color: "#6A8070" }}>Tailored role-based interfaces for every echelon of wildlife management</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            {[
              { role: "Forest Department & DFOs",      detail: "District-level conflict heatmaps, executive analytics, and divisional oversight.",             color: "#4CAF50" },
              { role: "Wildlife Wardens & Range Officers", detail: "Incident dossiers, timeline progression, and team deployment protocols.",                  color: "#3A82EE" },
              { role: "Field Rangers & Beat Guards",   detail: "Outdoor high-contrast mobile layout with offline queue and GPS tagging.",                      color: "#D6A84F" },
              { role: "Emergency Response Teams (QRT)",detail: "Rapid siren alerts, distance-to-settlement telemetry, and live camera streams.",               color: "#E54D4D" }
            ].map(u => (
              <div key={u.role} style={{ background: "var(--panel-raised)", padding: 16, borderRadius: 6, border: "1px solid var(--line-soft)", borderLeft: `3px solid ${u.color}` }}>
                <strong style={{ color: "#EEF4EE", fontSize: 13 }}>{u.role}</strong>
                <p style={{ fontSize: 12, color: "#8FA396", marginTop: 6, lineHeight: 1.4, margin: "6px 0 0" }}>{u.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
