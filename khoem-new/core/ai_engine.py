#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ==============================================================================
# khoem-new/core/ai_engine.py
# AI Engine — Groq (Chat + Vision) + SQLite conversation memory
# ==============================================================================

from __future__ import annotations

import datetime
import logging
import os
import sqlite3

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ==============================================================================
# Configuration
# ==============================================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Config:
    """Central configuration — all values read from environment variables."""

    GROQ_API_KEY      : str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL        : str = os.getenv("GROQ_MODEL",        "llama-3.3-70b-versatile")
    GROQ_VISION_MODEL : str = os.getenv("GROQ_VISION_MODEL", "llama-3.2-90b-vision-preview")
    GROQ_API_URL      : str = "https://api.groq.com/openai/v1/chat/completions"

    DB_PATH     : str = os.path.join(BASE_DIR, "..", "database", "khoem_ai.db")
    MAX_HISTORY : int = int(os.getenv("MAX_HISTORY", 20))
    MAX_TOKENS  : int = int(os.getenv("MAX_TOKENS",  1024))
    TEMPERATURE : float = float(os.getenv("TEMPERATURE", 0.7))

    DEFAULT_SYSTEM_PROMPT : str = (
        "អ្នកជាជំនួយការឆ្លាតវៃឈ្មោះ KHOEM_AI។ "
        "ឆ្លើយតបជាភាសាខ្មែរ លើកលែងតែអ្នកប្រើប្រាស់សួរជាភាសាផ្សេង។"
    )

# Ensure database directory exists
os.makedirs(os.path.dirname(os.path.abspath(Config.DB_PATH)), exist_ok=True)


# ==============================================================================
# Database
# ==============================================================================

def _connect() -> sqlite3.Connection:
    """Open a SQLite connection with recommended pragmas."""
    conn = sqlite3.connect(Config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Create tables and indexes if they do not already exist."""
    with _connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS conversations (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT    NOT NULL,
                role       TEXT    NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
                content    TEXT    NOT NULL,
                created_at TEXT    NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_conv_session
                ON conversations (session_id, id);
        """)
    logger.info("Database ready: %s", Config.DB_PATH)


def _utcnow() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    

def save_message(session_id: str, role: str, content: str) -> None:
    """Persist one message to the conversation history."""
    with _connect() as conn:
        conn.execute(
            "INSERT INTO conversations (session_id, role, content, created_at)"
            " VALUES (?, ?, ?, ?)",
            (session_id, role, content, _utcnow()),
        )


def get_history(session_id: str, limit: int | None = None) -> list[dict]:
    """
    Return the last *limit* messages for a session, oldest first.
    Defaults to Config.MAX_HISTORY when limit is None.
    """
    limit = limit or Config.MAX_HISTORY
    with _connect() as conn:
        rows = conn.execute(
            "SELECT role, content FROM conversations"
            " WHERE session_id = ?"
            " ORDER BY id DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
    return [dict(r) for r in reversed(rows)]


def clear_history(session_id: str) -> None:
    """Delete all conversation history for a session."""
    with _connect() as conn:
        conn.execute("DELETE FROM conversations WHERE session_id = ?", (session_id,))
    logger.info("History cleared for session: %s", session_id)


# ==============================================================================
# Groq API — internal helpers
# ==============================================================================

def _auth_headers() -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {Config.GROQ_API_KEY}",
    }


def _check_api_key() -> tuple[bool, str] | None:
    """Return an error tuple if GROQ_API_KEY is missing, otherwise None."""
    if not Config.GROQ_API_KEY:
        return False, "សូមកំណត់ GROQ_API_KEY មុនសិន"
    return None


def _parse_groq_response(resp: requests.Response) -> tuple[bool, str]:
    """Extract the assistant reply from a successful Groq response."""
    try:
        return True, resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as exc:
        logger.error("Unexpected Groq response shape: %s", exc)
        return False, "Groq បញ្ជូន response មិនត្រឹមត្រូវ"


# ==============================================================================
# Groq API — public interface
# ==============================================================================

def chat(
    messages: list[dict],
    system_prompt: str = "",
) -> tuple[bool, str]:
    """
    Send *messages* to Groq and return (success, reply_or_error).

    Args:
        messages:      List of {"role": ..., "content": ...} dicts.
        system_prompt: Optional system instruction prepended to the conversation.

    Returns:
        (True, reply_text) on success, (False, error_message) on failure.
    """
    err = _check_api_key()
    if err:
        return err

    full_messages: list[dict] = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    payload = {
        "model":       Config.GROQ_MODEL,
        "messages":    full_messages,
        "max_tokens":  Config.MAX_TOKENS,
        "temperature": Config.TEMPERATURE,
    }

    try:
        resp = requests.post(
            Config.GROQ_API_URL,
            headers=_auth_headers(),
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        return _parse_groq_response(resp)

    except requests.exceptions.HTTPError:
        logger.error("Groq chat HTTP %s: %s", resp.status_code, resp.text)
        return False, f"Groq API បញ្ហា (HTTP {resp.status_code})"
    except requests.exceptions.ConnectionError:
        logger.error("Groq chat: connection error")
        return False, "មិនអាចភ្ជាប់ Groq API បាន — សូមពិនិត្យ internet"
    except requests.exceptions.Timeout:
        logger.error("Groq chat: request timed out")
        return False, "Groq API timeout — សូមព្យាយាមម្ដងទៀត"
    except requests.exceptions.RequestException as exc:
        logger.error("Groq chat error: %s", exc)
        return False, "បញ្ហាក្នុងការភ្ជាប់ Groq API"


def chat_with_memory(
    session_id: str,
    user_message: str,
    system_prompt: str = "",
) -> tuple[bool, str]:
    """
    High-level helper: save the user message, call Groq with full history,
    save the assistant reply, and return (success, reply_or_error).

    This is the function Flask routes should call — not chat() directly.
    """
    save_message(session_id, "user", user_message)

    history = get_history(session_id)
    messages = [{"role": h["role"], "content": h["content"]} for h in history]

    prompt = system_prompt or Config.DEFAULT_SYSTEM_PROMPT
    success, reply = chat(messages, prompt)

    if success:
        save_message(session_id, "assistant", reply)

    return success, reply


def vision(
    image_base64: str,
    question: str = "",
    mime_type: str = "image/jpeg",
) -> tuple[bool, str]:
    """
    Describe or answer questions about an image encoded as base-64.

    Args:
        image_base64: Raw base-64 string (no data-URI prefix).
        question:     Question to ask about the image (Khmer or English).
        mime_type:    MIME type of the image, e.g. "image/jpeg", "image/png".

    Returns:
        (True, answer_text) on success, (False, error_message) on failure.
    """
    err = _check_api_key()
    if err:
        return err

    question = question or "សូមពិពណ៌នារូបភាពនេះជាភាសាខ្មែរ"

    payload = {
        "model": Config.GROQ_VISION_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text",      "text": question},
                {"type": "image_url", "image_url": {
                    "url": f"data:{mime_type};base64,{image_base64}",
                }},
            ],
        }],
        "max_tokens": Config.MAX_TOKENS,
    }

    try:
        resp = requests.post(
            Config.GROQ_API_URL,
            headers=_auth_headers(),
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        return _parse_groq_response(resp)

    except requests.exceptions.HTTPError:
        logger.error("Groq vision HTTP %s: %s", resp.status_code, resp.text)
        return False, f"Vision API បញ្ហា (HTTP {resp.status_code})"
    except requests.exceptions.Timeout:
        logger.error("Groq vision: request timed out")
        return False, "Vision API timeout — រូបភាពអាចនឹងធំពេក"
    except requests.exceptions.RequestException as exc:
        logger.error("Groq vision error: %s", exc)
        return False, "បញ្ហាក្នុងការវិភាគរូបភាព"


# ==============================================================================
# Module init
# ==============================================================================

init_db()
