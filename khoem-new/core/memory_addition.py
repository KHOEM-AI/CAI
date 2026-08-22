#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ==============================================================================
# memory_addition.py — KHOEM_AI 2.2: AI Memory (ចងចាំទីតាំង)
# ==============================================================================
# ចងចាំទីតាំងសំខាន់ៗ (ផ្ទះ ការងារ ហាងចូលញឹកញាប់) ក្នុង SQLite
# ពេលអ្នកប្រើនិយាយ "ទៅផ្ទះ" ប្រព័ន្ធរកឃើញទីតាំងភ្លាមៗ
#
# របៀបប្រើ: copy function + routes ខាងក្រោមទៅដាក់ក្នុង app.py
# ==============================================================================

# --- បន្ថែមចូល init_db() ដែលមានស្រាប់ ---
"""
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS conversations (...)''')  # មានស្រាប់

        # តារាងថ្មី — ចងចាំទីតាំង
        c.execute('''
            CREATE TABLE IF NOT EXISTS saved_places (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                label TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                created_at TEXT NOT NULL
            )
        ''')
        conn.commit()
"""

# --- Functions ថ្មី ---
def save_place(session_id, label, lat, lng):
    """រក្សាទុកទីតាំង (ឧ. label='ផ្ទះ', lat=11.55, lng=104.9)"""
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        # បើ label ដូចគ្នាមានស្រាប់ (ឧ. "ផ្ទះ" បង្កើតម្តងទៀត) → update ជំនួស insert
        c.execute(
            "DELETE FROM saved_places WHERE session_id = ? AND label = ?",
            (session_id, label)
        )
        c.execute(
            "INSERT INTO saved_places (session_id, label, lat, lng, created_at) VALUES (?, ?, ?, ?, ?)",
            (session_id, label, lat, lng, str(datetime.datetime.now()))
        )
        conn.commit()

def get_place(session_id, label):
    """ស្វែងរកទីតាំងតាមឈ្មោះ (ឧ. 'ផ្ទះ') — ត្រឡប់ (lat, lng) ឬ None"""
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute(
            "SELECT lat, lng FROM saved_places WHERE session_id = ? AND label = ?",
            (session_id, label)
        )
        row = c.fetchone()
        return {"lat": row[0], "lng": row[1]} if row else None

def get_all_places(session_id):
    """ត្រឡប់ទីតាំងទាំងអស់ដែលចងចាំសម្រាប់ session នេះ"""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute(
            "SELECT label, lat, lng FROM saved_places WHERE session_id = ?",
            (session_id,)
        )
        return [dict(r) for r in c.fetchall()]


# --- Routes ថ្មី — ដាក់ក្នុង app.py ---
"""
@app.route('/api/places', methods=['POST'])
def add_place():
    '''
    រក្សាទុកទីតាំង
    Body: { "session_id": "...", "label": "ផ្ទះ", "lat": 11.55, "lng": 104.9 }
    '''
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id")
    label = data.get("label", "").strip()
    lat = data.get("lat")
    lng = data.get("lng")

    if not session_id or not label or lat is None or lng is None:
        return jsonify({"error": "trauvkar session_id, label, lat, lng"}), 400

    save_place(session_id, label, lat, lng)
    return jsonify({"status": "saved", "label": label})


@app.route('/api/places/<session_id>', methods=['GET'])
def list_places(session_id):
    '''ត្រឡប់ទីតាំងទាំងអស់ដែលចងចាំ'''
    return jsonify({"places": get_all_places(session_id)})


@app.route('/api/places/<session_id>/<label>', methods=['GET'])
def find_place(session_id, label):
    '''ស្វែងរកទីតាំងតាមឈ្មោះ (ឧ. /api/places/session_abc/ផ្ទះ)'''
    place = get_place(session_id, label)
    if place:
        return jsonify(place)
    else:
        return jsonify({"error": "rok min kheunh"}), 404
"""
