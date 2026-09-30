import React, { useState } from "react";
import { GitBranch, MapPin, ChevronRight, ShieldAlert, Camera, Radio } from "lucide-react";

const ADMINISTRATIVE_TREE = [
  {
    state: "Maharashtra",
    districts: [
      {
        name: "Chandrapur",
        reserve: "Tadoba-Andhari Tiger Reserve",
        ranges: [
          { name: "Moharli Core Range", beats: ["Beat #1 (Lake Perimeter)", "Beat #2 (Telia Gate)", "Beat #3 (Buffer Edge)"], detections: 24, highRisk: 8 },
          { name: "Kolsa South Range", beats: ["Beat #4 (Zari)", "Beat #5 (Pangadi Buffer)"], detections: 14, highRisk: 4 }
        ]
      },
      {
        name: "Mumbai Suburban",
        reserve: "Sanjay Gandhi National Park",
        ranges: [
          { name: "Borivali West Range", beats: ["Beat #1 (Kanheri Trail)", "Beat #2 (Yeoor Hills)"], detections: 15, highRisk: 6 },
          { name: "Aarey Buffer Division", beats: ["Beat #3 (Residential Fringe)", "Beat #4 (Metro Shed Outskirts)"], detections: 9, highRisk: 3 }
        ]
      }
    ]
  },
  {
    state: "Uttarakhand",
    districts: [
      {
        name: "Nainital / Pauri",
        reserve: "Jim Corbett National Park",
        ranges: [
          { name: "Dhikala Core Range", beats: ["Beat #1 (Grasslands)", "Beat #2 (Ramganga River Corridor)"], detections: 26, highRisk: 7 },
          { name: "Bijrani Tourist Zone", beats: ["Beat #3 (Buffer Belt)", "Beat #4 (Dhangarhi Gate)"], detections: 16, highRisk: 4 }
        ]
      }
    ]
  },
  {
    state: "Assam",
    districts: [
      {
        name: "Golaghat / Nagaon",
        reserve: "Kaziranga National Park",
        ranges: [
          { name: "Kohora Central Range", beats: ["Beat #1 (Mihimukh)", "Beat #2 (Bagori Western Corridor)"], detections: 20, highRisk: 5 },
          { name: "Agoratoli Eastern Range", beats: ["Beat #3 (Wetlands Sanctuary)", "Beat #4 (Highway Overpass)"], detections: 12, highRisk: 3 }
        ]
      }
    ]
  }
];

export default function DistrictHierarchyView() {
  const [selectedState, setSelectedState] = useState(ADMINISTRATIVE_TREE[0]);
  const [selectedDistrict, setSelectedDistrict] = useState(ADMINISTRATIVE_TREE[0].districts[0]);
  const [selectedRange, setSelectedRange] = useState(ADMINISTRATIVE_TREE[0].districts[0].ranges[0]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div className="kv-panel" style={{ padding: "18px 24px" }}>
        <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 24, fontWeight: 700, margin: 0, color: "#EEF4EE", display: "flex", alignItems: "center", gap: 8 }}>
          <GitBranch size={22} color="#D6A84F" />
          STATE & DISTRICT ADMINISTRATIVE HIERARCHY
        </h1>
        <div style={{ fontSize: 13, color: "#8FA396", marginTop: 4 }}>
          Departmental operational tree: National HQ → State Forest HQ → Wildlife Division → Forest Range → Forest Beat
        </div>
      </div>

      {/* Breadcrumb path */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#8FA396", background: "var(--panel-raised)", padding: "10px 16px", borderRadius: 6, border: "1px solid var(--line-soft)" }}>
        <span style={{ color: "#4CAF50", fontWeight: 700 }}>INDIA</span>
        <ChevronRight size={14} />
        <span style={{ color: "#EEF4EE" }}>{selectedState.state}</span>
        <ChevronRight size={14} />
        <span style={{ color: "#EEF4EE" }}>{selectedDistrict.name} ({selectedDistrict.reserve})</span>
        <ChevronRight size={14} />
        <span style={{ color: "#D6A84F", fontWeight: 600 }}>{selectedRange.name}</span>
      </div>

      {/* 3-Column Hierarchy Explorer */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {/* Column 1: State Selection */}
        <div className="kv-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>1. SELECT STATE</div>
          {ADMINISTRATIVE_TREE.map(st => (
            <button
              key={st.state}
              onClick={() => {
                setSelectedState(st);
                setSelectedDistrict(st.districts[0]);
                setSelectedRange(st.districts[0].ranges[0]);
              }}
              style={{
                background: selectedState.state === st.state ? "#1E3D2A" : "var(--panel-raised)",
                border: `1px solid ${selectedState.state === st.state ? "#4CAF50" : "var(--line-soft)"}`,
                color: selectedState.state === st.state ? "#EEF4EE" : "#8FA396",
                padding: "12px 14px",
                borderRadius: 4,
                cursor: "pointer",
                textAlign: "left",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <span>{st.state}</span>
              <ChevronRight size={15} color={selectedState.state === st.state ? "#4CAF50" : "#7A9183"} />
            </button>
          ))}
        </div>

        {/* Column 2: District Selection */}
        <div className="kv-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>2. FOREST DIVISION / RESERVE</div>
          {selectedState.districts.map(dist => (
            <button
              key={dist.name}
              onClick={() => {
                setSelectedDistrict(dist);
                setSelectedRange(dist.ranges[0]);
              }}
              style={{
                background: selectedDistrict.name === dist.name ? "#1E3D2A" : "var(--panel-raised)",
                border: `1px solid ${selectedDistrict.name === dist.name ? "#4CAF50" : "var(--line-soft)"}`,
                color: selectedDistrict.name === dist.name ? "#EEF4EE" : "#8FA396",
                padding: "12px 14px",
                borderRadius: 4,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: 2
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13 }}>{dist.name} Division</div>
              <div style={{ fontSize: 11, color: "#A4B7AC" }}>{dist.reserve}</div>
            </button>
          ))}
        </div>

        {/* Column 3: Range & Beat Detail */}
        <div className="kv-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8FA396", fontFamily: "'IBM Plex Mono', monospace" }}>3. FOREST RANGE & BEATS</div>
          {selectedDistrict.ranges.map(rng => (
            <div
              key={rng.name}
              onClick={() => setSelectedRange(rng)}
              style={{
                background: selectedRange.name === rng.name ? "var(--panel-hi)" : "var(--panel-raised)",
                border: `1px solid ${selectedRange.name === rng.name ? "#D6A84F" : "var(--line-soft)"}`,
                borderRadius: 6,
                padding: 12,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 8
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 13, color: "#EEF4EE" }}>{rng.name}</strong>
                <span style={{ fontSize: 10, color: "#D6A84F", background: "rgba(214,168,79,0.15)", padding: "2px 6px", borderRadius: 3 }}>
                  {rng.detections} Detections
                </span>
              </div>

              <div style={{ fontSize: 11, color: "#8FA396" }}>
                Active Beats:
                <ul style={{ margin: "4px 0 0", paddingLeft: 16, color: "#CCD8D0" }}>
                  {rng.beats.map(b => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: "flex", gap: 8, fontSize: 10, marginTop: 4 }}>
                <span style={{ color: "#E54D4D", fontWeight: 700 }}>{rng.highRisk} High Risk</span>
                <span style={{ color: "#7A9183" }}>· QRT Patrol Active</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
