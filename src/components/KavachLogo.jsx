import React, { useState } from "react";

export default function KavachLogo({
  size = "default",
  compact = false,
  showTagline = true,
  showFullTitle = true,
  style = {}
}) {
  const [imageError, setImageError] = useState(false);
  const isSmall = size === "small";
  const isLarge = size === "large";

  // Dimensioning: maintain clean, sharp 1:1 aspect ratio
  const iconSize = isLarge ? 72 : isSmall ? 36 : compact ? 40 : 48;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSmall ? 8 : 12,
        userSelect: "none",
        /* Prevent any inherited CSS animations from moving the logo */
        animation: "none",
        transform: "none",
        ...style
      }}
      className="kavach-brand-container"
    >
      {/* KAVACH Emblem Container — must stay perfectly static */}
      <div
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: 8,
          background: "linear-gradient(135deg, rgba(24, 56, 40, 0.9) 0%, rgba(13, 34, 23, 0.95) 60%, rgba(8, 21, 15, 1) 100%)",
          border: "1.5px solid #2E6648",
          boxShadow: "0 0 16px rgba(46, 102, 72, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          flexShrink: 0,
          overflow: "hidden",
          padding: 2,
          /* Explicit static positioning — no float, no drift */
          animation: "none",
          transform: "none",
          transition: "none"
        }}
      >
        {!imageError ? (
          <img
            src="/kavach-logo.png"
            alt="KAVACH Official Logo"
            onError={() => setImageError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              borderRadius: 6,
              display: "block",
              /* Lock image: no animation, no transform, perfectly centered */
              animation: "none",
              transform: "none",
              transition: "none",
              position: "relative",
              margin: "auto"
            }}
          />
        ) : (
          /* Tactical Fallback Emblem */
          <svg
            width={iconSize * 0.72}
            height={iconSize * 0.72}
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M24 4L8 10V22C8 32.5 14.8 42.2 24 44C33.2 42.2 40 32.5 40 22V10L24 4Z"
              stroke="#4F8A64"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="rgba(31, 69, 49, 0.3)"
            />
            <circle cx="24" cy="23" r="11" stroke="#D6A84F" strokeWidth="1.5" strokeDasharray="3 2" />
            <line x1="24" y1="9" x2="24" y2="13" stroke="#D6A84F" strokeWidth="2" strokeLinecap="round" />
            <line x1="24" y1="33" x2="24" y2="37" stroke="#D6A84F" strokeWidth="2" strokeLinecap="round" />
            <line x1="10" y1="23" x2="14" y2="23" stroke="#D6A84F" strokeWidth="2" strokeLinecap="round" />
            <line x1="34" y1="23" x2="38" y2="23" stroke="#D6A84F" strokeWidth="2" strokeLinecap="round" />
            <path
              d="M17 19L19 23L22 22L24 25L26 22L29 23L31 19C29 17 26 16 24 16C22 16 19 17 17 19Z"
              fill="#EAF2EC"
            />
            <path
              d="M20 25C20 28 22 30 24 30C26 30 28 28 28 25L24 27L20 25Z"
              fill="#D6A84F"
            />
            <circle cx="24" cy="23" r="1.5" fill="#4F8A64" />
          </svg>
        )}

        {/* Tactical Corner Reticles */}
        <div style={{ position: "absolute", top: 1, left: 1, width: 3, height: 3, borderTop: "1px solid #D6A84F", borderLeft: "1px solid #D6A84F" }} />
        <div style={{ position: "absolute", bottom: 1, right: 1, width: 3, height: 3, borderBottom: "1px solid #D6A84F", borderRight: "1px solid #D6A84F" }} />
      </div>

      {/* Brand Typography & Full Title */}
      {!compact && (
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, justifyContent: "center" }}>
          {/* Main Title Row */}
          <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 6, lineHeight: 1.1 }}>
            <span
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 800,
                fontSize: isLarge ? 28 : isSmall ? 18 : 22,
                letterSpacing: "0.12em",
                color: "#EEF4EE",
                textShadow: "0 0 14px rgba(79, 138, 100, 0.45)",
                display: "inline-block"
              }}
            >
              KAVACH
            </span>

            {showFullTitle && (
              <span
                className="kavach-full-title-desktop"
                style={{
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: isLarge ? 16 : isSmall ? 12 : 13.5,
                  letterSpacing: "0.06em",
                  color: "#A4B7AC",
                  textTransform: "uppercase"
                }}
              >
                – AI-POWERED WILDLIFE DETECTION & EARLY WARNING SYSTEM
              </span>
            )}

            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9,
                fontWeight: 700,
                color: "#D6A84F",
                background: "rgba(214, 168, 79, 0.15)",
                border: "1px solid rgba(214, 168, 79, 0.35)",
                padding: "1px 5px",
                borderRadius: 3,
                letterSpacing: "0.08em",
                alignSelf: "center"
              }}
              className="kavach-badge-tag"
            >
              v2.0 PRO
            </span>
          </div>

          {/* Subtitle / Tagline */}
          {showTagline && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 2
              }}
            >
              <span
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: isLarge ? 11 : 9.5,
                  color: "#8FA396",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap"
                }}
                className="kavach-tagline-text"
              >
                TRACK • ALERT • COEXIST | REDUCING HUMAN-WILDLIFE CONFLICT
              </span>
            </div>
          )}
        </div>
      )}

      {/* Responsive Styles for Logo Component */}
      <style>{`
        /* ── LOGO STABILITY FIX ──────────────────────────────── */
        /* Ensure the KAVACH brand logo container and its icon   */
        /* are always perfectly static. No float, jump, rotate,  */
        /* or drift. Any accidental CSS animations are cancelled. */
        .kavach-brand-container,
        .kavach-brand-container > div,
        .kavach-brand-container img,
        .kavach-brand-container svg {
          animation: none !important;
          transform: none !important;
          will-change: auto !important;
        }
        /* ── END LOGO STABILITY FIX ─────────────────────────── */

        @media (max-width: 1200px) {
          .kavach-full-title-desktop {
            font-size: 12px !important;
          }
          .kavach-tagline-text {
            font-size: 8.5px !important;
          }
        }
        @media (max-width: 900px) {
          .kavach-full-title-desktop {
            display: none !important;
          }
          .kavach-tagline-text {
            font-size: 8.5px !important;
          }
        }
        @media (max-width: 600px) {
          .kavach-tagline-text {
            display: none !important;
          }
          .kavach-badge-tag {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
