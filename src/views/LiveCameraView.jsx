import React from "react";
import KavachLiveSurveillance from "../components/KavachLiveSurveillance";
import { API_BASE_URL } from "../KavachApp";

/**
 * LiveCameraView
 * Upgraded KAVACH 4-Camera Surveillance Control Room Interface.
 * - 4-Camera Responsive Grid: CAM-001 (Forest North), CAM-002 (Forest East), CAM-003 (Village Border), CAM-004 (Forest South)
 * - Hardware Browser Camera (`navigator.mediaDevices.getUserMedia()`) + Optical Trail Sensor feeds
 * - YOLO11 real-time inference with strict 5-class Indian wildlife whitelist
 * - 3-Frame Temporal Confirmation & Conflict Risk Intelligence
 * - Zero siren on page load / camera connection (Only confirmed target wildlife triggers siren)
 */
export default function LiveCameraView({ apiBaseUrl, userGps, onNavigate, onDetectionAdded }) {
  const effectiveApiUrl = apiBaseUrl || API_BASE_URL;

  return (
    <div style={{ width: "100%", maxWidth: 1440, margin: "0 auto" }}>
      <KavachLiveSurveillance
        apiBaseUrl={effectiveApiUrl}
        userGps={userGps}
        onNavigate={onNavigate}
        isEmbedded={false}
      />
    </div>
  );
}
