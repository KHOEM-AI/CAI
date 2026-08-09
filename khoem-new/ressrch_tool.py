#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ==============================================================================
# research_routes.py — KHOEM_AI 3.3 AI Web Research Blueprint (Claude API)
# ==============================================================================
import os
import logging
import requests
from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)

# ==============================================================================
# Configuration & Environment Variables
# ==============================================================================
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-3-7-sonnet-20250219")
MAX_QUESTION_LENGTH = int(os.getenv("MAX_QUESTION_LENGTH", 2000))

research_bp = Blueprint("research_bp", __name__)


def call_claude_with_search(user_question: str, system_prompt: str = "") -> tuple[bool, str, list[dict]]:
    """
    Calls the Anthropic Claude API with the native web_search tool enabled.
    Claude dynamically determines whether to invoke web search based on the query.

    :param user_question: User prompt or query text.
    :param system_prompt: Optional custom instructions for the research agent.
    :return: Tuple containing (success: bool, answer_text: str, sources: list[dict])
    """
    if not ANTHROPIC_API_KEY:
        logger.warning("ANTHROPIC_API_KEY is missing in environment configuration.")
        return False, "ANTHROPIC_API_KEY is not set in .env file.", []

    if not user_question or not isinstance(user_question, str) or not user_question.strip():
        return False, "Invalid query: Please provide a non-empty question.", []

    question = user_question.strip()
    if len(question) > MAX_QUESTION_LENGTH:
        return False, f"Question exceeds maximum allowed length ({MAX_QUESTION_LENGTH} characters).", []

    headers = {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
    }

    default_system = (
        "You are an expert AI research assistant for KHOEM_AI. "
        "Use the web search tool whenever fresh facts, news, or current information are requested. "
        "Provide direct and concise responses in Khmer unless requested otherwise."
    )

    payload = {
        "model": CLAUDE_MODEL,
        "max_tokens": 1500,
        "system": system_prompt or default_system,
        "messages": [{"role": "user", "content": question}],
        "tools": [
            {
                "type": "web_search_20250305",
                "name": "web_search"
            }
        ]
    }

    try:
        response = requests.post(CLAUDE_API_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.HTTPError as e:
        logger.error("Claude API HTTP error: %s — %s", e, getattr(response, "text", ""))
        return False, f"Claude API HTTP Error ({response.status_code})", []
    except requests.exceptions.RequestException as e:
        logger.error("Claude API connection exception: %s", e)
        return False, "Failed to establish connection to Claude API endpoint.", []
    except ValueError as e:
        logger.error("Failed to parse JSON response from Claude API: %s", e)
        return False, "Received an invalid JSON payload from Claude API.", []

    text_parts = []
    sources = []

    try:
        for block in data.get("content", []):
            if block.get("type") == "text":
                text_parts.append(block.get("text", ""))
            elif block.get("type") == "web_search_tool_result":
                for item in block.get("content", []):
                    if item.get("type") == "web_search_result":
                        sources.append({
                            "title": item.get("title", ""),
                            "url": item.get("url", "")
                        })
    except (AttributeError, TypeError) as e:
        logger.error("Unexpected payload schema from Claude API: %s", e)
        return False, "Response payload structural validation failed.", []

    full_text = "\n".join(text_parts).strip()
    return True, full_text, sources


# ==============================================================================
# API Routes
# ==============================================================================

@research_bp.route("/api/research", methods=["POST"])
def api_research():
    """
    HTTP POST endpoint for triggering AI web research query.
    """
    data = request.get_json(silent=True) or {}
    question = data.get("question", "")

    if not isinstance(question, str) or not question.strip():
        return jsonify({"error": "Field 'question' is required."}), 400

    success, answer, sources = call_claude_with_search(question.strip())

    if success:
        return jsonify({
            "status": "success",
            "answer": answer,
            "sources": sources
        }), 200
    else:
        return jsonify({
            "status": "error",
            "error": answer
        }), 502
