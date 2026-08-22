#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ==============================================================================
# routes/vault_routes.py — Secure Vault blueprint
#
# Mounted on app.py with:
#     from routes.vault_routes import vault_bp, init_vault_db
#     app.register_blueprint(vault_bp)
#     init_vault_db()
#
# Required .env additions (see .env.example at the bottom of this file):
#     VAULT_MASTER_KEY=<fernet key>
#     VAULT_TOKEN_SECRET=<random long string>
#     GOOGLE_CLIENT_ID=...
#     GOOGLE_CLIENT_SECRET=...
#     GOOGLE_REDIRECT_URI=https://your-domain/api/vault/google/callback
#
# Required pip packages (add to requirements.txt):
#     cryptography
#     authlib
# ==============================================================================

import os
import io
import time
import sqlite3
import logging
import datetime
import mimetypes
from urllib.parse import urlencode

from flask import Blueprint, request, jsonify, send_file, redirect, current_app
from authlib.integrations.requests_client import OAuth2Session

from core.vault_security import (
    hash_password, verify_password,
    encrypt_bytes, decrypt_bytes,
    new_owner_id, issue_unlock_token, verify_unlock_token,
    face_matches, serialize_descriptor,
)

logger = logging.getLogger(__name__)
vault_bp = Blueprint("vault", __name__, url_prefix="/api/vault")

# ------------------------------------------------------------------------------
# Config
# ------------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VAULT_DB_PATH = os.path.join(BASE_DIR, "database", "vault.db")
VAULT_FILES_DIR = os.path.join(BASE_DIR, "vault_storage")  # encrypted blobs live here, NOT under static/
os.makedirs(os.path.dirname(VAULT_DB_PATH), exist_ok=True)
os.makedirs(VAULT_FILES_DIR, exist_ok=True)

OWNER_COOKIE = "vault_owner_id"
OWNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5  # 5 years — this identifies "whose vault", not an unlock
UNLOCK_TOKEN_TTL = 60 * 30  # 30 minutes of unlocked access after password/face verification

ALLOWED_CATEGORIES = {"document", "image", "video", "code", "audio"}
MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200MB per file — tune to your server/disk

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")
GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"


def _token_secret() -> str:
    secret = os.getenv("VAULT_TOKEN_SECRET", "")
    if not secret:
        raise RuntimeError("VAULT_TOKEN_SECRET មិនទាន់បានកំណត់ក្នុង .env")
    return secret


# ------------------------------------------------------------------------------
# DB
# ------------------------------------------------------------------------------

def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(VAULT_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_vault_db() -> None:
    with _conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS vault_auth (
                owner_id        TEXT PRIMARY KEY,
                password_hash   TEXT NOT NULL,
                face_descriptor TEXT,
                google_email    TEXT,
                google_sub      TEXT,
                created_at      TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS vault_files (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id      TEXT NOT NULL,
                category      TEXT NOT NULL CHECK(category IN ('document','image','video','code','audio')),
                original_name TEXT NOT NULL,
                stored_name   TEXT NOT NULL UNIQUE,
                mime_type     TEXT,
                size_bytes    INTEGER NOT NULL,
                uploaded_at   TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES vault_auth(owner_id)
            );
            CREATE INDEX IF NOT EXISTS idx_vault_files_owner ON vault_files(owner_id);

            CREATE TABLE IF NOT EXISTS vault_login_attempts (
                owner_id     TEXT NOT NULL,
                attempted_at REAL NOT NULL
            );
        """)
    logger.info("Vault database initialised at %s", VAULT_DB_PATH)


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


# ------------------------------------------------------------------------------
# Owner identity + brute-force throttling
# ------------------------------------------------------------------------------

def _get_or_create_owner_id(response_holder: dict) -> str:
    owner_id = request.cookies.get(OWNER_COOKIE)
    if owner_id:
        return owner_id
    owner_id = new_owner_id()
    response_holder["new_owner_id"] = owner_id
    return owner_id


def _too_many_recent_attempts(owner_id: str, window_seconds: int = 300, max_attempts: int = 8) -> bool:
    cutoff = time.time() - window_seconds
    with _conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS c FROM vault_login_attempts WHERE owner_id = ? AND attempted_at >= ?",
            (owner_id, cutoff),
        ).fetchone()
    return row["c"] >= max_attempts


def _record_attempt(owner_id: str) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO vault_login_attempts (owner_id, attempted_at) VALUES (?, ?)",
            (owner_id, time.time()),
        )
        # housekeeping: drop attempts older than 1 day
        conn.execute(
            "DELETE FROM vault_login_attempts WHERE attempted_at < ?",
            (time.time() - 86400,),
        )


def _require_unlock():
    """Returns owner_id if the request carries a valid unlock token, else None."""
    owner_id = request.cookies.get(OWNER_COOKIE)
    token = request.headers.get("X-Vault-Token", "")
    if not owner_id or not token:
        return None
    if not verify_unlock_token(token, owner_id, _token_secret(), int(time.time())):
        return None
    return owner_id


def _unlock_required_response():
    return jsonify({"error": "vault_locked", "message": "សូមផ្ទៀងផ្ទាត់ Password ឬស្កេនមុខជាមុនសិន"}), 401


# ------------------------------------------------------------------------------
# Setup / status / unlock
# ------------------------------------------------------------------------------

@vault_bp.route("/status", methods=["GET"])
def status():
    holder = {}
    owner_id = _get_or_create_owner_id(holder)
    with _conn() as conn:
        row = conn.execute(
            "SELECT owner_id, face_descriptor, google_email FROM vault_auth WHERE owner_id = ?",
            (owner_id,),
        ).fetchone()

    resp = jsonify({
        "vault_exists": row is not None,
        "face_enrolled": bool(row and row["face_descriptor"]),
        "google_linked": bool(row and row["google_email"]),
        "google_email": row["google_email"] if row else None,
        "unlocked": _require_unlock() is not None,
    })
    if "new_owner_id" in holder:
        resp.set_cookie(OWNER_COOKIE, holder["new_owner_id"],
                         max_age=OWNER_COOKIE_MAX_AGE, httponly=True, samesite="Lax")
    return resp


@vault_bp.route("/setup", methods=["POST"])
def setup():
    """First-time password creation for this device's vault. Fails if one already exists."""
    holder = {}
    owner_id = _get_or_create_owner_id(holder)
    data = request.get_json(silent=True) or {}
    password = str(data.get("password", ""))

    if len(password) < 8:
        return jsonify({"error": "Password ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ"}), 400

    with _conn() as conn:
        existing = conn.execute("SELECT 1 FROM vault_auth WHERE owner_id = ?", (owner_id,)).fetchone()
        if existing:
            return jsonify({"error": "Vault មានរួចហើយសម្រាប់ឧបករណ៍នេះ — សូមប្រើ /unlock ជំនួសវិញ"}), 409
        conn.execute(
            "INSERT INTO vault_auth (owner_id, password_hash, created_at) VALUES (?, ?, ?)",
            (owner_id, hash_password(password), _now_iso()),
        )

    token = issue_unlock_token(owner_id, _token_secret(), UNLOCK_TOKEN_TTL, int(time.time()))
    resp = jsonify({"status": "created", "unlock_token": token, "expires_in": UNLOCK_TOKEN_TTL})
    resp.set_cookie(OWNER_COOKIE, owner_id, max_age=OWNER_COOKIE_MAX_AGE, httponly=True, samesite="Lax")
    return resp


@vault_bp.route("/unlock", methods=["POST"])
def unlock():
    owner_id = request.cookies.get(OWNER_COOKIE)
    data = request.get_json(silent=True) or {}
    password = str(data.get("password", ""))

    if not owner_id:
        return jsonify({"error": "រកមិនឃើញ Vault សម្រាប់ឧបករណ៍នេះទេ"}), 404

    if _too_many_recent_attempts(owner_id):
        return jsonify({"error": "ព្យាយាមច្រើនដងពេក — សូមរង់ចាំបន្តិច ហើយសាកម្តងទៀត"}), 429

    with _conn() as conn:
        row = conn.execute("SELECT password_hash FROM vault_auth WHERE owner_id = ?", (owner_id,)).fetchone()

    _record_attempt(owner_id)

    if not row or not verify_password(password, row["password_hash"]):
        return jsonify({"error": "Password មិនត្រឹមត្រូវ"}), 401

    token = issue_unlock_token(owner_id, _token_secret(), UNLOCK_TOKEN_TTL, int(time.time()))
    return jsonify({"status": "unlocked", "unlock_token": token, "expires_in": UNLOCK_TOKEN_TTL})


# ------------------------------------------------------------------------------
# Face enrollment / verification (second factor — see module docstring caveat)
# ------------------------------------------------------------------------------

@vault_bp.route("/face/enroll", methods=["POST"])
def face_enroll():
    owner_id = _require_unlock()
    if not owner_id:
        return _unlock_required_response()

    data = request.get_json(silent=True) or {}
    descriptor = data.get("descriptor")
    if not isinstance(descriptor, list) or len(descriptor) != 128:
        return jsonify({"error": "Face descriptor មិនត្រឹមត្រូវ (ត្រូវការ 128 dimensions)"}), 400

    with _conn() as conn:
        conn.execute(
            "UPDATE vault_auth SET face_descriptor = ? WHERE owner_id = ?",
            (serialize_descriptor(descriptor), owner_id),
        )
    return jsonify({"status": "enrolled"})


@vault_bp.route("/face/verify", methods=["POST"])
def face_verify():
    """Alternative unlock path: verify by face instead of typing the password."""
    owner_id = request.cookies.get(OWNER_COOKIE)
    if not owner_id:
        return jsonify({"error": "រកមិនឃើញ Vault សម្រាប់ឧបករណ៍នេះទេ"}), 404

    if _too_many_recent_attempts(owner_id):
        return jsonify({"error": "ព្យាយាមច្រើនដងពេក — សូមរង់ចាំបន្តិច"}), 429

    data = request.get_json(silent=True) or {}
    descriptor = data.get("descriptor")
    if not isinstance(descriptor, list) or len(descriptor) != 128:
        return jsonify({"error": "Face descriptor មិនត្រឹមត្រូវ"}), 400

    with _conn() as conn:
        row = conn.execute("SELECT face_descriptor FROM vault_auth WHERE owner_id = ?", (owner_id,)).fetchone()

    _record_attempt(owner_id)

    if not row or not row["face_descriptor"] or not face_matches(row["face_descriptor"], descriptor):
        return jsonify({"error": "មិនអាចផ្ទៀងផ្ទាត់មុខបានទេ"}), 401

    token = issue_unlock_token(owner_id, _token_secret(), UNLOCK_TOKEN_TTL, int(time.time()))
    return jsonify({"status": "unlocked", "unlock_token": token, "expires_in": UNLOCK_TOKEN_TTL})


# ------------------------------------------------------------------------------
# Files: upload / list / download / delete  (all require an unlock token)
# ------------------------------------------------------------------------------

@vault_bp.route("/files", methods=["POST"])
def upload_file():
    owner_id = _require_unlock()
    if not owner_id:
        return _unlock_required_response()

    category = request.form.get("category", "")
    if category not in ALLOWED_CATEGORIES:
        return jsonify({"error": f"category ត្រូវជាមួយក្នុងចំណោម: {', '.join(sorted(ALLOWED_CATEGORIES))}"}), 400

    if "file" not in request.files:
        return jsonify({"error": "គ្មានឯកសារត្រូវបាន upload"}), 400

    uploaded = request.files["file"]
    raw = uploaded.read()
    if not raw:
        return jsonify({"error": "ឯកសារទទេ"}), 400
    if len(raw) > MAX_UPLOAD_BYTES:
        return jsonify({"error": f"ឯកសារធំពេក (អតិបរមា {MAX_UPLOAD_BYTES // (1024*1024)}MB)"}), 400

    stored_name = f"{owner_id}_{int(time.time()*1000)}_{new_owner_id()[:8]}.enc"
    stored_path = os.path.join(VAULT_FILES_DIR, stored_name)

    encrypted = encrypt_bytes(raw)
    with open(stored_path, "wb") as f:
        f.write(encrypted)

    mime_type = uploaded.mimetype or mimetypes.guess_type(uploaded.filename or "")[0] or "application/octet-stream"

    with _conn() as conn:
        cur = conn.execute(
            """INSERT INTO vault_files
               (owner_id, category, original_name, stored_name, mime_type, size_bytes, uploaded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (owner_id, category, uploaded.filename or "unnamed", stored_name, mime_type, len(raw), _now_iso()),
        )
        file_id = cur.lastrowid

    return jsonify({
        "status": "uploaded",
        "file": {
            "id": file_id, "category": category, "name": uploaded.filename,
            "size_bytes": len(raw), "mime_type": mime_type, "uploaded_at": _now_iso(),
        },
    })


@vault_bp.route("/files", methods=["GET"])
def list_files():
    owner_id = _require_unlock()
    if not owner_id:
        return _unlock_required_response()

    category = request.args.get("category")
    with _conn() as conn:
        if category:
            rows = conn.execute(
                """SELECT id, category, original_name, mime_type, size_bytes, uploaded_at
                   FROM vault_files WHERE owner_id = ? AND category = ? ORDER BY id DESC""",
                (owner_id, category),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT id, category, original_name, mime_type, size_bytes, uploaded_at
                   FROM vault_files WHERE owner_id = ? ORDER BY id DESC""",
                (owner_id,),
            ).fetchall()
    return jsonify({"files": [dict(r) for r in rows]})


@vault_bp.route("/files/<int:file_id>/download", methods=["GET"])
def download_file(file_id: int):
    owner_id = _require_unlock()
    if not owner_id:
        return _unlock_required_response()

    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM vault_files WHERE id = ? AND owner_id = ?",
            (file_id, owner_id),
        ).fetchone()
    if not row:
        return jsonify({"error": "រកមិនឃើញឯកសារ"}), 404

    stored_path = os.path.join(VAULT_FILES_DIR, row["stored_name"])
    if not os.path.exists(stored_path):
        return jsonify({"error": "ឯកសារបាត់ពី storage"}), 410

    with open(stored_path, "rb") as f:
        encrypted = f.read()

    try:
        plain = decrypt_bytes(encrypted)
    except ValueError as e:
        logger.error("Vault decrypt failed for file_id=%s: %s", file_id, e)
        return jsonify({"error": str(e)}), 500

    return send_file(
        io.BytesIO(plain),
        mimetype=row["mime_type"] or "application/octet-stream",
        as_attachment=True,
        download_name=row["original_name"],
    )


@vault_bp.route("/files/<int:file_id>", methods=["DELETE"])
def delete_file(file_id: int):
    owner_id = _require_unlock()
    if not owner_id:
        return _unlock_required_response()

    with _conn() as conn:
        row = conn.execute(
            "SELECT stored_name FROM vault_files WHERE id = ? AND owner_id = ?",
            (file_id, owner_id),
        ).fetchone()
        if not row:
            return jsonify({"error": "រកមិនឃើញឯកសារ"}), 404
        conn.execute("DELETE FROM vault_files WHERE id = ? AND owner_id = ?", (file_id, owner_id))

    stored_path = os.path.join(VAULT_FILES_DIR, row["stored_name"])
    try:
        if os.path.exists(stored_path):
            os.remove(stored_path)
    except OSError as e:
        logger.warning("Could not remove vault file blob %s: %s", stored_path, e)

    return jsonify({"status": "deleted", "id": file_id})


# ------------------------------------------------------------------------------
# Google account linking (real OAuth 2.0 — requires real credentials in .env)
# ------------------------------------------------------------------------------

@vault_bp.route("/google/login", methods=["GET"])
def google_login():
    owner_id = _require_unlock()
    if not owner_id:
        return _unlock_required_response()
    if not (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI):
        return jsonify({"error": "Google OAuth មិនទាន់ configure នៅក្នុង .env (GOOGLE_CLIENT_ID / SECRET / REDIRECT_URI)"}), 501

    oauth = OAuth2Session(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
                           redirect_uri=GOOGLE_REDIRECT_URI, scope="openid email profile")
    uri, state = oauth.create_authorization_url(GOOGLE_AUTH_ENDPOINT, access_type="offline", prompt="consent")
    resp = redirect(uri)
    # state ties the callback back to this owner + prevents CSRF
    resp.set_cookie("vault_oauth_state", f"{state}:{owner_id}", max_age=600, httponly=True, samesite="Lax")
    return resp


@vault_bp.route("/google/callback", methods=["GET"])
def google_callback():
    saved = request.cookies.get("vault_oauth_state", "")
    if ":" not in saved:
        return jsonify({"error": "Session ខុសឆ្គង — សូមព្យាយាមភ្ជាប់ម្តងទៀត"}), 400
    expected_state, owner_id = saved.split(":", 1)

    if request.args.get("state") != expected_state:
        return jsonify({"error": "OAuth state មិនត្រូវគ្នា (អាចជា CSRF)"}), 400

    oauth = OAuth2Session(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, redirect_uri=GOOGLE_REDIRECT_URI)
    token = oauth.fetch_token(GOOGLE_TOKEN_ENDPOINT, authorization_response=request.url)
    userinfo = oauth.get(GOOGLE_USERINFO_ENDPOINT).json()

    email = userinfo.get("email")
    sub = userinfo.get("sub")
    if not email or not userinfo.get("email_verified"):
        return jsonify({"error": "Google មិនបានផ្តល់អ៊ីមែលដែលបានផ្ទៀងផ្ទាត់"}), 400

    with _conn() as conn:
        conn.execute(
            "UPDATE vault_auth SET google_email = ?, google_sub = ? WHERE owner_id = ?",
            (email, sub, owner_id),
        )

    # Redirect back to the dashboard; front-end vault.js checks /status to refresh the UI.
    return redirect("/?vault_google_linked=1")


@vault_bp.route("/google/unlink", methods=["POST"])
def google_unlink():
    owner_id = _require_unlock()
    if not owner_id:
        return _unlock_required_response()
    with _conn() as conn:
        conn.execute("UPDATE vault_auth SET google_email = NULL, google_sub = NULL WHERE owner_id = ?", (owner_id,))
    return jsonify({"status": "unlinked"})


"""
.env.example additions
-----------------------
VAULT_MASTER_KEY=          # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
VAULT_TOKEN_SECRET=        # any long random string, e.g. python -c "import secrets;print(secrets.token_hex(32))"
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-domain.com/api/vault/google/callback
"""

