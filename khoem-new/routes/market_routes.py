#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""KHOEM_AI 3.3 PRO — connected Flask application."""

from __future__ import annotations

import datetime as dt
import logging
import os
import sqlite3
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import requests
from flask import Flask, jsonify, render_template, request

try:
    from flask_cors import CORS
except ImportError:  # CORS is optional for a same-origin deployment.
    CORS = None

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv() -> bool:
        return False

from routes.market_routes import market_bp


load_dotenv()
BASE_DIR = Path(__file__).resolve().parent


class Config:
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    GROQ_VISION_MODEL = os.getenv(
        "GROQ_VISION_MODEL", "llava-v1.5-7b-4096-preview"
    )
    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
    DB_PATH = BASE_DIR / "database" / "khoem_ai.db"
    LOG_PATH = BASE_DIR / "logs" / "system.log"
    PORT = int(os.getenv("PORT", os.getenv("SERVER_PORT", "5000")))
    DEBUG = os.getenv("DEBUG_MODE", "false").lower() == "true"
    VERSION = "3.3"
    SYSTEM_NAME = "khoem_ai"
    MAX_HISTORY = int(os.getenv("MAX_HISTORY", "20"))


Config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
Config.LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [khoem_ai] %(message)s",
    handlers=[
        logging.FileHandler(Config.LOG_PATH, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

app = Flask(
    __name__,
    template_folder=str(BASE_DIR / "templates"),
    static_folder=str(BASE_DIR / "static"),
)
app.secret_key = os.getenv("SESSION_SECRET", "dev-only-change-this-secret")
app.config["JSON_AS_ASCII"] = False
if CORS:
    CORS(app, origins=os.getenv("CORS_ORIGINS", "*").split(","))

# These two registrations are the important connection points:
# the main app serves the pages, while the blueprints serve feature APIs.
app.register_blueprint(market_bp)


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(Config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with _get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_conv_session
                ON conversations(session_id, id);
            CREATE TABLE IF NOT EXISTS saved_places (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                label TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(session_id, label)
            );
            """
        )


def _now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def _require_fields(data: dict[str, Any], *fields: str) -> str | None:
    missing = [field for field in fields if data.get(field) in (None, "")]
    return f"តម្រូវឲ្យមាន field: {', '.join(missing)}" if missing else None


def save_message(session_id: str, role: str, content: str) -> None:
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO conversations(session_id, role, content, created_at) "
            "VALUES (?, ?, ?, ?)",
            (session_id, role, content, _now_iso()),
        )


def get_history(session_id: str, limit: int = Config.MAX_HISTORY) -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT role, content FROM conversations WHERE session_id = ? "
            "ORDER BY id DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
    return [dict(row) for row in reversed(rows)]


def call_groq(messages: list[dict[str, str]]) -> tuple[bool, str]:
    if not Config.GROQ_API_KEY:
        return False, "សូមកំណត់ GROQ_API_KEY ក្នុង .env មុនសិន"

    payload = {
        "model": Config.GROQ_MODEL,
        "messages": [
            {
                "role": "system",
                "content": (
                    "អ្នកជាជំនួយការឈ្មោះ KHOEM_AI។ "
                    "ឆ្លើយខ្លីៗ និងច្បាស់លាស់ជាភាសាខ្មែរ។"
                ),
            },
            *messages,
        ],
        "max_tokens": 1024,
        "temperature": 0.7,
    }
    try:
        response = requests.post(
            Config.GROQ_API_URL,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {Config.GROQ_API_KEY}",
            },
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        return True, response.json()["choices"][0]["message"]["content"]
    except requests.RequestException as exc:
        logger.error("Groq request failed: %s", exc)
        return False, "បញ្ហាក្នុងការភ្ជាប់ទៅ Groq API"
    except (KeyError, TypeError, ValueError) as exc:
        logger.error("Groq response format failed: %s", exc)
        return False, "ទម្រង់ចម្លើយពី AI មិនត្រឹមត្រូវ"


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/market-board")
def market_board():
    return render_template("market_board.html")


@app.get("/healthz")
def healthz():
    return jsonify({"ok": True, "service": Config.SYSTEM_NAME})


@app.get("/api/status")
def status():
    return jsonify(
        {
            "status": "online",
            "system": Config.SYSTEM_NAME,
            "version": Config.VERSION,
            "model": Config.GROQ_MODEL,
            "market_endpoint": "/api/market-prices",
        }
    )


@app.post("/api/chat")
def chat():
    data = request.get_json(silent=True) or {}
    error = _require_fields(data, "session_id", "message")
    if error:
        return jsonify({"error": error}), 400

    session_id = str(data["session_id"]).strip()
    message = str(data["message"]).strip()
    if len(message) > 4000:
        return jsonify({"error": "សារវែងពេក (អតិបរមា ៤០០០ តួអក្សរ)"}), 400

    save_message(session_id, "user", message)
    messages = get_history(session_id)
    success, reply = call_groq(messages)
    if not success:
        return jsonify({"error": reply}), 502

    save_message(session_id, "assistant", reply)
    return jsonify({"reply": reply, "session_id": session_id})


@app.get("/api/history/<session_id>")
def history(session_id: str):
    try:
        limit = min(max(int(request.args.get("limit", "100")), 1), 500)
    except ValueError:
        limit = 100
    return jsonify({"session_id": session_id, "messages": get_history(session_id, limit)})


@app.delete("/api/history/<session_id>")
def clear_history(session_id: str):
    with _get_conn() as conn:
        conn.execute("DELETE FROM conversations WHERE session_id = ?", (session_id,))
    return jsonify({"status": "cleared", "session_id": session_id})


@app.get("/api/global-time")
def global_time():
    timezone_name = request.args.get("tz", "Asia/Phnom_Penh")
    try:
        current = dt.datetime.now(ZoneInfo(timezone_name))
    except ZoneInfoNotFoundError:
        return jsonify({"status": "error", "message": "Timezone មិនត្រឹមត្រូវ"}), 400
    return jsonify(
        {
            "status": "success",
            "timezone": timezone_name,
            "time": current.strftime("%Y-%m-%d %H:%M:%S"),
            "utc_offset": current.strftime("%z"),
        }
    )


@app.post("/api/directions")
def directions():
    data = request.get_json(silent=True) or {}
    error = _require_fields(data, "origin", "destination")
    if error:
        return jsonify({"error": error}), 400
    return jsonify(
        {
            "status": "stub",
            "origin": data["origin"],
            "destination": data["destination"],
            "mode": data.get("mode", "driving"),
            "instruction": f"កំពុងស្វែងរកផ្លូវពី {data['origin']} ទៅ {data['destination']}",
        }
    )


@app.post("/api/places")
def add_place():
    data = request.get_json(silent=True) or {}
    error = _require_fields(data, "session_id", "label", "lat", "lng")
    if error:
        return jsonify({"error": error}), 400
    try:
        lat, lng = float(data["lat"]), float(data["lng"])
    except (TypeError, ValueError):
        return jsonify({"error": "lat និង lng ត្រូវតែជាលេខ"}), 400
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return jsonify({"error": "lat/lng មិនត្រឹមត្រូវ"}), 400

    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO saved_places(session_id, label, lat, lng, created_at) "
            "VALUES (?, ?, ?, ?, ?) ON CONFLICT(session_id, label) DO UPDATE SET "
            "lat=excluded.lat, lng=excluded.lng, created_at=excluded.created_at",
            (str(data["session_id"]), str(data["label"]).strip(), lat, lng, _now_iso()),
        )
    return jsonify({"status": "saved", "label": data["label"], "lat": lat, "lng": lng})


@app.get("/api/places/<session_id>/<label>")
def find_place(session_id: str, label: str):
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT lat, lng FROM saved_places WHERE session_id = ? AND label = ?",
            (session_id, label),
        ).fetchone()
    if not row:
        return jsonify({"error": "រកមិនឃើញទីតាំង"}), 404
    return jsonify(dict(row))


@app.get("/api/account")
def account():
    return jsonify({"status": "success", "username": "KHOEM", "role": "Master"})


@app.get("/api/nexus/status")
def nexus_status():
    return jsonify({"status": "operational", "code": 200})


@app.get("/api/subscription")
def subscription():
    return jsonify({"status": "active", "plan": "pro"})


@app.errorhandler(404)
def not_found(_error):
    return jsonify({"error": "រកមិនឃើញ endpoint"}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.exception("Unhandled exception: %s", error)
    return jsonify({"error": "បញ្ហាខាងក្នុង server"}), 500


init_db()

if __name__ == "__main__":
    logger.info("KHOEM_AI %s starting on port %d", Config.VERSION, Config.PORT)
    app.run(host="0.0.0.0", port=Config.PORT, debug=Config.DEBUG)

