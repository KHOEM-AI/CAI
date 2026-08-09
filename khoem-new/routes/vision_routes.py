#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
=========================================================
KHOEM_AI 3.0
routes/voice_routes.py (Patched)
Voice API

+ bounds validation on rate/pitch/volume, text length cap,
+ error handling around voice_engine calls
=========================================================
"""

import logging

from flask import Blueprint, jsonify, request

from core.voice_engine import voice_engine

logger = logging.getLogger(__name__)

voice_bp = Blueprint(
    "voice",
    __name__
)

RATE_MIN, RATE_MAX = 0.5, 2.0
PITCH_MIN, PITCH_MAX = 0.5, 2.0
VOLUME_MIN, VOLUME_MAX = 0.0, 1.0
MAX_SPEAK_TEXT_LENGTH = 1000


def _error(message: str, status: int = 400):
    return jsonify({"success": False, "error": message}), status


def _safe_call(fn, *args, **kwargs):
    try:
        return True, fn(*args, **kwargs)
    except Exception as e:
        logger.exception("voice_engine error in %s: %s", getattr(fn, "__name__", "call"), e)
        return False, str(e)


# =====================================================
# Voice Status
# =====================================================

@voice_bp.route("/api/voice", methods=["GET"])
def voice_status():
    ok, settings = _safe_call(voice_engine.get_settings)
    if not ok:
        return _error("មិនអាចទាញយកការកំណត់សំឡេងបានទេ", 500)
    return jsonify({"success": True, "settings": settings})


# =====================================================
# Voice Profiles
# =====================================================

@voice_bp.route("/api/voice/profiles", methods=["GET"])
def voice_profiles():
    ok, profiles = _safe_call(voice_engine.list_profiles)
    if not ok:
        return _error("មិនអាចទាញយកបញ្ជីសំឡេងបានទេ", 500)
    return jsonify({"success": True, "profiles": profiles})


# =====================================================
# Select Voice
# =====================================================

@voice_bp.route("/api/voice/select", methods=["POST"])
def select_voice():
    data = request.get_json(silent=True) or {}
    voice = data.get("voice", "")

    if not voice or not isinstance(voice, str):
        return _error("voice ត្រូវការ ហើយត្រូវតែជា string")

    ok, result = _safe_call(voice_engine.set_voice, voice)
    if not ok:
        return _error("មិនអាចកំណត់សំឡេងបានទេ", 500)

    if not result:
        return _error("រកមិនឃើញ voice profile នេះទេ", 404)

    return jsonify({
        "success": True,
        "message": "voice updated",
        "settings": voice_engine.get_settings()
    })


# =====================================================
# Voice ON
# =====================================================

@voice_bp.route("/api/voice/on", methods=["POST"])
def voice_on():
    ok, _ = _safe_call(voice_engine.enable)
    if not ok:
        return _error("មិនអាចបើកសំឡេងបានទេ", 500)

    return jsonify({
        "success": True,
        "message": "voice enabled",
        "settings": voice_engine.get_settings()
    })


# =====================================================
# Voice OFF
# =====================================================

@voice_bp.route("/api/voice/off", methods=["POST"])
def voice_off():
    ok, _ = _safe_call(voice_engine.disable)
    if not ok:
        return _error("មិនអាចបិទសំឡេងបានទេ", 500)

    return jsonify({
        "success": True,
        "message": "voice disabled",
        "settings": voice_engine.get_settings()
    })


# =====================================================
# Toggle Voice
# =====================================================

@voice_bp.route("/api/voice/toggle", methods=["POST"])
def toggle_voice():
    ok, _ = _safe_call(voice_engine.toggle)
    if not ok:
        return _error("មិនអាចប្តូរស្ថានភាពសំឡេងបានទេ", 500)

    return jsonify({"success": True, "settings": voice_engine.get_settings()})


# =====================================================
# Auto Read
# =====================================================

@voice_bp.route("/api/voice/auto-read", methods=["POST"])
def auto_read():
    data = request.get_json(silent=True) or {}

    if "enabled" not in data or not isinstance(data.get("enabled"), bool):
        return _error("enabled ត្រូវការ ហើយត្រូវតែជា true/false")

    ok, _ = _safe_call(voice_engine.set_auto_read, data["enabled"])
    if not ok:
        return _error("មិនអាចកំណត់ auto-read បានទេ", 500)

    return jsonify({"success": True, "settings": voice_engine.get_settings()})


# =====================================================
# Update Settings
# =====================================================

@voice_bp.route("/api/voice/settings", methods=["POST"])
def update_settings():
    data = request.get_json(silent=True) or {}

    if "rate" in data:
        try:
            rate = float(data["rate"])
        except (TypeError, ValueError):
            return _error("rate ត្រូវតែជាលេខ")
        if not (RATE_MIN <= rate <= RATE_MAX):
            return _error(f"rate ត្រូវនៅចន្លោះ {RATE_MIN} និង {RATE_MAX}")
        ok, _ = _safe_call(voice_engine.set_rate, rate)
        if not ok:
            return _error("មិនអាចកំណត់ rate បានទេ", 500)

    if "pitch" in data:
        try:
            pitch = float(data["pitch"])
        except (TypeError, ValueError):
            return _error("pitch ត្រូវតែជាលេខ")
        if not (PITCH_MIN <= pitch <= PITCH_MAX):
            return _error(f"pitch ត្រូវនៅចន្លោះ {PITCH_MIN} និង {PITCH_MAX}")
        ok, _ = _safe_call(voice_engine.set_pitch, pitch)
        if not ok:
            return _error("មិនអាចកំណត់ pitch បានទេ", 500)

    if "volume" in data:
        try:
            volume = float(data["volume"])
        except (TypeError, ValueError):
            return _error("volume ត្រូវតែជាលេខ")
        if not (VOLUME_MIN <= volume <= VOLUME_MAX):
            return _error(f"volume ត្រូវនៅចន្លោះ {VOLUME_MIN} និង {VOLUME_MAX}")
        ok, _ = _safe_call(voice_engine.set_volume, volume)
        if not ok:
            return _error("មិនអាចកំណត់ volume បានទេ", 500)

    return jsonify({"success": True, "settings": voice_engine.get_settings()})


# =====================================================
# Speak Preview
# =====================================================

@voice_bp.route("/api/voice/speak", methods=["POST"])
def speak_preview():
    data = request.get_json(silent=True) or {}
    raw_text = data.get("text", "")

    if not isinstance(raw_text, str):
        return _error("text ត្រូវតែជា string")

    text = raw_text.strip()
    if not text:
        return _error("text ត្រូវការ")

    if len(text) > MAX_SPEAK_TEXT_LENGTH:
        return _error(f"text វែងពេក (អតិបរមា {MAX_SPEAK_TEXT_LENGTH} តួអក្សរ)")

    ok, result = _safe_call(voice_engine.speak, text)
    if not ok:
        return _error("មិនអាចបំពាក់សំឡេងបានទេ", 500)

    return jsonify({"success": True, "result": result})
