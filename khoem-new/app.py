#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ==============================================================================
# app.py — KHOEM_AI 3.3 Backend (Chat + Vision + Memory / Saved Places)
# ==============================================================================

# ── Standard library ──────────────────────────────────────────────────────────
import os
import sqlite3
import logging
import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# ── Third-party ───────────────────────────────────────────────────────────────
import requests
from flask import Flask, jsonify, request, render_template
from flask_cors import CORS
from dotenv import load_dotenv
from core.security_engine import require_api_key, rate_limit, init_security

load_dotenv()

# ==============================================================================
# Configuration
# ==============================================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    GROQ_API_KEY      = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL        = os.getenv("GROQ_MODEL",        "llama-3.3-70b-versatile")
    GROQ_VISION_MODEL = os.getenv("GROQ_VISION_MODEL", "llava-v1.5-7b-4096-preview")
    GROQ_API_URL      = "https://api.groq.com/openai/v1/chat/completions"

    MUSIC_API_KEY  = os.getenv("MUSIC_API_KEY", "")
    MUSIC_API_URL  = os.getenv("MUSIC_API_URL", "https://api.example-music-gen.com/v1/generate")
    MUSIC_PROVIDER = os.getenv("MUSIC_PROVIDER", "stub")

    DB_PATH  = os.path.join(BASE_DIR, "database", "khoem_ai.db")
    LOG_PATH = os.path.join(BASE_DIR, "logs",     "system.log")

    PORT        = int(os.getenv("SERVER_PORT",  5000))
    DEBUG       = os.getenv("DEBUG_MODE", "false").lower() == "true"
    MAX_HISTORY = int(os.getenv("MAX_HISTORY", 20))
    VERSION     = "3.3"
    SYSTEM_NAME = "khoem_ai"

    DEFAULT_SYSTEM_PROMPT = (
        "អ្នកជាជំនួយការឆ្លាតវៃឈ្មោះ KHOEM_AI។ "
        "ឆ្លើយតបឱ្យខ្លីៗ និងច្បាស់លាស់ជាភាសាខ្មែរ "
        "លើកលែងតែអ្នកប្រើប្រាស់សួរជាភាសាផ្សេង។"
    )


# បង្កើត Folder ចាំបាច់ប្រសិនបើមិនទាន់មាន
os.makedirs(os.path.dirname(Config.DB_PATH),  exist_ok=True)
os.makedirs(os.path.dirname(Config.LOG_PATH), exist_ok=True)

# ==============================================================================
# Logging
# ==============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [khoem_ai] %(message)s",
    handlers=[
        logging.FileHandler(Config.LOG_PATH, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# ==============================================================================
# Flask App & CORS
# ==============================================================================

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "change-me-in-production")

CORS(app, origins=os.getenv("CORS_ORIGINS", "*").split(","))
init_security(app)  # ភ្ជាប់ Security Middleware (API key + rate limit) ចូលទៅក្នុង Flask App

# ── Blueprint registration ────────────────────────────────────────────────────
try:
    from routes.settings_routes      import settings_bp
    from routes.accessibility_routes import accessibility_bp
    from routes.navigator_routes     import navigator_bp

    app.register_blueprint(settings_bp)
    app.register_blueprint(accessibility_bp)
    app.register_blueprint(navigator_bp)
    logger.info("Optional route blueprints registered.")
except ImportError as _e:
    logger.warning("Some route blueprints not found and were skipped: %s", _e)

# ==============================================================================
# Database Helpers  (SQLite — WAL mode)
# ==============================================================================

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(Config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with _get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS conversations (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT    NOT NULL,
                role       TEXT    NOT NULL CHECK(role IN ('user','assistant','system')),
                content    TEXT    NOT NULL,
                created_at TEXT    NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_conv_session
                ON conversations(session_id, id);

            CREATE TABLE IF NOT EXISTS saved_places (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT    NOT NULL,
                label      TEXT    NOT NULL,
                lat        REAL    NOT NULL,
                lng        REAL    NOT NULL,
                created_at TEXT    NOT NULL,
                UNIQUE(session_id, label)
            );
            CREATE INDEX IF NOT EXISTS idx_places_session
                ON saved_places(session_id);
        """)
    logger.info("Database initialised at %s", Config.DB_PATH)


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def save_message(session_id: str, role: str, content: str) -> None:
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO conversations (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, role, content, _now_iso()),
        )


def get_history(session_id: str, limit: int = Config.MAX_HISTORY) -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            """SELECT role, content FROM conversations
               WHERE session_id = ?
               ORDER BY id DESC LIMIT ?""",
            (session_id, limit),
        ).fetchall()
    return [dict(r) for r in reversed(rows)]


def save_place(session_id: str, label: str, lat: float, lng: float) -> None:
    with _get_conn() as conn:
        conn.execute(
            """INSERT INTO saved_places (session_id, label, lat, lng, created_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(session_id, label) DO UPDATE
               SET lat=excluded.lat, lng=excluded.lng, created_at=excluded.created_at""",
            (session_id, label, lat, lng, _now_iso()),
        )


def get_place(session_id: str, label: str) -> dict | None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT lat, lng FROM saved_places WHERE session_id = ? AND label = ?",
            (session_id, label),
        ).fetchone()
    return dict(row) if row else None


def get_all_places(session_id: str) -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT label, lat, lng FROM saved_places WHERE session_id = ? ORDER BY label",
            (session_id,),
        ).fetchall()
    return [dict(r) for r in rows]


# ==============================================================================
# Groq API Helpers
# ==============================================================================

def _groq_headers() -> dict:
    return {
        "Content-Type":  "application/json",
        "Authorization": f"Bearer {Config.GROQ_API_KEY}",
    }


def call_groq(messages: list[dict], system_prompt: str = "") -> tuple[bool, str]:
    """ផ្ញើសារទៅ Groq text model ហើយទទួលចម្លើយ។"""
    if not Config.GROQ_API_KEY:
        return False, "សូមកំណត់ GROQ_API_KEY ក្នុង .env មុនសិន"

    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    payload = {
        "model":       Config.GROQ_MODEL,
        "messages":    full_messages,
        "max_tokens":  1024,
        "temperature": 0.7,
    }
    try:
        resp = requests.post(
            Config.GROQ_API_URL,
            headers=_groq_headers(),
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        return True, resp.json()["choices"][0]["message"]["content"]
    except requests.exceptions.HTTPError as e:
        logger.error("Groq HTTP error: %s — %s", e, resp.text)
        return False, f"បញ្ហា Groq API (HTTP {resp.status_code})"
    except requests.exceptions.RequestException as e:
        logger.error("Groq request error: %s", e)
        return False, "បញ្ហាក្នុងការភ្ជាប់ទៅ Groq API"


def call_groq_vision(image_b64: str, question: str, mime_type: str = "image/jpeg") -> tuple[bool, str]:
    """ផ្ញើរូបភាព base64 ទៅ Groq vision model ហើយទទួលការពិពណ៌នា។"""
    if not Config.GROQ_API_KEY:
        return False, "សូមកំណត់ GROQ_API_KEY ក្នុង .env មុនសិន"

    payload = {
        "model": Config.GROQ_VISION_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text",      "text": question},
                {"type": "image_url", "image_url": {
                    "url": f"data:{mime_type};base64,{image_b64}"
                }},
            ],
        }],
        "max_tokens": 1024,
    }
    try:
        resp = requests.post(
            Config.GROQ_API_URL,
            headers=_groq_headers(),
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        return True, resp.json()["choices"][0]["message"]["content"]
    except requests.exceptions.HTTPError as e:
        logger.error("Groq Vision HTTP error: %s — %s", e, resp.text)
        return False, f"បញ្ហា Vision API (HTTP {resp.status_code})"
    except requests.exceptions.RequestException as e:
        logger.error("Groq Vision request error: %s", e)
        return False, "បញ្ហាក្នុងការវិភាគរូបភាព"

def call_music_api(prompt: str, style: str = "", duration_sec: int = 30, instrumental: bool = False) -> tuple[bool, dict]:
    """ហៅ Music Generation API ខាងក្រៅ (Suno / ElevenLabs Music / ផ្សេងៗ) ដើម្បីបង្កើតបទចម្រៀង។
    ប្រសិនបើ MUSIC_API_KEY មិនទាន់បានកំណត់ក្នុង .env — endpoint នេះនឹងត្រឡប់ status="stub"
    ដើម្បីឲ្យ Frontend អាចដំណើរការតេស្តបានដោយមិនចាំបាច់មាន API key ពិតប្រាកដមុនសិន។
    """
    if not Config.MUSIC_API_KEY:
        logger.warning("MUSIC_API_KEY មិនទាន់បានកំណត់ — ត្រឡប់ stub response")
        return True, {
            "status": "stub",
            "track_url": None,
            "message": "សូមកំណត់ MUSIC_API_KEY ក្នុង .env ដើម្បីបង្កើតបទចម្រៀងពិតប្រាកដ",
        }

    payload = {
        "prompt": prompt,
        "style": style,
        "duration": duration_sec,
        "instrumental": instrumental,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {Config.MUSIC_API_KEY}",
    }
    try:
        resp = requests.post(
            Config.MUSIC_API_URL,
            headers=headers,
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        result = resp.json()
        return True, {
            "status": "completed",
            "track_url": result.get("audio_url") or result.get("track_url"),
            "job_id": result.get("id") or result.get("job_id"),
            "raw": result,
        }
    except requests.exceptions.HTTPError as e:
        logger.error("Music API HTTP error: %s — %s", e, resp.text)
        return False, {"error": f"បញ្ហា Music API (HTTP {resp.status_code})"}
    except requests.exceptions.RequestException as e:
        logger.error("Music API request error: %s", e)
        return False, {"error": "បញ្ហាក្នុងការភ្ជាប់ទៅ Music API"}
# ==============================================================================
# Validation Helper
# ==============================================================================

def _require_json_fields(data: dict, *fields) -> str | None:
    """ត្រួតពិនិត្យ field ចាំបាច់ — ប្រសិនបើខ្វះ ត្រឡប់ error message។"""
    missing = [f for f in fields if data.get(f) in (None, "")]
    return f"តម្រូវឲ្យមាន field: {', '.join(missing)}" if missing else None


# ==============================================================================
# Routes — Frontend
# ==============================================================================

@app.route("/")
def index():
    return render_template("index.html")


# ==============================================================================
# Routes — System Status
# ==============================================================================

@app.route("/api/status", methods=["GET"])
def get_status():
    return jsonify({
        "status":       "online",
        "system":       Config.SYSTEM_NAME,
        "version":      Config.VERSION,
        "model":        Config.GROQ_MODEL,
        "vision_model": Config.GROQ_VISION_MODEL,
    })


# ==============================================================================
# Routes — Chat API
# ==============================================================================

@app.route("/api/chat", methods=["POST"])
@require_api_key
@rate_limit(max_calls=15, window_seconds=60)
def chat():
    data = request.get_json(silent=True) or {}
    err  = _require_json_fields(data, "session_id", "message")
    if err:
        return jsonify({"error": err}), 400

    session_id    = str(data["session_id"]).strip()
    user_message  = str(data["message"]).strip()
    system_prompt = data.get("system_prompt") or Config.DEFAULT_SYSTEM_PROMPT

    if len(user_message) > 4000:
        return jsonify({"error": "សារវែងពេក (អតិបរមា ៤០០០ តួអក្សរ)"}), 400

    save_message(session_id, "user", user_message)

    history = get_history(session_id)
    groq_messages = [{"role": h["role"], "content": h["content"]} for h in history]

    success, reply = call_groq(groq_messages, system_prompt)
    if not success:
        return jsonify({"error": reply}), 502

    save_message(session_id, "assistant", reply)
    return jsonify({"reply": reply, "session_id": session_id})


@app.route("/api/history/<session_id>", methods=["GET"])
def get_chat_history(session_id: str):
    limit = min(int(request.args.get("limit", 100)), 500)
    return jsonify({"session_id": session_id, "messages": get_history(session_id, limit=limit)})


@app.route("/api/history/<session_id>", methods=["DELETE"])
def clear_history(session_id: str):
    with _get_conn() as conn:
        conn.execute("DELETE FROM conversations WHERE session_id = ?", (session_id,))
    return jsonify({"status": "cleared", "session_id": session_id})


# ==============================================================================
# Routes — Vision API
# ==============================================================================

@app.route("/api/vision", methods=["POST"])
@require_api_key
@rate_limit(max_calls=5, window_seconds=60)
def vision():
    data = request.get_json(silent=True) or {}
    err  = _require_json_fields(data, "image")
    if err:
        return jsonify({"error": err}), 400

    image_b64 = data["image"]
    question  = data.get("question") or "សូមពិពណ៌នារូបភាពនេះជាភាសាខ្មែរ"
    mime_type = data.get("mime_type", "image/jpeg")

    success, answer = call_groq_vision(image_b64, question, mime_type)
    if not success:
        return jsonify({"error": answer}), 502

    return jsonify({"answer": answer})


# ==============================================================================
# Routes — Directions (Stub — integrate Google Maps API ពេលក្រោយ)
# ==============================================================================

@app.route("/api/directions", methods=["POST"])
def directions():
    data = request.get_json(silent=True) or {}
    err  = _require_json_fields(data, "origin", "destination")
    if err:
        return jsonify({"error": err}), 400

    origin      = data["origin"]
    destination = data["destination"]
    mode        = data.get("mode", "driving")

    logger.info("Directions: %s → %s (mode=%s)", origin, destination, mode)
    return jsonify({
        "status":      "stub",
        "origin":      origin,
        "destination": destination,
        "mode":        mode,
        "instruction": f"កំពុងស្វែងរកផ្លូវពី {origin} ទៅ {destination}",
    })


# ==============================================================================
# Routes — Saved Places API
# ==============================================================================

@app.route("/api/places", methods=["POST"])
@require_api_key
@rate_limit(max_calls=30, window_seconds=60)
def add_place():
    data = request.get_json(silent=True) or {}
    err  = _require_json_fields(data, "session_id", "label", "lat", "lng")
    if err:
        return jsonify({"error": err}), 400

    session_id = str(data["session_id"]).strip()
    label      = str(data["label"]).strip()
    try:
        lat = float(data["lat"])
        lng = float(data["lng"])
    except (TypeError, ValueError):
        return jsonify({"error": "lat និង lng ត្រូវតែជាលេខ"}), 400

    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return jsonify({"error": "lat/lng មិនត្រឹមត្រូវ (ក្រៅព្រំដែន)"}), 400

    save_place(session_id, label, lat, lng)
    return jsonify({"status": "saved", "label": label, "lat": lat, "lng": lng})


@app.route("/api/places/<session_id>", methods=["GET"])
def list_places(session_id: str):
    return jsonify({"session_id": session_id, "places": get_all_places(session_id)})


@app.route("/api/places/<session_id>/<label>", methods=["GET"])
def find_place(session_id: str, label: str):
    place = get_place(session_id, label)
    if not place:
        return jsonify({"error": "រកមិនឃើញទីតាំង"}), 404
    return jsonify(place)


@app.route("/api/places/<session_id>/<label>", methods=["DELETE"])
def delete_place(session_id: str, label: str):
    with _get_conn() as conn:
        conn.execute(
            "DELETE FROM saved_places WHERE session_id = ? AND label = ?",
            (session_id, label),
        )
    return jsonify({"status": "deleted", "label": label})


# ==============================================================================
# Routes — Global Time API  (FIX: ប្រើ zoneinfo.ZoneInfo ត្រឹមត្រូវ)
# ==============================================================================

@app.route("/api/global-time", methods=["GET"])
def global_time():
    """ទាញយកម៉ោងបច្ចុប្បន្នតាម IANA timezone ណាមួយ។"""
    timezone_name = request.args.get("tz", "Asia/Phnom_Penh")
    try:
        tz           = ZoneInfo(timezone_name)
        current_time = datetime.datetime.now(tz)
        return jsonify({
            "status":   "success",
            "timezone": timezone_name,
            "time":     current_time.strftime("%Y-%m-%d %H:%M:%S"),
            "utc_offset": current_time.strftime("%z"),
        })
    except ZoneInfoNotFoundError:
        return jsonify({
            "status":  "error",
            "message": f"Timezone '{timezone_name}' មិនត្រឹមត្រូវ",
        }), 400
    except Exception as e:
        logger.error("global_time error: %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500


# ==============================================================================
# Global Error Handlers
# ==============================================================================

@app.errorhandler(400)
def bad_request(_):
    return jsonify({"error": "សំណើមិនត្រឹមត្រូវ"}), 400


@app.errorhandler(404)
def not_found(_):
    return jsonify({"error": "រកមិនឃើញ endpoint"}), 404


@app.errorhandler(405)
def method_not_allowed(_):
    return jsonify({"error": "HTTP method មិនត្រូវបានអនុញ្ញាត"}), 405


@app.errorhandler(500)
def internal_error(exc):
    logger.exception("Unhandled exception: %s", exc)
    return jsonify({"error": "បញ្ហាខាងក្នុង server"}), 500


# ==============================================================================
# Main Entry Point
# ==============================================================================

if __name__ == "__main__":
    init_db()
    logger.info(
        "KHOEM_AI %s starting on port %d (debug=%s)",
        Config.VERSION, Config.PORT, Config.DEBUG,
    )
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)
