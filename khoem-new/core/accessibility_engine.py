#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
=========================================================
KHOEM_AI 3.0
core/accessibility_engine.py

Accessibility Engine
=========================================================
"""


class AccessibilityEngine:

    def __init__(self):
        self.enabled = True

        # Vision
        self.zoom = 100
        self.rotation = 0
        self.high_contrast = False
        self.dark_mode = True
        self.white_mode = False
        self.large_text = False

        # Voice
        self.auto_read = False
        self.speech_speed = 1.0
        self.volume = 1.0

    # --------------------------------------------------
    # Enable / Disable
    # --------------------------------------------------

    def enable(self):
        self.enabled = True

    def disable(self):
        self.enabled = False

    def toggle(self):
        self.enabled = not self.enabled

    # --------------------------------------------------
    # Zoom
    # --------------------------------------------------

    def set_zoom(self, value):
        self.zoom = max(100, min(500, int(value)))

    # --------------------------------------------------
    # Rotation
    # --------------------------------------------------

    def set_rotation(self, degree):
        self.rotation = int(degree) % 360

    # --------------------------------------------------
    # Contrast
    # --------------------------------------------------

    def set_high_contrast(self, enabled):
        self.high_contrast = bool(enabled)

    # --------------------------------------------------
    # Theme
    # --------------------------------------------------

    def set_dark_mode(self):
        self.dark_mode = True
        self.white_mode = False

    def set_white_mode(self):
        self.dark_mode = False
        self.white_mode = True

    # --------------------------------------------------
    # Large Text
    # --------------------------------------------------

    def set_large_text(self, enabled):
        self.large_text = bool(enabled)

    # --------------------------------------------------
    # Voice
    # --------------------------------------------------

    def set_auto_read(self, enabled):
        self.auto_read = bool(enabled)

    def set_speech_speed(self, speed):
        self.speech_speed = max(0.5, min(2.0, float(speed)))

    def set_volume(self, volume):
        self.volume = max(0.0, min(1.0, float(volume)))

    # --------------------------------------------------
    # Reset
    # --------------------------------------------------

    def reset(self):
        self.__init__()

    # --------------------------------------------------
    # Status
    # --------------------------------------------------

    def get_status(self):
        return {
            "enabled": self.enabled,
            "vision": {
                "zoom": self.zoom,
                "rotation": self.rotation,
                "high_contrast": self.high_contrast,
                "dark_mode": self.dark_mode,
                "white_mode": self.white_mode,
                "large_text": self.large_text,
            },
            "voice": {
                "auto_read": self.auto_read,
                "speech_speed": self.speech_speed,
                "volume": self.volume,
            },
        }


accessibility_engine = AccessibilityEngine()
