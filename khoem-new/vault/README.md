# 🤖 KHOEM_AI 3.3 — Intelligent AI Assistant Framework

**KHOEM_AI** is a modern, lightweight, and scalable AI Assistant backend built with **Flask**, **Groq LLaMA models**, and **SQLite**. It features chat memory persistence, vision image analysis, and location memory services.

---

## ✨ Features

- **🚀 High-Performance Chat:** Powered by Groq's high-speed LLaMA 3.3 infrastructure (`llama-3.3-70b-versatile`).
- **👁️ Vision Capabilities:** Multi-modal image analysis and description using `llama-3.2-90b-vision-preview`.
- **🧠 Conversation Memory:** State-management with SQLite WAL mode to remember conversation history per session.
- **📍 Saved Places Management:** Store, query, and manage labeled geographic coordinates (`lat`, `lng`).
- **🏗️ Modular Architecture:** Clean separation of concerns between Flask REST APIs (`app.py`) and core AI logic (`core/ai_engine.py`).

---

## 🛠️ Project Structure

khoem-new/
├── app.py                # Flask application, routing, and REST API handlers
├── core/
│   └── ai_engine.py      # Core AI engine, Groq API integration, DB management
├── database/
│   └── khoem_ai.db       # SQLite Database (Auto-generated with WAL mode)
├── templates/
│   └── index.html        # Web UI interface
├── static/               # Frontend CSS, JS, and asset files
├── logs/                 # System application logs
└── .env                  # Environment configuration file

---

## 🚀 Quick Start

### 1. Requirements
- Python `3.10+`
- Groq API Key ([Get yours here](https://console.groq.com/))

### 2. Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/KHOEM-AI/KHOEM_AI.git
cd KHOEM_AI/khoem-new


   
MethodEndpointDescription
GET/api/statusHealth check & system version details
POST/api/chatSend message & retrieve AI response with history memory
GET/api/history/<session_id>Fetch conversation history for a session
DELETE/api/history/<session_id>Clear conversation history
POST/api/visionAnalyze base64-encoded image input
POST/api/placesSave or update a place location (lat, lng)
GET/api/places/<session_id>List all saved places for a session
DELETE/api/places/<session_id>/<label>Delete a specific saved place
🔹👑 KHOEM_AI
🔹└── 🎖️ khoem-new
🔹├── 👉 core/
🔹│   ├── 👉 __init__.py
🔹│   ├── 👉 accessibility_engine.py
🔹│   ├── 👉 ai_engine.py
🔹│   ├── 👉 database_engine.py
🔹│   ├── 👉 khoem_ai_app.py
🔹│   ├── 👉 🔹khoem_ai_nexus_hub.py
🔹│   ├── 👉 memory_addition.py
🔹│   ├── 👉 memory_engine.py
🔹│   ├── 👉 navigator_engine.py
🔹│   ├── 👉 optimization_engine.py
🔹│   ├── 👉 planner_engine.py
🔹│   ├── 👉 security_engine.py
🔹│   ├── 👉 settings_engine.py
🔹│   ├── 👉 video_khoemai.py
🔹│   ├── 👉 vision_engine.py
🔹│   └── 👉 voice_engine.py
🔹├── 👉 database/
🔹│   ├── 👉 chat.db
🔹│   ├── 👉 khoem_ai.db
🔹│   ├── 👉 memory.db
🔹│   ├── 👉 schema.sql
🔹│   └── 👉 settings.db
🔹├── 👉 docs/
🔹│   ├── 👉 KHOEM_AI.md
🔹│   ├── 👉 accessibility.md
🔹│   ├── 👉 api.md
🔹│   ├── 👉 architecture.md
🔹│   ├── 👉 database.md
🔹│   ├── 👉 kh.md
🔹│   ├── 👉 khoem_ai.md
🔹│   ├── 👉 khoem_ai_nexus_hub.md
🔹│   ├── 👉 khoemai.md
🔹│   ├── 👉 navigator.md
🔹│   ├── 👉 roadmap.md
🔹│   ├── 👉 security.md
🔹│   ├── 👉 video_khoemai.md
🔹│   └── 👉 voice.md
🔹├── 👉 logs/
🔹│   ├── 👉 chat.log
🔹│   ├── 👉 error.log
🔹│   ├── 👉 gps.log
🔹│   ├── 👉 system.log
🔹│   └── 👉 vision.log
🔹├── 👉 routes/
🔹│   ├── 👉 accessibility_routes.py
🔹│   ├── 👉 chat_routes.py
🔹│   ├── 👉 gps_routes.py
🔹│   ├── 👉 memory_routes.py
🔹│   ├── 👉 navigator_routes.py
🔹│   ├── 👉 settings_routes.py
🔹│   ├── 👉 status_routes.py
🔹│   └── 👉 vision_routes.py
🔹├── 👉 src/
🔹│   ├── 👉 components/
🔹│   │   └── 👉 KhmerTodo.tsx
🔹│   ├── 👉 errors/
🔹│   │   ├── 👉 AppError.js
🔹│   │   └── 👉 CustomErrors.js
🔹│   ├── 👉 services/
🔹│   │   ├── 👉 userService.js
🔹│   │   └── 👉 userService.test.js
🔹│   ├── 👉 chat_component.css
🔹│   ├── 👉 chat_component.html
🔹│   ├── 👉 chat_component.ts
🔹│   ├── 👉 claude_service.ts
🔹│   ├── 👉 index.ts
🔹│   └── 👉 khoem.ts
🔹├── 👉 static/
🔹│   ├── 👉 css/
🔹│   │   ├── 🔹 api-status.css (បានបន្ថែម🔹ថ្មី)
🔹│   │   ├── 👉 kh_key.css
🔹│   │   ├── 👉 khoem_ai_nexus.css
🔹│   │   ├── 👉 khoemai.css
🔹│   │   ├── 👉 magnifying_glass.css
🔹│   │   ├── 👉 navigator.css
🔹│   │   └── 👉 style.css
🔹│   └── 👉 js/
🔹│       ├── 🔹 api-client.js (បានបន្ថែម🔹ថ្មី)
🔹│       ├── 👉 app.js
🔹│       ├── 👉 camera.js
🔹│       ├── 👉 chat.js
🔹│       ├── 👉 gps.js
🔹│       ├── 👉 kh.js
🔹│       ├── 👉 kh_key.js
🔹│       ├── 👉 khoem_ai_nexus_hub.js
🔹│       ├── 👉 khoemai.js
🔹│       ├── 👉 magnifying_glass.js
🔹│       ├── 👉 map.js
🔹│       ├── 👉 navigator.js
🔹│       ├── 👉 settings.js
🔹│       ├── 👉 video_khoemai.js
🔹│       └── 👉 voice.js
🔹├── 👉 templates/
🔹│   ├── 👉 index.html
🔹│   ├── 👉 kh.html
🔹│   ├── 👉 kh_key.html
🔹│   ├── 👉 🔹khoem_ai_nexus_hub.html
🔹│   ├── 👉 khoemai.html
🔹│   ├── 👉 magnifying_glass.html
🔹│   ├── 👉 navigator.html
🔹│   └── 👉 video_khoemai.html
🔹├── 👉 vault/
🔹│   └── 👉 README.md
🔹├── 👉 .env
🔹├── 👉 .gitignore
🔹├── 👉 app.py
🔹├── 👉 requirements.txt
🔹└── 👉 research_tool.py
🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹🔹==>KHOEM_AI
