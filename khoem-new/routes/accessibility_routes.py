#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
=========================================================
KHOEM_AI 3.0 Enterprise Edition
Accessibility Routes (Patched)

Creator : KHOEM SOKSIVUTHA
Patch   : + input validation, error handling, Khmer messages
=========================================================
"""

import logging

from flask import Blueprint, request, jsonify

from core.accessibility_engine import accessibility_engine


logger = logging.getLogger(__name__)

accessibility_bp = Blueprint(
    "accessibility",
    __name__
)


# =====================================================
# Constants — Validation Bounds
# =====================================================

ZOOM_MIN, ZOOM_MAX = 50, 300          # %
ROTATION_ALLOWED   = (0, 90, 180, 270)  # degrees
SPEED_MIN, SPEED_MAX = 0.5, 2.0       # playback speed multiplier
VOLUME_MIN, VOLUME_MAX = 0, 100       # %
VOICE_PROFILES_ALLOWED = {"male", "female", "child", "default"}
THEME_MODES_ALLOWED = {"white", "dark"}


# =====================================================
# Helpers
# =====================================================

def _error(message: str, status: int = 400):
    return jsonify({"success": False, "error": message}), status


def _safe_call(fn, *args, **kwargs):
    """Wrap engine calls so a bug in accessibility_engine never becomes
    an unhandled 500 with no Khmer-facing message."""
    try:
        return True, fn(*args, **kwargs)
    except Exception as e:
        logger.exception("accessibility_engine error in %s: %s", fn.__name__, e)
        return False, str(e)


# =====================================================
# Status
# =====================================================

@accessibility_bp.route("/api/accessibility/status", methods=["GET"])
def status():
    ok, result = _safe_call(accessibility_engine.get_status)
    if not ok:
        return _error("មិនអាចទាញយកស្ថានភាព Accessibility បានទេ", 500)
    return jsonify(result)


# =====================================================
# Enable / Disable
# =====================================================

@accessibility_bp.route("/api/accessibility/enable", methods=["POST"])
def enable():
    ok, _ = _safe_call(accessibility_engine.enable)
    if not ok:
        return _error("មិនអាចបើក Accessibility បានទេ", 500)

    return jsonify({
        "success": True,
        "message": "Accessibility Enabled",
        "status": accessibility_engine.get_status()
    })


@accessibility_bp.route("/api/accessibility/disable", methods=["POST"])
def disable():
    ok, _ = _safe_call(accessibility_engine.disable)
    if not ok:
        return _error("មិនអាចបិទ Accessibility បានទេ", 500)

    return jsonify({
        "success": True,
        "message": "Accessibility Disabled",
        "status": accessibility_engine.get_status()
    })


# =====================================================
# Zoom
# =====================================================

@accessibility_bp.route("/api/accessibility/zoom", methods=["POST"])
def zoom():
    data = request.get_json(silent=True) or {}

    try:
        zoom_value = int(data.get("zoom", 100))
    except (TypeError, ValueError):
        return _error("zoom ត្រូវតែជាលេខ")

    if not (ZOOM_MIN <= zoom_value <= ZOOM_MAX):
        return _error(f"zoom ត្រូវនៅចន្លោះ {ZOOM_MIN} និង {ZOOM_MAX}")

    ok, _ = _safe_call(accessibility_engine.set_zoom, zoom_value)
    if not ok:
        return _error("មិនអាចកំណត់ zoom បានទេ", 500)

    return jsonify({
        "success": True,
        "zoom": accessibility_engine.zoom
    })


# =====================================================
# Rotation
# =====================================================

@accessibility_bp.route("/api/accessibility/rotate", methods=["POST"])
def rotate():
    data = request.get_json(silent=True) or {}

    try:
        degree = int(data.get("rotation", 0))
    except (TypeError, ValueError):
        return _error("rotation ត្រូវតែជាលេខ")

    if degree not in ROTATION_ALLOWED:
        return _error(f"rotation ត្រូវតែជាមួយក្នុងចំណោម {ROTATION_ALLOWED}")

    ok, _ = _safe_call(accessibility_engine.rotate, degree)
    if not ok:
        return _error("មិនអាចបង្វិលអេក្រង់បានទេ", 500)

    return jsonify({
        "success": True,
        "rotation": accessibility_engine.rotation
    })


# =====================================================
# Theme
# =====================================================

@accessibility_bp.route("/api/accessibility/theme", methods=["POST"])
def theme():
    data = request.get_json(silent=True) or {}
    mode = data.get("mode", "dark")

    if mode not in THEME_MODES_ALLOWED:
        return _error(f"mode ត្រូវតែជា {', '.join(THEME_MODES_ALLOWED)}")

    fn = accessibility_engine.set_white_mode if mode == "white" else accessibility_engine.set_dark_mode
    ok, _ = _safe_call(fn)
    if not ok:
        return _error("មិនអាចផ្លាស់ប្តូរ theme បានទេ", 500)

    return jsonify({
        "success": True,
        "mode": mode,
        "status": accessibility_engine.get_status()
    })


# =====================================================
# High Contrast
# =====================================================

@accessibility_bp.route("/api/accessibility/high_contrast", methods=["POST"])
def contrast():
    data = request.get_json(silent=True) or {}
    enabled = data.get("enabled", False)

    if not isinstance(enabled, bool):
        return _error("enabled ត្រូវតែជា true/false")

    fn = accessibility_engine.enable_high_contrast if enabled else accessibility_engine.disable_high_contrast
    ok, _ = _safe_call(fn)
    if not ok:
        return _error("មិនអាចកំណត់ high contrast បានទេ", 500)

    return jsonify({
        "success": True,
        "high_contrast": accessibility_engine.high_contrast
    })


# =====================================================
# Large Text
# =====================================================

@accessibility_bp.route("/api/accessibility/large_text", methods=["POST"])
def large_text():
    data = request.get_json(silent=True) or {}
    enabled = data.get("enabled", False)

    if not isinstance(enabled, bool):
        return _error("enabled ត្រូវតែជា true/false")

    fn = accessibility_engine.enable_large_text if enabled else accessibility_engine.disable_large_text
    ok, _ = _safe_call(fn)
    if not ok:
        return _error("មិនអាចកំណត់ large text បានទេ", 500)

    return jsonify({
        "success": True,
        "large_text": accessibility_engine.large_text
    })


# =====================================================
# Voice Settings
# =====================================================

@accessibility_bp.route("/api/accessibility/voice", methods=["POST"])
def voice():
    data = request.get_json(silent=True) or {}

    # --- enabled ---
    if "enabled" in data:
        if not isinstance(data["enabled"], bool):
            return _error("enabled ត្រូវតែជា true/false")
        fn = accessibility_engine.enable_voice if data["enabled"] else accessibility_engine.disable_voice
        ok, _ = _safe_call(fn)
        if not ok:
            return _error("មិនអាចកំណត់សំឡេងបានទេ", 500)

    # --- auto_read ---
    if "auto_read" in data:
        if not isinstance(data["auto_read"], bool):
            return _error("auto_read ត្រូវតែជា true/false")
        ok, _ = _safe_call(accessibility_engine.set_auto_read, data["auto_read"])
        if not ok:
            return _error("មិនអាចកំណត់ auto_read បានទេ", 500)

    # --- profile ---
    if "profile" in data:
        profile = data["profile"]
        if profile not in VOICE_PROFILES_ALLOWED:
            return _error(f"profile ត្រូវតែជាមួយក្នុងចំណោម {', '.join(VOICE_PROFILES_ALLOWED)}")
        ok, _ = _safe_call(accessibility_engine.set_voice_profile, profile)
        if not ok:
            return _error("មិនអាចកំណត់ profile សំឡេងបានទេ", 500)

    # --- speed ---
    if "speed" in data:
        try:
            speed = float(data["speed"])
        except (TypeError, ValueError):
            return _error("speed ត្រូវតែជាលេខ")
        if not (SPEED_MIN <= speed <= SPEED_MAX):
            return _error(f"speed ត្រូវនៅចន្លោះ {SPEED_MIN} និង {SPEED_MAX}")
        ok, _ = _safe_call(accessibility_engine.set_speed, speed)
        if not ok:
            return _error("មិនអាចកំណត់ល្បឿនសំឡេងបានទេ", 500)

    # --- volume ---
    if "volume" in data:
        try:
            volume = int(data["volume"])
        except (TypeError, ValueError):
            return _error("volume ត្រូវតែជាលេខ")
        if not (VOLUME_MIN <= volume <= VOLUME_MAX):
            return _error(f"volume ត្រូវនៅចន្លោះ {VOLUME_MIN} និង {VOLUME_MAX}")
        ok, _ = _safe_call(accessibility_engine.set_volume, volume)
        if not ok:
            return _error("មិនអាចកំណត់កម្រិតសំឡេងបានទេ", 500)

    return jsonify({
        "success": True,
        "voice": accessibility_engine.get_status()["voice"]
    })


# =====================================================
# Reset
# =====================================================

@accessibility_bp.route("/api/accessibility/reset", methods=["POST"])
def reset():
    ok, _ = _safe_call(accessibility_engine.reset)
    if not ok:
        return _error("មិនអាច Reset Accessibility បានទេ", 500)

    return jsonify({
        "success": True,
        "message": "Accessibility Reset",
        "status": accessibility_engine.get_status()
    })
