#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
routes/gps_routes.py (Patched)
ចំណាំ: ការគណនាផ្លូវពិត (routing) ធ្វើនៅ client-side តាមរយៈ
static/js/map.js (Leaflet + OSRM ឥតគិតថ្លៃ) — endpoint នេះសម្រាប់
ព័ត៌មានបន្ថែម ឬ logging ប៉ុណ្ណោះ

+ validation លើ origin/destination, mode, និង logging
"""

import logging

from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)

gps_bp = Blueprint("gps", __name__)

ALLOWED_MODES = {"driving", "walking", "bicycling", "transit"}


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def _valid_point(point) -> bool:
    """origin/destination should be a non-empty string (place name)
    or a {lat, lng} dict."""
    if isinstance(point, str):
        return bool(point.strip())
    if isinstance(point, dict):
        try:
            lat = float(point.get("lat"))
            lng = float(point.get("lng"))
            return -90 <= lat <= 90 and -180 <= lng <= 180
        except (TypeError, ValueError):
            return False
    return False


@gps_bp.route("/api/directions", methods=["POST"])
def directions():
    data = request.get_json(silent=True) or {}
    origin = data.get("origin")
    destination = data.get("destination")
    mode = data.get("mode", "driving")

    if not _valid_point(origin) or not _valid_point(destination):
        return _error("origin និង destination ត្រូវតែជា string ឬ {lat, lng} ត្រឹមត្រូវ")

    if mode not in ALLOWED_MODES:
        return _error(f"mode ត្រូវតែជាមួយក្នុងចំណោម {', '.join(ALLOWED_MODES)}")

    logger.info("Directions requested: %s → %s (mode=%s)", origin, destination, mode)

    return jsonify({
        "status": "ok",
        "instruction": f"កំពុងស្វែងរកផ្លូវពី {origin} ទៅ {destination}",
        "origin": origin,
        "destination": destination,
        "mode": mode
    })
