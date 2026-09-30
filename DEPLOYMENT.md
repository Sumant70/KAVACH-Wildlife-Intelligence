# KAVACH — Production Deployment Guide

## Architecture Overview

```
GitHub Repo
    ├── Frontend → Vercel  (React + Vite)
    └── Backend  → Render  (FastAPI + YOLO)
```

---

## Prerequisites

- Node.js 18+, npm
- Python 3.10+, pip
- Firebase project (`kavach-wildlife-alert` or your own)
- Render account (render.com)
- Vercel account (vercel.com)
- YOLO model file: `backend/best.pt` (NOT in Git — handle separately)

---

## Step 1: Local Development Setup

### Frontend

```bash
# Install dependencies
cd /path/to/KAVACHHACKATHON-main
npm install

# Create local environment file
cp .env.example .env
# Edit .env:
#   VITE_API_BASE_URL=http://localhost:8000

# Start dev server
npm run dev
# Frontend available at: http://localhost:5173
```

### Backend

```bash
cd backend

# Create Python virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run backend
uvicorn predict:app --host 0.0.0.0 --port 8000 --reload
# Backend available at: http://localhost:8000

# Verify health
curl http://localhost:8000/health
```

### Local Production Build Test

```bash
# Build frontend
npm run build
# Preview production build
npm run preview
# Preview at: http://localhost:4173
```

---

## Step 2: Deploy Backend to Render

### 2.1 Prepare the Model File

The YOLO `.pt` model is NOT committed to Git. Choose one of:

**Option A — Render Disk (Recommended):**
1. Create a Render Disk in your dashboard
2. Mount at `/data`
3. Upload `best.pt` via Render Shell: `cp /path/to/best.pt /data/best.pt`
4. Set `MODEL_PATH=/data/best.pt` in env vars

**Option B — Download at startup:**
Create `backend/startup.sh`:
```bash
#!/bin/bash
if [ ! -f "$MODEL_PATH" ]; then
  wget -O "$MODEL_PATH" "$MODEL_DOWNLOAD_URL"
fi
uvicorn predict:app --host 0.0.0.0 --port $PORT --app-dir backend
```

### 2.2 Create Render Web Service

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repository
3. Configure:
   - **Root Directory:** (leave empty)
   - **Environment:** Python 3
   - **Build Command:** `pip install -r backend/requirements.txt`
   - **Start Command:** `uvicorn predict:app --host 0.0.0.0 --port $PORT --app-dir backend`
   - **Health Check Path:** `/health`

### 2.3 Set Backend Environment Variables in Render

Go to Render → Your Service → Environment:

```
ENVIRONMENT=production
ALLOWED_ORIGINS=https://YOUR-APP.vercel.app
MODEL_PATH=backend/best.pt

# Firebase Admin SDK (paste entire JSON on one line):
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"kavach-wildlife-alert","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}

WILDLIFE_CONFIDENCE_THRESHOLD=0.35
DEVICE=cpu
```

> **How to get FIREBASE_SERVICE_ACCOUNT_JSON:**
> 1. Firebase Console → Project Settings → Service Accounts
> 2. Click "Generate new private key"
> 3. Open the downloaded JSON file
> 4. Copy entire contents and paste as single-line value

### 2.4 Verify Backend Deployment

```bash
# Replace with your actual Render URL
curl https://kavach-api.onrender.com/health
# Expected: {"status":"ok","service":"KAVACH API",...}

curl https://kavach-api.onrender.com/api/health/model
# Expected: {"model":"ok",...}

curl https://kavach-api.onrender.com/api/health/firebase
# Expected: {"firebase":"ok",...} OR {"firebase":"not_configured",...}
```

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Import Project

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import from GitHub
3. Framework: **Vite** (auto-detected)
4. Root Directory: `.` (repo root)
5. Build Command: `npm run build`
6. Output Directory: `dist`

### 3.2 Set Frontend Environment Variables in Vercel

Go to Vercel → Project → Settings → Environment Variables:

```
VITE_API_BASE_URL=https://kavach-api.onrender.com

# Optional — only if you changed Firebase project:
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=kavach-wildlife-alert.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kavach-wildlife-alert
VITE_FIREBASE_STORAGE_BUCKET=kavach-wildlife-alert.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=342826294293
VITE_FIREBASE_APP_ID=1:342826294293:web:1cba7f3dfede990492021c
VITE_FIREBASE_VAPID_KEY=BCqNaemwZ7Jxl__LFtRc0DhVacQIWplDmn9X8etWHMUGRr6FNlV6o0cEiqZzpUCk_X4oMV4-O3IF1ZlXRNHpwL0
```

### 3.3 Update Backend CORS

After getting your Vercel URL (e.g., `https://kavach-app.vercel.app`):

1. Go to Render → Your Service → Environment
2. Update `ALLOWED_ORIGINS=https://kavach-app.vercel.app`
3. Render will auto-redeploy

### 3.4 Verify Frontend Deployment

1. Visit your Vercel URL
2. Open browser DevTools → Console — no CORS errors
3. Dashboard shows "API Connected" (green)

---

## Step 4: Firebase FCM Setup

### 4.1 Configure Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com) → kavach-wildlife-alert
2. Project Settings → Cloud Messaging
3. Verify Web Push certificates exist
4. Note the VAPID public key

### 4.2 Authorize Your Domains

Firebase Console → Authentication → Settings → Authorized domains:
- Add: `kavach-app.vercel.app` (your Vercel domain)
- Add: `kavach-api.onrender.com` (backend domain)

### 4.3 Test FCM

1. Open deployed frontend
2. Go to "Phone Connection" tab
3. Click "Enable Push Notifications"
4. Allow browser notification permission
5. In Command Center, click "Test Alert"
6. Notification should appear

---

## Step 5: Post-Deployment Verification

```bash
# 1. Health check
curl https://kavach-api.onrender.com/health

# 2. Model health
curl https://kavach-api.onrender.com/api/health/model

# 3. Firebase health
curl https://kavach-api.onrender.com/api/health/firebase

# 4. Test image detection
curl -X POST https://kavach-api.onrender.com/api/detect/image \
  -F "file=@test_image.jpg"

# 5. Test alert
curl -X POST https://kavach-api.onrender.com/api/alerts/test \
  -H "Content-Type: application/json" \
  -d '{"device_name":"Production Test"}'

# 6. Test siren
curl -X POST https://kavach-api.onrender.com/api/alerts/test-siren \
  -H "Content-Type: application/json" \
  -d '{"device_name":"Production Test"}'
```

---

## Troubleshooting

### "API Unreachable" on dashboard
- Check `VITE_API_BASE_URL` in Vercel env vars
- Check Render service is running (`/health` endpoint)
- Check CORS: `ALLOWED_ORIGINS` in Render must include your Vercel URL

### "FCM Status: FAILED"
- Check `FIREBASE_SERVICE_ACCOUNT_JSON` in Render env vars
- Ensure JSON is valid (no line breaks, properly escaped)
- Check Firebase Console → Service Accounts for the key

### "Model Status: FAILED"
- Check `MODEL_PATH` points to the actual `.pt` file
- Confirm the file exists on the Render server
- Check Render logs for `[YOLO]` lines

### CORS errors in browser
- `ALLOWED_ORIGINS` must exactly match the Vercel URL (including `https://`)
- No trailing slash in the origin

### Service Worker / FCM not working
- FCM requires HTTPS — ensure you're accessing via `https://`
- Check that `firebase-messaging-sw.js` returns status 200
- Open DevTools → Application → Service Workers

### WebSocket connection fails
- WebSocket uses `wss://` on HTTPS — ensure `VITE_API_BASE_URL` starts with `https://`
- Render supports WebSockets on all plans

---

## Notes on Physical Siren

The `POST /api/alerts/test-siren` broadcasts a WebSocket event to all connected browser tabs and triggers browser audio. For a **physical IoT siren device:**
- Set `SIREN_IOT_ENDPOINT` to your IoT relay HTTP endpoint
- The backend will POST `{"command":"ACTIVATE","duration_sec":30}` to that endpoint
- Without `SIREN_IOT_ENDPOINT`, the siren is browser audio only

## Notes on CCTV / RTSP Cameras

RTSP cameras are only accessible on the **same local network** as the backend server. On a cloud-hosted backend, RTSP streams from local cameras are not reachable. For production:
- Deploy the backend on an on-premise server with network access to cameras
- Or use a VPN/tunneling solution (e.g., ngrok, Tailscale)
- Or use the browser webcam / cross-device camera features (work over HTTPS)
