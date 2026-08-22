#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
routes/status_routes.py (Patched)
+ timezone-aware timestamp (utcnow() is deprecated in Python 3.12+)
+ version pulled from a single source instead of hardcoded string
"""

import datetime
import os

from flask import Blueprint, jsonify

status_bp = Blueprint("status", __name__)

VERSION = os.getenv("KHOEM_AI_VERSION", "3.3")
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
VISION_MODEL = os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.6-27b")


@status_bp.route("/api/status", methods=["GET"])
def status():
    return jsonify({
        "status": "online",
        "system": "KHOEM_AI",
        "version": VERSION,
        "model": MODEL,
        "vision_model": VISION_MODEL,
        "time": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    })
    
