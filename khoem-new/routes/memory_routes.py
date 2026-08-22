#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
routes/memory_routes.py (Patched)
+ type validation, label length cap, DELETE endpoint,
+ broader error handling around engine/DB calls
"""

import logging

from flask import Blueprint, request, jsonify
from core.memory_engine import (
    remember_place,
    recall_place,
    recall_all_places,
    forget_place,
)

logger = logging.getLogger(__name__)

memory_bp = Blueprint("memory", __name__)

MAX_LABEL_LENGTH = 100


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def _valid_session_and_label(session_id, label) -> str | None:
    """Returns an error message if invalid, otherwise None."""
    if not session_id or not isinstance(session_id, str):
        return "session_id ត្រូវការ ហើយត្រូវតែជា string"
    if not label or not isinstance(label, str):
        return "label ត្រូវការ ហើយត្រូវតែជា string"
    if len(label.strip()) > MAX_LABEL_LENGTH:
        return f"label វែងពេក (អតិបរមា {MAX_LABEL_LENGTH} តួអក្សរ)"
    return None


@memory_bp.route("/api/places", methods=["POST"])
def add_place():
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id")
    label = data.get("label", "")
    lat = data.get("lat")
    lng = data.get("lng")

    label = label.strip() if isinstance(label, str) else label

    err = _valid_session_and_label(session_id, label)
    if err:
        return _error(err)

    if lat is None or lng is None:
        return _error("ត្រូវការ lat និង lng")

    try:
        result = remember_place(session_id, label, lat, lng)
        return jsonify({"status": "saved", **result})
    except ValueError as e:
        return _error(str(e))
    except Exception as e:
        logger.exception("Unexpected error in remember_place: %s", e)
        return _error("មិនអាចរក្សាទុកទីតាំងបានទេ", 500)


@memory_bp.route("/api/places/<session_id>", methods=["GET"])
def list_places(session_id):
    try:
        places = recall_all_places(session_id)
    except Exception as e:
        logger.exception("Unexpected error in recall_all_places: %s", e)
        return _error("មិនអាចទាញយកទីតាំងទាំងអស់បានទេ", 500)

    return jsonify({"places": places})


@memory_bp.route("/api/places/<session_id>/<label>", methods=["GET"])
def find_place(session_id, label):
    try:
        place = recall_place(session_id, label)
    except Exception as e:
        logger.exception("Unexpected error in recall_place: %s", e)
        return _error("មិនអាចទាញយកទីតាំងបានទេ", 500)

    if place:
        return jsonify(place)
    return _error("រកមិនឃើញទីតាំងនេះទេ", 404)


@memory_bp.route("/api/places/<session_id>/<label>", methods=["DELETE"])
def delete_place(session_id, label):
    try:
        deleted = forget_place(session_id, label)
    except Exception as e:
        logger.exception("Unexpected error in forget_place: %s", e)
        return _error("មិនអាចលុបទីតាំងបានទេ", 500)

    if not deleted:
        return _error("រកមិនឃើញទីតាំងនេះទេ", 404)

    return jsonify({"status": "deleted", "label": label})
