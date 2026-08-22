#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
core/vision_engine.py — ការវិភាគរូបភាព (Groq Vision)
"""

import os
import logging
import requests

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_VISION_MODEL = "qwen/qwen3.6-27b"
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

logger = logging.getLogger("KHOEM_AI")


def call_groq_vision(image_base64, question, mime_type="image/jpeg"):
    """
    ហៅ Groq vision model វិភាគរូបភាព
    ត្រឡប់ (success: bool, text_or_error: str)
    """
    if not GROQ_API_KEY:
        return False, "សូមកំណត់ GROQ_API_KEY ជាមុនសិន"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}"
    }

    payload = {
        "model": GROQ_VISION_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": question},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_base64}"}}
            ]
        }],
        "max_tokens": 1024
    }

    try:
        response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        return True, data["choices"][0]["message"]["content"]
    except requests.exceptions.RequestException as e:
        logger.error(f"Groq Vision API error: {e}")
        return False, f"មានបញ្ហាវិភាគរូបភាព: {str(e)}"
