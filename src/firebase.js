import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

// ── Firebase Web Client Configuration ─────────────────────────────────────────
// Firebase web API keys are NOT private/secret — they are intentionally public
// and are used to identify your Firebase project from the browser.
// Restrict them via Firebase Console → App Check / authorized domains instead.
//
// For production deployments: set these in your hosting provider's environment
// variables (Vercel → Project Settings → Environment Variables):
//
//   VITE_FIREBASE_API_KEY
//   VITE_FIREBASE_AUTH_DOMAIN
//   VITE_FIREBASE_PROJECT_ID
//   VITE_FIREBASE_STORAGE_BUCKET
//   VITE_FIREBASE_MESSAGING_SENDER_ID
//   VITE_FIREBASE_APP_ID
//   VITE_FIREBASE_VAPID_KEY
//
// If the VITE_ vars are not set, the hardcoded project defaults are used as
// a fallback so that local development continues to work out of the box.
// ─────────────────────────────────────────────────────────────────────────────

const _e = typeof import.meta !== "undefined" ? import.meta.env : {};

export const firebaseConfig = {
  apiKey:            _e.VITE_FIREBASE_API_KEY            || "AIzaSyC5P63wx77UpADqArWEELBZDa8DIy4iuxc",
  authDomain:        _e.VITE_FIREBASE_AUTH_DOMAIN        || "kavach-wildlife-alert.firebaseapp.com",
  projectId:         _e.VITE_FIREBASE_PROJECT_ID         || "kavach-wildlife-alert",
  storageBucket:     _e.VITE_FIREBASE_STORAGE_BUCKET     || "kavach-wildlife-alert.firebasestorage.app",
  messagingSenderId: _e.VITE_FIREBASE_MESSAGING_SENDER_ID || "342826294293",
  appId:             _e.VITE_FIREBASE_APP_ID             || "1:342826294293:web:1cba7f3dfede990492021c",
  measurementId:     _e.VITE_FIREBASE_MEASUREMENT_ID     || "G-LC5FN83JBJ"
};

// VAPID Public Key for Web Push Certificate
// This is the *public* key from Firebase Console → Cloud Messaging → Web Push certificates
export const VAPID_KEY =
  _e.VITE_FIREBASE_VAPID_KEY ||
  "BCqNaemwZ7Jxl__LFtRc0DhVacQIWplDmn9X8etWHMUGRr6FNlV6o0cEiqZzpUCk_X4oMV4-O3IF1ZlXRNHpwL0";

// Initialize Firebase client app (Client-side ONLY — no service-account secrets here)
export const app = initializeApp(firebaseConfig);

let messagingInstance = null;

/**
 * Validates whether the current browser and network origin can support Firebase Web Push.
 * Accurately diagnoses secure context, Notification, ServiceWorker, and PushManager availability.
 */
export async function checkFcmSupport() {
  if (typeof window === "undefined") {
    return {
      supported: false,
      reason: "Window context unavailable (SSR).",
      isSecureContext: false
    };
  }

  const isSecure = Boolean(window.isSecureContext);
  const hasNotification = "Notification" in window;
  const hasServiceWorker = "serviceWorker" in navigator;
  const hasPushManager = "PushManager" in window;

  if (!isSecure) {
    return {
      supported: false,
      reason: "Insecure Origin: Web Push & Service Workers require HTTPS or localhost. Over LAN HTTP, test via localhost, HTTPS, or enable chrome://flags/#unsafely-treat-insecure-origin-as-secure on Android Chrome.",
      isSecureContext: false,
      hasNotification,
      hasServiceWorker,
      hasPushManager
    };
  }

  if (!hasNotification) {
    return {
      supported: false,
      reason: "Notification API is not supported in this browser.",
      isSecureContext: isSecure,
      hasNotification,
      hasServiceWorker,
      hasPushManager
    };
  }

  if (!hasServiceWorker) {
    return {
      supported: false,
      reason: "Service Workers are not supported or disabled in this browser.",
      isSecureContext: isSecure,
      hasNotification,
      hasServiceWorker,
      hasPushManager
    };
  }

  if (!hasPushManager) {
    return {
      supported: false,
      reason: "Push messaging (PushManager) is not supported in this browser.",
      isSecureContext: isSecure,
      hasNotification,
      hasServiceWorker,
      hasPushManager
    };
  }

  try {
    const supported = await isSupported();
    if (!supported) {
      return {
        supported: false,
        reason: "Firebase Messaging is not supported in this browser environment.",
        isSecureContext: isSecure,
        hasNotification,
        hasServiceWorker,
        hasPushManager
      };
    }
    return {
      supported: true,
      reason: null,
      isSecureContext: isSecure,
      hasNotification,
      hasServiceWorker,
      hasPushManager
    };
  } catch (err) {
    return {
      supported: false,
      reason: `Firebase isSupported check failed: ${err.message || err}`,
      isSecureContext: isSecure,
      hasNotification,
      hasServiceWorker,
      hasPushManager
    };
  }
}

/**
 * Obtains the Firebase Messaging instance if supported.
 */
export async function getFirebaseMessaging() {
  if (typeof window === "undefined") return null;
  const check = await checkFcmSupport();
  if (!check.supported) {
    console.warn(`[FCM] ${check.reason}`);
    return null;
  }
  try {
    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }
    return messagingInstance;
  } catch (err) {
    console.warn("[FCM] getMessaging initialization failed:", err);
    return null;
  }
}

/**
 * Requests browser notification permission silently without triggering any sound.
 * Obtains the FCM registration token and registers it with the backend database.
 */
export async function requestFcmToken(apiBaseUrl = "", deviceInfo = {}) {
  const support = await checkFcmSupport();
  if (!support.supported) {
    return {
      success: false,
      error: support.reason,
      isSecureContext: support.isSecureContext
    };
  }

  try {
    // 1. Silent Permission Request
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[FCM] Notification permission state:", permission);
      return { success: false, permission, error: `Notification permission: ${permission}` };
    }

    // 2. Register Service Worker with root scope
    let swReg = null;
    if ("serviceWorker" in navigator) {
      try {
        swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.error("[FCM] Service Worker registration failed:", swErr);
        return { success: false, error: `Service Worker registration failed: ${swErr.message || swErr}` };
      }
    } else {
      return { success: false, error: "Service Worker unavailable." };
    }

    // 3. Obtain Firebase Messaging Instance
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return { success: false, error: "FCM Messaging not initialized in current environment." };
    }

    // 4. Generate FCM Device Token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (!token) {
      return { success: false, error: "FCM returned an empty token." };
    }

    console.log("[FCM] Token generated successfully:", token.substring(0, 15) + "...");

    // Cache locally
    try {
      localStorage.setItem("kavach_fcm_token", token);
    } catch {}

    // 5. Register with backend database
    const registered = await sendTokenToBackend(token, apiBaseUrl, deviceInfo);

    return {
      success: true,
      token,
      permission,
      backendRegistered: registered
    };
  } catch (err) {
    console.error("[FCM] Error acquiring FCM token:", err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Sends token securely to the KAVACH Python backend.
 * @param {string} token - FCM device token
 * @param {string} apiBaseUrl - Backend base URL (from env)
 * @param {object} deviceInfo - Optional device metadata
 */
export async function sendTokenToBackend(token, apiBaseUrl = "", deviceInfo = {}) {
  try {
    const cleanBase = (apiBaseUrl || _e.VITE_API_BASE_URL || "").replace(/\/+$/, "");
    if (!cleanBase) {
      console.warn("[FCM] No API base URL configured — skipping backend token registration");
      return false;
    }
    const payload = {
      token: token.trim(),
      device_id: deviceInfo.deviceId || localStorage.getItem("kavach_device_id") || "DEV-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      device_name: deviceInfo.deviceName || localStorage.getItem("kavach_device_name") || "Field Monitor Phone",
      role: deviceInfo.role || "Field Monitor",
      platform: navigator.userAgentData?.platform || navigator.platform || "Web",
      user_agent: navigator.userAgent
    };

    const res = await fetch(`${cleanBase}/api/fcm/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      console.log("[FCM] Token registered with backend for:", payload.device_name, data);
      return true;
    } else {
      console.warn("[FCM] Backend registration returned status:", res.status);
      return false;
    }
  } catch (err) {
    console.error("[FCM] Failed to transmit token to backend:", err);
    return false;
  }
}

/**
 * Subscribes to foreground push messages while page is open.
 */
export async function attachForegroundListener(callback) {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return () => {};
    return onMessage(messaging, (payload) => {
      console.log("[FCM] Received foreground push payload:", payload);
      callback(payload);
    });
  } catch (e) {
    console.warn("[FCM] Unable to attach foreground listener:", e);
    return () => {};
  }
}
