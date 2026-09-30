/**
 * KAVACH Wildlife Early Warning & Alert Network
 * Camera Source Layer & Abstraction Architecture
 *
 * Architecture:
 * CameraSource (Base)
 * ├── BrowserCameraSource: Laptop/USB Webcam via navigator.mediaDevices.getUserMedia()
 * ├── SimulatedTrailCameraSource: Optical field sensor feed for surveillance grid testing
 * └── RTSPCameraSource: Enterprise RTSP stream worker abstraction (Future-ready placeholder)
 */

export class CameraSource {
  constructor(id, name, options = {}) {
    this.id = id;
    this.name = name;
    this.options = options;
    this.status = "OFFLINE"; // "OFFLINE" | "CONNECTING" | "LIVE" | "ERROR"
    this.errorMessage = null;
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event, data) {
    this.listeners.forEach((fn) => {
      try {
        fn(event, data);
      } catch (err) {
        console.error(`[CameraSource ${this.id}] Listener error:`, err);
      }
    });
  }

  setStatus(status, errorMsg = null) {
    this.status = status;
    this.errorMessage = errorMsg;
    this.notify("status_change", { status, errorMessage: errorMsg });
  }

  async start() {
    throw new Error("start() must be implemented by subclass.");
  }

  stop() {
    throw new Error("stop() must be implemented by subclass.");
  }

  captureFrameBlob() {
    throw new Error("captureFrameBlob() must be implemented by subclass.");
  }
}

/**
 * BrowserCameraSource
 * Direct hardware capture using navigator.mediaDevices.getUserMedia().
 * Enforces:
 * - Permission requested ONLY when user explicitly triggers start()
 * - Zero permission prompts on page load
 * - Immediate track teardown on stop()
 * - Secure context verification (HTTPS or localhost)
 */
export class BrowserCameraSource extends CameraSource {
  constructor(id, name, options = {}) {
    super(id, name, options);
    this.stream = null;
    this.videoElement = null;
    this.canvas = null;
    this.facingMode = options.facingMode || "environment";
  }

  attachVideoElement(videoEl) {
    this.videoElement = videoEl;
    if (this.stream && this.videoElement) {
      this.videoElement.srcObject = this.stream;
      this.videoElement.play().catch(() => {});
    }
  }

  detachVideoElement() {
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  async start() {
    // Prevent duplicate stream requests if already active
    if (this.stream && this.status === "LIVE") {
      return this.stream;
    }

    this.setStatus("CONNECTING");

    // 1. Verify Browser & Secure Context (HTTPS or Localhost)
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      const isSecure = window?.isSecureContext;
      const host = window?.location?.hostname || "";
      const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";

      if (!isSecure && !isLocalhost) {
        const errorMsg = "CAMERA ACCESS REQUIRES HTTPS OR LOCALHOST";
        this.setStatus("ERROR", errorMsg);
        throw new Error(errorMsg);
      }

      const errorMsg = "MediaDevices API is not supported in this browser environment.";
      this.setStatus("ERROR", errorMsg);
      throw new Error(errorMsg);
    }

    // 2. Request user media only on user action
    try {
      this.stopTracks();

      const constraints = {
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = mediaStream;

      if (this.videoElement) {
        this.videoElement.srcObject = mediaStream;
        await this.videoElement.play().catch(() => {});
      }

      this.setStatus("LIVE");
      this.notify("stream_ready", { stream: mediaStream });
      return mediaStream;
    } catch (err) {
      let friendlyError = "Failed to access optical camera device.";

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        friendlyError = "Camera permission was denied. Please allow camera access in browser settings.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        friendlyError = "No camera hardware detected on this device.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        friendlyError = "Camera is currently in use by another application or process.";
      } else if (err.name === "SecurityError") {
        friendlyError = "CAMERA ACCESS REQUIRES HTTPS OR LOCALHOST";
      } else if (err.message && err.message.toLowerCase().includes("secure")) {
        friendlyError = "CAMERA ACCESS REQUIRES HTTPS OR LOCALHOST";
      }

      this.setStatus("ERROR", friendlyError);
      throw new Error(friendlyError);
    }
  }

  stopTracks() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn("[CameraSource] Error stopping track:", e);
        }
      });
      this.stream = null;
    }
  }

  stop() {
    this.stopTracks();
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.setStatus("OFFLINE");
    this.notify("stream_stopped", {});
  }

  async captureFrameBlob() {
    if (!this.videoElement || this.status !== "LIVE") {
      return null;
    }

    const vw = this.videoElement.videoWidth;
    const vh = this.videoElement.videoHeight;
    if (!vw || !vh) return null;

    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
    }
    this.canvas.width = vw;
    this.canvas.height = vh;
    const ctx = this.canvas.getContext("2d");
    ctx.drawImage(this.videoElement, 0, 0, vw, vh);

    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
    });
  }
}

/**
 * SimulatedTrailCameraSource
 * Optical field trap simulation source for surveillance grid testing.
 * Loads actual sample wildlife frames from the KAVACH dataset (tiger, elephant, leopard, meadow)
 * and sends them to the backend YOLO11 pipeline.
 */
export class SimulatedTrailCameraSource extends CameraSource {
  constructor(id, name, options = {}) {
    super(id, name, options);
    this.sampleUrl = options.sampleUrl || "/sample_images/tiger.jpg";
    this.intervalMs = options.intervalMs || 2500;
    this.timer = null;
    this.cachedBlob = null;
  }

  setSampleUrl(newUrl) {
    this.sampleUrl = newUrl;
    this.cachedBlob = null;
  }

  async start() {
    this.setStatus("CONNECTING");
    try {
      const res = await fetch(this.sampleUrl);
      if (!res.ok) {
        throw new Error(`Failed to load optical sensor test feed (${res.status})`);
      }
      this.cachedBlob = await res.blob();
      this.setStatus("LIVE");
      return this.cachedBlob;
    } catch (err) {
      this.setStatus("ERROR", err.message || "Failed to connect to field sensor.");
      throw err;
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.setStatus("OFFLINE");
  }

  async captureFrameBlob() {
    if (this.status !== "LIVE") return null;
    if (this.cachedBlob) return this.cachedBlob;
    try {
      const res = await fetch(this.sampleUrl);
      this.cachedBlob = await res.blob();
      return this.cachedBlob;
    } catch (e) {
      return null;
    }
  }
}

/**
 * RTSPCameraSource
 * Architectural placeholder for enterprise IP / RTSP / NVR streaming.
 * Future-ready abstraction designed for RTSP stream workers.
 * NOTE: As per system specification, RTSP integration is an architectural interface
 * and does NOT claim fake or mock RTSP connection.
 */
export class RTSPCameraSource extends CameraSource {
  constructor(id, name, options = {}) {
    super(id, name, options);
    this.rtspUrl = options.rtspUrl || "";
    this.isRTSPSupported = false; // Intentionally false until backend streaming gateway is active
  }

  async start() {
    this.setStatus("CONNECTING");
    // Explicit transparent message: RTSP gateway required
    const msg = "RTSP Network Stream Worker requires configured IP camera endpoint. Use Browser Webcam or Trail Sensor feed for real-time inference.";
    this.setStatus("OFFLINE", msg);
    throw new Error(msg);
  }

  stop() {
    this.setStatus("OFFLINE");
  }

  async captureFrameBlob() {
    return null;
  }
}
