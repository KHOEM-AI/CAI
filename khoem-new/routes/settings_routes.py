#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
=========================================================
KHOEM_AI 3.0
routes/settings_routes.py (Patched)
Settings API

*** សំខាន់ (Security) ***
Version ដើមអនុញ្ញាតឲ្យ client save/overwrite key ណាមួយក៏បាន
ដោយគ្មានដែនកំណត់ — នេះជាចំណុចប្រថុយប្រថានបំផុត។ Patch នេះបន្ថែម
ALLOWED_KEYS whitelist ដើម្បីការពារកុំឲ្យ client សរសេរជាន់លើ key
ដែលមិនត្រូវបានរំពឹងទុក។ សូមកែ ALLOWED_KEYS ឲ្យត្រូវនឹង key
ពិតប្រាកដទាំងអស់ដែល settings_engine គាំទ្រ។
=========================================================
"""

import logging

from flask import Blueprint, request, jsonify

from core.settings_engine import settings_engine

logger = logging.getLogger(__name__)

settings_bp = Blueprint(
    "settings",
    __name__
)

# សូមផ្ទៀងផ្ទាត់ និងបំពេញបន្ថែមតាម key ពិតប្រាកដដែល settings_engine គាំទ្រ
ALLOWED_KEYS = {
    "theme", "zoom", "rotation", "high_contrast", "large_text",
    "voice_profile", "voice_enabled", "voice_rate", "voice_pitch",
    "voice_volume", "language",
}

MAX_VALUE_LENGTH = 500

DEFAULTS = {
    "theme": "dark",
    "zoom": "100",
    "rotation": "0",
    "high_contrast": "false",
    "large_text": "false",
    "voice_profile": "default",
    "voice_enabled": "true",
    "voice_rate": "1.0",
    "voice_pitch": "1.0",
    "voice_volume": "1.0",
    "language": "km-KH",
}


def _error(message: str, status: int = 400):
    return jsonify({"success": False, "message": message}), status


def _safe_call(fn, *args, **kwargs):
    try:
        return True, fn(*args, **kwargs)
    except Exception as e:
        logger.exception("settings_engine error in %s: %s", getattr(fn, "__name__", "call"), e)
        return False, str(e)


# =========================================================
# Save Setting
# POST /api/settings/save
# =========================================================
@settings_bp.route(
    "/api/settings/save",
    methods=["POST"]
)
def save_setting():
    data = request.get_json(silent=True) or {}

    key = data.get("key")
    value = data.get("value")

    if not key or not isinstance(key, str):
        return _error("Missing or invalid setting key")

    if key not in ALLOWED_KEYS:
        return _error(f"'{key}' is not a recognized setting key")

    if value is not None and len(str(value)) > MAX_VALUE_LENGTH:
        return _error(f"Setting value too long (max {MAX_VALUE_LENGTH} chars)")

    ok, _ = _safe_call(settings_engine.save, key, value)
    if not ok:
        return _error("Failed to save setting", 500)

    return jsonify({
        "success": True,
        "message": "Setting saved successfully",
        "key": key,
        "value": value
    })


# =========================================================
# Load One Setting
# GET /api/settings/load?key=theme
# =========================================================
@settings_bp.route(
    "/api/settings/load",
    methods=["GET"]
)
def load_setting():
    key = request.args.get("key")

    if not key:
        return _error("Missing setting key")

    if key not in ALLOWED_KEYS:
        return _error(f"'{key}' is not a recognized setting key")

    ok, value = _safe_call(settings_engine.load, key)
    if not ok:
        return _error("Failed to load setting", 500)

    return jsonify({
        "success": True,
        "key": key,
        "value": value
    })


# =========================================================
# Load All Settings
# GET /api/settings/all
# =========================================================
@settings_bp.route(
    "/api/settings/all",
    methods=["GET"]
)
def load_all_settings():
    ok, all_settings = _safe_call(settings_engine.load_all)
    if not ok:
        return _error("Failed to load settings", 500)

    return jsonify({
        "success": True,
        "settings": all_settings
    })


# =========================================================
# Delete One Setting
# DELETE /api/settings/<key>
# =========================================================
@settings_bp.route(
    "/api/settings/<key>",
    methods=["DELETE"]
)
def delete_setting(key):
    if key not in ALLOWED_KEYS:
        return _error(f"'{key}' is not a recognized setting key")

    ok, _ = _safe_call(settings_engine.save, key, DEFAULTS.get(key))
    if not ok:
        return _error("Failed to reset setting", 500)

    return jsonify({
        "success": True,
        "message": "Setting reset to default",
        "key": key,
        "value": DEFAULTS.get(key)
    })


# =========================================================
# Reset Settings
# POST /api/settings/reset
# =========================================================
@settings_bp.route(
    "/api/settings/reset",
    methods=["POST"]
)
def reset_settings():
    ok, _ = _safe_call(settings_engine.reset)
    if not ok:
        return _error("Failed to reset settings", 500)

    return jsonify({
        "success": True,
        "message": "All settings reset successfully"
    })


# =========================================================
# Default Settings
# POST /api/settings/default
# =========================================================
@settings_bp.route(
    "/api/settings/default",
    methods=["POST"]
)
def default_settings():
    for key, value in DEFAULTS.items():
        ok, _ = _safe_call(settings_engine.save, key, value)
        if not ok:
            return _error(f"Failed to restore default for '{key}'", 500)

    return jsonify({
        "success": True,
        "message": "Default settings restored",
        "settings": DEFAULTS
    })
