import React from "react";
import {
  Layers, Cpu, Camera, MapPin, ShieldAlert, Radio, Database,
  ArrowDown, CheckCircle2, Server, GitBranch, Bell, Users
} from "lucide-react";

export default function SystemArchitectureView() {
  const PIPELINE_STAGES = [
    {
      id: "1. DATA ACQUISITION & SENSING",
      icon: Camera,
      color: "#4CAF50",
      title: "Multi-Source Sensor Ingestion",
      desc: "Ingests imagery from stationary trail cameras, drone sweeps, CCTV feeds, IP sensors, and ranger mobile uploads with automatic timestamping and GPS tagging."
    },
    {
      id: "2. COMPUTER VISION INFERENCE",
      icon: Cpu,
      color: "#D6A84F",
      title: "YOLO Species Detection & Localization",
      desc: "Ultralytics deep learning model evaluates frames, isolates bounding boxes, maps species (Tiger, Leopard, Elephant, Bear, Boar, Deer), and computes prediction confidence scores."
    },
    {
      id: "3. RISK INTELLIGENCE ENGINE",
      icon: ShieldAlert,
      color: "#E54D4D",
      title: "Multi-Factor Conflict Assessment",
      desc: "Synthesizes species threat weights, human habitation proximity (meters), nocturnal temporal windows, historical conflict recurrence, and animal group sizes into an audited 0–100 risk score."
    },
    {
      id: "4. GEOSPATIAL & GEOFENCING ENGINE",
      icon: MapPin,
      color: "#3A82EE",
      title: "Spatial Point-in-Polygon & Buffer Enforcement",
      desc: "Validates GPS coordinates against active residential buffer perimeters and sanctuary corridors. Applies penalty multipliers for geofence breaches."
    },
    {
      id: "5. ESCALATION & RAPID DISPATCH",
      icon: Bell,
      color: "#E55C5C",
      title: "Real-Time Early Warning & Response",
      desc: "Automatically generates high-priority emergency alerts and incident tickets. Pushes audio siren notifications, SMS advisories, and dispatches Forest Quick Response Teams (QRT)."
    },
    {
      id: "6. INCIDENT LIFECYCLE & ANALYTICS",
      icon: Database,
      color: "#9C27B0",
      title: "Audit Logging & Executive Dashboard",
      desc: "Persists records to SQLite/PostGIS database. Tracks 5-stage lifecycle (Detection → Alert → Acknowledgment → Dispatch → Resolution) and outputs conflict density analytics."
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div className="kv-panel" style={{ padding: "18px 24px" }}>
        <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 24, fontWeight: 700, margin: 0, color: "#EEF4EE", display: "flex", alignItems: "center", gap: 8 }}>
          <Layers size={22} color="#D6A84F" />
          KAVACH SYSTEM ARCHITECTURE & INTELLIGENCE PIPELINE
        </h1>
        <div style={{ fontSize: 13, color: "#8FA396", marginTop: 4 }}>
          End-to-end technical flow: Edge Sensing → YOLO AI → Multi-Factor Risk Assessment → GIS Mapping → Rapid Emergency Dispatch
        </div>
      </div>

      {/* Visual Pipeline Carousel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {PIPELINE_STAGES.map((stg, i) => {
          const Icon = stg.icon;
          return (
            <div key={stg.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                className="kv-panel"
                style={{
                  width: "100%",
                  padding: "18px 22px",
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  borderLeft: `5px solid ${stg.color}`
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: `${stg.color}18`,
                    border: `1.5px solid ${stg.color}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}
                >
                  <Icon size={22} color={stg.color} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: stg.color, fontWeight: 700 }}>
                    STAGE {stg.id}
                  </div>
                  <h3 style={{ margin: "2px 0 4px", fontSize: 16, color: "#EEF4EE" }}>
                    {stg.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#CCD8D0", lineHeight: 1.5 }}>
                    {stg.desc}
                  </p>
                </div>
              </div>

              {i < PIPELINE_STAGES.length - 1 && (
                <div style={{ padding: "6px 0", color: "#3A7050", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ArrowDown size={18} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Technology Stack Grid */}
      <div className="kv-panel" style={{ padding: 20 }}>
        <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 18, fontWeight: 700, margin: "0 0 14px", color: "#EEF4EE" }}>
          CORE TECHNOLOGY STACK
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
            <div style={{ fontSize: 11, color: "#8FA396", fontWeight: 700 }}>COMPUTER VISION</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#EEF4EE", marginTop: 4 }}>Ultralytics YOLO (PyTorch)</div>
            <div style={{ fontSize: 11, color: "#A4B7AC", marginTop: 2 }}>Custom 5-class wildlife model + COCO general weights</div>
          </div>

          <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
            <div style={{ fontSize: 11, color: "#8FA396", fontWeight: 700 }}>BACKEND ARCHITECTURE</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#EEF4EE", marginTop: 4 }}>Python 3.13 & FastAPI</div>
            <div style={{ fontSize: 11, color: "#A4B7AC", marginTop: 2 }}>Asynchronous REST endpoints, OpenCV frame extractor</div>
          </div>

          <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
            <div style={{ fontSize: 11, color: "#8FA396", fontWeight: 700 }}>GIS & GEOMETRY</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#EEF4EE", marginTop: 4 }}>Leaflet & Ray-Casting Algorithm</div>
            <div style={{ fontSize: 11, color: "#A4B7AC", marginTop: 2 }}>Point-in-polygon & Haversine distance geofencing</div>
          </div>

          <div style={{ background: "var(--panel-raised)", padding: 12, borderRadius: 6, border: "1px solid var(--line-soft)" }}>
            <div style={{ fontSize: 11, color: "#8FA396", fontWeight: 700 }}>DATABASE LAYER</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#EEF4EE", marginTop: 4 }}>Self-Contained SQLite / PostGIS</div>
            <div style={{ fontSize: 11, color: "#A4B7AC", marginTop: 2 }}>Turnkey zero-friction persistence with audit logs</div>
          </div>
        </div>
      </div>
    </div>
  );
}
