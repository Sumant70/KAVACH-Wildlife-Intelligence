import React from "react";
import {
  BarChart3, Download, Printer, PieChart, TrendingUp, ShieldAlert,
  Clock, MapPin, Calendar, CheckCircle2
} from "lucide-react";

export default function AnalyticsView({
  analyticsData = {},
  detections = [],
  alerts = []
}) {
  const kpis = analyticsData.kpis || {
    total_detections: detections.length,
    high_risk_detections: detections.filter(d => d.risk_level === "HIGH" || d.risk_level === "CRITICAL").length,
    avg_confidence: 88.5,
    avg_risk_score: 64.2
  };

  const speciesDist = analyticsData.species_distribution || [
    { species: "Asian Elephant", count: 8 },
    { species: "Tiger", count: 6 },
    { species: "Leopard", count: 7 },
    { species: "Wild Boar", count: 9 },
    { species: "Spotted Deer", count: 12 },
    { species: "Sloth Bear", count: 3 }
  ];

  const timeDist = analyticsData.time_of_day_distribution || [
    { time: "00:00 - 04:00", count: 7, period: "Night (Peak Conflict)" },
    { time: "04:00 - 08:00", count: 14, period: "Dawn (Corridor Movement)" },
    { time: "08:00 - 12:00", count: 4, period: "Morning" },
    { time: "12:00 - 16:00", count: 3, period: "Afternoon" },
    { time: "16:00 - 20:00", count: 12, period: "Dusk (Foraging Transition)" },
    { time: "20:00 - 24:00", count: 9, period: "Night (Peak Conflict)" }
  ];

  const districtStats = analyticsData.district_breakdown || [
    { state: "Maharashtra", district: "Chandrapur (Tadoba-Andhari)", detections: 44, high_risk: 14, active_incidents: 3 },
    { state: "Uttarakhand", district: "Nainital (Jim Corbett)", detections: 48, high_risk: 11, active_incidents: 2 },
    { state: "Assam", district: "Golaghat (Kaziranga)", detections: 32, high_risk: 8, active_incidents: 1 },
    { state: "Maharashtra", district: "Mumbai Suburban (SGNP)", detections: 24, high_risk: 9, active_incidents: 2 },
    { state: "Karnataka", district: "Mysuru (Nagarhole)", detections: 35, high_risk: 7, active_incidents: 1 }
  ];

  const handleExportCSV = () => {
    const headers = ["Detection ID", "Timestamp", "Species", "Confidence", "Latitude", "Longitude", "Risk Level", "Risk Score"];
    const rows = detections.map(d => [
      d.id,
      `"${d.timestamp}"`,
      `"${d.species}"`,
      d.confidence,
      d.lat,
      d.lng,
      d.risk_level,
      d.risk_score
    ]);

    const csvContent = "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kavach_wildlife_detections_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div className="kv-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 24, fontWeight: 700, margin: 0, color: "#EEF4EE", display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={22} color="#D6A84F" />
            WILDLIFE INTELLIGENCE & CONFLICT ANALYTICS
          </h1>
          <div style={{ fontSize: 13, color: "#8FA396", marginTop: 4 }}>
            Geospatial temporal patterns, species threat distributions, and district-level conflict analytics
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleExportCSV}
            style={{
              background: "#1E3D2A",
              border: "1px solid #37734E",
              color: "#C5E6D0",
              padding: "8px 14px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Download size={14} /> Export CSV Records
          </button>

          <button
            onClick={() => window.print()}
            style={{
              background: "transparent",
              border: "1px solid #234634",
              color: "#A4B7AC",
              padding: "8px 14px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <Printer size={14} /> Print Executive Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div className="kv-panel" style={{ padding: 16, borderLeft: "4px solid #4F8A64" }}>
          <div style={{ fontSize: 11, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>TOTAL DETECTIONS LOGGED</div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 32, fontWeight: 700, color: "#EEF4EE", marginTop: 4 }}>
            {kpis.total_detections}
          </div>
          <div style={{ fontSize: 11, color: "#4CAF50", marginTop: 4 }}>Continuous 24/7 camera traps</div>
        </div>

        <div className="kv-panel" style={{ padding: 16, borderLeft: "4px solid #E54D4D" }}>
          <div style={{ fontSize: 11, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>HIGH-RISK CONFLICT SIGHTINGS</div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 32, fontWeight: 700, color: "#E54D4D", marginTop: 4 }}>
            {kpis.high_risk_detections}
          </div>
          <div style={{ fontSize: 11, color: "#E57373", marginTop: 4 }}>Predators & Mega-Herbivores</div>
        </div>

        <div className="kv-panel" style={{ padding: 16, borderLeft: "4px solid #D6A84F" }}>
          <div style={{ fontSize: 11, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>AVERAGE AI CONFIDENCE</div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 32, fontWeight: 700, color: "#D6A84F", marginTop: 4 }}>
            {kpis.avg_confidence}%
          </div>
          <div style={{ fontSize: 11, color: "#D6A84F", marginTop: 4 }}>YOLOv11 Object Detection</div>
        </div>

        <div className="kv-panel" style={{ padding: 16, borderLeft: "4px solid #3A82EE" }}>
          <div style={{ fontSize: 11, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>AVG CONFLICT RISK SCORE</div>
          <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 32, fontWeight: 700, color: "#EEF4EE", marginTop: 4 }}>
            {kpis.avg_risk_score} <span style={{ fontSize: 14, color: "#8FA396" }}>/ 100</span>
          </div>
          <div style={{ fontSize: 11, color: "#64B5F6", marginTop: 4 }}>Multi-factor risk engine</div>
        </div>
      </div>

      {/* Visual Analytics Charts Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 20 }}>
        {/* Species Distribution Chart */}
        <div className="kv-panel" style={{ padding: 20 }}>
          <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 17, fontWeight: 700, margin: "0 0 14px", color: "#EEF4EE" }}>
            SPECIES FREQUENCY DISTRIBUTION
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {speciesDist.map(sp => {
              const maxCount = Math.max(...speciesDist.map(s => s.count)) || 1;
              const pct = Math.round((sp.count / maxCount) * 100);
              return (
                <div key={sp.species} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "#EEF4EE", fontWeight: 600 }}>{sp.species}</span>
                    <span style={{ color: "#D6A84F", fontFamily: "'IBM Plex Mono', monospace" }}>{sp.count} sightings</span>
                  </div>
                  <div style={{ width: "100%", height: 8, background: "#112219", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #2E6B48, #D6A84F)", borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Time of Day Conflict Histogram */}
        <div className="kv-panel" style={{ padding: 20 }}>
          <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 17, fontWeight: 700, margin: "0 0 14px", color: "#EEF4EE", display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} color="#D6A84F" /> TEMPORAL CONFLICT PATTERN (TIME OF DAY)
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {timeDist.map(t => {
              const isPeak = t.period.includes("Peak") || t.period.includes("Corridor");
              return (
                <div key={t.time} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: isPeak ? "rgba(229, 77, 77, 0.08)" : "var(--panel-raised)", borderRadius: 4, border: `1px solid ${isPeak ? "rgba(229, 77, 77, 0.3)" : "var(--line-soft)"}` }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: "#EEF4EE" }}>{t.time}</div>
                    <div style={{ fontSize: 10, color: isPeak ? "#E57373" : "#8FA396" }}>{t.period}</div>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 13, color: isPeak ? "#E54D4D" : "#A4B7AC" }}>
                    {t.count} events
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* District Breakdown Table */}
      <div className="kv-panel" style={{ padding: 20 }}>
        <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 17, fontWeight: 700, margin: "0 0 14px", color: "#EEF4EE", display: "flex", alignItems: "center", gap: 8 }}>
          <MapPin size={16} color="#4F8A64" /> DISTRICT-LEVEL WILDLIFE CONFLICT RISK MATRIX
        </h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1E382A", color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>
                <th style={{ padding: "8px 12px" }}>STATE</th>
                <th style={{ padding: "8px 12px" }}>DISTRICT / SANCTUARY DIVISION</th>
                <th style={{ padding: "8px 12px" }}>DETECTIONS</th>
                <th style={{ padding: "8px 12px" }}>HIGH RISK</th>
                <th style={{ padding: "8px 12px" }}>ACTIVE INCIDENTS</th>
                <th style={{ padding: "8px 12px" }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {districtStats.map((dist, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "10px 12px", color: "#EEF4EE" }}>{dist.state}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "#EEF4EE" }}>{dist.district}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "'IBM Plex Mono', monospace", color: "#D6A84F" }}>{dist.detections}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "'IBM Plex Mono', monospace", color: "#E54D4D", fontWeight: 700 }}>{dist.high_risk}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "'IBM Plex Mono', monospace", color: "#EEF4EE" }}>{dist.active_incidents}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: dist.high_risk > 10 ? "rgba(229,77,77,0.2)" : "rgba(76,175,80,0.2)", color: dist.high_risk > 10 ? "#E54D4D" : "#4CAF50" }}>
                      {dist.high_risk > 10 ? "ELEVATED ALERT" : "STABLE"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
