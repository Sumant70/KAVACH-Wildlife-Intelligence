import React from "react";
import {
  ShieldAlert, Camera, MapPin, Activity, ArrowRight, Play, CheckCircle2,
  Layers, Radio, Bell, Eye, Compass, Cpu, Database
} from "lucide-react";
import KavachLogo from "../components/KavachLogo";

// NOTE: HeroWildlifeRadar is kept as backup but replaced with the provided
// hero image in the right column per user requirement.

export default function LandingPageView({ onEnterCommandCenter, onStartDetection }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 60, paddingBottom: 60 }}>

      {/* ============================================================ */}
      {/* HERO SECTION — provided image used as right-column visual    */}
      {/* ============================================================ */}
      <div
        className="kavach-hero-banner"
        style={{
          position: "relative",
          borderRadius: 12,
          padding: "54px 36px",
          background: "radial-gradient(circle at 80% 20%, rgba(46, 107, 72, 0.4) 0%, rgba(13, 26, 19, 0.96) 50%, #08110D 100%)",
          border: "1.5px solid #28543C",
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.6)"
        }}
      >
        <div
          className="kavach-hero-flex"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 40,
            position: "relative",
            zIndex: 2
          }}
        >
          {/* Left Text & Actions Column (~60-65% width) */}
          <div style={{ flex: "1 1 520px", maxWidth: 680, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(214, 168, 79, 0.15)", border: "1px solid rgba(214, 168, 79, 0.4)", padding: "4px 12px", borderRadius: 4, width: "fit-content" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#D6A84F", animation: "pulse 1.5s infinite" }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700, color: "#FFD580", letterSpacing: "0.08em" }}>
                SIH NATIONAL INTELLIGENCE PLATFORM
              </span>
            </div>

            <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(34px, 5vw, 52px)", fontWeight: 800, color: "#EEF4EE", lineHeight: 1.1, margin: 0, letterSpacing: "0.02em" }}>
              KAVACH – AI-POWERED WILDLIFE DETECTION &amp; EARLY WARNING SYSTEM
            </h1>

            <p style={{ fontSize: 16, color: "#A4B7AC", lineHeight: 1.6, margin: 0 }}>
              Combining Artificial Intelligence, GPS and Geospatial Intelligence to enable faster wildlife monitoring and proactive human-wildlife conflict response across India's protected reserves.
            </p>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
              {/* OPEN COMMAND CENTER — navigates to command dashboard */}
              <button
                id="btn-open-command-center"
                onClick={onEnterCommandCenter}
                style={{
                  background: "linear-gradient(90deg, #2E6B48, #3E8A5E)",
                  border: "1px solid #4CAF50",
                  color: "#FFFFFF",
                  padding: "14px 26px",
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: "'Rajdhani', sans-serif",
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 4px 16px rgba(46, 107, 72, 0.4)",
                  transition: "all 0.18s ease"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(90deg, #3E8A5E, #4CAF50)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(76, 175, 80, 0.5)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(90deg, #2E6B48, #3E8A5E)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(46, 107, 72, 0.4)"; }}
              >
                <span>OPEN COMMAND CENTER</span>
                <ArrowRight size={16} />
              </button>

              {/* START AI DETECTION — navigates to existing AnimalDetectionView */}
              <button
                id="btn-start-ai-detection"
                onClick={onStartDetection}
                style={{
                  background: "rgba(214, 168, 79, 0.12)",
                  border: "1.5px solid #D6A84F",
                  color: "#FFD580",
                  padding: "14px 26px",
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: "'Rajdhani', sans-serif",
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  transition: "all 0.18s ease"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(214, 168, 79, 0.22)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(214, 168, 79, 0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(214, 168, 79, 0.12)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <Camera size={16} />
                <span>START AI DETECTION</span>
              </button>
            </div>
          </div>

          {/* Right Visual Column — Hero Banner Image */}
          <div
            className="kavach-hero-visual-col"
            style={{
              flex: "0 0 420px",
              maxWidth: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative"
            }}
          >
            {/* Hero provided image — shown as the visual emblem on the right */}
            <div
              className="kavach-hero-img-wrap"
              style={{
                width: "100%",
                maxWidth: 420,
                aspectRatio: "1 / 1",
                borderRadius: 12,
                overflow: "hidden",
                position: "relative",
                border: "1.5px solid rgba(46, 107, 72, 0.6)",
                boxShadow: "0 8px 40px rgba(0,0,0,0.55), 0 0 60px rgba(46, 107, 72, 0.18)"
              }}
            >
              <img
                src="/kavach-hero-banner.jpg"
                alt="KAVACH AI Wildlife Detection Shield Emblem"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "right center",
                  display: "block",
                  borderRadius: 10
                }}
              />
              {/* Subtle tactical overlay vignette */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(135deg, rgba(7,14,10,0.25) 0%, transparent 60%)",
                  borderRadius: 10,
                  pointerEvents: "none"
                }}
              />
              {/* HUD Corner Brackets */}
              <div style={{ position: "absolute", top: 10, right: 10, borderTop: "2px solid #D6A84F", borderRight: "2px solid #D6A84F", width: 18, height: 18, pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: 10, left: 10, borderBottom: "2px solid #2E6B48", borderLeft: "2px solid #2E6B48", width: 18, height: 18, pointerEvents: "none" }} />
              {/* Live badge */}
              <div style={{
                position: "absolute",
                top: 12,
                left: 12,
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "rgba(7, 14, 10, 0.88)",
                border: "1px solid #2E6648",
                borderRadius: 4,
                padding: "3px 8px",
                pointerEvents: "none"
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF50", animation: "pulse 1.5s infinite" }} />
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, fontWeight: 700, color: "#EEF4EE", letterSpacing: "0.08em" }}>
                  AI DETECTION RADAR
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tactical HUD Corner Marks on banner border */}
        <div style={{ position: "absolute", top: 12, right: 12, borderTop: "2px solid #D6A84F", borderRight: "2px solid #D6A84F", width: 18, height: 18, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 12, left: 12, borderBottom: "2px solid #2E6B48", borderLeft: "2px solid #2E6B48", width: 18, height: 18, pointerEvents: "none" }} />

        {/* Responsive Layout Styles for Hero Section */}
        <style>{`
          @media (max-width: 1100px) {
            .kavach-hero-flex {
              gap: 24px !important;
            }
            .kavach-hero-visual-col {
              flex: 0 0 350px !important;
              width: 350px !important;
            }
          }
          @media (max-width: 900px) {
            .kavach-hero-flex {
              flex-direction: column !important;
              align-items: center !important;
              gap: 32px !important;
            }
            .kavach-hero-banner {
              padding: 40px 24px !important;
            }
            .kavach-hero-visual-col {
              flex: 0 0 300px !important;
              width: 300px !important;
              margin-top: 8px;
            }
          }
          @media (max-width: 600px) {
            .kavach-hero-banner {
              padding: 32px 18px !important;
            }
            .kavach-hero-visual-col {
              flex: 0 0 260px !important;
              width: 260px !important;
            }
          }

          /* ──────────────────────────────────────────────────────── */
          /* LOGO FIX: Prevent any accidental floating / drifting    */
          /* on the KAVACH logo in the header.                       */
          /* The heroEmblemFadeIn animation only runs once (forwards)*/
          /* on the hero image — NOT on the logo element.            */
          /* ──────────────────────────────────────────────────────── */
          .kavach-brand-container {
            animation: none !important;
            transform: none !important;
          }
          .kavach-brand-container * {
            /* Only allow explicit animations that are set inside the
               logo component itself (none currently) */
          }
        `}</style>
      </div>

      {/* How KAVACH Works (5 Pillars) — UNCHANGED */}
      <div>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#D6A84F", fontWeight: 700 }}>
            OPERATIONAL LIFECYCLE
          </div>
          <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 32, fontWeight: 700, margin: "6px 0 0", color: "#EEF4EE" }}>
            HOW KAVACH PREVENTS CONFLICT
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[
            { step: "1", title: "DETECT", desc: "Ultralytics YOLO computer vision identifies species and bounding boxes from camera traps and video.", icon: Eye, color: "#4CAF50" },
            { step: "2", title: "LOCATE", desc: "Automated GPS telemetry and spatial mapping plot wildlife locations on live GIS layers.", icon: MapPin, color: "#3A82EE" },
            { step: "3", title: "ANALYZE", desc: "Multi-factor conflict risk engine calculates 0-100 scores based on habitation proximity and time.", icon: Cpu, color: "#D6A84F" },
            { step: "4", title: "ALERT", desc: "Real-time acoustic alarms and automated tickets notify rangers when high-risk predators approach buffers.", icon: Bell, color: "#E54D4D" },
            { step: "5", title: "RESPOND", desc: "Quick Response Teams (QRT) are dispatched with audit trails, incident dossiers, and field notes.", icon: CheckCircle2, color: "#9C27B0" }
          ].map(p => {
            const Icon = p.icon;
            return (
              <div
                key={p.step}
                className="kv-panel"
                style={{
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  borderTop: `3px solid ${p.color}`
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${p.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={18} color={p.color} />
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 800, color: p.color }}>
                    0{p.step}
                  </span>
                </div>
                <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, color: "#EEF4EE", margin: 0 }}>
                  {p.title}
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: "#A4B7AC", lineHeight: 1.5 }}>
                  {p.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Target User Groups — UNCHANGED */}
      <div className="kv-panel" style={{ padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 26, fontWeight: 700, color: "#EEF4EE", margin: 0 }}>
            BUILT FOR GOVERNMENT &amp; FIELD INTELLIGENCE
          </h2>
          <div style={{ fontSize: 13, color: "#8FA396", marginTop: 4 }}>
            Tailored role-based interfaces for every echelon of wildlife management
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {[
            { role: "Forest Department & DFOs", detail: "District-level conflict heatmaps, executive analytics, and divisional oversight." },
            { role: "Wildlife Wardens & Range Officers", detail: "Incident dossiers, timeline progression, and team deployment protocols." },
            { role: "Field Rangers & Beat Guards", detail: "Outdoor high-contrast mobile layout with offline queue and GPS tagging." },
            { role: "Emergency Response Teams (QRT)", detail: "Rapid siren alerts, distance-to-settlement telemetry, and live camera streams." }
          ].map(u => (
            <div key={u.role} style={{ background: "var(--panel-raised)", padding: 16, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
              <strong style={{ color: "#EEF4EE", fontSize: 14 }}>{u.role}</strong>
              <p style={{ fontSize: 12, color: "#8FA396", marginTop: 6, lineHeight: 1.4, margin: "6px 0 0" }}>
                {u.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
