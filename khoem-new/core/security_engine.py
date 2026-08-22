#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ==============================================================================
# core/security_engine.py — KHOEM_AI 3.3
# ការពារ API ដោយ API Key + Rate Limiting (ឥតគិតថ្លៃ, គ្មានចាំបាច់ Redis)
# ==============================================================================
#
# របៀបប្រើ (ក្នុង app.py):
#
#   from core.security_engine import require_api_key, rate_limit, init_security
#
#   init_security(app)                 # ត្រូវហៅមុនគេ បន្ទាប់ពីបង្កើត app
#
#   @app.route("/api/chat", methods=["POST"])
#   @require_api_key
#   @rate_limit(max_calls=15, window_seconds=60)   # 15 សំណើ/នាទី/key
#   def chat():
#       ...
#
# ==============================================================================

import os
import time
import hmac
import logging
from collections import defaultdict, deque
from functools import wraps
from threading import Lock

from flask import request, jsonify, g

logger = logging.getLogger(__name__)

# ==============================================================================
# 1) API KEY PROTECTION
# ==============================================================================
#
# ដាក់ APP_API_KEY ក្នុងឯកសារ .env របស់បង:
#   APP_API_KEY=សូមប្តូរជាតម្លៃសម្ងាត់វែងៗ_ដូចជា_secret_a1b2c3d4e5
#
# ភាគី Frontend (JS) ត្រូវផ្ញើ header: X-API-Key: <key>
#
# ចំណាំសុវត្ថិភាព: បើ APP_API_KEY ទទេ (មិនកំណត់ក្នុង .env) → security ត្រូវបានបិទ
# ស្វ័យប្រវត្តិ (មានប្រយោជន៍សម្រាប់ dev localhost) ប៉ុន្តែផ្ញើ warning ក្នុង log
# ជានិច្ច ដើម្បីកុំឲ្យបងភ្លេចដាក់ key ពេល deploy ជាក់ស្តែង។
# ==============================================================================

_API_KEY = os.getenv("APP_API_KEY", "").strip()

if not _API_KEY:
    logger.warning(
        "⚠️  APP_API_KEY មិនទាន់បានកំណត់ក្នុង .env — API endpoints "
        "កំពុងបើកចំហដោយគ្មានការការពារ! កំណត់ APP_API_KEY មុននឹង deploy ជាក់ស្តែង។"
    )


def _valid_key(provided: str) -> bool:
    """ប្រៀបធៀប key ដោយ constant-time ដើម្បីការពារ timing attack."""
    if not _API_KEY:
        return True  # security បិទ (dev mode) — មិនណែនាំសម្រាប់ production
    if not provided:
        return False
    return hmac.compare_digest(provided, _API_KEY)


def require_api_key(view_func):
    """Decorator: ដាក់លើ route ណាមួយ ដើម្បីទាមទារ X-API-Key header ត្រឹមត្រូវ."""

    @wraps(view_func)
    def wrapper(*args, **kwargs):
        provided = request.headers.get("X-API-Key", "")
        if not _valid_key(provided):
            client_ip = request.headers.get("X-Forwarded-For", request.remote_addr)
            logger.warning("🚫 API key មិនត្រឹមត្រូវពី %s → %s", client_ip, request.path)
            return jsonify({"error": "unauthorized — API key មិនត្រឹមត្រូវ ឬខ្វះខាត"}), 401
        return view_func(*args, **kwargs)

    return wrapper


# ==============================================================================
# 2) RATE LIMITING (In-memory — ឥតគិតថ្លៃ, សមស្របសម្រាប់ server តូច/1 instance)
# ==============================================================================
#
# ចំណាំ: ដំណោះស្រាយនេះផ្ទុកទិន្នន័យក្នុង RAM របស់ process តែមួយ។
# វាល្អឥតខ្ចោះសម្រាប់ server ដំណើរការតែ 1 instance (ដូចករណីធនធានកំណត់)។
# បើអនាគតបងពង្រីកទៅច្រើន instance/server គួរប្តូរទៅ Redis-based limiter វិញ។
# ==============================================================================

_lock = Lock()
# key = "client_identifier:route" → deque នៃ timestamp នៃសំណើថ្មីៗ
_call_history: dict[str, deque] = defaultdict(deque)


def _client_identifier() -> str:
    """កំណត់អត្តសញ្ញាណអ្នកហៅ — អាទិភាព៖ API key > IP address."""
    api_key = request.headers.get("X-API-Key", "")
    if api_key:
        return f"key:{api_key[:12]}"  # កាត់ឲ្យខ្លី កុំកត់ត្រា key ពេញក្នុង log/memory
    ip = request.headers.get("X-Forwarded-For", request.remote_addr) or "unknown"
    return f"ip:{ip.split(',')[0].strip()}"


def rate_limit(max_calls: int = 20, window_seconds: int = 60):
    """
    Decorator កំណត់ចំនួនសំណើអតិបរមាក្នុងរយៈពេលកំណត់។

    ឧទាហរណ៍៖ @rate_limit(max_calls=15, window_seconds=60)
              → អនុញ្ញាតតែ 15 សំណើ ក្នុងរយៈពេល 60 វិនាទី ក្នុងមួយ client

    ណែនាំតម្លៃតាមប្រភេទ endpoint (ព្រោះ Groq API cost ខុសគ្នា)៖
      • /api/chat    → 15/60s  (text ថោក អាចអនុញ្ញាតច្រើនជាង)
      • /api/vision  → 5/60s   (image ថ្លៃជាង — កំណត់តឹងជាង)
      • /api/places  → 30/60s  (មិនប៉ះពាល់ AI cost)
    """

    def decorator(view_func):
        @wraps(view_func)
        def wrapper(*args, **kwargs):
            identifier = _client_identifier()
            route_key = f"{identifier}:{request.path}"
            now = time.monotonic()

            with _lock:
                history = _call_history[route_key]
                # លុប timestamp ចាស់ដែលហួសពេល window ចេញ
                while history and now - history[0] > window_seconds:
                    history.popleft()

                if len(history) >= max_calls:
                    retry_after = max(0, round(window_seconds - (now - history[0])))
                    logger.warning(
                        "🐢 Rate limit ដល់កម្រិត: %s → %s (%d/%d ក្នុង %ds)",
                        identifier, request.path, len(history), max_calls, window_seconds,
                    )
                    resp = jsonify({
                        "error": "សំណើច្រើនពេក សូមរង់ចាំបន្តិច",
                        "retry_after_seconds": retry_after,
                    })
                    resp.status_code = 429
                    resp.headers["Retry-After"] = str(retry_after)
                    return resp

                history.append(now)

            return view_func(*args, **kwargs)

        return wrapper

    return decorator


# ==============================================================================
# 3) សម្អាតទិន្នន័យចាស់ក្នុង memory ជាទៀងទាត់ (ការពារ memory leak រយៈពេលវែង)
# ==============================================================================

def init_security(app, cleanup_interval_seconds: int = 600) -> None:
    """
    ហៅមុខងារនេះម្តងគត់ក្នុង app.py បន្ទាប់ពីបង្កើត Flask app។
    វានឹងចាប់ផ្តើម background thread សម្អាតទិន្នន័យ rate-limit ចាស់ៗ
    ដើម្បីកុំឲ្យ memory កើនឡើងគ្មានទីបញ្ចប់លើ server រត់យូរ។
    """
    import threading

    def _cleanup_loop():
        while True:
            time.sleep(cleanup_interval_seconds)
            now = time.monotonic()
            with _lock:
                stale_keys = [
                    k for k, hist in _call_history.items()
                    if not hist or now - hist[-1] > cleanup_interval_seconds
                ]
                for k in stale_keys:
                    del _call_history[k]
            if stale_keys:
                logger.info("🧹 Rate-limit cleanup: បានលុប %d entry ចាស់", len(stale_keys))

    t = threading.Thread(target=_cleanup_loop, daemon=True)
    t.start()
    logger.info("🛡️  Security engine ចាប់ផ្តើមរួចរាល់ (API key: %s)",
                "បើក" if _API_KEY else "បិទ — ⚠️ dev mode")
