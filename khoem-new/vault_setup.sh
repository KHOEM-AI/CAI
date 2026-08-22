#!/data/data/com.termux/files/usr/bin/bash
# vault_setup.sh — run this from your project root (same folder as app.py)
# Usage:  bash vault_setup.sh
set -e

echo "==> Creating folders..."
mkdir -p core routes static/css static/js database storage/vault

echo "==> Writing core/vault_security.py"
cat > core/vault_security.py << 'PYSEC'
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ==============================================================================
# core/vault_security.py — Security primitives for the Secure Vault module
#
# Design notes (read before changing anything):
#   - Passwords are hashed with PBKDF2-SHA256 (werkzeug). Plaintext passwords
#     are never stored or logged.
#   - Files are encrypted at rest with Fernet (AES-128-CBC + HMAC) using a
#     server-held key (VAULT_MASTER_KEY). This protects against someone
#     stealing the disk/backups, but the server itself CAN decrypt files —
#     this is not "zero-knowledge". If you need zero-knowledge (server can
#     never read files), derive the Fernet key from the user's password with
#     PBKDF2 instead of a server key — trade-off: if the user forgets their
#     password, their files are unrecoverable by anyone, including you.
#   - Face verification compares a 128-d descriptor (produced client-side by
#     face-api.js) against an enrolled descriptor using Euclidean distance.
#     This is a convenience second factor, not a forensic-grade biometric
#     system — treat it as "raises the bar", not "unbreakable".
# ==============================================================================

import os
import base64
import hashlib
import hmac
import json
import math
import secrets

from werkzeug.security import generate_password_hash, check_password_hash
from cryptography.fernet import Fernet, InvalidToken

# ------------------------------------------------------------------------------
# Password hashing
# ------------------------------------------------------------------------------

def hash_password(plain_password: str) -> str:
    """PBKDF2-SHA256 hash with per-call random salt (handled internally)."""
    return generate_password_hash(plain_password, method="pbkdf2:sha256", salt_length=16)


def verify_password(plain_password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    return check_password_hash(password_hash, plain_password)


# ------------------------------------------------------------------------------
# File encryption at rest
# ------------------------------------------------------------------------------

def _load_master_key() -> bytes:
    """
    VAULT_MASTER_KEY must be a urlsafe-base64 32-byte Fernet key.
    Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    and put it in .env — never commit it to git, never hard-code it.
    """
    key = os.getenv("VAULT_MASTER_KEY", "")
    if not key:
        raise RuntimeError(
            "VAULT_MASTER_KEY មិនទាន់បានកំណត់ក្នុង .env — Vault មិនអាចដំណើរការដោយគ្មានវាបានទេ។"
        )
    return key.encode()


def get_fernet() -> Fernet:
    return Fernet(_load_master_key())


def encrypt_bytes(data: bytes) -> bytes:
    return get_fernet().encrypt(data)


def decrypt_bytes(token: bytes) -> bytes:
    try:
        return get_fernet().decrypt(token)
    except InvalidToken:
        raise ValueError("ឯកសារខូច ឬកូនសោមិនត្រឹមត្រូវ — មិនអាចឌិគ្រីបបានទេ")


# ------------------------------------------------------------------------------
# Device / vault-owner identity (long-lived, not the ephemeral chat session_id)
# ------------------------------------------------------------------------------

def new_owner_id() -> str:
    return secrets.token_hex(16)


# ------------------------------------------------------------------------------
# Signed short-lived "unlock token" — proves the caller passed
# password/face verification recently, without re-checking every request.
# ------------------------------------------------------------------------------

def _sign(payload: str, secret: str) -> str:
    mac = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{mac}"


def issue_unlock_token(owner_id: str, secret: str, ttl_seconds: int, now_ts: int) -> str:
    expires_at = now_ts + ttl_seconds
    payload = f"{owner_id}:{expires_at}"
    signed = _sign(payload, secret)
    return base64.urlsafe_b64encode(signed.encode()).decode()


def verify_unlock_token(token: str, owner_id: str, secret: str, now_ts: int) -> bool:
    try:
        signed = base64.urlsafe_b64decode(token.encode()).decode()
        payload, mac = signed.rsplit(".", 1)
        expected_mac = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(mac, expected_mac):
            return False
        token_owner, expires_at = payload.split(":")
        if token_owner != owner_id:
            return False
        return now_ts <= int(expires_at)
    except Exception:
        return False


# ------------------------------------------------------------------------------
# Face descriptor matching (128-d vectors from face-api.js)
# ------------------------------------------------------------------------------

FACE_MATCH_THRESHOLD = 0.5  # lower = stricter. face-api.js convention: <0.5 is usually the same face.


def euclidean_distance(vec_a: list, vec_b: list) -> float:
    if len(vec_a) != len(vec_b):
        raise ValueError("Face descriptor length mismatch")
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(vec_a, vec_b)))


def face_matches(enrolled_json: str, candidate_descriptor: list) -> bool:
    if not enrolled_json:
        return False
    enrolled = json.loads(enrolled_json)
    distance = euclidean_distance(enrolled, candidate_descriptor)
    return distance <= FACE_MATCH_THRESHOLD


def serialize_descriptor(descriptor: list) -> str:
    return json.dumps([float(x) for x in descriptor])
PYSEC

echo "==> Writing routes/vault_routes.py"
cat > routes/vault_routes.py << 'PYROUTES'
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Flask blueprint for the KHOEM_AI encrypted personal vault."""

from __future__ import annotations

import io
import datetime
import os
import sqlite3
import time
import uuid
from pathlib import Path

from flask import (
    Blueprint,
    current_app,
    g,
    jsonify,
    request,
    send_file,
    session,
)
from werkzeug.utils import secure_filename

from core.vault_security import (
    decrypt_bytes,
    encrypt_bytes,
    face_matches,
    hash_password,
    issue_unlock_token,
    new_owner_id,
    serialize_descriptor,
    verify_password,
    verify_unlock_token,
)

vault_bp = Blueprint("vault", __name__, url_prefix="/api/vault")

ALLOWED_CATEGORIES = {"document", "image", "video", "code", "audio"}
MAX_FILE_BYTES = 25 * 1024 * 1024
UNLOCK_TTL_SECONDS = 15 * 60


def _db_path() -> Path:
    return Path(
        os.getenv(
            "VAULT_DB_PATH",
            os.path.join(current_app.root_path, "database", "khoem_ai.db"),
        )
    )


def _storage_path() -> Path:
    return Path(
        os.getenv(
            "VAULT_STORAGE_DIR",
            os.path.join(current_app.root_path, "storage", "vault"),
        )
    )


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(_db_path())
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def _init_db(app) -> None:
    db_path = Path(
        os.getenv(
            "VAULT_DB_PATH",
            os.path.join(app.root_path, "database", "khoem_ai.db"),
        )
    )
    storage_path = Path(
        os.getenv(
            "VAULT_STORAGE_DIR",
            os.path.join(app.root_path, "storage", "vault"),
        )
    )
    db_path.parent.mkdir(parents=True, exist_ok=True)
    storage_path.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS vault_owners (
                owner_id TEXT PRIMARY KEY,
                password_hash TEXT NOT NULL,
                face_descriptor TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS vault_files (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                original_name TEXT NOT NULL,
                stored_name TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                uploaded_at TEXT NOT NULL,
                FOREIGN KEY(owner_id) REFERENCES vault_owners(owner_id)
                    ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_vault_files_owner_category
                ON vault_files(owner_id, category, uploaded_at);
            """
        )


@vault_bp.record_once
def _register_vault(state) -> None:
    _init_db(state.app)


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def _owner_id():
    value = session.get("vault_owner_id")
    return str(value) if value else None


def _secret() -> str:
    secret = current_app.secret_key
    if isinstance(secret, bytes):
        return secret.decode("utf-8", errors="replace")
    return str(secret)


def _find_owner(owner_id):
    if not owner_id:
        return None
    with _connect() as connection:
        return connection.execute(
            "SELECT * FROM vault_owners WHERE owner_id = ?",
            (owner_id,),
        ).fetchone()


def _valid_unlock(owner_id) -> bool:
    token = request.headers.get("X-Vault-Token", "")
    return bool(
        owner_id
        and token
        and verify_unlock_token(token, owner_id, _secret(), int(time.time()))
    )


def _require_unlock():
    owner_id = _owner_id()
    if not _find_owner(owner_id):
        return None, (jsonify({"error": "Vault មិនទាន់បាន setup ទេ"}), 401)
    if not _valid_unlock(owner_id):
        return None, (jsonify({"error": "Vault ចាក់សោ — សូម unlock មុន"}), 401)
    return owner_id, None


def _token(owner_id: str) -> str:
    return issue_unlock_token(
        owner_id,
        _secret(),
        UNLOCK_TTL_SECONDS,
        int(time.time()),
    )


@vault_bp.get("/status")
def status():
    owner = _find_owner(_owner_id())
    unlocked = bool(owner and _valid_unlock(owner["owner_id"]))
    return jsonify(
        {
            "vault_exists": bool(owner),
            "unlocked": unlocked,
            "face_enrolled": bool(owner and owner["face_descriptor"]),
            "google_linked": False,
            "google_available": False,
        }
    )


@vault_bp.post("/setup")
def setup():
    payload = request.get_json(silent=True) or {}
    password = str(payload.get("password") or "")
    if len(password) < 8:
        return jsonify({"error": "Password ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ"}), 400

    current_owner = _find_owner(_owner_id())
    if current_owner:
        return jsonify({"error": "Vault មានរួចហើយ — សូម unlock"}), 409

    owner_id = new_owner_id()
    now = _now_iso()
    with _connect() as connection:
        connection.execute(
            """
            INSERT INTO vault_owners
                (owner_id, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (owner_id, hash_password(password), now, now),
        )
    session.permanent = True
    session["vault_owner_id"] = owner_id
    return jsonify({"unlock_token": _token(owner_id), "expires_in": UNLOCK_TTL_SECONDS})


@vault_bp.post("/unlock")
def unlock():
    owner = _find_owner(_owner_id())
    if not owner:
        return jsonify({"error": "Vault មិនទាន់បាន setup ទេ"}), 404

    payload = request.get_json(silent=True) or {}
    password = str(payload.get("password") or "")
    if not verify_password(password, owner["password_hash"]):
        return jsonify({"error": "Password មិនត្រឹមត្រូវ"}), 401
    session.permanent = True
    session["vault_owner_id"] = owner["owner_id"]
    return jsonify(
        {"unlock_token": _token(owner["owner_id"]), "expires_in": UNLOCK_TTL_SECONDS}
    )


@vault_bp.post("/face/enroll")
def enroll_face():
    owner_id, error = _require_unlock()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    try:
        descriptor = payload.get("descriptor")
        serialized = serialize_descriptor(descriptor)
    except (TypeError, ValueError):
        return jsonify({"error": "Face descriptor មិនត្រឹមត្រូវ"}), 400

    with _connect() as connection:
        connection.execute(
            """
            UPDATE vault_owners
            SET face_descriptor = ?, updated_at = ?
            WHERE owner_id = ?
            """,
            (serialized, _now_iso(), owner_id),
        )
    return jsonify({"status": "enrolled"})


@vault_bp.post("/face/verify")
def verify_face():
    owner = _find_owner(_owner_id())
    if not owner:
        return jsonify({"error": "Vault មិនទាន់បាន setup ទេ"}), 404
    if not owner["face_descriptor"]:
        return jsonify({"error": "មិនទាន់បានចុះឈ្មោះ Face"}), 400

    payload = request.get_json(silent=True) or {}
    try:
        matches = face_matches(
            owner["face_descriptor"],
            payload.get("descriptor"),
        )
    except ValueError:
        matches = False
    if not matches:
        return jsonify({"error": "Face verification មិនជោគជ័យ"}), 401
    session.permanent = True
    session["vault_owner_id"] = owner["owner_id"]
    return jsonify(
        {"unlock_token": _token(owner["owner_id"]), "expires_in": UNLOCK_TTL_SECONDS}
    )


@vault_bp.get("/files")
def list_files():
    owner_id, error = _require_unlock()
    if error:
        return error
    category = request.args.get("category", "document").strip().lower()
    if category not in ALLOWED_CATEGORIES:
        return jsonify({"error": "ប្រភេទឯកសារមិនត្រឹមត្រូវ"}), 400

    with _connect() as connection:
        files = connection.execute(
            """
            SELECT id, original_name, category, mime_type, size_bytes, uploaded_at
            FROM vault_files
            WHERE owner_id = ? AND category = ?
            ORDER BY uploaded_at DESC
            """,
            (owner_id, category),
        ).fetchall()
    return jsonify({"files": [dict(item) for item in files]})


@vault_bp.post("/files")
def upload_file():
    owner_id, error = _require_unlock()
    if error:
        return error

    uploaded = request.files.get("file")
    category = request.form.get("category", "document").strip().lower()
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "សូមជ្រើសរើសឯកសារ"}), 400
    if category not in ALLOWED_CATEGORIES:
        return jsonify({"error": "ប្រភេទឯកសារមិនត្រឹមត្រូវ"}), 400

    original_name = secure_filename(uploaded.filename)
    if not original_name:
        return jsonify({"error": "ឈ្មោះឯកសារមិនត្រឹមត្រូវ"}), 400
    content = uploaded.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        return jsonify({"error": "ឯកសារធំពេក (អតិបរមា ២៥ MB)"}), 413

    file_id = uuid.uuid4().hex
    stored_name = f"{file_id}.vault"
    stored_path = _storage_path() / stored_name
    stored_path.write_bytes(encrypt_bytes(content))

    try:
        with _connect() as connection:
            connection.execute(
                """
                INSERT INTO vault_files
                    (id, owner_id, original_name, stored_name, category,
                     mime_type, size_bytes, uploaded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    file_id,
                    owner_id,
                    original_name,
                    stored_name,
                    category,
                    uploaded.mimetype or "application/octet-stream",
                    len(content),
                    _now_iso(),
                ),
            )
    except Exception:
        stored_path.unlink(missing_ok=True)
        current_app.logger.exception("Vault file metadata insert failed")
        return jsonify({"error": "មិនអាចរក្សាទុក metadata ឯកសារ"}), 500

    return jsonify(
        {
            "status": "uploaded",
            "file": {
                "id": file_id,
                "original_name": original_name,
                "category": category,
                "size_bytes": len(content),
            },
        }
    ), 201


def _owned_file(file_id: str, owner_id: str):
    with _connect() as connection:
        return connection.execute(
            "SELECT * FROM vault_files WHERE id = ? AND owner_id = ?",
            (file_id, owner_id),
        ).fetchone()


@vault_bp.get("/files/<file_id>/download")
def download_file(file_id: str):
    owner_id, error = _require_unlock()
    if error:
        return error
    file_record = _owned_file(file_id, owner_id)
    if not file_record:
        return jsonify({"error": "រកមិនឃើញឯកសារ"}), 404

    path = _storage_path() / file_record["stored_name"]
    if not path.is_file():
        return jsonify({"error": "ឯកសារដើមបាត់ពី storage"}), 404
    try:
        plaintext = decrypt_bytes(path.read_bytes())
    except (RuntimeError, ValueError):
        current_app.logger.exception("Vault decrypt failed for %s", file_id)
        return jsonify({"error": "មិនអាចបើកឯកសារដែលបាន encrypt"}), 500
    return send_file(
        io.BytesIO(plaintext),
        mimetype=file_record["mime_type"],
        as_attachment=True,
        download_name=file_record["original_name"],
    )


@vault_bp.delete("/files/<file_id>")
def delete_file(file_id: str):
    owner_id, error = _require_unlock()
    if error:
        return error
    file_record = _owned_file(file_id, owner_id)
    if not file_record:
        return jsonify({"error": "រកមិនឃើញឯកសារ"}), 404

    (_storage_path() / file_record["stored_name"]).unlink(missing_ok=True)
    with _connect() as connection:
        connection.execute(
            "DELETE FROM vault_files WHERE id = ? AND owner_id = ?",
            (file_id, owner_id),
        )
    return jsonify({"status": "deleted", "id": file_id})
PYROUTES

echo "==> Writing static/css/vault.css"
cat > static/css/vault.css << 'CSSEOF'
/* ==============================================================================
   static/css/vault.css — Secure Vault Matrix
   Uses the same CSS custom properties already defined on :root in index.html
   (--bg, --panel, --line, --cyan, --muted, --radius, etc.)
   ============================================================================== */

.vault-card { padding: 20px; }

.vault-lock-icon { color: var(--cyan); }
.vault-lock-icon svg { width: 20px; height: 20px; }

.vault-state { margin-top: 4px; color: var(--muted); font-size: 12px; }
.vault-state.unlocked { color: var(--green); }

.vault-panel { margin-top: 16px; display: grid; gap: 14px; }
.vault-panel[hidden] { display: none; }

/* --- Auth gate (password / face) --- */
.vault-gate { display: grid; gap: 10px; }
.vault-gate input[type="password"] {
    width: 100%;
    height: 42px;
    padding: 0 13px;
    border: 1px solid var(--line);
    border-radius: 12px;
    color: var(--text);
    background: #102f3c;
}
.vault-gate-actions { display: flex; gap: 8px; }
.vault-btn {
    flex: 1;
    min-height: 40px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    color: #b9d2d6;
    background: rgba(18, 54, 68, .58);
    cursor: pointer;
    font-size: 12px;
    transition: all 180ms ease;
}
.vault-btn:hover { border-color: var(--line-strong); background: var(--panel-hover); }
.vault-btn.primary { color: var(--bg-deep); background: var(--cyan); border-color: var(--cyan); font-weight: 600; }
.vault-btn.danger { color: #ffd9dc; background: rgba(139, 45, 58, .55); }
.vault-btn:disabled { opacity: .5; cursor: not-allowed; }

.vault-error {
    padding: 9px 12px;
    border: 1px solid rgba(255, 122, 131, .35);
    border-radius: 11px;
    color: #ffb9bd;
    background: rgba(139, 45, 58, .25);
    font-size: 12px;
    display: none;
}
.vault-error.is-visible { display: block; }

/* --- Face capture --- */
.vault-face-box {
    position: relative;
    width: 100%;
    max-width: 220px;
    margin: 0 auto;
    border: 1px solid var(--line);
    border-radius: 16px;
    overflow: hidden;
    aspect-ratio: 1 / 1;
    background: #04131b;
}
.vault-face-box video, .vault-face-box canvas {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
}
.vault-face-hint { margin-top: 8px; text-align: center; color: var(--muted); font-size: 11px; }

/* --- Category tabs --- */
.vault-tabs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.vault-tab {
    padding: 8px 4px;
    border: 1px solid var(--line);
    border-radius: 10px;
    color: #a9cdd1;
    background: rgba(17, 52, 65, .6);
    cursor: pointer;
    font-size: 15px;
    text-align: center;
}
.vault-tab .vault-tab-label { display: block; margin-top: 3px; font-size: 8px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.vault-tab.is-active { border-color: var(--cyan); color: var(--cyan); background: rgba(97, 228, 239, .12); }

/* --- Dropzone --- */
.vault-dropzone {
    padding: 22px 12px;
    border: 1.5px dashed var(--line-strong);
    border-radius: 14px;
    text-align: center;
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
    transition: all 180ms ease;
}
.vault-dropzone:hover, .vault-dropzone.is-dragover { border-color: var(--cyan); color: var(--cyan); background: rgba(97, 228, 239, .06); }
.vault-dropzone input[type="file"] { display: none; }

.vault-upload-progress { height: 4px; margin-top: 8px; border-radius: 3px; background: rgba(151,221,231,.14); overflow: hidden; display: none; }
.vault-upload-progress.is-visible { display: block; }
.vault-upload-progress > span { display: block; height: 100%; width: 0%; background: var(--cyan); transition: width 120ms linear; }

/* --- File list --- */
.vault-file-list { display: grid; gap: 8px; max-height: 260px; overflow-y: auto; }
.vault-file-row {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 10px;
    border: 1px solid var(--line);
    border-radius: 11px;
    background: rgba(18, 54, 68, .45);
}
.vault-file-icon { flex: 0 0 auto; color: var(--cyan); font-size: 15px; }
.vault-file-meta { min-width: 0; flex: 1; }
.vault-file-name { overflow: hidden; color: #d4e7e9; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.vault-file-sub { margin-top: 2px; color: var(--muted); font-size: 10px; }
.vault-file-actions { display: flex; gap: 6px; flex: 0 0 auto; }
.vault-icon-btn {
    width: 30px; height: 30px;
    display: grid; place-items: center;
    border: 1px solid var(--line);
    border-radius: 9px;
    color: #a9cdd1;
    background: transparent;
    cursor: pointer;
}
.vault-icon-btn:hover { color: var(--cyan); border-color: var(--cyan); }
.vault-icon-btn.danger:hover { color: #ff7a83; border-color: #ff7a83; }
.vault-empty { padding: 18px 10px; text-align: center; color: var(--muted); font-size: 12px; }

/* --- Google link row --- */
.vault-google-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 12px; background: rgba(18, 54, 68, .45); }
.vault-google-row span { font-size: 12px; color: #c1d8db; }
.vault-google-row .linked { color: var(--green); }
CSSEOF

echo "==> Writing static/js/vault.js"
cat > static/js/vault.js << 'JSEOF'
// ==============================================================================
// static/js/vault.js — Secure Vault Matrix (frontend)
//
// Depends on:
//   - face-api.js (CDN, loaded in index.html) for browser-side face descriptors
//   - Model weights served from /static/models/ (download once, see comment below)
//
// The unlock token is kept ONLY in memory (a JS variable), never in
// localStorage — closing the tab forces a fresh unlock, which is the point.
// ==============================================================================

(function () {
    "use strict";

    const CATEGORY_ICONS = { document: "📄", image: "🖼️", video: "🎥", code: "💻", audio: "🎵" };
    const CATEGORY_LABELS = { document: "ឯកសារ", image: "រូបភាព", video: "វីដេអូ", code: "កូដ", audio: "សំឡេង" };

    let unlockToken = null;      // in-memory only
    let activeCategory = "document";
    let faceModelsLoaded = false;
    let faceStream = null;

    function $(id) { return document.getElementById(id); }

    function fmtSize(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    async function api(path, options) {
        options = options || {};
        options.headers = Object.assign({}, options.headers);
        if (unlockToken) options.headers["X-Vault-Token"] = unlockToken;
        options.credentials = "same-origin";
        const res = await fetch("/api/vault" + path, options);
        let body = null;
        try { body = await res.json(); } catch (e) { /* non-JSON (file download handled separately) */ }
        if (!res.ok) {
            const err = new Error((body && body.error) || ("HTTP " + res.status));
            err.status = res.status;
            err.body = body;
            throw err;
        }
        return body;
    }

    function showError(message) {
        const el = $("vault-error");
        el.textContent = message;
        el.classList.add("is-visible");
    }
    function clearError() { $("vault-error").classList.remove("is-visible"); }

    // -------------------------------------------------------------------
    // Status / gate rendering
    // -------------------------------------------------------------------

    async function refreshStatus() {
        const status = await api("/status");
        const stateEl = $("vault-state");

        if (!status.vault_exists) {
            stateEl.textContent = "មិនទាន់រៀបចំ — សូមកំណត់ Password";
            stateEl.className = "vault-state";
            renderSetupGate();
        } else if (!unlockToken) {
            stateEl.textContent = "🔒 បិទសោ";
            stateEl.className = "vault-state";
            renderUnlockGate(status);
        } else {
            stateEl.textContent = "🔓 បើកសោហើយ";
            stateEl.className = "vault-state unlocked";
            renderUnlocked(status);
        }
    }

    function renderSetupGate() {
        $("vault-gate").hidden = false;
        $("vault-unlocked").hidden = true;
        $("vault-gate-title").textContent = "កំណត់ Password សម្រាប់ Vault";
        $("vault-gate-password").value = "";
        $("vault-face-unlock-btn").hidden = true;
        $("vault-gate-submit").textContent = "បង្កើត Vault";
        $("vault-gate-submit").onclick = handleSetup;
    }

    function renderUnlockGate(status) {
        $("vault-gate").hidden = false;
        $("vault-unlocked").hidden = true;
        $("vault-gate-title").textContent = "បញ្ចូល Password ដើម្បីបើក Vault";
        $("vault-gate-password").value = "";
        $("vault-face-unlock-btn").hidden = !status.face_enrolled;
        $("vault-gate-submit").textContent = "បើកសោ";
        $("vault-gate-submit").onclick = handleUnlock;
    }

    function renderUnlocked(status) {
        $("vault-gate").hidden = true;
        $("vault-unlocked").hidden = false;
        renderGoogleRow(status);
        loadFiles();
    }

    function renderGoogleRow(status) {
        const row = $("vault-google-row");
        if (status.google_linked) {
            row.innerHTML = `<span class="linked">✅ ភ្ជាប់ជាមួយ ${status.google_email}</span>
                              <button class="vault-btn" id="vault-google-unlink">ផ្តាច់</button>`;
            $("vault-google-unlink").onclick = async () => {
                await api("/google/unlink", { method: "POST" });
                refreshStatus();
            };
        } else {
            row.innerHTML = `<span>មិនទាន់ភ្ជាប់ Google Email</span>
                              <button class="vault-btn primary" id="vault-google-link">ភ្ជាប់ Google</button>`;
            $("vault-google-link").onclick = () => { window.location.href = "/api/vault/google/login"; };
        }
    }

    // -------------------------------------------------------------------
    // Setup / password unlock
    // -------------------------------------------------------------------

    async function handleSetup() {
        clearError();
        const password = $("vault-gate-password").value;
        if (password.length < 8) { showError("Password ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ"); return; }
        try {
            const result = await api("/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            unlockToken = result.unlock_token;
            await refreshStatus();
        } catch (e) { showError(e.message); }
    }

    async function handleUnlock() {
        clearError();
        const password = $("vault-gate-password").value;
        if (!password) { showError("សូមបញ្ចូល Password"); return; }
        try {
            const result = await api("/unlock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            unlockToken = result.unlock_token;
            await refreshStatus();
        } catch (e) { showError(e.message); }
    }

    // -------------------------------------------------------------------
    // Face capture (enroll + verify) using face-api.js
    // Model weights: download once from
    // https://github.com/justadudewhohacks/face-api.js/tree/master/weights
    // and place tiny_face_detector + face_landmark_68 + face_recognition
    // model files under /static/models/
    // -------------------------------------------------------------------

    async function ensureFaceModels() {
        if (faceModelsLoaded) return true;
        if (typeof faceapi === "undefined") { showError("face-api.js មិនទាន់ load"); return false; }
        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri("/static/models");
            await faceapi.nets.faceLandmark68Net.loadFromUri("/static/models");
            await faceapi.nets.faceRecognitionNet.loadFromUri("/static/models");
            faceModelsLoaded = true;
            return true;
        } catch (e) {
            showError("មិនអាច load Face model បានទេ — ពិនិត្យ /static/models");
            return false;
        }
    }

    async function openFaceCapture(onDescriptor) {
        clearError();
        const box = $("vault-face-box");
        const video = $("vault-face-video");
        box.hidden = false;

        const ready = await ensureFaceModels();
        if (!ready) { box.hidden = true; return; }

        try {
            faceStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
            video.srcObject = faceStream;
            await video.play();
        } catch (e) {
            showError("មិនអាចបើកកាមេរ៉ាបានទេ — សូមអនុញ្ញាត camera permission");
            box.hidden = true;
            return;
        }

        $("vault-face-capture-btn").hidden = false;
        $("vault-face-capture-btn").onclick = async () => {
            const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();
            if (!detection) { showError("រកមិនឃើញមុខ — សូមសាកម្តងទៀត"); return; }
            closeFaceCapture();
            onDescriptor(Array.from(detection.descriptor));
        };
    }

    function closeFaceCapture() {
        $("vault-face-box").hidden = true;
        $("vault-face-capture-btn").hidden = true;
        if (faceStream) { faceStream.getTracks().forEach((t) => t.stop()); faceStream = null; }
    }

    $("vault-enroll-face-btn") && ($("vault-enroll-face-btn").onclick = () => {
        openFaceCapture(async (descriptor) => {
            try {
                await api("/face/enroll", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ descriptor }),
                });
                refreshStatus();
            } catch (e) { showError(e.message); }
        });
    });

    $("vault-face-unlock-btn") && ($("vault-face-unlock-btn").onclick = () => {
        openFaceCapture(async (descriptor) => {
            try {
                const result = await api("/face/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ descriptor }),
                });
                unlockToken = result.unlock_token;
                refreshStatus();
            } catch (e) { showError(e.message); }
        });
    });

    // -------------------------------------------------------------------
    // Category tabs
    // -------------------------------------------------------------------

    function initTabs() {
        document.querySelectorAll(".vault-tab").forEach((tab) => {
            tab.addEventListener("click", () => {
                document.querySelectorAll(".vault-tab").forEach((t) => t.classList.remove("is-active"));
                tab.classList.add("is-active");
                activeCategory = tab.dataset.category;
                loadFiles();
            });
        });
    }

    // -------------------------------------------------------------------
    // Upload (dropzone)
    // -------------------------------------------------------------------

    function initDropzone() {
        const zone = $("vault-dropzone");
        const input = $("vault-file-input");

        zone.addEventListener("click", () => input.click());
        input.addEventListener("change", () => { if (input.files[0]) uploadFile(input.files[0]); });

        ["dragenter", "dragover"].forEach((evt) =>
            zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add("is-dragover"); })
        );
        ["dragleave", "drop"].forEach((evt) =>
            zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove("is-dragover"); })
        );
        zone.addEventListener("drop", (e) => {
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) uploadFile(file);
        });
    }

    function uploadFile(file) {
        clearError();
        const form = new FormData();
        form.append("file", file);
        form.append("category", activeCategory);

        const bar = $("vault-upload-progress");
        const fill = bar.querySelector("span");
        bar.classList.add("is-visible");
        fill.style.width = "0%";

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/vault/files");
        if (unlockToken) xhr.setRequestHeader("X-Vault-Token", unlockToken);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) fill.style.width = Math.round((e.loaded / e.total) * 100) + "%";
        };
        xhr.onload = () => {
            bar.classList.remove("is-visible");
            if (xhr.status >= 200 && xhr.status < 300) {
                loadFiles();
            } else {
                try { showError(JSON.parse(xhr.responseText).error); }
                catch (e) { showError("Upload បរាជ័យ"); }
            }
        };
        xhr.onerror = () => { bar.classList.remove("is-visible"); showError("Upload បរាជ័យ — បញ្ហាបណ្តាញ"); };
        xhr.send(form);
    }

    // -------------------------------------------------------------------
    // File list
    // -------------------------------------------------------------------

    async function loadFiles() {
        const listEl = $("vault-file-list");
        try {
            const result = await api("/files?category=" + encodeURIComponent(activeCategory));
            renderFiles(result.files || []);
        } catch (e) {
            if (e.status === 401) { unlockToken = null; refreshStatus(); return; }
            listEl.innerHTML = `<div class="vault-empty">មិនអាចទាញយកបញ្ជីឯកសារបានទេ</div>`;
        }
    }

    function renderFiles(files) {
        const listEl = $("vault-file-list");
        if (!files.length) {
            listEl.innerHTML = `<div class="vault-empty">មិនទាន់មានឯកសារ ${CATEGORY_LABELS[activeCategory]} នៅឡើយទេ</div>`;
            return;
        }
        listEl.innerHTML = "";
        files.forEach((f) => {
            const row = document.createElement("div");
            row.className = "vault-file-row";
            row.innerHTML = `
                <span class="vault-file-icon">${CATEGORY_ICONS[f.category] || "📄"}</span>
                <div class="vault-file-meta">
                    <div class="vault-file-name">${escapeHtml(f.original_name)}</div>
                    <div class="vault-file-sub">${fmtSize(f.size_bytes)} · ${new Date(f.uploaded_at).toLocaleString()}</div>
                </div>
                <div class="vault-file-actions">
                    <button class="vault-icon-btn" title="Download" data-action="download" data-id="${f.id}">⭳</button>
                    <button class="vault-icon-btn danger" title="Delete" data-action="delete" data-id="${f.id}">✕</button>
                </div>`;
            listEl.appendChild(row);
        });

        listEl.querySelectorAll("[data-action='download']").forEach((btn) => {
            btn.addEventListener("click", () => downloadFile(btn.dataset.id));
        });
        listEl.querySelectorAll("[data-action='delete']").forEach((btn) => {
            btn.addEventListener("click", () => deleteFile(btn.dataset.id));
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    async function downloadFile(id) {
        try {
            const res = await fetch(`/api/vault/files/${id}/download`, {
                headers: unlockToken ? { "X-Vault-Token": unlockToken } : {},
                credentials: "same-origin",
            });
            if (!res.ok) { const body = await res.json(); showError(body.error || "Download បរាជ័យ"); return; }
            const blob = await res.blob();
            const disposition = res.headers.get("Content-Disposition") || "";
            const match = disposition.match(/filename="?([^"]+)"?/);
            const filename = match ? match[1] : "file";
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
        } catch (e) { showError("Download បរាជ័យ"); }
    }

    async function deleteFile(id) {
        if (!window.confirm("លុបឯកសារនេះ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។")) return;
        try {
            await api(`/files/${id}`, { method: "DELETE" });
            loadFiles();
        } catch (e) { showError(e.message); }
    }

    // -------------------------------------------------------------------
    // Boot
    // -------------------------------------------------------------------

    document.addEventListener("DOMContentLoaded", function () {
        if (!$("vault-card")) return; // section not present on this page
        initTabs();
        initDropzone();
        refreshStatus();

        // If we just came back from a Google OAuth redirect, drop the query param
        if (window.location.search.includes("vault_google_linked")) {
            window.history.replaceState({}, "", window.location.pathname);
        }
    });
})();
JSEOF

echo "==> Adding VAULT_MASTER_KEY to .env (if missing)"
touch .env
if ! grep -q "^VAULT_MASTER_KEY=" .env; then
  KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
  echo "VAULT_MASTER_KEY=$KEY" >> .env
  echo "    -> VAULT_MASTER_KEY added"
else
  echo "    -> VAULT_MASTER_KEY already exists, skipped"
fi

echo ""
echo "======================================================"
echo "DONE. Files created:"
echo "  core/vault_security.py"
echo "  routes/vault_routes.py"
echo "  static/css/vault.css"
echo "  static/js/vault.js"
echo "  .env  (VAULT_MASTER_KEY added if it was missing)"
echo ""
echo "STILL TO DO BY HAND in app.py (only 2 things):"
echo "  1) pip install cryptography"
echo "  2) Add near your other blueprint registrations:"
echo "       from routes.vault_routes import vault_bp"
echo "       app.register_blueprint(vault_bp)"
echo "     And near the top with your other imports:"
echo "       from datetime import timedelta"
echo "     Then after app.secret_key is set, add:"
echo "       app.permanent_session_lifetime = timedelta(days=365)"
echo "======================================================"

