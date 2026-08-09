#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
=========================================================
KHOEM_AI 3.0
core/voice_engine.py

Voice Engine
=========================================================
"""

from dataclasses import dataclass


@dataclass
class VoiceProfile:
    id: str
    name: str
    gender: str
    age_group: str
    language: str
    pitch: float
    rate: float
    description: str


class VoiceEngine:

    def __init__(self):

        self.enabled = True
        self.auto_read = False

        self.language = "km-KH"

        self.volume = 1.0
        self.rate = 1.0
        self.pitch = 1.0

        self.current_voice = "young_man"

        self.voice_profiles = {

            # ===========================
            # Male
            # ===========================

            "boy": VoiceProfile(
                "boy",
                "Boy",
                "male",
                "child",
                "km-KH",
                1.40,
                1.10,
                "ក្មេងប្រុស"
            ),

            "young_man": VoiceProfile(
                "young_man",
                "Young Man",
                "male",
                "young",
                "km-KH",
                1.00,
                1.00,
                "យុវជន"
            ),

            "elder_man": VoiceProfile(
                "elder_man",
                "Elder Man",
                "male",
                "elder",
                "km-KH",
                0.85,
                0.85,
                "បុរសចំណាស់"
            ),

            # ===========================
            # Female
            # ===========================

            "girl": VoiceProfile(
                "girl",
                "Girl",
                "female",
                "child",
                "km-KH",
                1.50,
                1.10,
                "ក្មេងស្រី"
            ),

            "young_woman": VoiceProfile(
                "young_woman",
                "Young Woman",
                "female",
                "young",
                "km-KH",
                1.15,
                1.00,
                "យុវនារី"
            ),

            "elder_woman": VoiceProfile(
                "elder_woman",
                "Elder Woman",
                "female",
                "elder",
                "km-KH",
                0.95,
                0.85,
                "ស្ត្រីចំណាស់"
            ),

            # ===========================
            # Special
            # ===========================

            "robot": VoiceProfile(
                "robot",
                "Robot",
                "ai",
                "system",
                "km-KH",
                1.00,
                1.00,
                "AI Robot"
            ),

            "narrator": VoiceProfile(
                "narrator",
                "Narrator",
                "neutral",
                "adult",
                "km-KH",
                0.95,
                0.90,
                "សម្រាប់អានឯកសារ"
            ),

            "accessibility": VoiceProfile(
                "accessibility",
                "Accessibility",
                "neutral",
                "elder",
                "km-KH",
                1.00,
                0.75,
                "សម្រាប់អ្នកចាស់ និងអ្នកមើលមិនសូវឃើញ"
            )

        }

    # ===================================================
    # Enable / Disable
    # ===================================================

    def enable(self):
        self.enabled = True

    def disable(self):
        self.enabled = False

    def toggle(self):
        self.enabled = not self.enabled

    # ===================================================
    # Auto Read
    # ===================================================

    def set_auto_read(self, value: bool):
        self.auto_read = bool(value)

    # ===================================================
    # Settings
    # ===================================================

    def set_voice(self, voice_id):

        if voice_id not in self.voice_profiles:
            return False

        profile = self.voice_profiles[voice_id]

        self.current_voice = voice_id
        self.language = profile.language
        self.pitch = profile.pitch
        self.rate = profile.rate

        return True

    def set_rate(self, rate):
        self.rate = max(0.5, min(2.0, float(rate)))

    def set_pitch(self, pitch):
        self.pitch = max(0.5, min(2.0, float(pitch)))

    def set_volume(self, volume):
        self.volume = max(0.0, min(1.0, float(volume)))

    # ===================================================
    # Information
    # ===================================================

    def list_profiles(self):

        return [
            {
                "id": p.id,
                "name": p.name,
                "gender": p.gender,
                "age_group": p.age_group,
                "description": p.description
            }
            for p in self.voice_profiles.values()
        ]

    def get_settings(self):

        return {

            "enabled": self.enabled,

            "auto_read": self.auto_read,

            "voice": self.current_voice,

            "language": self.language,

            "rate": self.rate,

            "pitch": self.pitch,

            "volume": self.volume

        }

    # ===================================================
    # Speak
    # ===================================================

    def speak(self, text):

        return {

            "status": "ready",

            "enabled": self.enabled,

            "voice": self.current_voice,

            "language": self.language,

            "rate": self.rate,

            "pitch": self.pitch,

            "volume": self.volume,

            "auto_read": self.auto_read,

            "text": text

        }


voice_engine = VoiceEngine()
