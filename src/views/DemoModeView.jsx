import React, { useState, useEffect } from "react";
import {
  Play, CheckCircle2, RefreshCw, ShieldAlert, Camera, MapPin,
  Bell, Activity, ArrowRight, X, Radio
} from "lucide-react";
import { SAMPLE_WILDLIFE_CASES } from "../assets/sample_animals";
import { playRadarPing, playEmergencyAlarm, playSuccessChime } from "../components/AudioAlerts";

export default function DemoModeView({
  apiBaseUrl,
  userGps,
  onDemoCompleted,
  onNavigate
}) {
  const [selectedCase, setSelectedCase] = useState(SAMPLE_WILDLIFE_CASES[0]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [demoResult, setDemoResult] = useState(null);
  const [isFinished, setIsFinished] = useState(false);

  const STEPS = [
    { title: "SELECTING CAMERA-TRAP IMAGE", desc: "Loading high-resolution field imagery" },
    { title: "EXECUTING YOLO AI DETECTION", desc: "Localizing animal & computing bounding box" },
    { title: "ACQUIRING GPS COORDINATES", desc: "Locking field latitude/longitude telemetry" },
    { title: "EVALUATING MULTI-FACTOR RISK", desc: "Synthesizing nocturnal, proximity & threat weights" },
    { title: "CHECKING GEOFENCE BOUNDARIES", desc: "Testing point-in-polygon buffer perimeter" },
    { title: "GENERATING EARLY-WARNING ALERT", desc: "Broadcasting emergency alert & dispatch ticket" },
    { title: "UPDATING GIS MAP & ANALYTICS", desc: "Synchronizing command center intelligence feed" }
  ];

  const runFullDemo = async () => {
    setIsRunning(true);
    setIsFinished(false);
    setCurrentStep(0);
    setDemoResult(null);

    // Step 1: Select image
    await new Promise(r => setTimeout(r, 700));
    setCurrentStep(1);

    // Step 2: Run real YOLO detection via backend
    try {
      const resp = await fetch(selectedCase.imageUrl);
      const blob = await resp.blob();
      const file = new File([blob], `${selectedCase.species.toLowerCase()}.jpg`, { type: "image/jpeg" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("lat", selectedCase.lat.toString());
      formData.append("lng", selectedCase.lng.toString());
      formData.append("zone_id", selectedCase.zoneId);

      const detResp = await fetch(`${apiBaseUrl}/api/detect/image`, {
        method: "POST",
        body: formData
      });

      const data = await detResp.json();
      setDemoResult(data);
      playRadarPing();

      await new Promise(r => setTimeout(r, 800));
      setCurrentStep(2); // GPS

      await new Promise(r => setTimeout(r, 800));
      setCurrentStep(3); // Risk

      await new Promise(r => setTimeout(r, 800));
      setCurrentStep(4); // Geofence

      await new Promise(r => setTimeout(r, 800));
      setCurrentStep(5); // Alert
      playEmergencyAlarm();

      await new Promise(r => setTimeout(r, 800));
      setCurrentStep(6); // Final sync
      playSuccessChime();

      setIsFinished(true);
      onDemoCompleted?.(data);
    } catch (err) {
      console.error("Demo failed:", err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div
        className="kv-panel"
        style={{
          padding: "20px 24px",
          background: "linear-gradient(135deg, #203A2B 0%, #112017 100%)",
          border: "2px solid #D6A84F"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#D6A84F", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, fontWeight: 700 }}>
          <Play size={14} /> SMART INDIA HACKATHON · END-TO-END DEMONSTRATION MODE
        </div>
        <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 26, fontWeight: 800, margin: "6px 0 2px", color: "#EEF4EE" }}>
          KAVACH 1-CLICK VERIFICATION WORKFLOW
        </h1>
        <div style={{ fontSize: 12.5, color: "#A4B7AC" }}>
          Demonstrates the complete operational lifecycle: Image Ingestion → AI Detection → GPS Plotting → Risk Engine → Geofence Breach → Alert Generation → Incident Dispatch.
        </div>
      </div>

      {/* Preset Selector */}
      <div className="kv-panel" style={{ padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 10 }}>
          SELECT DEMO CASE TARGET:
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          {SAMPLE_WILDLIFE_CASES.map(c => (
            <div
              key={c.id}
              onClick={() => !isRunning && setSelectedCase(c)}
              style={{
                border: `1.5px solid ${selectedCase.id === c.id ? "#D6A84F" : "var(--line-soft)"}`,
                background: selectedCase.id === c.id ? "var(--panel-hi)" : "var(--panel-raised)",
                borderRadius: 6,
                padding: 10,
                cursor: isRunning ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12
              }}
            >
              <img src={c.imageUrl} alt={c.species} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#EEF4EE" }}>{c.species}</div>
                <div style={{ fontSize: 11, color: "#D6A84F" }}>{c.expectedRisk} RISK</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            onClick={runFullDemo}
            disabled={isRunning}
            style={{
              width: "100%",
              background: isRunning ? "#1E3D2A" : "linear-gradient(90deg, #2E6B48, #D6A84F)",
              border: "none",
              color: "#FFFFFF",
              padding: "14px 20px",
              borderRadius: 6,
              fontWeight: 800,
              fontSize: 15,
              fontFamily: "'Rajdhani', sans-serif",
              letterSpacing: "0.08em",
              cursor: isRunning ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 4px 16px rgba(46, 107, 72, 0.4)"
            }}
          >
            {isRunning ? (
              <>
                <RefreshCw size={18} style={{ animation: "spin 1s linear infinite" }} />
                <span>EXECUTING LIVE DEMO PIPELINE...</span>
              </>
            ) : (
              <>
                <Play size={18} />
                <span>START FULL AUTOMATED DEMO NOW</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Progress Pipeline Stepper */}
      <div className="kv-panel" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 14 }}>
          SYSTEM PIPELINE EXECUTION PROGRESS:
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {STEPS.map((st, i) => {
            const isDone = i < currentStep;
            const isCurrent = i === currentStep && isRunning;

            return (
              <div
                key={st.title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 12px",
                  borderRadius: 4,
                  background: isCurrent ? "rgba(214, 168, 79, 0.12)" : isDone ? "rgba(76, 175, 80, 0.08)" : "transparent",
                  border: `1px solid ${isCurrent ? "#D6A84F" : isDone ? "#37734E" : "transparent"}`
                }}
              >
                {isDone ? (
                  <CheckCircle2 size={16} color="#4CAF50" style={{ flexShrink: 0 }} />
                ) : isCurrent ? (
                  <RefreshCw size={16} color="#D6A84F" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: "1.5px solid #234634", flexShrink: 0 }} />
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: isDone ? "#4CAF50" : isCurrent ? "#D6A84F" : "#7A9183" }}>
                    {st.title}
                  </div>
                  <div style={{ fontSize: 11, color: "#8FA396" }}>{st.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Demo Outcome Results Card */}
      {demoResult && (
        <div className="kv-panel" style={{ padding: 20, borderLeft: "5px solid #D6A84F" }}>
          <h3 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, color: "#EEF4EE", margin: "0 0 10px" }}>
            DEMO RESULTS: {demoResult.species.toUpperCase()} IDENTIFIED
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, fontSize: 12 }}>
            <div style={{ background: "var(--panel-raised)", padding: 8, borderRadius: 4 }}>
              <span style={{ color: "#8FA396" }}>AI CONFIDENCE: </span>
              <strong style={{ color: "#D6A84F" }}>{demoResult.confidence}%</strong>
            </div>
            <div style={{ background: "var(--panel-raised)", padding: 8, borderRadius: 4 }}>
              <span style={{ color: "#8FA396" }}>CONFLICT RISK: </span>
              <strong style={{ color: demoResult.risk?.risk_level === "CRITICAL" ? "#E54D4D" : "#D99A32" }}>
                {demoResult.risk?.risk_level} ({demoResult.risk?.risk_score}/100)
              </strong>
            </div>
            <div style={{ background: "var(--panel-raised)", padding: 8, borderRadius: 4 }}>
              <span style={{ color: "#8FA396" }}>ALERT ID: </span>
              <strong style={{ color: "#EEF4EE" }}>{demoResult.alert_id || "ALT-GENERATED"}</strong>
            </div>
            <div style={{ background: "var(--panel-raised)", padding: 8, borderRadius: 4 }}>
              <span style={{ color: "#8FA396" }}>GEOFENCE BREACH: </span>
              <strong style={{ color: demoResult.geofence?.has_breach ? "#E54D4D" : "#4CAF50" }}>
                {demoResult.geofence?.has_breach ? "YES (Residential Buffer)" : "NO"}
              </strong>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <button
              onClick={() => onNavigate("command")}
              style={{
                flex: 1,
                background: "#2E6B48",
                border: "1px solid #4CAF50",
                color: "#FFFFFF",
                padding: "10px 16px",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6
              }}
            >
              <span>Return to Command Center</span>
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => onNavigate("gis", { lat: demoResult.lat, lng: demoResult.lng })}
              style={{
                flex: 1,
                background: "#1A3728",
                border: "1px solid #36664D",
                color: "#D2E8DA",
                padding: "10px 16px",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6
              }}
            >
              <span>Inspect on GIS Map</span>
              <MapPin size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
