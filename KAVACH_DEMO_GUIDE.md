# KAVACH — HACKATHON LIVE DEMO GUIDE
## Complete Wildlife Detection + Real-Time Community Alert System

---

## 🎯 Judge Presentation Explanation (Read to Judges)

> "KAVACH uses the YOLO-based wildlife detection pipeline to identify animals from camera or image input. Once a relevant wildlife detection is confirmed, the alert engine generates a structured event containing the animal, confidence, risk level, timestamp and location. The event is broadcast through WebSocket to connected community alert devices. In our prototype demonstration, these devices are smartphones representing field/community monitoring devices. Each connected phone can display the warning and activate its local alert sound and vibration."

*(Note: We do not claim that the hackathon prototype sends paid SMS to villagers; it uses real-time local network WebSocket dispatch to field monitors without requiring paid third-party APIs).*

---

## 🚀 Live Demo Step-by-Step Instructions

### STEP 1: Find Laptop LAN IP
1. Open PowerShell or Command Prompt on your laptop.
2. Run:
   ```powershell
   ipconfig
   ```
3. Locate your **IPv4 Address** under your active Wi-Fi or Hotspot adapter (e.g., `192.168.1.100` or `192.168.43.50`).

---

### STEP 2: Start KAVACH Backend Server
1. In terminal, navigate to the project directory:
   ```powershell
   python -u backend/predict.py
   ```
   *(Or alternatively: `uvicorn predict:app --app-dir backend --host 0.0.0.0 --port 8000`)*
2. Confirm the terminal displays:
   ```
   INFO: Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
   ```

---

### STEP 3: Start Frontend Dev Server
1. In a second terminal window, run:
   ```powershell
   npm run dev
   ```
2. Confirm Vite is listening on `0.0.0.0:5173`:
   ```
   ➜  Local:   http://localhost:5173/
   ➜  Network: http://192.168.X.X:5173/
   ```

---

### STEP 4: Connect Phones to the Same Wi-Fi / Hotspot
- Ensure your laptop and the 3–4 smartphones are all connected to the **same Wi-Fi router or phone mobile hotspot**.

---

### STEP 5: Open Mobile Alert Page on Each Phone
1. On each phone's mobile browser (Chrome/Safari), open:
   ```
   http://<YOUR_LAPTOP_IP>:5173/alert-device
   ```
   *(Example: `http://192.168.1.100:5173/alert-device`)*
2. Or on the laptop dashboard, click **"Connect Phones (QR / URL)"** to display the QR Code and scan it with each phone camera!

---

### STEP 6: Assign Device Roles
Assign each phone a distinct monitoring role by tapping one of the preset buttons:
- **Phone 1:** `[ Team Leader ]`
- **Phone 2:** `[ Field Monitor ]`
- **Phone 3:** `[ Forest Monitor ]`
- **Phone 4:** `[ Emergency Monitor ]`

---

### STEP 7: Unlock Browser Audio on Every Phone
1. On each phone, tap:
   ```
   [ 🔊 ACTIVATE ALERT SOUND ]
   ```
2. Confirm the status changes to:
   ```
   🔊 Alert Sound Ready
   ```
   *(This satisfies mobile browser autoplay security policies so future alerts can play the siren automatically).*

---

### STEP 8: Verify Connected Status
1. Check each phone displays:
   ```
   🟢 CONNECTED
   ```
2. Check your laptop dashboard under **🚨 COMMUNITY WILDLIFE ALERT NETWORK**:
   ```
   Status: 🟢 ONLINE
   Connected Devices: 4
   🟢 Team Leader
   🟢 Field Monitor
   🟢 Forest Monitor
   🟢 Emergency Monitor
   ```

---

### STEP 9: Test Alert Broadcast (Quick Verification)
1. On any connected phone, tap:
   ```
   [ 🧪 TEST ALERT (BROADCAST TO ALL PHONES) ]
   ```
2. **Observe**:
   - Every single phone immediately displays the fullscreen emergency overlay: `🚨 KAVACH ALERT — TEST ALERT BROADCAST`.
   - Continuous emergency siren wails across all phones.
   - Phones vibrate (`[300, 150, 300, 150, 600]` pattern).
3. Tap `[ ✓ ACKNOWLEDGE ALERT ]` on any phone to dismiss the overlay and silence the siren.

---

### STEP 10: Real YOLO Wildlife Detection Demo
1. On your laptop, navigate to the **Detection Hub** (or **AI Wildlife Detection Studio**).
2. Click **Upload Image** or choose one of the high-res 1-click test cases:
   - Select `elephant.jpg` (or `tiger.jpg` / `leopard.jpg`).
3. Click:
   ```
   [ DETECT WILDLIFE ]
   ```
4. **Observe the Live Chain in front of judges**:
   ```
   User Uploads Wildlife Photo
           ↓
   Backend Runs YOLO Model (best.pt / yolo11n.pt)
           ↓
   Species Detected (e.g. Asian Elephant, 37.2% / 94% conf)
           ↓
   Risk Engine Evaluates Conflict Score & Settlement Proximity
           ↓
   Alert Engine Formulates Structured Alert Event
           ↓
   WebSocket Broadcasts Event (<150ms)
           ↓
   Phone 1 (Team Leader)      ──▶ 🚨 Alert Overlay + 🔊 Siren + 📳 Vibration
   Phone 2 (Field Monitor)    ──▶ 🚨 Alert Overlay + 🔊 Siren + 📳 Vibration
   Phone 3 (Forest Monitor)   ──▶ 🚨 Alert Overlay + 🔊 Siren + 📳 Vibration
   Phone 4 (Emergency Monitor)──▶ 🚨 Alert Overlay + 🔊 Siren + 📳 Vibration
   ```
5. Click `[ 📍 VIEW LOCATION ON GIS ]` to plot the detected animal on the interactive Leaflet map corridor!

---

### STEP 11: Demo Simulation Mode (Fallback for Zero-Image Scenarios)
If you wish to demonstrate alerts without uploading files:
1. On the main dashboard under **COMMUNITY WILDLIFE ALERT NETWORK**, click any of the rapid simulation buttons:
   - `[ 🐘 SIMULATE ELEPHANT ]`
   - `[ 🐅 SIMULATE TIGER ]`
   - `[ 🐆 SIMULATE LEOPARD ]`
   - `[ 🐗 SIMULATE WILD BOAR ]`
   - `[ 🦌 SIMULATE DEER ]`
2. All phones will receive the event with clear `[ 🧪 DEMO / SIMULATION EVENT ]` labeling.

---

## 🛠️ System Architecture Summary

| Component | Port / Route | Description |
| :--- | :--- | :--- |
| **Backend API** | `0.0.0.0:8000` | FastAPI server hosting YOLO inference & Risk Engine |
| **Health Check** | `GET /health` | Instant service telemetry check |
| **Photo Detection** | `POST /api/detect/image` | Standardized JSON with animal, bbox, confidence, risk score |
| **Alert WebSocket** | `ws://<IP>:8000/ws/alerts` | Real-time broadcast channel for community phones |
| **Camera WebSocket** | `ws://<IP>:8000/ws/camera/{id}` | Dedicated CCTV channel (completely preserved and isolated) |
| **Frontend UI** | `0.0.0.0:5173` | Vite React App with reverse proxy |
| **Mobile Alert Device** | `/alert-device` | Clean mobile-first interface for field monitoring smartphones |
