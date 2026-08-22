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
