"""
=========================================================
Navigator Engine
KHOEM_AI 3.0
=========================================================
"""

import math


class NavigatorEngine:


    def __init__(self):

        self.current_location = None

        self.destination = None

    def update_location(self, latitude, longitude):

        self.current_location = {

            "lat": latitude,

            "lng": longitude

        }

        return self.current_location

    def set_destination(self, latitude, longitude):

        self.destination = {

            "lat": latitude,

            "lng": longitude

        }

        return self.destination

    def get_current_location(self):

        return self.current_location

    def get_destination(self):

        return self.destination

    def calculate_distance(self):

        if not self.current_location:

            return None

        if not self.destination:

            return None

        lat1 = self.current_location["lat"]

        lon1 = self.current_location["lng"]

        lat2 = self.destination["lat"]

        lon2 = self.destination["lng"]

        distance = math.sqrt(

            (lat2 - lat1) ** 2 +

            (lon2 - lon1) ** 2

        ) * 111

        return round(distance, 2)

    def estimate_time(self, speed_kmh=40):

        distance = self.calculate_distance()

        if distance is None:

            return None

        return round(distance / speed_kmh * 60, 1)

    def route_summary(self):

        distance = self.calculate_distance()

        if distance is None:

            return {

                "status": "waiting"

            }

        return {

            "status": "ready",

            "distance_km": distance,

            "estimated_minutes": self.estimate_time()

        }

navigator_engine = NavigatorEngine()

