import React, { useState, useEffect, useRef } from "react";
import {
  Volume2, VolumeX, Smartphone, Wifi, WifiOff, Bell, AlertTriangle,
  ShieldAlert, CheckCircle2, RefreshCw, Radio, MapPin, Clock, ArrowLeft
} from "lucide-react";
import {
  activateAudio,
  isAudioActivated,
  startContinuousSiren,
  stopContinuousSiren,
  vibratePhone,
  stopPhoneVibration,
  isVibrationSupported,
  playSuccessChime
} from "../components/AudioAlerts";
import { requestFcmToken, attachForegroundListener, checkFcmSupport } from "../firebase";
import { API_BASE_URL } from "../KavachApp";

const PRESET_DEVICES = [
  "Team Leader",
  "Field Monitor",
  "Forest Monitor",
  "Emergency Monitor"
];

export default function MobileAlertDeviceView({ onNavigateBack }) {
  // Device Identity
  const [deviceName, setDeviceName] = useState(() => {
    try {
      return localStorage.getItem("kavach_device_name") || "Team Leader";
    } catch {
      return "Team Leader";
    }
  });
  const [customName, setCustomName] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  // Connectivity
  const [connectionStatus, setConnectionStatus] = useState("CONNECTING"); // "CONNECTED" | "CONNECTING" | "DISCONNECTED"
  const [soundEnabled, setSoundEnabled] = useState(isAudioActivated());
  const [vibrationSupported] = useState(isVibrationSupported());
  const [pushEnabled, setPushEnabled] = useState(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission === "granted" && !!localStorage.getItem("kavach_fcm_token");
    }
    return false;
  });
  const [backendFcmStatus, setBackendFcmStatus] = useState("CHECKING"); // "CONFIGURED" | "UNCONFIGURED" | "OFFLINE" | "CHECKING"
  const [fcmNotice, setFcmNotice] = useState(null);
  const [fcmSupport, setFcmSupport] = useState({
    checking: true,
    supported: false,
    reason: null,
    isSecureContext: typeof window !== "undefined" ? Boolean(window.isSecureContext) : false
  });

  const cleanApiBase = (API_BASE_URL || "").replace(/\/+$/, "");

  // Check client browser and origin support for Web Push / FCM
  useEffect(() => {
    checkFcmSupport().then(res => {
      setFcmSupport({
        checking: false,
        supported: res.supported,
        reason: res.reason,
        isSecureContext: res.isSecureContext
      });
    });
  }, []);

  // Poll backend FCM status so UI accurately reflects backend readiness
  useEffect(() => {
    let unmounted = false;
    const checkFcmStatus = async () => {
      try {
        const res = await fetch(`${cleanApiBase}/api/fcm/status`);
        if (res.ok) {
          const data = await res.json();
          if (!unmounted) {
            setBackendFcmStatus(data.configured && data.fcm_enabled ? "CONFIGURED" : (data.configured ? "CONFIGURED" : "UNCONFIGURED"));
          }
        } else {
          if (!unmounted) setBackendFcmStatus("OFFLINE");
        }
      } catch (err) {
        if (!unmounted) setBackendFcmStatus("OFFLINE");
      }
    };
    checkFcmStatus();
    const interval = setInterval(checkFcmStatus, 8000);
    return () => { unmounted = true; clearInterval(interval); };
  }, [cleanApiBase]);

  // Alerts & Overlay
  const [activeAlert, setActiveAlert] = useState(null);
  const [isSirenActive, setIsSirenActive] = useState(false);
  const [alertHistory, setAlertHistory] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const testSirenTimerRef = useRef(null);
  const processedEventIds = useRef(new Set());

  // Save selected device name
  const handleNameChange = (name) => {
    setDeviceName(name);
    try {
      localStorage.setItem("kavach_device_name", name);
    } catch { }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "REGISTER_DEVICE",
        device_name: name
      }));
    }
  };

  // Determine WebSocket Alert URL dynamically without double slashes
  const getWsAlertsUrl = () => {
    if (typeof window !== "undefined" && window.location) {
      const isHttps = window.location.protocol === "https:" || cleanApiBase.startsWith("https:");
      const wsProto = isHttps ? "wss:" : "ws:";
      const host = cleanApiBase.replace(/^https?:\/\//, "") || `${window.location.hostname}:8000`;
      return `${wsProto}//${host}/ws/alerts`;
    }
    return `ws://${window.location.hostname}:8000/ws/alerts`;
  };

  // WebSocket Connection Lifecycle with Auto-reconnect
  useEffect(() => {
    let unmounted = false;

    const connectWebSocket = () => {
      if (unmounted) return;
      setConnectionStatus("CONNECTING");

      try {
        const url = getWsAlertsUrl();
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (unmounted) return;
          console.log("[ALERT-DEVICE] Connected to WebSocket alert server:", url);
          setConnectionStatus("CONNECTED");

          // Register device identity immediately (Registration NEVER triggers siren or alert)
          ws.send(JSON.stringify({
            type: "REGISTER_DEVICE",
            device_name: deviceName
          }));
        };

        ws.onmessage = (event) => {
          if (unmounted) return;
          try {
            const data = JSON.parse(event.data);
            const msgType = data.type || data.event_type;

            if (msgType === "INIT_STATE") {
              // Initial registration state only — NEVER trigger alert or siren
              if (data.recent_alerts) {
                setAlertHistory(data.recent_alerts);
              }
            } else if (msgType === "DEVICE_LIST_UPDATE") {
              // Device presence update only — ignore for siren/alert
            } else if (msgType === "TEST_SIREN") {
              // Manual Test Siren triggered from laptop dashboard
              console.log("[PHONE] Received TEST_SIREN from:", data.source || "laptop");
              console.log("[SIREN] Playing emergency siren");
              startContinuousSiren();
              setIsSirenActive(true);
              vibratePhone([250, 100, 250, 100, 400]);

              if (testSirenTimerRef.current) clearTimeout(testSirenTimerRef.current);
              testSirenTimerRef.current = setTimeout(() => {
                stopContinuousSiren();
                setIsSirenActive(false);
              }, 4000);
            } else if (msgType === "ANIMAL_DETECTED" || msgType === "WILDLIFE_ALERT" || msgType === "TEST_ALERT") {
              // Deduplicate events to prevent double sirens for same detection event
              const eventId = data.event_id || data.alert_id;
              if (eventId && processedEventIds.current.has(eventId)) {
                console.log("[PHONE] Skipping duplicate event:", eventId);
                return;
              }
              if (eventId) {
                processedEventIds.current.add(eventId);
              }

              console.log(`[PHONE] Received ${msgType}:`, eventId || "unknown", data.animal || data.species || "Wildlife");
              console.log("[SIREN] Playing emergency siren");
              handleIncomingAlert(data);
            }
          } catch (e) {
            console.error("[ALERT-DEVICE] WS parse error:", e);
          }
        };

        ws.onclose = () => {
          if (unmounted) return;
          console.warn("[ALERT-DEVICE] WebSocket closed. Scheduling reconnect...");
          setConnectionStatus("DISCONNECTED");
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3500);
        };

        ws.onerror = (err) => {
          console.warn("[ALERT-DEVICE] WebSocket error:", err);
          ws.close();
        };

      } catch (err) {
        if (!unmounted) {
          setConnectionStatus("DISCONNECTED");
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 4000);
        }
      }
    };

    connectWebSocket();

    return () => {
      unmounted = true;
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (testSirenTimerRef.current) clearTimeout(testSirenTimerRef.current);
      stopContinuousSiren();
    };
  }, [deviceName]);

  // Handle incoming alert (ANIMAL_DETECTED or TEST_ALERT)
  const handleIncomingAlert = (alertData) => {
    setActiveAlert(alertData);
    setAlertHistory(prev => [alertData, ...prev.slice(0, 49)]);

    // Start continuous wailing siren and tactile vibration
    startContinuousSiren();
    setIsSirenActive(true);
    vibratePhone([300, 150, 300, 150, 600]);
  };

  // Silence Siren Only
  const handleStopSiren = () => {
    if (testSirenTimerRef.current) clearTimeout(testSirenTimerRef.current);
    stopContinuousSiren();
    setIsSirenActive(false);
  };

  // Fully acknowledge alert
  const handleAcknowledge = () => {
    if (testSirenTimerRef.current) clearTimeout(testSirenTimerRef.current);
    stopContinuousSiren();
    setIsSirenActive(false);
    setActiveAlert(null);
  };

  // Unlock Browser Autoplay (Silent permission unlock only)
  const handleActivateSound = () => {
    const ok = activateAudio();
    if (ok) {
      setSoundEnabled(true);
    }
  };

  // Request FCM Push Notification Permission (Zero sound triggered)
  const handleEnablePushNotifications = async () => {
    // 1. Verify browser environment & origin support first
    const support = await checkFcmSupport();
    if (!support.supported) {
      if (!support.isSecureContext) {
        setFcmNotice("⚠️ Insecure Origin: Web Push requires HTTPS or localhost. For PC testing open http://localhost:5173. For Android phone testing over LAN HTTP, enable chrome://flags/#unsafely-treat-insecure-origin-as-secure.");
      } else {
        setFcmNotice(`⚠️ Push not supported: ${support.reason}`);
      }
      setTimeout(() => setFcmNotice(null), 8000);
      return;
    }

    setFcmNotice("Requesting browser push notification permission...");
    try {
      const res = await requestFcmToken(API_BASE_URL, {
        deviceId: localStorage.getItem("kavach_device_id") || "DEV-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
        deviceName: deviceName,
        role: deviceName
      });
      if (res.success) {
        setPushEnabled(true);
        setFcmNotice("✓ Background Push Notifications enabled successfully.");
        setTimeout(() => setFcmNotice(null), 5000);
      } else {
        setFcmNotice(`Push registration failed: ${res.error || res.permission}`);
        setTimeout(() => setFcmNotice(null), 6000);
      }
    } catch (e) {
      setFcmNotice(`Push initialization error: ${e.message || e}`);
      setTimeout(() => setFcmNotice(null), 5000);
    }
  };

  // Send Test FCM Push Notification to this device
  const handleSendTestPush = async () => {
    try {
      setFcmNotice("Sending test push notification...");
      const token = localStorage.getItem("kavach_fcm_token");
      const res = await fetch(`${cleanApiBase}/api/fcm/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_name: deviceName,
          token: token,
          title: "🚨 TEST WILDLIFE PUSH",
          body: `Test notification dispatched to ${deviceName}`
        })
      });
      const data = await res.json();
      if (data.success && ((data.delivered_count ?? data.dispatched ?? 0) > 0 || data.total === 0)) {
        const delivered = data.delivered_count ?? data.dispatched ?? 0;
        setFcmNotice(`✓ Test push sent (${delivered} delivered).`);
      } else {
        setFcmNotice(`Test push notice: ${data.message || data.error || data.status || "Delivery attempted"}`);
      }
      setTimeout(() => setFcmNotice(null), 4000);
    } catch (e) {
      console.error("Test push error:", e);
      setFcmNotice("Failed to send test push.");
      setTimeout(() => setFcmNotice(null), 4000);
    }
  };

  // Subscribe to Foreground FCM Messages
  useEffect(() => {
    const unsub = attachForegroundListener((payload) => {
      const eventId = payload.data?.event_id;
      // Deduplicate: If WebSocket already triggered this alert, do not re-alarm
      if (eventId && processedEventIds.current.has(eventId)) {
        console.log("[FCM] Foreground push message already handled via WebSocket, skipping duplicate:", eventId);
        return;
      }
      if (eventId) {
        processedEventIds.current.add(eventId);
      }
      const alertData = {
        type: "ANIMAL_DETECTED",
        event_id: eventId,
        alert_id: eventId,
        animal: payload.data?.animal || payload.data?.species || "Wildlife",
        confidence: parseFloat(payload.data?.confidence || "90.0"),
        risk_level: payload.data?.risk_level || "HIGH",
        location: {
          village_name: payload.data?.village_name || "Sanctuary Sector",
          distance_str: payload.data?.distance_str || "~250 m"
        },
        timestamp: payload.data?.timestamp || new Date().toISOString(),
        source: payload.data?.source || "FCM_PUSH"
      };
      handleIncomingAlert(alertData);
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // Send Test Alert from this phone
  const handleSendTestAlert = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "TEST_ALERT",
        device_name: deviceName
      }));
    } else {
      // Fallback via HTTP
      fetch(`${cleanApiBase}/api/alerts/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_name: deviceName })
      }).catch(err => console.error("HTTP test alert error:", err));
    }
  };

  // Species Emoji Helper
  const getAnimalEmoji = (animal = "") => {
    const a = animal.toLowerCase();
    if (a.includes("elephant")) return "🐘";
    if (a.includes("tiger")) return "🐅";
    if (a.includes("leopard")) return "🐆";
    if (a.includes("boar")) return "🐗";
    if (a.includes("deer")) return "🦌";
    if (a.includes("bear")) return "🐻";
    return "🐾";
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080F0B",
      color: "#EEF4EE",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
      maxWidth: 500,
      margin: "0 auto",
      boxSizing: "border-box"
    }}>
      {/* Top Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #1B3828",
        paddingBottom: 14
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              style={{
                background: "transparent",
                border: "1px solid #234B35",
                color: "#8FA396",
                padding: "6px 10px",
                borderRadius: 6,
                cursor: "pointer"
              }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <div style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 20, fontWeight: 800, color: "#4CAF50", letterSpacing: "0.05em" }}>
              KAVACH
            </div>
            <div style={{ fontSize: 11, color: "#8FA396", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Community Wildlife Alert Network
            </div>
          </div>
        </div>

        {/* Live Status Indicators: 🟢 Connected, 🔴 Disconnected, 🚨 Alert Active, 🔊 Siren Active */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {isSirenActive && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(229, 77, 77, 0.2)",
              border: "1px solid #E54D4D",
              padding: "4px 8px",
              borderRadius: 20,
              fontSize: 10,
              color: "#FF8A80",
              fontWeight: 800,
              animation: "pulse 1s infinite"
            }}>
              <span>🔊 Siren Active</span>
            </div>
          )}

          {activeAlert && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(229, 77, 77, 0.2)",
              border: "1px solid #E54D4D",
              padding: "4px 8px",
              borderRadius: 20,
              fontSize: 10,
              color: "#FF8A80",
              fontWeight: 800
            }}>
              <span>🚨 Alert Active</span>
            </div>
          )}

          {connectionStatus === "CONNECTED" && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(76, 175, 80, 0.15)",
              border: "1px solid #4CAF50",
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 11,
              color: "#81C784",
              fontWeight: 700
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4CAF50", boxShadow: "0 0 8px #4CAF50" }}></span>
              <span>🟢 Connected</span>
            </div>
          )}
          {connectionStatus === "CONNECTING" && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(214, 168, 79, 0.15)",
              border: "1px solid #D6A84F",
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 11,
              color: "#D6A84F",
              fontWeight: 700
            }}>
              <RefreshCw size={10} style={{ animation: "spin 1s linear infinite" }} />
              <span>🟡 Reconnecting...</span>
            </div>
          )}
          {connectionStatus === "DISCONNECTED" && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(229, 77, 77, 0.15)",
              border: "1px solid #E54D4D",
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 11,
              color: "#FF8A80",
              fontWeight: 700
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E54D4D" }}></span>
              <span>🔴 Disconnected</span>
            </div>
          )}
        </div>
      </div>

      {/* Device Registration Card */}
      <div style={{
        background: "#0D1E15",
        border: "1px solid #1E462E",
        borderRadius: 12,
        padding: "16px"
      }}>
        <div style={{ fontSize: 12, color: "#8FA396", marginBottom: 8, fontWeight: 600 }}>
          SELECT MONITORING ROLE / DEVICE NAME:
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {PRESET_DEVICES.map(role => (
            <button
              key={role}
              onClick={() => { setIsCustom(false); handleNameChange(role); }}
              style={{
                background: deviceName === role && !isCustom ? "#2E6B48" : "#13281D",
                border: `1px solid ${deviceName === role && !isCustom ? "#4CAF50" : "#1F422F"}`,
                color: deviceName === role && !isCustom ? "#FFFFFF" : "#8FA396",
                padding: "10px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.15s ease"
              }}
            >
              {role}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Or type custom device role..."
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            style={{
              flex: 1,
              background: "#080F0B",
              border: "1px solid #204732",
              borderRadius: 6,
              padding: "8px 12px",
              color: "#EEF4EE",
              fontSize: 12
            }}
          />
          <button
            onClick={() => {
              if (customName.trim()) {
                setIsCustom(true);
                handleNameChange(customName.trim());
              }
            }}
            style={{
              background: "#1E3D2A",
              border: "1px solid #3A7350",
              color: "#D2E8DA",
              padding: "8px 14px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600
            }}
          >
            Set
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: "#4CAF50", display: "flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={13} />
          <span>Active Device: <strong>{deviceName}</strong></span>
        </div>
      </div>

      {/* Hardware Readiness Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 8
      }}>
        {/* Sound Status */}
        <div style={{
          background: "#0D1E15",
          border: `1px solid ${soundEnabled ? "#2F6B48" : "#4A3018"}`,
          borderRadius: 10,
          padding: 10
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "#8FA396" }}>ALERT SIREN</span>
            {soundEnabled ? <Volume2 size={14} color="#4CAF50" /> : <VolumeX size={14} color="#D6A84F" />}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: soundEnabled ? "#81C784" : "#D6A84F" }}>
            {soundEnabled ? "🟢 ENABLED" : "🔴 MUTED"}
          </div>
        </div>

        {/* Vibration Status */}
        <div style={{
          background: "#0D1E15",
          border: `1px solid ${vibrationSupported ? "#2F6B48" : "#2A3A30"}`,
          borderRadius: 10,
          padding: 10
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "#8FA396" }}>VIBRATION</span>
            <Smartphone size={14} color={vibrationSupported ? "#4CAF50" : "#8FA396"} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: vibrationSupported ? "#81C784" : "#8FA396" }}>
            {vibrationSupported ? "🟢 ENABLED" : "⚪ N/A"}
          </div>
        </div>

        {/* FCM Push Notification Status */}
        <div style={{
          background: "#0D1E15",
          border: `1px solid ${
            pushEnabled
              ? "#2F6B48"
              : backendFcmStatus === "OFFLINE"
                ? "#602020"
                : !fcmSupport.isSecureContext
                  ? "#6B5820"
                  : "#4A3018"
          }`,
          borderRadius: 10,
          padding: 10
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "#8FA396" }}>FCM PUSH</span>
            <Bell size={14} color={
              pushEnabled
                ? "#4CAF50"
                : backendFcmStatus === "OFFLINE"
                  ? "#E54D4D"
                  : !fcmSupport.isSecureContext
                    ? "#D6A84F"
                    : "#8FA396"
            } />
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, color:
              pushEnabled
                ? "#81C784"
                : backendFcmStatus === "OFFLINE"
                  ? "#FF8080"
                  : !fcmSupport.isSecureContext
                    ? "#E6C665"
                    : "#D6A84F"
          }}>
            {pushEnabled
              ? "🟢 FCM ENABLED"
              : backendFcmStatus === "OFFLINE"
                ? "🔴 BACKEND OFFLINE"
                : !fcmSupport.isSecureContext
                  ? "🟡 INSECURE ORIGIN (LAN)"
                  : fcmSupport.supported === false
                    ? "🔴 NOT SUPPORTED"
                    : (typeof Notification !== "undefined" && Notification.permission === "denied")
                      ? "🔴 BLOCKED"
                      : "🔴 PENDING PERMISSION"
            }
          </div>
        </div>
      </div>

      {/* FCM Notice Toast if any */}
      {fcmNotice && (
        <div style={{
          background: "rgba(30, 61, 42, 0.9)",
          border: "1px solid #3A7350",
          color: "#D2E8DA",
          padding: "8px 12px",
          borderRadius: 6,
          fontSize: 12,
          textAlign: "center"
        }}>
          {fcmNotice}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Browser Background Push Notification Button & Info */}
        {!pushEnabled ? (
          <>
            <button
              onClick={handleEnablePushNotifications}
              style={{
                background: "#163424",
                border: "1px solid #2B5E40",
                color: "#81C784",
                padding: "12px 16px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              <Bell size={18} />
              <span>🔔 ENABLE BACKGROUND PUSH NOTIFICATIONS</span>
            </button>
            {!fcmSupport.isSecureContext && (
              <div style={{
                background: "rgba(214, 168, 79, 0.08)",
                border: "1px dashed rgba(214, 168, 79, 0.4)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 11,
                color: "#D6A84F",
                lineHeight: "1.4"
              }}>
                ℹ️ <strong>LAN Testing Notice:</strong> Browsers require a Secure Origin (HTTPS or localhost) for Web Push & Service Workers. For PC testing use <code>localhost:5173</code>. For Android phone testing over LAN HTTP, enable <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> and add this address.
              </div>
            )}
          </>
        ) : (
          <div style={{
            background: "rgba(46, 107, 72, 0.2)",
            border: "1px solid #2F6B48",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            color: "#A5D6A7",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Bell size={14} color="#4CAF50" />
              <span>🔔 Background Push Active (Device Registered)</span>
            </div>
            <button
              onClick={handleSendTestPush}
              style={{
                background: "#1E3D2A",
                border: "1px solid #3A7350",
                color: "#EEF4EE",
                padding: "3px 8px",
                borderRadius: 4,
                fontSize: 10,
                cursor: "pointer"
              }}
            >
              Test Push
            </button>
          </div>
        )}
        {/* Browser Autoplay Activation Button */}
        {!soundEnabled ? (
          <button
            onClick={handleActivateSound}
            style={{
              background: "#2E6B48",
              border: "1px solid #4CAF50",
              color: "#FFFFFF",
              padding: "14px 20px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 4px 14px rgba(76, 175, 80, 0.3)"
            }}
          >
            <Volume2 size={20} />
            <span>🔊 ACTIVATE ALERT SOUND</span>
          </button>
        ) : (
          <div style={{
            background: "rgba(46, 107, 72, 0.2)",
            border: "1px solid #2F6B48",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#A5D6A7",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Volume2 size={16} color="#4CAF50" />
              <span>🔊 Alert Sound Ready (Autoplay Unlocked)</span>
            </div>
            <button
              onClick={() => { startContinuousSiren(); setIsSirenActive(true); }}
              style={{
                background: "#1E3D2A",
                border: "1px solid #3A7350",
                color: "#EEF4EE",
                padding: "4px 8px",
                borderRadius: 4,
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              Test Siren
            </button>
          </div>
        )}

        {/* Test Alert Button */}
        <button
          onClick={handleSendTestAlert}
          style={{
            background: "#1A2E22",
            border: "1px solid #2E5C41",
            color: "#D6A84F",
            padding: "12px 18px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8
          }}
        >
          <span>🧪 TEST ALERT (BROADCAST TO ALL PHONES)</span>
        </button>
      </div>

      {/* Manual Siren Silence Bar if siren is playing outside overlay */}
      {isSirenActive && !activeAlert && (
        <div style={{
          background: "#E54D4D",
          color: "#FFFFFF",
          padding: "12px 16px",
          borderRadius: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          animation: "pulse 1s infinite"
        }}>
          <span style={{ fontWeight: 700, fontSize: 13 }}>🚨 SIREN ACTIVE</span>
          <button
            onClick={handleStopSiren}
            style={{
              background: "#FFFFFF",
              color: "#E54D4D",
              border: "none",
              padding: "6px 12px",
              borderRadius: 4,
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            STOP SIREN
          </button>
        </div>
      )}

      {/* Alert History Section */}
      <div style={{
        marginTop: 6,
        background: "#0D1E15",
        border: "1px solid #1B3828",
        borderRadius: 12,
        padding: 16,
        flex: 1
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#8FA396", textTransform: "uppercase" }}>
            Alert History ({alertHistory.length})
          </span>
          <Clock size={14} color="#8FA396" />
        </div>

        {alertHistory.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 10px", color: "#607D6D", fontSize: 12 }}>
            <Radio size={28} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
            <div>No alerts received yet.</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Alerts triggered by YOLO detection or test will appear here in real time.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alertHistory.map((item, idx) => (
              <div
                key={item.alert_id || idx}
                style={{
                  background: item.risk_level === "CRITICAL" || item.risk_level === "HIGH"
                    ? "rgba(229, 77, 77, 0.1)"
                    : "rgba(217, 154, 50, 0.1)",
                  border: `1px solid ${item.risk_level === "CRITICAL" || item.risk_level === "HIGH"
                      ? "rgba(229, 77, 77, 0.3)"
                      : "rgba(217, 154, 50, 0.3)"
                    }`,
                  borderRadius: 8,
                  padding: "10px 12px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#EEF4EE" }}>
                    {getAnimalEmoji(item.animal || item.species)} {(item.animal || item.species || "Wildlife").toUpperCase()}
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: item.risk_level === "CRITICAL" || item.risk_level === "HIGH" ? "#E54D4D" : "#D6A84F",
                    color: "#FFFFFF"
                  }}>
                    {item.risk_level || "HIGH"}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: "#8FA396", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <span>Conf: {item.confidence}%</span>
                  <span>{item.source || "Photo Detection"}</span>
                  <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {item.location && (
                  <div style={{ fontSize: 11, color: "#A5D6A7", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={11} />
                    <span>{item.location.village_name || `${item.latitude?.toFixed(4)}, ${item.longitude?.toFixed(4)}`}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FULL-SCREEN EMERGENCY ALERT OVERLAY (Requirement 15) */}
      {activeAlert && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(10, 4, 4, 0.95)",
          backdropFilter: "blur(8px)",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "24px 20px",
          boxSizing: "border-box",
          animation: "emergencyPulse 1.2s infinite ease-in-out"
        }}>
          {/* Header Warning */}
          <div style={{ textAlign: "center" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#E54D4D",
              color: "#FFFFFF",
              padding: "8px 18px",
              borderRadius: 30,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: "0.08em",
              boxShadow: "0 0 20px rgba(229, 77, 77, 0.8)"
            }}>
              <AlertTriangle size={18} />
              <span>🚨 KAVACH WILDLIFE ALERT</span>
            </div>

            {activeAlert.is_test && (
              <div style={{
                marginTop: 8,
                fontSize: 12,
                color: "#D6A84F",
                fontWeight: 700,
                letterSpacing: "0.1em"
              }}>
                [ 🧪 TEST ALERT BROADCAST ]
              </div>
            )}
            {activeAlert.demo && (
              <div style={{
                marginTop: 8,
                fontSize: 12,
                color: "#64B5F6",
                fontWeight: 700,
                letterSpacing: "0.1em"
              }}>
                [ 🧪 DEMO / SIMULATION EVENT ]
              </div>
            )}
          </div>

          {/* Central Animal Card */}
          <div style={{
            background: "rgba(35, 12, 12, 0.85)",
            border: "2px solid #E54D4D",
            borderRadius: 16,
            padding: "24px 20px",
            textAlign: "center",
            boxShadow: "0 0 30px rgba(229, 77, 77, 0.4)"
          }}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>
              {getAnimalEmoji(activeAlert.animal || activeAlert.species)}
            </div>

            <h1 style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: 32,
              fontWeight: 800,
              margin: 0,
              color: "#FFFFFF",
              letterSpacing: "0.06em"
            }}>
              {(activeAlert.animal || activeAlert.species || "WILDLIFE").toUpperCase()} DETECTED
            </h1>

            {/* Metrics */}
            <div style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              marginTop: 14
            }}>
              <div style={{ background: "rgba(0,0,0,0.5)", padding: "6px 14px", borderRadius: 8, border: "1px solid #441A1A" }}>
                <div style={{ fontSize: 10, color: "#8FA396" }}>CONFIDENCE</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#D6A84F" }}>
                  {activeAlert.confidence}%
                </div>
              </div>

              <div style={{ background: "rgba(0,0,0,0.5)", padding: "6px 14px", borderRadius: 8, border: "1px solid #441A1A" }}>
                <div style={{ fontSize: 10, color: "#8FA396" }}>RISK LEVEL</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#E54D4D" }}>
                  🔴 {activeAlert.risk_level || "HIGH"}
                </div>
              </div>
            </div>

            {/* Location & Time */}
            <div style={{ marginTop: 16, borderTop: "1px solid #441A1A", paddingTop: 14, fontSize: 13, color: "#CCD8D0", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <MapPin size={15} color="#4CAF50" />
                <span>
                  {activeAlert.location?.village_name || "Monitored Area"}
                  {activeAlert.location?.distance_str ? ` (${activeAlert.location.distance_str})` : ""}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: "#8FA396" }}>
                <Clock size={13} />
                <span>{new Date(activeAlert.timestamp).toLocaleTimeString()} · Source: {activeAlert.source || "Photo Detection"}</span>
              </div>
            </div>

            {/* Siren Indicator */}
            {isSirenActive && (
              <div style={{
                marginTop: 14,
                fontSize: 12,
                color: "#E54D4D",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6
              }}>
                <Volume2 size={16} />
                <span>🔊 SIREN ACTIVE · PHONE VIBRATING</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {isSirenActive && (
              <button
                onClick={handleStopSiren}
                style={{
                  background: "#4A1A1A",
                  border: "1px solid #E54D4D",
                  color: "#FFB0B0",
                  padding: "14px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <VolumeX size={18} />
                <span>🔇 STOP SIREN</span>
              </button>
            )}

            <button
              onClick={handleAcknowledge}
              style={{
                background: "#2E6B48",
                border: "1px solid #4CAF50",
                color: "#FFFFFF",
                padding: "16px",
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 4px 18px rgba(76, 175, 80, 0.4)"
              }}
            >
              <CheckCircle2 size={20} />
              <span>✓ ACKNOWLEDGE ALERT</span>
            </button>
          </div>
        </div>
      )}

      {/* Emergency pulse animation style tag */}
      <style>{`
        @keyframes emergencyPulse {
          0% { box-shadow: inset 0 0 20px rgba(229, 77, 77, 0.4); }
          50% { box-shadow: inset 0 0 50px rgba(229, 77, 77, 0.8); }
          100% { box-shadow: inset 0 0 20px rgba(229, 77, 77, 0.4); }
        }
      `}</style>
    </div>
  );
}
