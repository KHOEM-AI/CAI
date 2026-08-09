#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
routes/navigator_routes.py (Patched)

*** សំខាន់ ***
Version ដើមមិនបានហៅ core/navigator_engine.py សោះ — status endpoint
តែងតែឆ្លើយ "ready" ដោយមិនអើពើ state ពិត។ Patch នេះភ្ជាប់ទៅ engine វិញ។
សន្មតថា navigator_engine មាន: start(session_id, destination),
stop(session_id), get_status(session_id) — សូមផ្ទៀងផ្ទាត់ signatures
ទាំងនេះនឹង core/navigator_engine.py ពិតប្រាកដ។
"""

import logging

from flask import Blueprint, request, jsonify
from core.navigator_engine import navigator_engine

logger = logging.getLogger(__name__)

navigator_bp = Blueprint("navigator", __name__)


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


@navigator_bp.route("/api/navigator/start", methods=["POST"])
def start_navigation():
    data = request.get_json(silent=True) or {}

    session_id = data.get("session_id")
    destination = data.get("destination")

    if not session_id or not isinstance(session_id, str):
        return _error("session_id ត្រូវការ ហើយត្រូវតែជា string")

    if not destination or (isinstance(destination, str) and not destination.strip()):
        return _error("destination ត្រូវការ")

    try:
        result = navigator_engine.start(session_id, destination)
    except Exception as e:
        logger.exception("navigator_engine.start error: %s", e)
        return _error("មិនអាចចាប់ផ្តើមការណែនាំផ្លូវបានទេ", 500)

    return jsonify({
        "status": "started",
        "destination": destination,
        "message": f"កំពុងចាប់ផ្តើមការណែនាំផ្លូវទៅ {destination}",
        **(result or {})
    })


@navigator_bp.route("/api/navigator/stop", methods=["POST"])
def stop_navigation():
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id")

    if not session_id or not isinstance(session_id, str):
        return _error("session_id ត្រូវការ ហើយត្រូវតែជា string")

    try:
        navigator_engine.stop(session_id)
    except Exception as e:
        logger.exception("navigator_engine.stop error: %s", e)
        return _error("មិនអាចបញ្ឈប់ការណែនាំផ្លូវបានទេ", 500)

    return jsonify({"status": "stopped"})


@navigator_bp.route("/api/navigator/status", methods=["GET"])
def navigator_status():
    session_id = request.args.get("session_id")

    if not session_id:
        return _error("session_id ត្រូវការ (query param)")

    try:
        status = navigator_engine.get_status(session_id)
    except Exception as e:
        logger.exception("navigator_engine.get_status error: %s", e)
        return _error("មិនអាចទាញយកស្ថានភាពការណែនាំផ្លូវបានទេ", 500)

    return jsonify({"navigator": status})
