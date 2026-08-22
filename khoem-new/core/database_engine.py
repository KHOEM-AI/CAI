#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
core/database_engine.py — ការគ្រប់គ្រង SQLite database
KHOEM_AI 3.0

Features:
  - WAL mode  (concurrent reads + writes)
  - row_factory = sqlite3.Row  (ត្រឡប់ dict-like rows គ្រប់ query)
  - Context-manager helper  (_db)
  - Conversations  (save / get / delete / clear)
  - Saved Places   (save / get / get_all / delete / clear)
  - Video History  (save / get / get_all / delete / clear / mark_favorite)
  - User / Session  (save / get / delete)
  - Usage Stats    (increment / get / reset)
"""

import os
import sqlite3
import threading
import datetime
import logging
from contextlib import contextmanager
from typing import Optional

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR   = os.path.join(BASE_DIR, "database")
DB_PATH  = os.path.join(DB_DIR, "khoem_ai.db")

# schema.sql អាចនៅ root project (~/khoem-new/schema.sql) ឬក្នុង database/ —
# ត្រូវសាកមើលទាំងពីរកន្លែង ព្រោះ layout ពិតប្រាកដរបស់ project ដាក់វានៅ root
_SCHEMA_CANDIDATES = [
    os.path.join(BASE_DIR, "schema.sql"),
    os.path.join(DB_DIR, "schema.sql"),
]

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logger = logging.getLogger("database_engine")

# ---------------------------------------------------------------------------
# Thread-local storage  (ផ្ដល់ connection ផ្ទាល់ខ្លួនសម្រាប់រៀងរាល់ thread)
# ---------------------------------------------------------------------------
_local = threading.local()


def _get_raw_connection() -> sqlite3.Connection:
    """ត្រឡប់ connection សម្រាប់ thread បច្ចុប្បន្ន (reuse if exists)."""
    if not getattr(_local, "conn", None):
        os.makedirs(DB_DIR, exist_ok=True)
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA synchronous=NORMAL")
        _local.conn = conn
        logger.debug("New DB connection created for thread %s", threading.current_thread().name)
    return _local.conn


@contextmanager
def _db():
    """
    Context manager — ប្រើជំនួស get_connection() ដើម្បីប្រើ with _db() as conn.
    Commit ស្វ័យប្រវត្តិបន្ទាប់ពី block, rollback ពេលមានកំហុស។
    """
    conn = _get_raw_connection()
    try:
        yield conn
        conn.commit()
    except sqlite3.Error as exc:
        conn.rollback()
        logger.error("DB error (rolled back): %s", exc)
        raise


def get_connection() -> sqlite3.Connection:
    """Public helper — ត្រឡប់ connection ថ្មី (backward-compatible)."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


# ---------------------------------------------------------------------------
# Initialization
# ---------------------------------------------------------------------------
def init_database() -> None:
    """
    បង្កើត tables ទាំងអស់តាម schema.sql (ស្វែងរកនៅ root project មុន បន្ទាប់មកក្នុង database/).
    បើរកមិនឃើញសោះ → បង្កើត tables built-in ដោយស្វ័យប្រវត្តិ.
    """
    os.makedirs(DB_DIR, exist_ok=True)

    schema_path = next((p for p in _SCHEMA_CANDIDATES if os.path.exists(p)), None)

    with _db() as conn:
        if schema_path:
            with open(schema_path, "r", encoding="utf-8") as f:
                conn.executescript(f.read())
            logger.info("Database initialized from %s", schema_path)
        else:
            _create_builtin_schema(conn)
            logger.info("Database initialized with built-in schema (no schema.sql found)")


def _create_builtin_schema(conn: sqlite3.Connection) -> None:
    """Built-in schema — ប្រើបើ schema.sql មិនទាន់មាន។"""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT    NOT NULL,
            role        TEXT    NOT NULL CHECK(role IN ('user','assistant','system')),
            content     TEXT    NOT NULL,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_conv_session ON conversations(session_id);

        CREATE TABLE IF NOT EXISTS saved_places (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT    NOT NULL,
            label       TEXT    NOT NULL,
            latitude    REAL    NOT NULL,
            longitude   REAL    NOT NULL,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
            UNIQUE(session_id, label)
        );
        CREATE INDEX IF NOT EXISTS idx_places_session ON saved_places(session_id);

        CREATE TABLE IF NOT EXISTS video_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT    NOT NULL,
            video_id    TEXT    NOT NULL UNIQUE,
            prompt      TEXT,
            video_url   TEXT,
            preview_url TEXT,
            duration    INTEGER,
            resolution  TEXT,
            style       TEXT,
            fps         INTEGER,
            quality     TEXT,
            is_favorite INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_video_session ON video_history(session_id);

        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT    NOT NULL UNIQUE,
            username    TEXT,
            email       TEXT,
            plan        TEXT    NOT NULL DEFAULT 'free',
            api_token   TEXT,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS usage_stats (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id             TEXT    NOT NULL UNIQUE,
            used_minutes        REAL    NOT NULL DEFAULT 0.0,
            daily_minutes       REAL    NOT NULL DEFAULT 0.0,
            monthly_minutes     REAL    NOT NULL DEFAULT 0.0,
            total_videos        INTEGER NOT NULL DEFAULT 0,
            last_reset_daily    TEXT,
            last_reset_monthly  TEXT,
            updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    """)


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------
def save_message(session_id: str, role: str, content: str) -> int:
    """រក្សាទុក message ថ្មី — ត្រឡប់ rowid ។"""
    with _db() as conn:
        cur = conn.execute(
            "INSERT INTO conversations (session_id, role, content, created_at) "
            "VALUES (?, ?, ?, ?)",
            (session_id, role, content, _now()),
        )
        return cur.lastrowid


def get_history(session_id: str, limit: int = 20) -> list[dict]:
    """ត្រឡប់ messages ចុងក្រោយ limit ជួរ (ជៀសរៀងតាម id ascending)."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT role, content, created_at FROM conversations "
            "WHERE session_id = ? ORDER BY id DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
    return list(reversed([dict(r) for r in rows]))


def delete_message(session_id: str, message_id: int) -> bool:
    """លុប message ជាក់លាក់មួយ — ត្រឡប់ True បើបានលុប។"""
    with _db() as conn:
        cur = conn.execute(
            "DELETE FROM conversations WHERE id = ? AND session_id = ?",
            (message_id, session_id),
        )
    return cur.rowcount > 0


def clear_history(session_id: str) -> int:
    """លុប conversations ទាំងអស់ក្នុង session — ត្រឡប់ចំនួនជួរដែលបានលុប។"""
    with _db() as conn:
        cur = conn.execute(
            "DELETE FROM conversations WHERE session_id = ?",
            (session_id,),
        )
    return cur.rowcount


def count_messages(session_id: str) -> int:
    """ត្រឡប់ចំនួន messages ក្នុង session។"""
    with _db() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM conversations WHERE session_id = ?",
            (session_id,),
        ).fetchone()
    return row["cnt"] if row else 0


# ---------------------------------------------------------------------------
# Saved Places
# ---------------------------------------------------------------------------
def save_place(session_id: str, label: str, lat: float, lng: float) -> None:
    """
    INSERT OR REPLACE ទីតាំង — បើ label ដូចគ្នា → update latitude/longitude.
    """
    with _db() as conn:
        conn.execute(
            "INSERT INTO saved_places (session_id, label, latitude, longitude, created_at) "
            "VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(session_id, label) DO UPDATE SET "
            "latitude=excluded.latitude, longitude=excluded.longitude, "
            "created_at=excluded.created_at",
            (session_id, label, lat, lng, _now()),
        )


def get_place(session_id: str, label: str) -> Optional[dict]:
    """ត្រឡប់ {'lat': ..., 'lng': ...} ឬ None បើគ្មាន។"""
    with _db() as conn:
        row = conn.execute(
            "SELECT latitude AS lat, longitude AS lng FROM saved_places "
            "WHERE session_id = ? AND label = ?",
            (session_id, label),
        ).fetchone()
    return dict(row) if row else None


def get_all_places(session_id: str) -> list[dict]:
    """ត្រឡប់ list នៃ {'label', 'lat', 'lng'} ក្នុង session។"""
    with _db() as conn:
        rows = conn.execute(
            "SELECT label, latitude AS lat, longitude AS lng "
            "FROM saved_places WHERE session_id = ? ORDER BY created_at DESC",
            (session_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_place(session_id: str, label: str) -> bool:
    """លុបទីតាំងតាម label — ត្រឡប់ True បើបានលុប។"""
    with _db() as conn:
        cur = conn.execute(
            "DELETE FROM saved_places WHERE session_id = ? AND label = ?",
            (session_id, label),
        )
    return cur.rowcount > 0


def clear_places(session_id: str) -> int:
    """លុបទីតាំងទាំងអស់ក្នុង session — ត្រឡប់ចំនួនជួរ។"""
    with _db() as conn:
        cur = conn.execute(
            "DELETE FROM saved_places WHERE session_id = ?",
            (session_id,),
        )
    return cur.rowcount


# ---------------------------------------------------------------------------
# Video History
# ---------------------------------------------------------------------------
def save_video(session_id: str, video: dict) -> None:
    """
    រក្សាទុក video record ថ្មី (INSERT — ឬ update ទាំងអស់បើ video_id ដូចគ្នា)។
    video dict ត្រូវការ: video_id, video_url
    ស្រេចចិត្ត: prompt, preview_url, duration, resolution,
                style, fps, quality
    ចំណាំ: is_favorite មិនត្រូវបានប៉ះពាល់ដោយការហៅម្តងទៀតទេ (ប្រើ mark_favorite() ដើម្បីប្តូរ)។
    """
    with _db() as conn:
        conn.execute(
            "INSERT INTO video_history "
            "(session_id, video_id, prompt, video_url, preview_url, "
            " duration, resolution, style, fps, quality, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(video_id) DO UPDATE SET "
            "prompt=excluded.prompt, "
            "video_url=excluded.video_url, "
            "preview_url=excluded.preview_url, "
            "duration=excluded.duration, "
            "resolution=excluded.resolution, "
            "style=excluded.style, "
            "fps=excluded.fps, "
            "quality=excluded.quality",
            (
                session_id,
                video.get("video_id") or video.get("id"),
                video.get("prompt"),
                video.get("video_url"),
                video.get("preview_url"),
                video.get("duration"),
                video.get("resolution"),
                video.get("style"),
                video.get("fps"),
                video.get("quality"),
                _now(),
            ),
        )


def get_video(session_id: str, video_id: str) -> Optional[dict]:
    """ត្រឡប់ video dict ឬ None។"""
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM video_history WHERE session_id = ? AND video_id = ?",
            (session_id, video_id),
        ).fetchone()
    return dict(row) if row else None


def get_all_videos(
    session_id: str,
    limit: int = 50,
    offset: int = 0,
    favorites_only: bool = False,
    search: str = "",
) -> list[dict]:
    """
    ត្រឡប់ video history ដោយ filter។
    - favorites_only: True → តែ is_favorite=1
    - search: ស្វែងរក prompt (LIKE)
    """
    conditions = ["session_id = ?"]
    params: list = [session_id]

    if favorites_only:
        conditions.append("is_favorite = 1")
    if search:
        conditions.append("prompt LIKE ?")
        params.append(f"%{search}%")

    where = " AND ".join(conditions)
    params += [limit, offset]

    with _db() as conn:
        rows = conn.execute(
            f"SELECT * FROM video_history WHERE {where} "
            f"ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params,
        ).fetchall()
    return [dict(r) for r in rows]


def delete_video(session_id: str, video_id: str) -> bool:
    """លុប video record — ត្រឡប់ True បើបានលុប។"""
    with _db() as conn:
        cur = conn.execute(
            "DELETE FROM video_history WHERE session_id = ? AND video_id = ?",
            (session_id, video_id),
        )
    return cur.rowcount > 0


def clear_video_history(session_id: str) -> int:
    """លុប video history ទាំងអស់ — ត្រឡប់ចំនួនជួរ។"""
    with _db() as conn:
        cur = conn.execute(
            "DELETE FROM video_history WHERE session_id = ?",
            (session_id,),
        )
    return cur.rowcount


def mark_favorite(session_id: str, video_id: str, is_favorite: bool = True) -> bool:
    """ដាក់/ដក ចំណូលចិត្ត — ត្រឡប់ True បើបាន update។"""
    with _db() as conn:
        cur = conn.execute(
            "UPDATE video_history SET is_favorite = ? "
            "WHERE session_id = ? AND video_id = ?",
            (1 if is_favorite else 0, session_id, video_id),
        )
    return cur.rowcount > 0


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
def save_user(user: dict) -> None:
    """
    INSERT OR UPDATE user record។
    user dict ត្រូវការ: user_id
    ស្រេចចិត្ត: username, email, plan, api_token
    """
    with _db() as conn:
        conn.execute(
            "INSERT INTO users (user_id, username, email, plan, api_token, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET "
            "username=excluded.username, email=excluded.email, "
            "plan=excluded.plan, api_token=excluded.api_token, "
            "updated_at=excluded.updated_at",
            (
                user["user_id"],
                user.get("username"),
                user.get("email"),
                user.get("plan", "free"),
                user.get("api_token"),
                _now(),
                _now(),
            ),
        )


def get_user(user_id: str) -> Optional[dict]:
    """ត្រឡប់ user dict ឬ None។"""
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE user_id = ?",
            (user_id,),
        ).fetchone()
    return dict(row) if row else None


def delete_user(user_id: str) -> bool:
    """លុប user record — ត្រឡប់ True បើបានលុប។"""
    with _db() as conn:
        cur = conn.execute(
            "DELETE FROM users WHERE user_id = ?",
            (user_id,),
        )
    return cur.rowcount > 0


# ---------------------------------------------------------------------------
# Usage Stats
# ---------------------------------------------------------------------------
def get_usage(user_id: str) -> dict:
    """ត្រឡប់ usage stats dict (បង្កើត record ថ្មីបើគ្មាន)."""
    with _db() as conn:
        row = conn.execute(
            "SELECT * FROM usage_stats WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        if not row:
            conn.execute(
                "INSERT OR IGNORE INTO usage_stats (user_id, updated_at) VALUES (?, ?)",
                (user_id, _now()),
            )
            row = conn.execute(
                "SELECT * FROM usage_stats WHERE user_id = ?",
                (user_id,),
            ).fetchone()
    return dict(row) if row else {}


def increment_usage(user_id: str, minutes: float) -> None:
    """
    បន្ថែម minutes ទៅ used_minutes, daily_minutes, monthly_minutes,
    និង total_videos + 1 ។
    """
    with _db() as conn:
        conn.execute(
            "INSERT INTO usage_stats "
            "(user_id, used_minutes, daily_minutes, monthly_minutes, total_videos, updated_at) "
            "VALUES (?, ?, ?, ?, 1, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET "
            "used_minutes    = used_minutes    + excluded.used_minutes, "
            "daily_minutes   = daily_minutes   + excluded.daily_minutes, "
            "monthly_minutes = monthly_minutes + excluded.monthly_minutes, "
            "total_videos    = total_videos    + 1, "
            "updated_at      = excluded.updated_at",
            (user_id, minutes, minutes, minutes, _now()),
        )


def reset_daily_usage(user_id: str) -> None:
    """Reset daily_minutes → 0 និង last_reset_daily = now."""
    with _db() as conn:
        conn.execute(
            "UPDATE usage_stats SET daily_minutes = 0, last_reset_daily = ?, updated_at = ? "
            "WHERE user_id = ?",
            (_now(), _now(), user_id),
        )


def reset_monthly_usage(user_id: str) -> None:
    """Reset monthly_minutes → 0 និង last_reset_monthly = now."""
    with _db() as conn:
        conn.execute(
            "UPDATE usage_stats SET monthly_minutes = 0, last_reset_monthly = ?, updated_at = ? "
            "WHERE user_id = ?",
            (_now(), _now(), user_id),
        )


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------
def _now() -> str:
    """ត្រឡប់ timestamp ស្តង់ដារ ISO 8601 (UTC, timezone-aware — មិនប្រើ utcnow() ដែល deprecated)."""
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


# ---------------------------------------------------------------------------
# Quick self-test  (python core/database_engine.py)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)
    print("Initializing database...")
    init_database()

    SID = "test_session_001"
    UID = "user_001"

    # Conversations
    save_message(SID, "user", "សួស្ដី KHOEM_AI!")
    save_message(SID, "assistant", "សួស្ដី! តើខ្ញុំជួយអ្វីបាន?")
    history = get_history(SID, limit=10)
    print(f"History ({len(history)} msgs):", history)

    # Places
    save_place(SID, "ផ្ទះ", 11.5564, 104.9282)
    save_place(SID, "ការិយាល័យ", 11.5449, 104.8922)
    print("Places:", get_all_places(SID))

    # Video
    save_video(SID, {
        "video_id": "vid_001",
        "prompt": "ទឹកជ្រោះនៅព្រះរាជាណាចក្រ",
        "video_url": "https://example.com/vid_001.mp4",
        "preview_url": "https://example.com/vid_001_thumb.jpg",
        "duration": 10,
        "resolution": "720p",
        "style": "cinematic",
        "fps": 24,
        "quality": "standard",
    })
    mark_favorite(SID, "vid_001", True)
    print("Videos:", get_all_videos(SID))

    # Users
    save_user({"user_id": UID, "username": "ប្អូន", "email": "boon@example.com", "plan": "free"})
    print("User:", get_user(UID))

    # Usage
    increment_usage(UID, 2.5)
    increment_usage(UID, 1.0)
    print("Usage:", get_usage(UID))
    reset_daily_usage(UID)
    print("After daily reset:", get_usage(UID))

    print("\nAll tests passed ✓")
