import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Robust React Error Boundary for Video Player & Telemetry Results.
 * Prevents video playback / canvas drawing errors from bubbling up
 * and crashing the entire KAVACH application into a blank white screen.
 */
export default class VideoErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[KAVACH VideoErrorBoundary] Caught error:", error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: "rgba(229, 77, 77, 0.12)",
            border: "1px solid #E54D4D",
            borderRadius: 8,
            padding: 24,
            color: "#FF8A80",
            margin: "12px 0",
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={24} color="#E54D4D" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#FFA4A4" }}>
              Video Rendering Error Prevented
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#EEF4EE", lineHeight: 1.5 }}>
            An unexpected error occurred while rendering the video player or telemetry overlay.
            The rest of KAVACH remains fully functional.
          </p>
          {this.state.error && (
            <div
              style={{
                background: "rgba(10, 15, 12, 0.9)",
                border: "1px solid #3A1F1F",
                borderRadius: 4,
                padding: "8px 12px",
                fontFamily: "monospace",
                fontSize: 12,
                color: "#FF8A80",
                wordBreak: "break-word"
              }}
            >
              {this.state.error.message || String(this.state.error)}
            </div>
          )}
          <button
            onClick={this.handleReset}
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#E54D4D",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 4,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              marginTop: 4
            }}
          >
            <RefreshCw size={14} /> Retry Video Display
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
