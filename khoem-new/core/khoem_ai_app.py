"""Production-oriented Flask API for the Khmer AI core.

This module keeps the original three concepts:

* request authentication and request-size protection;
* a core-memory authorization check;
* a response-safety filter and a system-health report.

The thermal report is explicitly simulated. It must not be treated as a
measurement of the host machine.

Request authentication
----------------------
Every request to the processing endpoint requires:

    Authorization: Bearer <KHMER_AI_TOKEN>
    X-Core-Timestamp: <Unix timestamp in seconds>
    X-Core-Signature: <hex HMAC-SHA256>

The HMAC input is ``<timestamp>.<raw-request-body>`` and is calculated with
``KHMER_MASTER_SECRET``. This prevents the old design's replayable
SHA-256(secret) value from being sent by clients.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
import unicodedata
import uuid
from dataclasses import dataclass
from functools import wraps
from typing import Any, Callable, TypeVar

from flask import Flask, g, jsonify, request

# ── KHOEM_AI: ភ្ជាប់ AI Chat (Groq) ចូល App ───────────────────────────────
from routes.chat_routes import chat_bp


LOGGER = logging.getLogger("khmer_ai")
F = TypeVar("F", bound=Callable[..., Any])


def required_secret(name: str, *, minimum_length: int = 32) -> str:
    """Read a required secret and fail closed when it is absent or weak."""

    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} must be configured; no default is allowed")
    if len(value) < minimum_length:
        raise RuntimeError(
            f"{name} must contain at least {minimum_length} characters"
        )
    return value


@dataclass(frozen=True)
class Settings:
    """Configuration loaded once when the application is created."""

    api_token: str
    master_secret: str
    flask_secret_key: str
    max_content_length: int = 1 * 1024 * 1024
    signature_clock_skew_seconds: int = 300
    max_message_length: int = 2_000

    @classmethod
    def from_environment(cls) -> "Settings":
        return cls(
            api_token=required_secret("KHMER_AI_TOKEN"),
            master_secret=required_secret("KHMER_MASTER_SECRET"),
            flask_secret_key=required_secret("FLASK_SECRET_KEY"),
        )


class CoreMemory:
    """Small example of protected internal state.

    Do not expose the secret or the full internal memory through an HTTP
    endpoint. Real AI memory should use an authenticated data store with
    explicit tenant and record-level authorization.
    """

    def __init__(self, master_secret: str) -> None:
        self._master_secret = master_secret.encode("utf-8")

    def authorize(self, timestamp: str, raw_body: bytes, signature: str) -> bool:
        """Verify the request's short-lived HMAC signature."""

        expected = hmac.new(
            self._master_secret,
            f"{timestamp}.".encode("utf-8") + raw_body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


class SystemHealth:
    """Health provider with a clearly marked simulation fallback."""

    def report(self) -> dict[str, Any]:
        # The original code generated a random temperature. Keep that behavior
        # visible as a simulation rather than presenting it as real telemetry.
        return {
            "mode": "SIMULATED",
            "thermal_status": "NOT_MEASURED",
            "temperature": None,
            "capacity_gb": None,
            "note": "Connect a real host telemetry provider before relying on this data.",
        }


def normalized_contains_any(text: str, terms: tuple[str, ...]) -> bool:
    """Perform a Unicode-normalized, case-insensitive term check."""

    normalized_text = unicodedata.normalize("NFC", text).casefold()
    return any(
        unicodedata.normalize("NFC", term).casefold() in normalized_text
        for term in terms
    )


class ResponseSafetyFilter:
    """A lightweight first-pass filter, not a complete moderation system."""

    _toxic_terms = ("ជេរ", "ឆ្កួត", "ឡប់", "ល្ងង់", "អន់", "ឡប់សតិ")

    def process(self, user_message: str) -> dict[str, Any]:
        if normalized_contains_any(user_message, self._toxic_terms):
            LOGGER.info("Safety filter triggered request_id=%s", g.request_id)
            return {
                "response_mode": "SAFE_SHIELD",
                "message": "សូមរក្សាការសន្ទនាឱ្យមានការគោរព។ តើអ្នកមានសំណួរអ្វីបន្តទៀត?",
            }

        # Do not reflect arbitrary user input into a response. JSON encoding is
        # not a substitute for output encoding in downstream HTML consumers.
        return {
            "response_mode": "STANDARD",
            "message": "ទទួលបានសំណួររបស់អ្នករួចរាល់ហើយ។",
        }


def create_app(settings: Settings | None = None) -> Flask:
    """Application factory suitable for WSGI servers and isolated tests."""

    config = settings or Settings.from_environment()
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY=config.flask_secret_key,
        MAX_CONTENT_LENGTH=config.max_content_length,
        JSON_SORT_KEYS=False,
    )

    core_memory = CoreMemory(config.master_secret)
    health = SystemHealth()
    response_filter = ResponseSafetyFilter()

    @app.before_request
    def assign_request_id() -> None:
        # Never trust a caller-provided request ID as the only identifier.
        g.request_id = str(uuid.uuid4())

    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Request-ID"] = g.get("request_id", "unknown")
        return response

    def json_error(message: str, status: int):
        return jsonify({"error": message, "request_id": g.request_id}), status

    @app.errorhandler(400)
    def handle_bad_request(_error):
        return json_error("Invalid request.", 400)

    @app.errorhandler(401)
    def handle_unauthorized(_error):
        return json_error("Authentication required.", 401)

    @app.errorhandler(403)
    def handle_forbidden(_error):
        return json_error("Request not authorized.", 403)

    @app.errorhandler(413)
    def handle_payload_too_large(_error):
        return json_error("Request payload is too large.", 413)

    @app.errorhandler(415)
    def handle_unsupported_media_type(_error):
        return json_error("Content-Type must be application/json.", 415)

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        LOGGER.exception(
            "Unhandled request error request_id=%s error_type=%s",
            g.get("request_id", "unknown"),
            type(error).__name__,
        )
        return json_error("Internal server error.", 500)

    def require_api_token(view: F) -> F:
        @wraps(view)
        def decorated(*args, **kwargs):
            authorization = request.headers.get("Authorization", "")
            supplied = (
                authorization.removeprefix("Bearer ").strip()
                if authorization.startswith("Bearer ")
                else ""
            )
            if not supplied or not hmac.compare_digest(supplied, config.api_token):
                LOGGER.warning(
                    "API authentication failed request_id=%s",
                    g.request_id,
                )
                return json_error("Authentication required.", 401)
            return view(*args, **kwargs)

        return decorated  # type: ignore[return-value]

    def require_signed_request(view: F) -> F:
        @wraps(view)
        def decorated(*args, **kwargs):
            timestamp = request.headers.get("X-Core-Timestamp", "")
            signature = request.headers.get("X-Core-Signature", "")

            try:
                timestamp_value = int(timestamp)
            except ValueError:
                timestamp_value = 0

            if (
                not timestamp
                or not signature
                or abs(int(time.time()) - timestamp_value)
                > config.signature_clock_skew_seconds
                or not core_memory.authorize(
                    timestamp,
                    request.get_data(cache=True),
                    signature,
                )
            ):
                LOGGER.warning(
                    "Core signature validation failed request_id=%s",
                    g.request_id,
                )
                return json_error("Request signature invalid or expired.", 403)
            return view(*args, **kwargs)

        return decorated  # type: ignore[return-value]

    @app.get("/api/health")
    def health_check():
        return jsonify({"status": "ok"})

    @app.post("/api/khmer-ai/process")
    @require_api_token
    @require_signed_request
    def process_request():
        if not request.is_json:
            return json_error("Content-Type must be application/json.", 415)

        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return json_error("JSON body must be an object.", 400)

        user_message = payload.get("message")
        if not isinstance(user_message, str) or not user_message.strip():
            return json_error("message must be a non-empty string.", 400)
        if len(user_message) > config.max_message_length:
            return json_error("message is too long.", 400)

        output = response_filter.process(user_message.strip())
        return jsonify(
            {
                "system_name": "Khmer AI",
                "request_id": g.request_id,
                "hardware_status": health.report(),
                "security_tier": "API token and signed request verified",
                "output": output,
            }
        )

    # ── KHOEM_AI: ភ្ជាប់ Route /api/chat ចូល App (ចាំបាច់ ដើម្បីឱ្យ Chat ដំណើរការ) ──
    app.register_blueprint(chat_bp)

    return app


def configure_logging() -> None:
    """Configure structured-enough process logging without logging secrets."""

    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


configure_logging()
app = create_app()


if __name__ == "__main__":
    # Development convenience only. Use Gunicorn/uWSGI behind TLS in
    # production, and keep debug disabled.
    app.run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "5000")),
        debug=False,
    )
