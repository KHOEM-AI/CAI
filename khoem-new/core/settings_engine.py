#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
=========================================================
KHOEM_AI 3.0
core/settings_engine.py
User Settings Engine
=========================================================
"""

import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "database", "settings.db")


class SettingsEngine:

    def __init__(self):

        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

        self.init_database()

    # =====================================================
    # Create Table
    # =====================================================

    def init_database(self):

        conn = sqlite3.connect(DB_PATH)

        cursor = conn.cursor()

        cursor.execute("""

        CREATE TABLE IF NOT EXISTS user_settings(

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            setting_key TEXT UNIQUE,

            setting_value TEXT

        )

        """)

        conn.commit()

        conn.close()

    # =====================================================
    # Save Setting
    # =====================================================

    def save(self, key, value):

        conn = sqlite3.connect(DB_PATH)

        cursor = conn.cursor()

        cursor.execute("""

        INSERT OR REPLACE INTO user_settings

        (setting_key, setting_value)

        VALUES (?,?)

        """, (key, str(value)))

        conn.commit()

        conn.close()

        return True

    # =====================================================
    # Load Setting
    # =====================================================

    def load(self, key, default=None):

        conn = sqlite3.connect(DB_PATH)

        cursor = conn.cursor()

        cursor.execute("""

        SELECT setting_value

        FROM user_settings

        WHERE setting_key=?

        """, (key,))

        row = cursor.fetchone()

        conn.close()

        if row:

            return row[0]

        return default

    # =====================================================
    # Load All
    # =====================================================

    def load_all(self):

        conn = sqlite3.connect(DB_PATH)

        conn.row_factory = sqlite3.Row

        cursor = conn.cursor()

        cursor.execute("""

        SELECT *

        FROM user_settings

        ORDER BY setting_key

        """)

        rows = cursor.fetchall()

        conn.close()

        return [dict(r) for r in rows]

    # =====================================================
    # Reset Default
    # =====================================================

    def reset(self):

        conn = sqlite3.connect(DB_PATH)

        cursor = conn.cursor()

        cursor.execute("DELETE FROM user_settings")

        conn.commit()

        conn.close()

        return True


# =========================================================
# Global Instance
# =========================================================

settings_engine = SettingsEngine()
