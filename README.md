# 🛡️ KAVACH — Wildlife Early Warning & Alert Network

> **DETECT • ANALYZE • ALERT • PROTECT**

KAVACH is an AI-powered wildlife monitoring and early-warning platform designed to help detect wildlife activity, monitor potential threats, visualize incidents, and support faster response through a centralized intelligence dashboard.

The platform combines **Computer Vision, FastAPI, real-time monitoring, GIS visualization, device management, and emergency alert workflows** into a single system.

---

## 🌐 Live Application

### 🚀 KAVACH Frontend

**https://kavach-frontend-qkri.onrender.com**

### ⚙️ KAVACH Backend API

**https://kavach-api-i2pt.onrender.com**

### 📚 API Health Check

**https://kavach-api-i2pt.onrender.com**

The production backend currently reports:

* API: Online
* AI Engine: Online
* Database: Online
* YOLO Model: Loaded
* Device: CPU

---

# 🎯 Project Vision

Wildlife monitoring often involves large geographical areas, camera feeds, field observations, and emergency response systems.

KAVACH aims to bring these components together into one centralized platform.

Instead of relying only on manual monitoring, KAVACH provides an intelligent workflow:

```text
Wildlife Image / Camera
          ↓
    AI Detection
          ↓
  Species Identification
          ↓
 Threat / Risk Analysis
          ↓
   Incident Monitoring
          ↓
 GIS / Dashboard
          ↓
     Alert System
          ↓
   Human Response
```

The objective is to help monitoring teams identify wildlife activity faster and support timely intervention.

---

# 🚨 Problem Statement

Wildlife and human-wildlife conflict monitoring can become difficult when:

* Large areas need continuous observation
* Camera-trap data is generated continuously
* Wildlife sightings need quick verification
* Important incidents can be missed
* Monitoring information is distributed across different systems
* Emergency teams need faster access to incident information

KAVACH addresses this challenge through a centralized wildlife intelligence dashboard.

---

# 💡 Our Solution

KAVACH provides a unified platform for:

### 🤖 AI Wildlife Detection

Detect animals from uploaded images and supported camera inputs using YOLO-based computer vision.

### 📷 Detection Hub

Analyze wildlife images and receive AI-generated detection results.

### 🗺️ GIS Hotspot Monitoring

Visualize wildlife incidents and monitoring locations through an interactive map interface.

### 🚨 Alert Management

Provide an alert workflow for detected threats and emergency situations.

### 📱 Mobile Alert Device

Support emergency alert and siren workflows for field-level response.

### 📊 Command Center

Provide a centralized dashboard for monitoring system status, incidents, devices, and AI detections.

---

# 🧠 AI Detection System

KAVACH uses a YOLO-based Computer Vision pipeline.

```text
Input Image
     ↓
YOLO Model
     ↓
Object Detection
     ↓
Confidence Filtering
     ↓
Wildlife Classification
     ↓
Detection Result
     ↓
Alert / Monitoring
```

The backend performs AI inference through the FastAPI server.

### Current Production Model

The currently deployed model is `best.pt`.

The production API currently exposes support for:

* 🐘 Elephant
* 🐕 Dog

Other wildlife species are currently marked as unsupported by the deployed model rather than being falsely mapped to another animal.

This behavior is intentional so that unsupported species are not incorrectly reported.

---

# ⚙️ Core Architecture

```text
                    KAVACH PLATFORM
                           │
          ┌────────────────┴────────────────┐
          │                                 │
          ▼                                 ▼
   React + Vite Frontend              FastAPI Backend
          │                                 │
          │                                 ▼
          │                          YOLO AI Engine
          │                                 │
          │                                 ▼
          │                          Detection Service
          │                                 │
          │                                 ▼
          │                            SQLite DB
          │                                 │
          └──────────────┬──────────────────┘
                         │
                         ▼
                  Alert / Monitoring
                         │
                ┌────────┴────────┐
                │                 │
                ▼                 ▼
          GIS Dashboard      Mobile Alerts
```

---

# 🏗️ System Components

## 1. 🖥️ Command Center

The Command Center acts as the main monitoring interface.

It provides access to:

* System status
* AI engine status
* Active incidents
* Monitoring devices
* Detection information
* Alert status
* Operational overview

---

## 2. 🤖 Detection Hub

The Detection Hub is responsible for AI-powered wildlife analysis.

Users can provide supported media for analysis and receive:

* Detected object
* Confidence score
* Bounding box information
* Species classification
* Detection status

The detection engine is powered by YOLO through the backend.

---

## 3. 📷 Camera Monitoring

KAVACH includes a multi-camera monitoring interface designed for wildlife surveillance.

The system can represent multiple camera channels and monitor their status.

The current production deployment is designed around the application architecture; direct access to private/local RTSP CCTV networks requires an appropriate camera gateway or network-accessible camera infrastructure.

---

# 🗺️ GIS Hotspot

KAVACH includes an interactive GIS-based monitoring interface.

The GIS layer is designed to help visualize:

* Wildlife locations
* Incident locations
* Monitoring zones
* Potential hotspots
* Field activity

The frontend uses map-based visualization to provide geographical context to wildlife incidents.

---

# 🚨 Alert System

KAVACH includes an emergency alert architecture designed to support rapid communication.

The system includes workflows for:

* Test alerts
* Emergency alerts
* Device notifications
* Alert monitoring
* Siren workflows

The platform is designed around a human-in-the-loop approach where AI provides detection information while authorized users make operational decisions.

---

# 📱 Mobile Alert Device

The Mobile Alert Device interface is designed for field-level response.

Possible actions include:

```text
AI Detection
     ↓
Threat Identified
     ↓
Alert Generated
     ↓
Field Device
     ↓
Siren / Notification
     ↓
Human Response
```

This creates a bridge between AI detection and physical response.

---

# 🔥 Firebase / FCM

KAVACH contains Firebase Cloud Messaging integration for notification workflows.

The intended architecture is:

```text
KAVACH Backend
      ↓
Firebase Cloud Messaging
      ↓
Registered Device
      ↓
Push Notification
```

Firebase credentials must be configured securely in the production environment before real FCM notifications can be delivered.

> **Current production status:** Firebase credentials are not configured on the deployed backend yet.

---

# 🗄️ Database

KAVACH currently uses SQLite for application data storage.

The backend initializes and manages the application database.

Example data areas include:

* Detection records
* Incidents
* Devices
* Alerts
* System information

The architecture can be extended to a production database such as PostgreSQL when required for larger deployments.

---

# 🔌 Backend API

The KAVACH backend is built using **FastAPI**.

Production API:

```text
https://kavach-api-i2pt.onrender.com
```

The backend provides endpoints for:

* Health monitoring
* AI model status
* Firebase status
* Wildlife detection
* Alert workflows
* Device management
* Application services

FastAPI also provides interactive API documentation when enabled.

---

# 🖥️ Frontend

The KAVACH dashboard is built using:

* React
* TypeScript
* Vite
* CSS
* Interactive map components
* API integration

Production frontend:

```text
https://kavach-frontend-qkri.onrender.com
```

The frontend communicates with the FastAPI backend to retrieve AI and monitoring information.

---

# 🛠️ Technology Stack

| Layer                | Technology               |
| -------------------- | ------------------------ |
| Frontend             | React                    |
| Language             | TypeScript / JavaScript  |
| Build Tool           | Vite                     |
| Backend              | FastAPI                  |
| Backend Language     | Python                   |
| AI / Computer Vision | YOLO                     |
| Deep Learning        | PyTorch                  |
| Database             | SQLite                   |
| Notifications        | Firebase Cloud Messaging |
| Maps                 | Leaflet / GIS            |
| API Server           | Uvicorn                  |
| Deployment           | Render                   |
| Version Control      | Git + GitHub             |

---

# 📂 Project Structure

```text
KAVACH-Wildlife-Intelligence/
│
├── backend/
│   ├── predict.py
│   ├── detection_service.py
│   ├── best.pt
│   ├── requirements.txt
│   └── ...
│
├── public/
│   ├── images/
│   └── ...
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── ...
│   └── ...
│
├── package.json
├── vite.config.*
├── .gitignore
└── README.md
```

---

# 🚀 Running KAVACH Locally

## Prerequisites

Install:

* Node.js
* Python 3.13
* Git
* npm

---

## 1. Clone Repository

```bash
git clone https://github.com/Sumant70/KAVACH-Wildlife-Intelligence.git
```

```bash
cd KAVACH-Wildlife-Intelligence
```

---

# 2. Install Frontend Dependencies

```bash
npm install
```

---

# 3. Start Frontend

```bash
npm run dev
```

The Vite development server will normally run at:

```text
http://localhost:5173
```

---

# 4. Install Backend Dependencies

From the project root:

```bash
pip install -r backend/requirements.txt
```

---

# 5. Start FastAPI Backend

```bash
uvicorn predict:app --host 0.0.0.0 --port 8000 --app-dir backend
```

Backend:

```text
http://localhost:8000
```

---

# 6. API Documentation

Once the backend is running:

```text
http://localhost:8000/docs
```

FastAPI provides an interactive interface for testing available API endpoints.

---

# ☁️ Production Deployment

KAVACH is deployed using Render.

### Frontend

```text
React + Vite
       ↓
npm run build
       ↓
dist/
       ↓
Render Static Site
```

### Backend

```text
FastAPI
   ↓
Uvicorn
   ↓
Render Web Service
   ↓
YOLO Inference
```

---

# 🔐 Environment Configuration

Production configuration should be handled through environment variables rather than committing secrets to GitHub.

Example configuration:

```text
ENVIRONMENT=production
MODEL_PATH=...
DEVICE=cpu
WILDLIFE_CONFIDENCE_THRESHOLD=...
```

Firebase service-account credentials should also be stored securely through the deployment platform.

**Never commit:**

```text
serviceAccountKey.json
```

or other private credentials to the repository.

---

# 🛡️ Safety & Reliability

KAVACH is designed as a **decision-support system**, not an autonomous authority.

AI detections should be verified before critical operational action.

The system should therefore be used with:

* Human verification
* Confidence thresholds
* Multiple-frame confirmation where applicable
* Incident verification
* Authorized personnel
* Appropriate field procedures

AI predictions should not be treated as guaranteed ground truth.

---

# 🎯 Key Features

### 🤖 AI

* YOLO-based object detection
* Confidence-based filtering
* Wildlife classification
* Model health monitoring

### 🖥️ Dashboard

* Command Center
* Detection Hub
* Incident monitoring
* System status
* Device monitoring

### 🗺️ GIS

* Interactive map
* Location visualization
* Wildlife activity monitoring
* Hotspot-oriented interface

### 🚨 Alerts

* Alert workflow
* Test alert
* Emergency notification architecture
* Siren workflow
* Mobile device interface

### ⚙️ Backend

* FastAPI
* REST APIs
* AI inference
* Database services
* Health monitoring

---

# 🌱 Future Development

KAVACH can be extended with:

* 🐅 Larger wildlife-specific training datasets
* 📷 Real CCTV / RTSP gateway integration
* 📡 IoT sensor integration
* 📱 Dedicated mobile application
* 🔥 Production Firebase notification configuration
* 🛰️ Satellite imagery integration
* 🐾 GPS/collar data integration
* 🧠 Improved wildlife classification models
* 📊 Advanced historical analytics
* 🌍 Multi-reserve deployment
* ☁️ Scalable production database
* 🔐 Role-based access control
* 📈 Advanced risk prediction models

---

# 🧪 Current MVP Status

| Component                   | Status                     |
| --------------------------- | -------------------------- |
| React Frontend              | ✅ Deployed                 |
| FastAPI Backend             | ✅ Deployed                 |
| YOLO Model                  | ✅ Online                   |
| SQLite Database             | ✅ Online                   |
| GIS Interface               | ✅ Available                |
| Detection Interface         | ✅ Available                |
| Alert Architecture          | ✅ Available                |
| Firebase Integration        | ⚠️ Credentials Pending     |
| Direct Production RTSP CCTV | ⚠️ Requires Camera Gateway |
| Large Wildlife Model        | 🔄 Future Improvement      |
| Satellite Data              | 🔄 Future Scope            |

---

# 🏆 Why KAVACH?

KAVACH is designed around a simple operational idea:

```text
        DETECT
           ↓
        ANALYZE
           ↓
         ALERT
           ↓
        RESPOND
           ↓
        PROTECT
```

The goal is to connect AI-based wildlife detection with monitoring, geographical context, and emergency communication in one platform.

---

# 👥 Team

### KAVACH — Hackathon Project

**Team Leader**

* Saurav Kumar

**Team Members**

* Sumant Kumar Raut
* Sahil Kumar
* Rishav Kumar
* Suryavansh Thakur

---

# 📌 Project Information

**Project:** KAVACH — Wildlife Early Warning & Alert Network

**Category:** Artificial Intelligence / Computer Vision / Wildlife Monitoring

**Primary Technologies:** React, TypeScript, Vite, Python, FastAPI, YOLO, PyTorch, SQLite, Firebase, GIS

**Deployment:** Render

**Repository:**

https://github.com/Sumant70/KAVACH-Wildlife-Intelligence

---

# 🔗 Links

### 🌐 Live KAVACH Application

https://kavach-frontend-qkri.onrender.com

### ⚙️ Backend API

https://kavach-api-i2pt.onrender.com

### 💻 GitHub Repository

https://github.com/Sumant70/KAVACH-Wildlife-Intelligence

---

# 📜 License

This project was developed as a hackathon and academic prototype.

If the project is later distributed as open-source software, an appropriate open-source license can be added.

---

# 🛡️ KAVACH

## **DETECT • ANALYZE • ALERT • PROTECT**

> **AI-powered wildlife monitoring for faster awareness and smarter response.**


