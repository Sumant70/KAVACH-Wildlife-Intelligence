import React, { useState } from "react";
import {
  ShieldAlert, MapPin, Plus, Trash2, CheckCircle2, AlertTriangle,
  Compass, Crosshair, ArrowRight
} from "lucide-react";

export default function GeofencingView({
  geofences = [],
  apiBaseUrl,
  onGeofenceCreated,
  onGeofenceDeleted
}) {
  const [testLat, setTestLat] = useState("20.2520");
  const [testLng, setTestLng] = useState("79.3880");
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const [createModal, setCreateModal] = useState(false);
  const [geoName, setGeoName] = useState("");
  const [geoType, setGeoType] = useState("RESIDENTIAL_BUFFER");
  const [geomType, setGeomType] = useState("CIRCLE");
  const [centerLat, setCenterLat] = useState("20.2500");
  const [centerLng, setCenterLng] = useState("79.3900");
  const [radiusM, setRadiusM] = useState("1500");
  const [riskMult, setRiskMult] = useState("1.4");
  const [desc, setDesc] = useState("");

  const handleTestCoordinates = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const lat = parseFloat(testLat);
      const lng = parseFloat(testLng);

      // Perform test against backend check logic or calculate locally
      const breached = [];
      geofences.forEach(g => {
        if (g.geometry_type === "CIRCLE" && g.coordinates?.center) {
          const [cLat, cLng] = g.coordinates.center;
          // Simple haversine
          const dLat = (lat - cLat) * (Math.PI / 180);
          const dLng = (lng - cLng) * (Math.PI / 180);
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(cLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distM = 6371000 * c;
          if (distM <= (g.radius_m || 1000)) {
            breached.push({ ...g, distance_m: Math.round(distM) });
          }
        }
      });

      setTestResult({
        hasBreach: breached.length > 0,
        breaches: breached
      });
    } catch (err) {
      console.error("Test failed:", err);
    } finally {
      setTesting(false);
    }
  };

  const handleCreateGeofence = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: geoName,
        type: geoType,
        geometry_type: geomType,
        coordinates: geomType === "CIRCLE"
          ? { center: [parseFloat(centerLat), parseFloat(centerLng)], radius: parseFloat(radiusM) }
          : [[parseFloat(centerLat), parseFloat(centerLng)], [parseFloat(centerLat) + 0.02, parseFloat(centerLng)], [parseFloat(centerLat) + 0.02, parseFloat(centerLng) + 0.02], [parseFloat(centerLat), parseFloat(centerLng) + 0.02]],
        radius_m: parseFloat(radiusM),
        risk_multiplier: parseFloat(riskMult),
        description: desc
      };

      const resp = await fetch(`${apiBaseUrl}/api/geofences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        const data = await resp.json();
        onGeofenceCreated?.({ ...payload, id: data.geofence_id });
        setCreateModal(false);
        setGeoName("");
        setDesc("");
      }
    } catch (err) {
      console.error("Failed to create geofence:", err);
    }
  };

  const handleDelete = async (geoId) => {
    try {
      const resp = await fetch(`${apiBaseUrl}/api/geofences/${geoId}`, { method: "DELETE" });
      if (resp.ok) {
        onGeofenceDeleted?.(geoId);
      }
    } catch (err) {
      console.error("Failed to delete geofence:", err);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div className="kv-panel" style={{ padding: "18px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 24, fontWeight: 700, margin: 0, color: "#EEF4EE" }}>
            GEOFENCE PERIMETER & BUFFER MANAGEMENT
          </h1>
          <div style={{ fontSize: 13, color: "#8FA396", marginTop: 4 }}>
            Spatial boundary enforcement, residential buffers, wildlife corridors, and automatic breach triggers
          </div>
        </div>

        <button
          onClick={() => setCreateModal(true)}
          style={{
            background: "#1E4A32",
            border: "1px solid #378057",
            color: "#FFFFFF",
            padding: "8px 16px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <Plus size={14} /> Create New Geofence
        </button>
      </div>

      {/* Geofence Breach Test Sandbox */}
      <div className="kv-panel" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, background: "rgba(24, 46, 34, 0.4)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#D6A84F", display: "flex", alignItems: "center", gap: 6 }}>
          <Crosshair size={16} /> LIVE GEOFENCE BREACH TEST BENCH
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Latitude (e.g. 20.2520)"
            value={testLat}
            onChange={(e) => setTestLat(e.target.value)}
            style={{ background: "var(--panel-raised)", border: "1px solid var(--line)", color: "#EEF4EE", padding: "6px 10px", borderRadius: 4, fontSize: 12, width: 160 }}
          />
          <input
            type="text"
            placeholder="Longitude (e.g. 79.3880)"
            value={testLng}
            onChange={(e) => setTestLng(e.target.value)}
            style={{ background: "var(--panel-raised)", border: "1px solid var(--line)", color: "#EEF4EE", padding: "6px 10px", borderRadius: 4, fontSize: 12, width: 160 }}
          />
          <button
            onClick={handleTestCoordinates}
            disabled={testing}
            style={{
              background: "#2A6E46",
              border: "1px solid #48A870",
              color: "#FFFFFF",
              padding: "6px 16px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600
            }}
          >
            {testing ? "Testing..." : "Test Geofence Breach"}
          </button>
        </div>

        {testResult && (
          <div style={{ padding: 10, borderRadius: 4, background: testResult.hasBreach ? "rgba(229, 77, 77, 0.15)" : "rgba(76, 175, 80, 0.15)", border: `1px solid ${testResult.hasBreach ? "#E54D4D" : "#4CAF50"}`, fontSize: 12, color: testResult.hasBreach ? "#FFB0B0" : "#A8D8B9", display: "flex", alignItems: "center", gap: 8 }}>
            {testResult.hasBreach ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            {testResult.hasBreach ? (
              <span><strong>BREACH DETECTED:</strong> Point is inside <strong>{testResult.breaches[0]?.name}</strong> (Distance to center: {testResult.breaches[0]?.distance_m}m). Risk Multiplier: {testResult.breaches[0]?.risk_multiplier}x applied.</span>
            ) : (
              <span>Point is outside all active residential buffers and high-risk zones. Normal monitoring parameters apply.</span>
            )}
          </div>
        )}
      </div>

      {/* Geofences List Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {geofences.map(geo => {
          const isBuffer = geo.type === "RESIDENTIAL_BUFFER";
          const borderColor = isBuffer ? "#E54D4D" : "#D6A84F";

          return (
            <div
              key={geo.id}
              className="kv-panel"
              style={{
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                borderTop: `3px solid ${borderColor}`
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#8FA396" }}>{geo.id}</span>
                  <h3 style={{ margin: "2px 0 0", fontSize: 15, color: "#EEF4EE" }}>{geo.name}</h3>
                </div>

                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    color: borderColor,
                    background: `${borderColor}18`,
                    border: `1px solid ${borderColor}40`,
                    padding: "2px 6px",
                    borderRadius: 3
                  }}
                >
                  {geo.type}
                </span>
              </div>

              <div style={{ fontSize: 12, color: "#CCD8D0", lineHeight: 1.4 }}>
                {geo.description}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "var(--panel-raised)", padding: 8, borderRadius: 4, border: "1px solid var(--line-soft)", fontSize: 11 }}>
                <div>
                  <span style={{ color: "#8FA396" }}>Shape: </span>
                  <strong style={{ color: "#EEF4EE" }}>{geo.geometry_type}</strong>
                </div>
                <div>
                  <span style={{ color: "#8FA396" }}>Radius: </span>
                  <strong style={{ color: "#EEF4EE" }}>{geo.radius_m ? `${geo.radius_m}m` : "Polygon"}</strong>
                </div>
                <div>
                  <span style={{ color: "#8FA396" }}>Multiplier: </span>
                  <strong style={{ color: "#D6A84F" }}>{geo.risk_multiplier}x</strong>
                </div>
                <div>
                  <span style={{ color: "#8FA396" }}>Status: </span>
                  <strong style={{ color: "#4CAF50" }}>ACTIVE</strong>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  onClick={() => handleDelete(geo.id)}
                  style={{
                    background: "transparent",
                    border: "1px solid #4A2020",
                    color: "#FF9999",
                    padding: "4px 8px",
                    borderRadius: 3,
                    cursor: "pointer",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 4
                  }}
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Geofence Modal */}
      {createModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="kv-panel" style={{ width: "min(500px, 100%)", padding: 24 }}>
            <h2 style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 20, fontWeight: 700, margin: "0 0 16px", color: "#EEF4EE" }}>
              DEFINE NEW GEOFENCE PERIMETER
            </h2>

            <form onSubmit={handleCreateGeofence} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "#8FA396", display: "block", marginBottom: 4 }}>Geofence Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Corbett North Buffer Boundary"
                  value={geoName}
                  onChange={(e) => setGeoName(e.target.value)}
                  style={{ width: "100%", background: "var(--panel-raised)", border: "1px solid var(--line)", color: "#EEF4EE", padding: "8px 10px", borderRadius: 4, fontSize: 12 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#8FA396", display: "block", marginBottom: 4 }}>Geofence Type</label>
                  <select
                    value={geoType}
                    onChange={(e) => setGeoType(e.target.value)}
                    style={{ width: "100%", background: "var(--panel-raised)", border: "1px solid var(--line)", color: "#EEF4EE", padding: "8px", borderRadius: 4, fontSize: 12 }}
                  >
                    <option value="RESIDENTIAL_BUFFER">Residential Buffer</option>
                    <option value="HIGH_RISK">High Risk Zone</option>
                    <option value="CORRIDOR">Wildlife Corridor</option>
                    <option value="PROTECTED_ZONE">Protected Sanctuary</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, color: "#8FA396", display: "block", marginBottom: 4 }}>Geometry</label>
                  <select
                    value={geomType}
                    onChange={(e) => setGeomType(e.target.value)}
                    style={{ width: "100%", background: "var(--panel-raised)", border: "1px solid var(--line)", color: "#EEF4EE", padding: "8px", borderRadius: 4, fontSize: 12 }}
                  >
                    <option value="CIRCLE">Circular Radius</option>
                    <option value="POLYGON">Polygon Bounding Box</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#8FA396", display: "block", marginBottom: 4 }}>Center Latitude</label>
                  <input
                    type="text"
                    required
                    value={centerLat}
                    onChange={(e) => setCenterLat(e.target.value)}
                    style={{ width: "100%", background: "var(--panel-raised)", border: "1px solid var(--line)", color: "#EEF4EE", padding: "8px", borderRadius: 4, fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#8FA396", display: "block", marginBottom: 4 }}>Center Longitude</label>
                  <input
                    type="text"
                    required
                    value={centerLng}
                    onChange={(e) => setCenterLng(e.target.value)}
                    style={{ width: "100%", background: "var(--panel-raised)", border: "1px solid var(--line)", color: "#EEF4EE", padding: "8px", borderRadius: 4, fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#8FA396", display: "block", marginBottom: 4 }}>Radius (Meters)</label>
                  <input
                    type="number"
                    value={radiusM}
                    onChange={(e) => setRadiusM(e.target.value)}
                    style={{ width: "100%", background: "var(--panel-raised)", border: "1px solid var(--line)", color: "#EEF4EE", padding: "8px", borderRadius: 4, fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#8FA396", display: "block", marginBottom: 4 }}>Risk Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    value={riskMult}
                    onChange={(e) => setRiskMult(e.target.value)}
                    style={{ width: "100%", background: "var(--panel-raised)", border: "1px solid var(--line)", color: "#EEF4EE", padding: "8px", borderRadius: 4, fontSize: 12 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, color: "#8FA396", display: "block", marginBottom: 4 }}>Description</label>
                <textarea
                  rows={2}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Explain the purpose of this geofence..."
                  style={{ width: "100%", background: "var(--panel-raised)", border: "1px solid var(--line)", color: "#EEF4EE", padding: "8px", borderRadius: 4, fontSize: 12 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setCreateModal(false)}
                  style={{ background: "transparent", border: "1px solid var(--line)", color: "#8FA396", padding: "8px 14px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: "#2E6B48", border: "1px solid #4CAF50", color: "#FFFFFF", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                >
                  Save Geofence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
