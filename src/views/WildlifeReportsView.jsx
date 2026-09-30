import React, { useState, useEffect } from "react";
import {
  FileText, CheckCircle2, XCircle, AlertTriangle, Eye, Clock,
  MapPin, Sparkles, PhoneCall, RefreshCw, User, Image as ImageIcon
} from "lucide-react";
import { API_BASE_URL } from "../KavachApp";

export default function WildlifeReportsView() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const fetchReports = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/wildlife`);
      const data = await res.json();
      if (data.success && data.reports) {
        setReports(data.reports);
      }
    } catch (e) {
      console.warn("Failed to load reports:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleVerify = async (repId, status) => {
    try {
      await fetch(`${API_BASE_URL}/api/reports/${repId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: status,
          officer_notes: `Reviewed by Forest Department as ${status}`
        })
      });
      fetchReports();
    } catch (e) {
      console.warn("Verification update error:", e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-md p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                Citizen Wildlife Sighting Review
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {reports.length} SIGHTINGS RECORDED
                </span>
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Community crowd-sourced wildlife sightings with automated YOLO photo pre-verification for Forest Department review
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchReports}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-medium transition flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Reports
        </button>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.length === 0 ? (
          <div className="col-span-full bg-slate-900/60 p-12 rounded-3xl border border-slate-800 text-center text-slate-400">
            No citizen wildlife reports submitted yet.
          </div>
        ) : (
          reports.map((rep) => {
            const hasAi = Boolean(rep.ai_verified_species);
            const isVerified = rep.status === "VERIFIED";
            const isRejected = rep.status === "REJECTED";

            return (
              <div
                key={rep.id}
                className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl flex flex-col hover:border-slate-700 transition"
              >
                {/* Photo Preview if any */}
                {rep.photo_path && (
                  <div
                    onClick={() => setSelectedPhoto(`${API_BASE_URL}${rep.photo_path}`)}
                    className="relative aspect-video bg-black overflow-hidden cursor-pointer group"
                  >
                    <img
                      src={`${API_BASE_URL}${rep.photo_path}`}
                      alt="Citizen submission"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-xs font-semibold text-white gap-1.5">
                      <Eye className="w-4 h-4" /> Expand Photo
                    </div>
                  </div>
                )}

                <div className="p-5 flex-1 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                      {rep.id}
                    </span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isVerified ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" :
                      isRejected ? "bg-rose-500/10 text-rose-300 border-rose-500/30" :
                      "bg-amber-500/10 text-amber-300 border-amber-500/30"
                    }`}>
                      {rep.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white">
                      Reported: {rep.animal_reported}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      "{rep.description || "No additional commentary provided."}"
                    </p>
                  </div>

                  {/* AI Verification Badge */}
                  {hasAi && (
                    <div className="p-2.5 bg-emerald-950/40 rounded-xl border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
                      <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <strong>YOLO Pre-Verification:</strong> {rep.ai_verified_species} ({rep.ai_confidence}% conf)
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2 text-slate-300">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold">{rep.reporter_name}</span>
                      {rep.reporter_contact && (
                        <span className="text-[11px] text-slate-500">({rep.reporter_contact})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{rep.village_name || "Village Habitation"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>{rep.created_at || "Recently"}</span>
                    </div>
                  </div>
                </div>

                {/* Officer Action Bar */}
                <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-2">
                  <button
                    onClick={() => handleVerify(rep.id, "VERIFIED")}
                    disabled={isVerified}
                    className="flex-1 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 disabled:opacity-40 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                  </button>
                  <button
                    onClick={() => handleVerify(rep.id, "REJECTED")}
                    disabled={isRejected}
                    className="flex-1 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 disabled:opacity-40 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Expanded Photo Modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <img src={selectedPhoto} alt="Expanded preview" className="w-full h-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
