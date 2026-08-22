# KHOEM_AI Database Documentation

> **Version:** 2.2  <!-- ស៊ីគ្នាជាមួយ roadmap.md/voice.md/security.md/navigator.md -->
> **Engine:** SQLite  
> **File:** `database/khoem_ai.db`  
> **Modules:** `core/database_engine.py` · `core/memory_engine.py`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Schema — `conversations`](#2-schema--conversations)
3. [Schema — `saved_places`](#3-schema--saved_places)
4. [Indexes](#4-indexes)
5. [database_engine.py](#5-database_enginepy)
6. [memory_engine.py](#6-memory_enginepy)
7. [Error Handling](#7-error-handling)
8. [Security Considerations](#8-security-considerations)
9. [Backup & Migration](#9-backup--migration)
10. [Future Tables](#10-future-tables)

---

## 1. Overview

KHOEM_AI ប្រើ **SQLite** ជា database ចម្បង ព្រោះស្រាល និងមិនត្រូវការ server ដាច់ដោយឡែក។ ឯកសារ database ស្ថិតនៅ `database/khoem_ai.db`។

> ⚠️ **កំណត់ចំណាំសំខាន់:** `.env` និង database file លេចឡើងក្នុង repo listing ថា commit ចូល git ("Create khoem_ai.db" 18 hours ago)។ ត្រូវប្រាកដថា `database/*.db` និង `.env` ស្ថិតក្នុង `.gitignore` — បើមិនដូច្នោះទេ ទិន្នន័យអ្នកប្រើ/session real នឹងលេចធ្លាយក្នុង git history។ សូមពិនិត្យ `.gitignore` ជាបន្ទាន់។

```
database/
└── khoem_ai.db     # SQLite file — should NOT be committed to git
```

---

## 2. Schema — `conversations`

**Purpose:** Stores every chat message (user + assistant turns).

```sql
CREATE TABLE IF NOT EXISTS conversations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT    NOT NULL,
    role        TEXT    NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content     TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

| Column       | Type    | Constraints                          | Notes                                    |
|--------------|---------|---------------------------------------|-------------------------------------------|
| `id`         | INTEGER | PRIMARY KEY AUTOINCREMENT             | —                                         |
| `session_id` | TEXT    | NOT NULL                              | ត្រូវ index (§4) — query ញឹកញាប់តាមវា    |
| `role`       | TEXT    | NOT NULL, CHECK (`user`/`assistant`/`system`) | ដើមឡើយគ្មាន constraint — បន្ថែមថ្មី |
| `content`    | TEXT    | NOT NULL                              | ⚠️ អាចមាន PII/sensitive text — see §8    |
| `created_at` | TEXT    | NOT NULL DEFAULT `datetime('now')`    | ISO 8601 string (SQLite មិនមាន native datetime) |

---

## 3. Schema — `saved_places`

**Purpose:** Stores favorite locations (used by `navigator.md` §9 Saved Places Integration).

```sql
CREATE TABLE IF NOT EXISTS saved_places (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT    NOT NULL,
    label       TEXT    NOT NULL,
    lat         REAL    NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng         REAL    NOT NULL CHECK (lng BETWEEN -180 AND 180),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

| Column       | Type    | Constraints                          | Notes                              |
|--------------|---------|----------------------------------------|-------------------------------------|
| `id`         | INTEGER | PRIMARY KEY AUTOINCREMENT             | —                                   |
| `session_id` | TEXT    | NOT NULL                              | ត្រូវ index (§4)                    |
| `label`      | TEXT    | NOT NULL                              | ត្រូវ index (§4) សម្រាប់ search    |
| `lat`        | REAL    | NOT NULL, CHECK range -90..90         | ដើមឡើយគ្មាន validation — បន្ថែមថ្មី |
| `lng`        | REAL    | NOT NULL, CHECK range -180..180       | ដើមឡើយគ្មាន validation — បន្ថែមថ្មី |
| `created_at` | TEXT    | NOT NULL DEFAULT `datetime('now')`    | —                                   |

---

## 4. Indexes

ឯកសារដើមរាយ `session_id`, `created_at`, `label` ជា "Future" ប៉ុន្តែពិតជាគួរបង្កើត**ឥឡូវនេះ** ព្រោះទាំង `conversations` និង `saved_places` ត្រូវ query តាម `session_id` រាល់ request — គ្មាន index មានន័យថា full table scan កាន់តែយូរនៅពេលទិន្នន័យកើនឡើង។

```sql
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_saved_places_session_id   ON saved_places(session_id);
CREATE INDEX IF NOT EXISTS idx_saved_places_label         ON saved_places(label);
```

---

## 5. `database_engine.py`

```python
# core/database_engine.py
from __future__ import annotations
import sqlite3
import logging
from contextlib import contextmanager
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = Path("database/khoem_ai.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS conversations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT    NOT NULL,
    role        TEXT    NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content     TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_places (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT    NOT NULL,
    label       TEXT    NOT NULL,
    lat         REAL    NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng         REAL    NOT NULL CHECK (lng BETWEEN -180 AND 180),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_saved_places_session_id   ON saved_places(session_id);
CREATE INDEX IF NOT EXISTS idx_saved_places_label         ON saved_places(label);
"""


def init_db() -> None:
    """Create tables/indexes if they don't exist. Safe to call on every startup."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        conn.executescript(SCHEMA)


@contextmanager
def get_connection():
    """
    Context-managed connection — commits on success, rolls back on error,
    always closes. Original doc had no connection lifecycle guidance at all.
    """
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def save_message(session_id: str, role: str, content: str) -> None:
    if role not in ("user", "assistant", "system"):
        raise ValueError(f"invalid role: {role}")
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO conversations (session_id, role, content) VALUES (?, ?, ?)",
            (session_id, role, content),   # parameterized — safe from SQL injection
        )


def get_conversation_history(session_id: str, limit: int = 50) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """SELECT role, content, created_at FROM conversations
               WHERE session_id = ? ORDER BY created_at ASC LIMIT ?""",
            (session_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]


def save_place(session_id: str, label: str, lat: float, lng: float) -> int:
    with get_connection() as conn:
        cur = conn.execute(
            "INSERT INTO saved_places (session_id, label, lat, lng) VALUES (?, ?, ?, ?)",
            (session_id, label, lat, lng),
        )
        return cur.lastrowid


def get_saved_places(session_id: str) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, label, lat, lng, created_at FROM saved_places WHERE session_id = ? ORDER BY created_at DESC",
            (session_id,),
        ).fetchall()
        return [dict(r) for r in rows]
```

> ✅ **Note:** ទាំងអស់ខាងលើប្រើ **parameterized queries** (`?` placeholders) — មិនប្រើ f-string/format ភ្ជាប់ SQL ដោយផ្ទាល់ ដែលជាមូលហេតុចម្បងនៃ SQL Injection ដែល `security.md` ព្យាយាមការពារនៅ layer ខាងលើ។ ការការពារពិតប្រាកដកើតឡើងទីនេះផងដែរ (defense-in-depth) មិនមែនត្រឹមតែ input validation ទេ។

---

## 6. `memory_engine.py`

*(ឯកសារដើមគ្រាន់តែរាយឈ្មោះ module — មិនមានលម្អិត)*

```python
# core/memory_engine.py
"""
Memory Engine — retrieves recent conversation context for the AI Engine.
Depends on: database_engine.py
Related roadmap item: roadmap.md Version 2.2 "Memory" (🔴 Planned)
"""
from __future__ import annotations
from .database_engine import get_conversation_history

MAX_CONTEXT_MESSAGES = 20  # TODO: tune based on token budget


def get_context(session_id: str) -> list[dict]:
    """Return recent messages formatted for the AI Engine's message list."""
    history = get_conversation_history(session_id, limit=MAX_CONTEXT_MESSAGES)
    return [{"role": h["role"], "content": h["content"]} for h in history]
```

> ⚠️ **Status mismatch:** `roadmap.md` Version 2.2 marks **Memory** as 🔴 Planned (not yet built), but `database.md` (ឯកសារដើម) already lists `memory_engine.py` as an existing module alongside `database_engine.py`. សូមបញ្ជាក់ថា តើ memory_engine.py មានស្រាប់ (partial) ឬត្រឹមតែជាឯកសារ placeholder — ដើម្បីកែ status ក្នុង roadmap.md ឲ្យត្រឹមត្រូវ។

---

## 7. Error Handling

*(ខ្វះទាំងស្រុងក្នុងឯកសារដើម — បន្ថែមថ្មី ស៊ីគ្នាជាមួយ pattern ក្នុង voice.md §10 / navigator.md §10)*

```python
def safe_save_message(session_id: str, role: str, content: str) -> bool:
    """Fail-safe wrapper — never lets a DB error crash the request handler."""
    try:
        save_message(session_id, role, content)
        return True
    except sqlite3.OperationalError as e:
        logger.error("DB locked/operational error: %s", e)
        return False
    except Exception as e:
        logger.error("Unexpected DB error: %s", e)
        return False
```

- **`database is locked` errors**: SQLite allows only one writer at a time — under concurrent requests this can happen. `get_connection()` uses a 10s `timeout` to retry internally, but high write concurrency will still need a queue or switch to WAL mode: `conn.execute("PRAGMA journal_mode=WAL")`.
- **Corrupted DB file**: no recovery/backup strategy documented — see §9.

---

## 8. Security Considerations

Cross-reference `security.md`:

- **SQL Injection**: `security.md` §3 blocks obvious SQL keywords at the *input* layer, but the real protection is parameterized queries here in §5 — both layers matter (defense-in-depth), input filtering alone is not sufficient.
- **`conversations.content` may contain PII**: chat messages could include names, phone numbers, addresses typed by the user. No mention of encryption-at-rest or a retention/deletion policy — ties into `security.md` §8 "Encrypted Database" (🔴 Planned) and §7 "Logging & Audit" gaps already flagged there.
- **`.env` file committed to repo** (see the ⚠️ note in §1) — if it contains `ROUTING_API_KEY`, DB credentials, or other secrets, those are exposed in git history even after later removal from the working tree.
- **No session_id validation**: nothing stops an attacker from guessing/enumerating another user's `session_id` to read their `conversations` or `saved_places` — no per-session auth check visible in `navigator_routes.py` or elsewhere. Ties into `security.md` §8 "JWT Authentication" / "Role Permission" (both 🔴 Planned).

---

## 9. Backup & Migration

*(មិនមានក្នុងឯកសារដើម — ត្រូវបំពេញ)*

- តើមាន automated backup សម្រាប់ `khoem_ai.db` ដែរឬទេ? (SQLite file អាចខូច ឬបាត់បង់ដោយងាយ)
- តើមាន migration strategy ដែរឬទេ ពេលបន្ថែម column/table ថ្មី (ឧ. `users`, `voice_profiles`)? ណែនាំ tool ដូចជា `alembic` ឬ script migration ដោយដៃដែលមាន version tracking
- Suggested minimal approach:
  ```bash
  # cron/script — simple file-copy backup
  cp database/khoem_ai.db "backups/khoem_ai_$(date +%Y%m%d_%H%M%S).db"
  ```

---

## 10. Future Tables

| Table | Purpose (inferred) | ភ្ជាប់ជាមួយ |
|---|---|---|
| `users` | User accounts (currently everything is session-based, no login) | `security.md` §8 JWT Authentication |
| `voice_profiles` | Custom/cloned user voices | `voice.md` §12 Voice Cloning |
| `settings` | Per-session or per-user preferences | — |
| `chat_statistics` | Usage metrics/analytics | — |
| `system_logs` | Security & error events | `security.md` §7 Logging & Audit — **should be prioritized**, since §7/§8 of security.md currently have no storage backend defined |
| `navigation_history` | Past routes | `navigator.md` §13 Route History |
| `vision_history` | Past image/document analyses | — |
| `api_usage` | Track external API calls (Nominatim, TTS providers) | `navigator.md` §12 — helps monitor Nominatim rate-limit compliance |

> **Recommendation:** `system_logs` should move up in priority — both `security.md` §7 and this doc's §8 currently depend on a logging table that doesn't exist yet.

---

*khoem-new/docs/database.md*

