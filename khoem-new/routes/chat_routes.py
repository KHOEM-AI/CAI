#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
routes/chat_routes.py (Patched)
+ input validation, message length cap, default system prompt,
+ error handling around DB calls, configurable history limit,
+ DELETE endpoint for clearing history
"""

import logging

from flask import Blueprint, request, jsonify
from core.ai_engine import chat as call_groq
from core.database_engine import save_message, get_history, clear_history

logger = logging.getLogger(__name__)

chat_bp = Blueprint("chat", __name__)

MAX_MESSAGE_LENGTH = 4000
MAX_HISTORY_LIMIT = 500
DEFAULT_SYSTEM_PROMPT = (
    "អ្នកជាជំនួយការឆ្លាតវៃឈ្មោះ KHOEM_AI។ "
    "ឆ្លើយតបឱ្យខ្លីៗ និងច្បាស់លាស់ជាភាសាខ្មែរ លើកលែងតែអ្នកប្រើប្រាស់សួរជាភាសាផ្សេង។"
)


def _error(message: str, status: int = 400):
    return jsonify({"error": message}), status


@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}

    session_id = data.get("session_id")
    raw_message = data.get("message")
    system_prompt = data.get("system_prompt") or DEFAULT_SYSTEM_PROMPT

    if not session_id or not isinstance(session_id, str):
        return _error("session_id ត្រូវការ ហើយត្រូវតែជា string")

    if not raw_message or not isinstance(raw_message, str):
        return _error("message ត្រូវការ ហើយត្រូវតែជា string")

    user_message = raw_message.strip()
    if not user_message:
        return _error("message មិនអាចទទេបានទេ")

    if len(user_message) > MAX_MESSAGE_LENGTH:
        return _error(f"សារវែងពេក (អតិបរមា {MAX_MESSAGE_LENGTH} តួអក្សរ)")

    try:
        save_message(session_id, "user", user_message)
        history_rows = get_history(session_id)
    except Exception as e:
        logger.exception("DB error while preparing chat history: %s", e)
        return _error("បញ្ហាក្នុងការចូលប្រើមូលដ្ឋានទិន្នន័យ", 500)

    groq_messages = [{"role": h["role"], "content": h["content"]} for h in history_rows]

    success, reply = call_groq(groq_messages, system_prompt)

    if not success:
        return _error(reply, 502)

    try:
        save_message(session_id, "assistant", reply)
    except Exception as e:
        logger.exception("DB error while saving assistant reply: %s", e)
        # Reply already generated — still return it to the user even if saving failed
        return jsonify({
            "reply": reply,
            "session_id": session_id,
            "warning": "ការឆ្លើយតបជោគជ័យ ប៉ុន្តែមិនអាចរក្សាទុកប្រវត្តិបានទេ"
        })

    return jsonify({"reply": reply, "session_id": session_id})


@chat_bp.route("/api/history/<session_id>", methods=["GET"])
def history(session_id):
    try:
        limit = int(request.args.get("limit", 100))
    except (TypeError, ValueError):
        return _error("limit ត្រូវតែជាលេខ")

    limit = max(1, min(limit, MAX_HISTORY_LIMIT))

    try:
        messages = get_history(session_id, limit=limit)
    except Exception as e:
        logger.exception("DB error while fetching history: %s", e)
        return _error("មិនអាចទាញយកប្រវត្តិសន្ទនាបានទេ", 500)

    return jsonify({"session_id": session_id, "messages": messages})


@chat_bp.route("/api/history/<session_id>", methods=["DELETE"])
def delete_history(session_id):
    try:
        clear_history(session_id)
    except Exception as e:
        logger.exception("DB error while clearing history: %s", e)
        return _error("មិនអាចលុបប្រវត្តិសន្ទនាបានទេ", 500)

    return jsonify({"status": "cleared", "session_id": session_id})
