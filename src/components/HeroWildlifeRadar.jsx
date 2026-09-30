import React from "react";

export default function HeroWildlifeRadar() {
  return (
    <div className="hero-radar-container">
      <svg
        viewBox="0 0 500 500"
        className="hero-radar-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="KAVACH AI Wildlife Early Warning Radar Emblem"
      >
        <defs>
          {/* Green to Gold Gradients */}
          <linearGradient id="goldGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4F8A64" />
            <stop offset="50%" stopColor="#85B895" />
            <stop offset="100%" stopColor="#D6A84F" />
          </linearGradient>

          <linearGradient id="goldAccentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D6A84F" />
            <stop offset="50%" stopColor="#FFD580" />
            <stop offset="100%" stopColor="#C29339" />
          </linearGradient>

          <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3E8A5E" />
            <stop offset="100%" stopColor="#1E442F" />
          </linearGradient>

          <linearGradient id="radarSweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(214, 168, 79, 0.28)" />
            <stop offset="50%" stopColor="rgba(79, 138, 100, 0.12)" />
            <stop offset="100%" stopColor="rgba(10, 24, 17, 0)" />
          </linearGradient>

          <radialGradient id="shieldBgGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="rgba(28, 62, 44, 0.72)" />
            <stop offset="55%" stopColor="rgba(13, 30, 21, 0.88)" />
            <stop offset="100%" stopColor="rgba(6, 16, 11, 0.96)" />
          </radialGradient>

          <radialGradient id="centerAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(79, 138, 100, 0.35)" />
            <stop offset="65%" stopColor="rgba(214, 168, 79, 0.08)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Soft Glow Filter */}
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="intenseGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ============================================================== */}
        {/* 1. BACKGROUND GLOW & RADAR CONCENTRIC RINGS                    */}
        {/* ============================================================== */}
        {/* Ambient Center Aura */}
        <circle cx="250" cy="250" r="230" fill="url(#centerAura)" />

        {/* Outer Bearing Compass Ring (240px radius) */}
        <circle
          cx="250"
          cy="250"
          r="238"
          stroke="#1F3D2C"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          opacity="0.85"
        />
        <circle
          cx="250"
          cy="250"
          r="228"
          stroke="#2E6648"
          strokeWidth="1"
          opacity="0.45"
        />

        {/* Compass Cardinal Marks & Degree Indicators */}
        <line x1="250" y1="8" x2="250" y2="20" stroke="#D6A84F" strokeWidth="2.5" />
        <line x1="250" y1="480" x2="250" y2="492" stroke="#D6A84F" strokeWidth="2.5" />
        <line x1="8" y1="250" x2="20" y2="250" stroke="#D6A84F" strokeWidth="2.5" />
        <line x1="480" y1="250" x2="492" y2="250" stroke="#D6A84F" strokeWidth="2.5" />

        {/* Intermediate Compass Ticks */}
        <g stroke="#3A664D" strokeWidth="1" opacity="0.6">
          <line x1="82" y1="82" x2="90" y2="90" />
          <line x1="418" y1="82" x2="410" y2="90" />
          <line x1="82" y1="418" x2="90" y2="410" />
          <line x1="418" y1="418" x2="410" y2="410" />
          <line x1="250" y1="22" x2="250" y2="28" strokeDasharray="2 4" />
        </g>

        {/* Cardinal Bearing Labels */}
        <text x="250" y="32" textAnchor="middle" fill="#D6A84F" fontSize="10" fontFamily="'IBM Plex Mono', monospace" fontWeight="700" letterSpacing="2">000° N</text>
        <text x="465" y="253" textAnchor="middle" fill="#8FA396" fontSize="9" fontFamily="'IBM Plex Mono', monospace" fontWeight="600">090° E</text>
        <text x="250" y="475" textAnchor="middle" fill="#8FA396" fontSize="9" fontFamily="'IBM Plex Mono', monospace" fontWeight="600">180° S</text>
        <text x="35" y="253" textAnchor="middle" fill="#8FA396" fontSize="9" fontFamily="'IBM Plex Mono', monospace" fontWeight="600">270° W</text>

        {/* Concentric Geofence Telemetry Rings */}
        <circle cx="250" cy="250" r="185" stroke="#254D36" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
        <circle cx="250" cy="250" r="130" stroke="#1D3E2C" strokeWidth="1.2" opacity="0.5" />
        <circle cx="250" cy="250" r="75" stroke="#D6A84F" strokeWidth="1" strokeDasharray="2 4" opacity="0.4" />

        {/* Crosshair Grid Lines */}
        <line x1="40" y1="250" x2="460" y2="250" stroke="#1B3828" strokeWidth="1" strokeDasharray="6 8" opacity="0.4" />
        <line x1="250" y1="40" x2="250" y2="460" stroke="#1B3828" strokeWidth="1" strokeDasharray="6 8" opacity="0.4" />

        {/* ============================================================== */}
        {/* 2. ROTATING RADAR SWEEP ANIMATION                              */}
        {/* ============================================================== */}
        <g className="hero-radar-sweep-group">
          {/* Scanning Cone Wedge */}
          <path
            d="M250 250 L425 150 A200 200 0 0 0 350 75 Z"
            fill="url(#radarSweepGrad)"
          />
          {/* Leading Scanner Beam Line */}
          <line
            x1="250"
            y1="250"
            x2="425"
            y2="150"
            stroke="#D6A84F"
            strokeWidth="1.8"
            opacity="0.85"
            filter="url(#softGlow)"
          />
        </g>

        {/* Expanding Pulsing Ping Wave */}
        <circle cx="250" cy="250" r="50" className="hero-radar-ping" fill="none" stroke="#4CAF50" strokeWidth="1.5" />

        {/* ============================================================== */}
        {/* 3. TACTICAL FORTIFIED WILDLIFE SHIELD EMBLEM                   */}
        {/* ============================================================== */}
        {/* Shield Outer Aura Shadow */}
        <path
          d="M250 82 L368 122 V226 C368 322 308 398 250 426 C192 398 132 322 132 226 V122 Z"
          fill="none"
          stroke="rgba(79, 138, 100, 0.4)"
          strokeWidth="10"
          filter="url(#intenseGlow)"
          opacity="0.6"
        />

        {/* Shield Solid Backdrop */}
        <path
          d="M250 85 L365 125 V225 C365 320 306 395 250 422 C194 395 135 320 135 225 V125 Z"
          fill="url(#shieldBgGrad)"
          stroke="url(#goldGreenGrad)"
          strokeWidth="2.5"
          filter="url(#softGlow)"
        />

        {/* Shield Inner Inset Border */}
        <path
          d="M250 97 L352 133 V223 C352 307 300 376 250 402 C200 376 148 307 148 223 V133 Z"
          fill="none"
          stroke="#2A5C3D"
          strokeWidth="1.2"
          strokeDasharray="4 2"
          opacity="0.75"
        />

        {/* ============================================================== */}
        {/* 4. SILHOUETTE ART: FOREST, ELEPHANT & SATELLITE TELEMETRY      */}
        {/* ============================================================== */}
        {/* Top: Early Warning Radio Waves / Satellite Telemetry */}
        <g stroke="#D6A84F" strokeWidth="1.5" fill="none" opacity="0.9">
          {/* Signal Arcs above Pin */}
          <path d="M228 118 A28 28 0 0 1 272 118" strokeLinecap="round" />
          <path d="M218 108 A42 42 0 0 1 282 108" strokeLinecap="round" opacity="0.65" />
          <path d="M208 98 A56 56 0 0 1 292 98" strokeLinecap="round" opacity="0.35" strokeDasharray="3 3" />
          {/* Center GPS Target Pin */}
          <circle cx="250" cy="126" r="3.5" fill="#FFD580" filter="url(#softGlow)" />
          <line x1="250" y1="129.5" x2="250" y2="138" stroke="#D6A84F" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Background Mountain Contours inside shield */}
        <path
          d="M149 265 L180 230 L220 255 L260 215 L300 245 L330 220 L351 255"
          stroke="#2E6648"
          strokeWidth="1"
          strokeDasharray="2 3"
          fill="none"
          opacity="0.5"
        />

        {/* Stylized Forest Canopy & Pine Trees (Left & Right Flanks) */}
        {/* Left Forest Trees */}
        <path
          d="M152 290 L162 268 L170 285 L180 258 L190 282 L198 260 L208 290 Z"
          fill="rgba(24, 60, 40, 0.7)"
          stroke="#3E8A5E"
          strokeWidth="1"
        />
        {/* Right Forest Trees */}
        <path
          d="M292 290 L302 262 L312 284 L322 256 L332 282 L340 268 L348 290 Z"
          fill="rgba(24, 60, 40, 0.7)"
          stroke="#3E8A5E"
          strokeWidth="1"
        />

        {/* Centerpiece: Noble Elephant Line-Art Silhouette */}
        <g className="hero-elephant-art" filter="url(#softGlow)">
          {/* Main Elephant Body Outline with Gold/Emerald Gradient */}
          <path
            d="M 210 270 
               C 210 240, 222 215, 245 208
               C 260 204, 280 205, 292 218
               C 298 224, 302 234, 305 248
               C 310 270, 314 278, 320 282
               C 324 285, 324 290, 318 292
               C 312 294, 308 288, 304 274
               C 300 258, 296 252, 290 252
               C 285 252, 284 262, 285 285
               L 285 320 L 274 320 L 273 288
               C 272 278, 268 274, 262 274
               C 256 274, 253 278, 252 288
               L 250 320 L 239 320 L 241 285
               C 241 275, 238 272, 232 272
               C 226 272, 224 276, 223 285
               L 221 320 L 210 320 L 211 282
               C 207 282, 206 280, 206 274
               Z"
            fill="rgba(234, 242, 236, 0.08)"
            stroke="url(#goldGreenGrad)"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* Elephant Ear Outline */}
          <path
            d="M 252 216 
               C 242 220, 234 232, 235 248 
               C 236 260, 244 268, 254 264 
               C 258 262, 260 252, 259 242 
               C 258 230, 256 220, 252 216 Z"
            fill="rgba(214, 168, 79, 0.15)"
            stroke="#D6A84F"
            strokeWidth="1.4"
            opacity="0.9"
          />

          {/* Curved Tusk in Bright Gold */}
          <path
            d="M 292 260 C 298 264, 304 266, 309 262 C 306 266, 298 270, 290 266 Z"
            fill="#FFD580"
            stroke="#FFD580"
            strokeWidth="1"
          />

          {/* Elephant Eye Accent Point */}
          <circle cx="266" cy="230" r="1.8" fill="#FFD580" />
        </g>

        {/* Conservation Leaf Emblem Accent (Bottom Center of Shield) */}
        <g transform="translate(250, 360)">
          {/* Stylized Bio-Shield Leaf Path */}
          <path
            d="M 0 -24 
               C 14 -16, 20 -2, 16 12 
               C 12 24, 0 28, 0 28 
               C 0 28, -12 24, -16 12 
               C -20 -2, -14 -16, 0 -24 Z"
            fill="rgba(46, 107, 72, 0.45)"
            stroke="url(#goldGreenGrad)"
            strokeWidth="1.8"
          />
          {/* Leaf Central Vein */}
          <line x1="0" y1="-20" x2="0" y2="24" stroke="#FFD580" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M 0 -8 Q 6 -4 10 -6" stroke="#85B895" strokeWidth="1" fill="none" />
          <path d="M 0 0 Q -6 4 -10 2" stroke="#85B895" strokeWidth="1" fill="none" />
          <path d="M 0 8 Q 6 12 9 10" stroke="#85B895" strokeWidth="1" fill="none" />
        </g>

        {/* ============================================================== */}
        {/* 5. TACTICAL HUD OVERLAYS & CORNER BRACKETS                     */}
        {/* ============================================================== */}
        {/* Outer Viewport Corner Reticles */}
        <g stroke="#D6A84F" strokeWidth="1.8" fill="none" opacity="0.85">
          {/* Top-Left Reticle */}
          <path d="M 16 36 L 16 16 L 36 16" />
          {/* Top-Right Reticle */}
          <path d="M 464 16 L 484 16 L 484 36" />
          {/* Bottom-Left Reticle */}
          <path d="M 16 464 L 16 484 L 36 484" />
          {/* Bottom-Right Reticle */}
          <path d="M 464 484 L 484 484 L 484 464" />
        </g>

        {/* HUD Telemetry Labels */}
        <g fontFamily="'IBM Plex Mono', monospace" fontSize="8.5" fontWeight="600" opacity="0.75">
          <text x="38" y="475" fill="#8FA396" letterSpacing="0.5">SEC-BUFFER // 500M</text>
          <text x="460" y="475" textAnchor="end" fill="#8FA396" letterSpacing="0.5">SYS-STATUS: OPTIMAL</text>
        </g>

        {/* Tactical Status Pill Badge (Floating at Top Center of Emblem) */}
        <g transform="translate(250, 48)">
          <rect
            x="-75"
            y="-11"
            width="150"
            height="22"
            rx="11"
            fill="rgba(10, 24, 17, 0.92)"
            stroke="#2E6648"
            strokeWidth="1.2"
          />
          <circle cx="-56" cy="0" r="3.5" fill="#4CAF50" className="hero-status-dot" />
          <text
            x="-44"
            y="3.5"
            fill="#EEF4EE"
            fontSize="9"
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight="700"
            letterSpacing="0.08em"
          >
            AI DETECTION RADAR
          </text>
        </g>
      </svg>

      {/* Scoped CSS Animations and Responsive Styling */}
      <style>{`
        .hero-radar-container {
          position: relative;
          display: flex;
          align-items: center;
          justifyContent: center;
          width: 100%;
          max-width: 440px;
          min-width: 280px;
          aspect-ratio: 1 / 1;
          margin: 0 auto;
          animation: heroEmblemFadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          user-select: none;
        }

        .hero-radar-svg {
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 12px 32px rgba(0, 0, 0, 0.65));
        }

        /* 360-Degree Continuous Radar Sweep */
        .hero-radar-sweep-group {
          transform-origin: 250px 250px;
          animation: heroRadarRotate 8s linear infinite;
        }

        /* Expanding Geofence Radar Wave */
        .hero-radar-ping {
          animation: heroRadarPing 3.5s ease-out infinite;
        }

        /* Blinking Status Indicator */
        .hero-status-dot {
          animation: heroDotPulse 2s ease-in-out infinite;
        }

        /* Subtle Elephant Glow Breathing */
        .hero-elephant-art {
          animation: heroElephantBreathe 4s ease-in-out infinite alternate;
        }

        @keyframes heroEmblemFadeIn {
          from {
            opacity: 0;
            transform: scale(0.94) translateY(8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes heroRadarRotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes heroRadarPing {
          0% {
            r: 60px;
            opacity: 0.85;
            stroke: #4CAF50;
          }
          70% {
            opacity: 0.35;
            stroke: #D6A84F;
          }
          100% {
            r: 236px;
            opacity: 0;
            stroke: #D6A84F;
          }
        }

        @keyframes heroDotPulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(0.85);
          }
        }

        @keyframes heroElephantBreathe {
          0% {
            filter: drop-shadow(0 0 4px rgba(79, 138, 100, 0.3));
          }
          100% {
            filter: drop-shadow(0 0 14px rgba(214, 168, 79, 0.65));
          }
        }

        @media (max-width: 900px) {
          .hero-radar-container {
            max-width: 320px;
            margin-top: 16px;
          }
        }

        @media (max-width: 600px) {
          .hero-radar-container {
            max-width: 270px;
          }
        }
      `}</style>
    </div>
  );
}
