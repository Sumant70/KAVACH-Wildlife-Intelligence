# KAVACH Production Deployment Checklist

> Run through this checklist before declaring the deployment successful.
> Mark each item only when **actually verified** — not just when code looks correct.

---

## Build & Local Verification

- [x] `npm install` works (exit code 0)
- [x] `npm run build` succeeds (exit code 0, dist/ created)
- [ ] `npm run preview` starts successfully
- [ ] `pip install -r backend/requirements.txt` completes without errors
- [ ] FastAPI starts locally: `uvicorn predict:app --host 0.0.0.0 --port 8000 --app-dir backend`
- [ ] `GET http://localhost:8000/health` returns `{"status":"ok"}`
- [ ] `GET http://localhost:8000/api/health/model` shows model loaded
- [ ] Image detection works locally (POST to `/api/detect/image` with test image)

---

## Environment Configuration

- [ ] `.env.example` reviewed and understood
- [ ] `VITE_API_BASE_URL` set in Vercel to production backend URL
- [ ] `ALLOWED_ORIGINS` set in Render to production frontend URL (no trailing slash)
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` set in Render (valid JSON, Firebase Admin)
- [ ] `MODEL_PATH` set in Render and model file accessible at that path
- [ ] No `.env` or `serviceAccountKey.json` committed to Git
- [ ] Firebase API keys only in `VITE_` env vars (public client keys — acceptable)

---

## Backend Deployment (Render)

- [ ] Render web service created and connected to GitHub repo
- [ ] Build command: `pip install -r backend/requirements.txt`
- [ ] Start command: `uvicorn predict:app --host 0.0.0.0 --port $PORT --app-dir backend`
- [ ] Health check path: `/health`
- [ ] Service deploys without errors in Render logs
- [ ] `GET https://YOUR-API.onrender.com/health` returns `{"status":"ok"}`
- [ ] `GET https://YOUR-API.onrender.com/api/health/model` shows `"model":"ok"`
- [ ] `GET https://YOUR-API.onrender.com/api/health/firebase` (configured or not_configured is fine)

---

## Frontend Deployment (Vercel)

- [ ] Vercel project connected to GitHub repo
- [ ] Framework detected as Vite
- [ ] Build succeeds on Vercel (check build logs)
- [ ] Production frontend loads at Vercel URL
- [ ] No 404 on page refresh (SPA rewrite working)
- [ ] Browser console shows no CORS errors
- [ ] Dashboard shows backend connected (green status indicators)

---

## CORS Verification

- [ ] Open deployed frontend in browser
- [ ] Open DevTools → Network tab
- [ ] Trigger a fetch to backend (refresh dashboard)
- [ ] No "CORS policy" errors in console
- [ ] No "Origin not allowed" errors in Render logs

---

## Firebase FCM

- [ ] `GET /api/health/firebase` returns `"configured": true` (if Admin SDK set up)
- [ ] Open Mobile Alert Device tab on deployed frontend
- [ ] Click "Enable Push Notifications"
- [ ] Browser asks for notification permission — grant it
- [ ] Token registered (check Render logs for `[FCM] Token registered`)
- [ ] Click "Test Alert" in Command Center
- [ ] FCM test push delivered (notification appears)
- [ ] `POST /api/fcm/test` returns `"success": true`

---

## Service Worker (FCM Background Notifications)

- [ ] `https://YOUR-APP.vercel.app/firebase-messaging-sw.js` returns 200 OK
- [ ] DevTools → Application → Service Workers shows SW registered
- [ ] Background notification received when tab is in background

---

## Detection Features

- [ ] Image upload → wildlife detected (use a test wildlife image)
- [ ] Video upload → frames analyzed
- [ ] Live webcam detection works over HTTPS
- [ ] Detection results appear in Detections Log
- [ ] High-risk detection generates alert in Alerts section

---

## Alert Features

- [ ] `POST /api/alerts/test` returns `{"success":true}`
- [ ] Test alert appears in Alert Device view (WebSocket)
- [ ] `POST /api/alerts/test-siren` dispatches WebSocket event
- [ ] Browser plays siren sound on Alert Device page
- [ ] Loading/Success/Error states shown properly (not generic messages)

---

## YOLO Model

- [ ] `GET /api/health/model` shows `"model":"ok"`
- [ ] Model classes listed correctly
- [ ] Detection with a tiger/elephant/leopard/wild boar image returns correct species
- [ ] Unrelated image (car, person) returns `"detected": false`
- [ ] Backend startup log shows model validation report

---

## Camera System

- [ ] Browser webcam works over HTTPS (`getUserMedia`)
- [ ] Camera shows "requires HTTPS" message on HTTP (not a crash)
- [ ] CCTV/RTSP cameras properly show "OFFLINE" if not on local network
- [ ] No fake "ONLINE" status for cameras that aren't actually connected
- [ ] 4-camera CCTV grid displays correctly

---

## Security

- [ ] No `serviceAccountKey.json` in Git history (check with `git log --all -- backend/*.json`)
- [ ] No Firebase private key visible in browser source
- [ ] No backend environment variables exposed to frontend
- [ ] `.gitignore` does NOT block `package.json` or `vercel.json`
- [ ] `vercel.json` has security headers (X-Frame-Options, X-Content-Type-Options)
- [ ] Backend CORS only allows the actual frontend domain (not `*`) in production

---

## No Localhost URLs in Production

- [ ] No `localhost:8000` in deployed frontend network calls
- [ ] No `127.0.0.1` in deployed frontend network calls
- [ ] No LAN IPs (`192.168.`, `172.16.`, `10.`) in production API calls
- [ ] WebSocket connects to `wss://YOUR-API.onrender.com/ws/...` (not ws://localhost)

---

## What Still Needs Manual Verification After Deployment

These cannot be verified locally:

| Item | Why Manual |
|------|-----------|
| FCM push to real mobile device | Requires actual registered device token |
| Physical IoT siren trigger | Requires `SIREN_IOT_ENDPOINT` hardware |
| SMS alerts (Twilio) | Requires Twilio credentials |
| RTSP camera integration | Requires cameras on same network as backend |
| Background FCM on locked phone | OS-dependent, browser-dependent |
| Data persistence across Render redeploys | Depends on whether Render Disk is configured |

---

## Final Sign-Off

**Deployment is production-ready when:**
- All checked items above are verified ✅
- No unchecked items are blocking core functionality
- Remaining unchecked items are documented as known limitations

**Do NOT declare deployment successful if:**
- `npm run build` fails
- `/health` endpoint returns error
- CORS errors appear in browser console
- FCM is expected to work but `firebase: not_configured` and no service account set
- Model loaded with wrong classes
