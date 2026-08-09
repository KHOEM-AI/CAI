#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
core/memory_engine.py — AI Memory (ចងចាំទីតាំង)
ស្រទាប់ logic សាមញ្ញនៅលើ database_engine — កន្លែងសមស្របសម្រាប់
បន្ថែមតក្កវិជ្ជាបន្ថែម (ឧ. validation, ស្វែងរកភាពស្រដៀង) នៅពេលក្រោយ
"""

from core.database_engine import save_place, get_place, get_all_places


def remember_place(session_id, label, lat, lng):
    label = label.strip()
    if not label:
        raise ValueError("label មិនអាចទទេបានទេ")
    save_place(session_id, label, lat, lng)
    return {"label": label, "lat": lat, "lng": lng}


def recall_place(session_id, label):
    return get_place(session_id, label.strip())


def recall_all_places(session_id):
    return get_all_places(session_id)
