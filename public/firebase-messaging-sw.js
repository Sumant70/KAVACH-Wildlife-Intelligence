// KAVACH Firebase Cloud Messaging Service Worker
// ─────────────────────────────────────────────────────────────────────────────
// Handles background push notifications when the browser tab is inactive,
// minimized, or closed.
//
// HOW TO UPDATE FIREBASE CONFIG FOR PRODUCTION:
//   This service worker is served as a static file and cannot read Vite env vars.
//   If you change your Firebase project, update the config object below to match
//   what is in src/firebase.js (same values — these are public client-side keys).
//
// IMPORTANT: The Firebase config here contains only PUBLIC web API keys.
// These are NOT secret — they are safe to commit and are published on every
// Firebase web app. Protect your project via Firebase Console → App Check
// and authorized domains, NOT by hiding these keys.
// ─────────────────────────────────────────────────────────────────────────────

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC5P63wx77UpADqArWEELBZDa8DIy4iuxc",
  authDomain: "kavach-wildlife-alert.firebaseapp.com",
  projectId: "kavach-wildlife-alert",
  storageBucket: "kavach-wildlife-alert.firebasestorage.app",
  messagingSenderId: "342826294293",
  appId: "1:342826294293:web:1cba7f3dfede990492021c",
  measurementId: "G-LC5FN83JBJ"
};

try {
  importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

  firebase.initializeApp(FIREBASE_CONFIG);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log("[FCM-SW] Received background message:", payload);

    const animal = payload.data?.animal || payload.data?.species || "Wildlife";
    const confidence = payload.data?.confidence || "";
    const risk = payload.data?.risk_level || "HIGH";
    const location = payload.data?.village_name || "Sanctuary Zone";

    const title = payload.notification?.title || `\uD83D\uDEA8 WILDLIFE ALERT: ${animal.toUpperCase()} DETECTED`;
    const body = payload.notification?.body || `\u26A0\uFE0F ${risk} Risk | Conf: ${confidence}% | ${location}. Tap to view immediate threat telemetry.`;

    const notificationOptions = {
      body: body,
      icon: "/kavach-logo.png",
      badge: "/kavach-logo.png",
      tag: payload.data?.event_id || `wildlife-${Date.now()}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 600],
      data: {
        url: payload.data?.url || payload.data?.click_action || "/?view=alert-device",
        eventId: payload.data?.event_id
      }
    };

    return self.registration.showNotification(title, notificationOptions);
  });
} catch (err) {
  console.warn("[FCM-SW] Initialization error in service worker:", err);
}

self.addEventListener("notificationclick", (event) => {
  console.log("[FCM-SW] Notification click event received:", event);
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/?view=alert-device";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If KAVACH window is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes("alert-device") && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
