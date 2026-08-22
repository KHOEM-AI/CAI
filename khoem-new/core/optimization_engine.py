"""
=========================================================
Optimization Engine
KHOEM_AI 3.0
=========================================================
"""

class OptimizationEngine:

    def __init__(self):

        self.mode = "balanced"

    def select_model(self, task):

        task = task.lower()

        if any(word in task for word in [
            "image",
            "vision",
            "photo",
            "camera"
        ]):
            return "vision"

        if any(word in task for word in [
            "map",
            "gps",
            "route",
            "navigate"
        ]):
            return "navigator"

        return "chat"

    def set_mode(self, mode):

        self.mode = mode

    def get_mode(self):

        return self.mode

    def system_status(self):

        return {
            "engine": "OptimizationEngine",
            "mode": self.mode,
            "status": "online"
        }
