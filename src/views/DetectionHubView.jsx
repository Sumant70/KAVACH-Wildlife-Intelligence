import React, { useState } from "react";
import { Camera, Radio, Video, Smartphone, Sparkles } from "lucide-react";
import AnimalDetectionView from "./AnimalDetectionView";
import LiveCameraView from "./LiveCameraView";
import CCTVMonitoringView from "./CCTVMonitoringView";
import RemoteCameraView from "./RemoteCameraView";
import { API_BASE_URL } from "../KavachApp";

export default function DetectionHubView({
  apiBaseUrl,
  userGps,
  onNavigate,
  onDetectionComplete,
  defaultMode = "IMAGE"
}) {
  const [detectionMode, setDetectionMode] = useState(defaultMode); // "IMAGE" | "LIVE_CAMERA" | "CCTV" | "REMOTE_CAMERA"
  const effectiveApiUrl = apiBaseUrl || API_BASE_URL;

  return (
    <div className="space-y-6">
      {/* Unified Detection Mode Selector Segmented Pill Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              KAVACH Multi-Modal Detection Engine
            </h2>
            <p className="text-xs text-slate-400">
              Select ingestion modality to run real-time YOLO wildlife inference
            </p>
          </div>
        </div>

        {/* The 4 Modality Buttons */}
        <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 gap-1 self-start md:self-auto flex-wrap">
          <button
            onClick={() => setDetectionMode("IMAGE")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              detectionMode === "IMAGE"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>📷 Image Analysis</span>
          </button>

          <button
            onClick={() => setDetectionMode("LIVE_CAMERA")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              detectionMode === "LIVE_CAMERA"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>🎥 Live Camera</span>
          </button>

          <button
            onClick={() => setDetectionMode("CCTV")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              detectionMode === "CCTV"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Video className="w-4 h-4" />
            <span>📹 CCTV Monitoring</span>
          </button>

          <button
            onClick={() => setDetectionMode("REMOTE_CAMERA")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              detectionMode === "REMOTE_CAMERA"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>📱 Remote Camera</span>
          </button>
        </div>
      </div>

      {/* Render Active Modality */}
      <div>
        {detectionMode === "IMAGE" && (
          <AnimalDetectionView
            apiBaseUrl={effectiveApiUrl}
            userGps={userGps}
            onDetectionAdded={onDetectionComplete}
          />
        )}

        {detectionMode === "LIVE_CAMERA" && (
          <LiveCameraView
            apiBaseUrl={effectiveApiUrl}
            userGps={userGps}
            onNavigate={onNavigate}
          />
        )}

        {detectionMode === "CCTV" && (
          <CCTVMonitoringView
            apiBaseUrl={effectiveApiUrl}
            onNavigate={onNavigate}
          />
        )}

        {detectionMode === "REMOTE_CAMERA" && (
          <RemoteCameraView
            apiBaseUrl={effectiveApiUrl}
            userGps={userGps}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </div>
  );
}
