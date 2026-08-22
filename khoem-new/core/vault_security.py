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
