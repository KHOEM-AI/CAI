# KHOEM_AI — System Architecture

> **Project:** KHOEM_AI  
> **Version:** 3.3  
> **Architecture:** Enterprise Modular AI Platform  
> **Designed by:** KHOEM SOKSIVUTHA

---

## Table of Contents

1. [Processing Pipeline](#1-processing-pipeline)
2. [Project Structure](#2-project-structure)
3. [Core Modules](#3-core-modules)
4. [Route Modules](#4-route-modules)
5. [Database](#5-database)
6. [Frontend](#6-frontend)
7. [Templates](#7-templates)
8. [Logs](#8-logs)
9. [Current Features](#9-current-features)
10. [Future Roadmap](#10-future-roadmap)

---

## 1. Processing Pipeline

Every request passes through five sequential stages — input guard, memory load, AI reasoning, output guard, and memory save — before a response is returned.

```
┌─────────────────────────────────────────────┐
│                  User Input                  │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│        ① INPUT GUARDRAILS                   │
│                                             │
│  ├─ Strip HTML tags                         │
│  ├─ Detect SQL injection                    │
│  ├─ Detect prompt injection                 │
│  ├─ Detect script injection                 │
│  ├─ Detect Base64-encoded attacks           │
│  └─ Enforce maximum input length            │
│                                             │
│           Blocked?                          │
│              │                              │
│              ▼                              │
│           HTTP 400  ◄────────── stop here   │
└────────────────────┬────────────────────────┘
                     │  clean input
                     ▼
┌─────────────────────────────────────────────┐
│        ② MEMORY ENGINE  (load)              │
│                                             │
│  ├─ Load conversation history               │
│  ├─ Load saved places                       │
│  └─ Load user context / session state       │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│        ③ AI ENGINE                          │
│                                             │
│  ├─ Intent detection                        │
│  ├─ Complexity analysis                     │
│  ├─ Reasoning                               │
│  └─ Confidence scoring                      │
│                                             │
│         ┌──────────┴──────────┐             │
│         ▼                     ▼             │
│     Planner               Optimizer         │
│     Engine                Engine            │
│         └──────────┬──────────┘             │
│                    ▼                        │
│       ┌────────────────────────┐            │
│       │  Sub-engines (routed)  │            │
│       │  ├─ Navigator          │            │
│       │  ├─ Vision             │            │
│       │  └─ Voice              │            │
│       └────────────────────────┘            │
└────────────────────┬────────────────────────┘
                     │  draft response
                     ▼
┌─────────────────────────────────────────────┐
│        ④ OUTPUT GUARDRAILS                  │
│                                             │
│  ├─ Response validation                     │
│  ├─ Policy / content check                  │
│  └─ Length check                            │
└────────────────────┬────────────────────────┘
                     │  approved response
                     ▼
┌─────────────────────────────────────────────┐
│        ⑤ MEMORY ENGINE  (save)              │
│                                             │
│  ├─ Save user message                       │
│  ├─ Save AI response                        │
│  └─ Update session state                    │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│                  Response                    │
└─────────────────────────────────────────────┘
```

---

## 2. Project Structure

```
khoem-new/
├── core/                   # Business logic — no Flask here
│   ├── ai_engine.py
│   ├── database_engine.py
│   ├── memory_engine.py
│   ├── navigator_engine.py
│   ├── optimization_engine.py
│   ├── planner_engine.py
│   ├── security_engine.py
│   ├── vision_engine.py
│   └── voice_engine.py
│
├── routes/                 # Flask blueprints — one file per domain
│   ├── chat_routes.py
│   ├── gps_routes.py
│   ├── memory_routes.py
│   ├── navigator_routes.py
│   ├── settings_routes.py
│   ├── status_routes.py
│   └── vision_routes.py
│
├── database/
│   ├── khoem_ai.db         # SQLite database
│   └── schema.sql          # Table definitions
│
├── static/
│   ├── css/
│   │   ├── style.css
│   │   └── navigator.css
│   └── js/
│       ├── app.js
│       ├── camera.js
│       ├── gps.js
│       ├── map.js
│       ├── navigator.js
│       └── voice.js
│
├── templates/
│   ├── index.html
│   └── navigator.html
│
├── logs/
│   ├── system.log
│   ├── error.log
│   ├── chat.log
│   ├── gps.log
│   └── vision.log
│
├── docs/
│   ├── architecture.md     ← this file
│   ├── api.md
│   ├── voice.md
│   └── navigator.md
│
├── app.py                  # Flask app entry point
├── .env                    # Environment variables (not committed)
└── requirements.txt
```

---

## 3. Core Modules

Each module in `core/` is a pure Python file — no Flask, no HTTP. Route files import from here.

| Module | Responsibility |
|--------|---------------|
| `ai_engine.py` | Groq API calls (chat + vision), conversation memory helpers |
| `database_engine.py` | SQLite connection, table init, low-level query helpers |
| `memory_engine.py` | Load/save conversation history and user context per session |
| `navigator_engine.py` | Route calculation, geocoding, step generation |
| `optimization_engine.py` | Response quality scoring, model parameter tuning |
| `planner_engine.py` | Intent detection, task decomposition, multi-step planning |
| `security_engine.py` | Input/output guardrails — injection detection, policy checks |
| `vision_engine.py` | Image preprocessing, base64 handling, Groq vision calls |
| `voice_engine.py` | Voice profile management, persona-to-voice mapping |

### Module dependency map

```
app.py
  └── routes/*
        ├── ai_engine        ← memory_engine, security_engine
        ├── database_engine  ← (no deps)
        ├── memory_engine    ← database_engine
        ├── navigator_engine ← (external: Nominatim / routing API)
        ├── optimization_engine ← ai_engine
        ├── planner_engine   ← ai_engine
        ├── security_engine  ← (no deps)
        ├── vision_engine    ← ai_engine
        └── voice_engine     ← (no deps)
```

---

## 4. Route Modules

Each file in `routes/` is a Flask Blueprint registered in `app.py`.

| Blueprint file | URL prefix | Endpoints |
|----------------|------------|-----------|
| `status_routes.py` | `/api` | `GET /api/status` |
| `chat_routes.py` | `/api` | `POST /api/chat`, `GET /api/history/<id>`, `DELETE /api/history/<id>` |
| `vision_routes.py` | `/api` | `POST /api/vision` |
| `memory_routes.py` | `/api` | `POST /api/places`, `GET /api/places/<id>`, `GET /api/places/<id>/<label>`, `DELETE /api/places/<id>/<label>` |
| `navigator_routes.py` | `/api/navigator` | `POST /api/navigator/route`, `GET /api/navigator/geocode` |
| `gps_routes.py` | `/api` | `POST /api/directions` |
| `settings_routes.py` | `/api` | `GET /api/settings`, `PATCH /api/settings` |

**Blueprint registration in `app.py`**
```python
from routes.status_routes    import status_bp
from routes.chat_routes      import chat_bp
from routes.vision_routes    import vision_bp
from routes.memory_routes    import memory_bp
from routes.navigator_routes import navigator_bp
from routes.gps_routes       import gps_bp
from routes.settings_routes  import settings_bp

for bp in [status_bp, chat_bp, vision_bp, memory_bp,
           navigator_bp, gps_bp, settings_bp]:
    app.register_blueprint(bp)
```

---

## 5. Database

**Engine:** SQLite 3 · **File:** `database/khoem_ai.db`

| Table | Description | Key columns |
|-------|-------------|-------------|
| `conversations` | Full chat history per session | `session_id`, `role`, `content`, `created_at` |
| `saved_places` | User-saved GPS locations | `session_id`, `label`, `lat`, `lng`, `created_at` |

**Indexes**

```sql
CREATE INDEX idx_conv_session   ON conversations  (session_id, id);
CREATE INDEX idx_places_session ON saved_places   (session_id);
UNIQUE (session_id, label) ON saved_places;
```

**Performance settings (applied on every connection)**

```python
conn.execute("PRAGMA journal_mode=WAL")   -- concurrent reads
conn.execute("PRAGMA foreign_keys=ON")
```

---

## 6. Frontend

### JavaScript modules

| File | Role |
|------|------|
| `app.js` | Main UI controller — chat input, message rendering, session management |
| `camera.js` | Camera access, image capture, base64 conversion for `/api/vision` |
| `gps.js` | `watchPosition` wrapper — emits `{ lat, lng, speed, accuracy }` |
| `map.js` | Leaflet.js wrapper — map init, markers, route polylines |
| `navigator.js` | Navigation orchestrator — links gps.js + map.js + voice.js + API |
| `voice.js` | Web Speech API — `SpeechRecognition` + `SpeechSynthesis` + voice profiles |

### CSS files

| File | Role |
|------|------|
| `style.css` | Global styles — chat UI, typography, dark/light theme |
| `navigator.css` | Navigator page layout — map panel, sidebar, speed HUD |

---

## 7. Templates

| File | Route | Description |
|------|-------|-------------|
| `index.html` | `/` | Main chat + vision interface |
| `navigator.html` | `/navigator` | Full-screen GPS navigation UI |

---

## 8. Logs

| File | Content |
|------|---------|
| `system.log` | Server startup, DB init, general info |
| `error.log` | Exceptions and unhandled errors |
| `chat.log` | Per-session chat events (session_id, message length, latency) |
| `gps.log` | GPS position updates and route events |
| `vision.log` | Vision API calls, image size, response latency |

All log files use **UTF-8 encoding** and the format:
```
2025-08-04T12:00:00Z [INFO] [khoem_ai] message
```

---

## 9. Current Features

| Category | Feature | Status |
|----------|---------|--------|
| **AI** | Chat AI (Groq LLM) | ✅ Live |
| **AI** | Vision AI (image understanding) | ✅ Live |
| **AI** | Planner Engine (multi-step tasks) | ✅ Live |
| **AI** | Optimization Engine | ✅ Live |
| **Navigation** | GPS Tracking | ✅ Live |
| **Navigation** | Live position + speed display | ✅ Live |
| **Navigation** | Route planning + map display | ✅ Live |
| **Voice** | Speech Recognition | ✅ Live |
| **Voice** | Text-to-Speech (6 voice profiles) | ✅ Live |
| **Voice** | Persona-to-voice mapping | ✅ Live |
| **Memory** | Conversation history (SQLite) | ✅ Live |
| **Memory** | Saved Places | ✅ Live |
| **Security** | Input / Output Guardrails | ✅ Live |

---

## 10. Future Roadmap

| Feature | Category | Notes |
|---------|----------|-------|
| **Vector Database** | AI Memory | Semantic search over past conversations |
| **RAG Search** | AI | Retrieval-Augmented Generation from documents |
| **Face Recognition** | Vision | Identify known persons (user-consented only) |
| **Offline AI** | AI | On-device model — works without internet |
| **Local LLM** | AI | Run LLaMA / Mistral locally via Ollama |
| **Live Traffic** | Navigation | Real-time congestion overlay |
| **Multi-language Translation** | AI | Auto-translate between Khmer, English, and more |
| **Cloud Sync** | Storage | Sync conversations and places across devices |
| **Plugin System** | Platform | Third-party module support |
| **Enterprise Dashboard** | Platform | Admin panel — usage metrics, user management |

---

*KHOEM_AI 3.3 · Enterprise Modular Architecture · Designed by KHOEM SOKSIVUTHA*
