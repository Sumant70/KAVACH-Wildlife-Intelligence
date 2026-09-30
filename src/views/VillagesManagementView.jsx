import React, { useState, useEffect } from "react";
import {
  MapPin, Plus, Shield, CheckCircle2, AlertTriangle, Users,
  PhoneCall, Compass, Layers, X, RefreshCw, ExternalLink
} from "lucide-react";
import { API_BASE_URL } from "../KavachApp";

export default function VillagesManagementView({ onNavigate }) {
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // New Village Form
  const [formData, setFormData] = useState({
    name: "",
    district: "Chandrapur",
    state: "Maharashtra",
    lat: "20.2667",
    lng: "79.4000",
    forest_range: "Tadoba Core Range",
    alert_radius_m: "1500",
    registered_users: "120",
    emergency_contact: "+91 94221 00000"
  });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const fetchVillages = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/villages`);
      const data = await res.json();
      if (data.success && data.villages) {
        setVillages(data.villages);
      }
    } catch (err) {
      console.warn("Failed to fetch villages:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVillages();
  }, []);

  const handleAddVillage = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    setSubmitting(true);
    setMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/villages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          district: formData.district,
          state: formData.state,
          lat: parseFloat(formData.lat) || 20.2667,
          lng: parseFloat(formData.lng) || 79.4000,
          forest_range: formData.forest_range,
          alert_radius_m: parseFloat(formData.alert_radius_m) || 1500,
          registered_users: parseInt(formData.registered_users, 10) || 100,
          emergency_contact: formData.emergency_contact
        })
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: `Village ${data.name} added successfully!` });
        setTimeout(() => {
          setAddModalOpen(false);
          setMsg(null);
          setFormData({
            name: "",
            district: "Chandrapur",
            state: "Maharashtra",
            lat: "20.2667",
            lng: "79.4000",
            forest_range: "Tadoba Core Range",
            alert_radius_m: "1500",
            registered_users: "120",
            emergency_contact: "+91 94221 00000"
          });
          fetchVillages();
        }, 1200);
      }
    } catch (err) {
      setMsg({ type: "error", text: "Network error saving village." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              Villages & Geo-Fencing Concentric Radii
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {villages.length} HABITATIONS ACTIVE
              </span>
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Concentric safety buffers: 🔴 Danger Zone (500m) • 🟡 Warning Zone (1500m) • 🟢 Safe Perimeter (3000m)
            </p>
          </div>
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
        >
          <Plus className="w-4 h-4" /> Add Village Settlement
        </button>
      </div>

      {/* Village Directory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {villages.map((v) => {
          const hasAlert = v.active_alerts_count > 0;
          return (
            <div
              key={v.id}
              className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4 hover:border-slate-700 transition shadow-xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                      {v.id}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      hasAlert
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    }`}>
                      {hasAlert ? "⚠️ ACTIVE THREAT IN SECTOR" : "🟢 AREA SECURE"}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1.5">{v.name}</h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {v.district}, {v.state} • Range: {v.forest_range}
                  </div>
                </div>

                <button
                  onClick={() => onNavigate && onNavigate("gis")}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center gap-1 transition"
                  title="View on GIS Map"
                >
                  <Compass className="w-4 h-4 text-emerald-400" />
                </button>
              </div>

              {/* Concentric Geo-fence Radii Preview */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Concentric Threat Boundaries</span>
                  <span className="font-mono text-slate-400 text-[11px]">{v.lat?.toFixed(4)}°N, {v.lng?.toFixed(4)}°E</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                    <div className="text-[10px] text-rose-400 font-bold">🔴 DANGER</div>
                    <div className="font-bold text-white mt-0.5">500 m</div>
                  </div>
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="text-[10px] text-amber-400 font-bold">🟡 WARNING</div>
                    <div className="font-bold text-white mt-0.5">{v.alert_radius_m || 1500} m</div>
                  </div>
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <div className="text-[10px] text-emerald-400 font-bold">🟢 SAFE</div>
                    <div className="font-bold text-white mt-0.5">3,000 m</div>
                  </div>
                </div>
              </div>

              {/* Community Metrics Footer */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>{v.registered_users || 120} Registered Residents</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-emerald-400" />
                  <span>{v.emergency_contact || "+91 94221 00000"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Village Settlement Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Add Village Settlement</h3>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddVillage} className="p-5 space-y-4">
              {msg && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  msg.type === "success"
                    ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800"
                    : "bg-rose-950/40 text-rose-300 border border-rose-800"
                }`}>
                  {msg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span>{msg.text}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-300">Village Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ashti Village"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300">District</label>
                  <input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300">Warning Radius (meters)</label>
                  <input
                    type="number"
                    value={formData.alert_radius_m}
                    onChange={(e) => setFormData({ ...formData, alert_radius_m: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300">Emergency Helpline Phone</label>
                  <input
                    type="tel"
                    value={formData.emergency_contact}
                    onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-xl transition flex items-center gap-2"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Save Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
