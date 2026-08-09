#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
=========================================================
KHOEM_AI 3.0
routes/voice_routes.py
Voice API
=========================================================
"""

from flask import Blueprint, jsonify, request

from core.voice_engine import voice_engine

voice_bp = Blueprint(
    "voice",
    __name__
)

# =====================================================
# Voice Status
# =====================================================

@voice_bp.route("/api/voice", methods=["GET"])
def voice_status():

    return jsonify({

        "success": True,

        "settings": voice_engine.get_settings()

    })


# =====================================================
# Voice Profiles
# =====================================================

@voice_bp.route("/api/voice/profiles", methods=["GET"])
def voice_profiles():

    return jsonify({

        "success": True,

        "profiles": voice_engine.list_profiles()

    })


# =====================================================
# Select Voice
# =====================================================

@voice_bp.route("/api/voice/select", methods=["POST"])
def select_voice():

    data = request.get_json(silent=True) or {}

    voice = data.get("voice", "")

    if not voice:

        return jsonify({

            "success": False,

            "error": "voice is required"

        }), 400

    ok = voice_engine.set_voice(voice)

    if not ok:

        return jsonify({

            "success": False,

            "error": "voice profile not found"

        }), 404

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

    voice_engine.enable()

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

    voice_engine.disable()

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

    voice_engine.toggle()

    return jsonify({

        "success": True,

        "settings": voice_engine.get_settings()

    })


# =====================================================
# Auto Read
# =====================================================

@voice_bp.route("/api/voice/auto-read", methods=["POST"])
def auto_read():

    data = request.get_json(silent=True) or {}

    enabled = bool(data.get("enabled", False))

    voice_engine.set_auto_read(enabled)

    return jsonify({

        "success": True,

        "settings": voice_engine.get_settings()

    })


# =====================================================
# Update Settings
# =====================================================

@voice_bp.route("/api/voice/settings", methods=["POST"])
def update_settings():

    data = request.get_json(silent=True) or {}

    if "rate" in data:
        voice_engine.set_rate(data["rate"])

    if "pitch" in data:
        voice_engine.set_pitch(data["pitch"])

    if "volume" in data:
        voice_engine.set_volume(data["volume"])

    return jsonify({

        "success": True,

        "settings": voice_engine.get_settings()

    })


# =====================================================
# Speak Preview
# =====================================================

@voice_bp.route("/api/voice/speak", methods=["POST"])
def speak_preview():

    data = request.get_json(silent=True) or {}

    text = data.get("text", "").strip()

    if not text:

        return jsonify({

            "success": False,

            "error": "text is required"

        }), 400

    return jsonify({

        "success": True,

        "result": voice_engine.speak(text)

    })

