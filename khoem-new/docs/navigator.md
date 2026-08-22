# KHOEM_AI Navigator

> **Version:** 2.2  <!-- កែពី 3.3 ឲ្យត្រូវនឹង roadmap.md/voice.md/security.md -->
> **Backend:** `core/navigator_engine.py` · `core/navigator_routes.py`  
> **Frontend:** `navigator.html` · `static/css/navigator.css` · `static/js/navigator.js`  
> **Sub-modules:** `static/js/gps.js` · `static/js/map.js`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Features](#2-features)
3. [Navigation Flow](#3-navigation-flow)
4. [File Structure](#4-file-structure)
5. [Frontend Modules](#5-frontend-modules)
   - [gps.js](#51-gpsjs)
   - [map.js](#52-mapjs)
   - [navigator.js](#53-navigatorjs)
6. [Backend Modules](#6-backend-modules)
   - [navigator_engine.py](#61-navigator_enginepy)
   - [navigator_routes.py](#62-navigator_routespy)
7. [API Reference](#7-api-reference)
8. [Voice Navigation](#8-voice-navigation)
9. [Saved Places Integration](#9-saved-places-integration)
10. [Error Handling](#10-error-handling) ⬅️ **NEW**
11. [Security Considerations](#11-security-considerations) ⬅️ **NEW**
12. [Known Gaps / TODO](#12-known-gaps--todo) ⬅️ **NEW**
13. [Future Roadmap](#13-future-roadmap)

---

## 1. Overview

KHOEM_AI Navigator is a browser-based navigation engine with real-time GPS tracking, interactive map display, route planning, and turn-by-turn voice guidance. It integrates with the KHOEM_AI Voice Engine (`voice.md`) for spoken directions and the Saved Places system for quick-access locations.

```
Browser GPS  →  gps.js  →  map.js  →  Route display  →  Voice guidance
                  ↓
           navigator_engine.py  →  Route calculation
```

---

## 2. Features

| Feature                | Description                                                            |
|------------------------|--------------------------------------------------------------------------|
| **GPS Tracking**       | Real-time position updates using the browser Geolocation API           |
| **Live Position**      | Animated marker follows the user as they move                          |
| **Current Speed**      | Displays speed in km/h derived from `GeolocationCoordinates.speed`     |
| **Map Display**        | Interactive map with tile layers (OpenStreetMap or custom tiles)       |
| **Route Planning**     | Calculate and draw the optimal route to a destination                  |
| **Voice Navigation**   | Turn-by-turn spoken instructions via KHOEM_AI Voice Engine              |
| **Destination Search** | Search by place name or coordinates                                    |
| **Saved Places**       | Load destinations directly from the user's saved places list           |
| **Center GPS**         | One-tap re-centering of the map on the current position                |
| **Start Navigation**   | Begin active turn-by-turn guidance                                     |
| **Stop Navigation**    | End guidance and return to browse mode                                 |

---

## 3. Navigation Flow

```
┌─────────────────────┐
│  1. Current Location │  ← Browser Geolocation API (gps.js)
└────────┬────────────┘
         ↓
┌─────────────────────┐
│  2. Search / Select  │  ← Text search or Saved Place
│     Destination      │
└────────┬────────────┘
         ↓
┌─────────────────────┐
│  3. Calculate Route  │  ← POST /api/navigator/route
│                      │     (navigator_engine.py)
└────────┬────────────┘
         ↓
┌─────────────────────┐
│  4. Draw Route       │  ← Polyline on map (map.js)
│     on Map           │
└────────┬────────────┘
         ↓
┌─────────────────────┐
│  5. Voice Guidance   │  ← Step-by-step via Voice Engine
│  (Turn-by-Turn)      │
└────────┬────────────┘
         ↓
┌─────────────────────┐
│  6. Arrival          │  ← "You have arrived" + stop tracking
└─────────────────────┘
```

---

## 4. File Structure

```
khoem-new/
├── core/
│   ├── navigator_engine.py     # Route calculation, step generation
│   └── navigator_routes.py     # Flask blueprint: /api/navigator/*
├── static/
│   ├── css/
│   │   └── navigator.css       # Navigator UI styles
│   └── js/
│       ├── gps.js              # Geolocation tracking + speed
│       ├── map.js              # Map rendering + markers + polylines
│       └── navigator.js        # Main orchestrator + UI logic
└── templates/
    └── navigator.html          # Navigator page template
```

---

## 5. Frontend Modules

### 5.1 `gps.js`

Handles all Geolocation API interaction. Emits position updates to `navigator.js`.

**Key functions**

| Function | Description |
|----------|-------------|
| `startTracking(callback, onError)` | Begin watching GPS position; calls `callback(position)` on each update, `onError(err)` on failure |
| `stopTracking()` | Clear the geolocation watcher |
| `getCurrentPosition()` | One-shot position read — returns `Promise<{lat, lng, speed, accuracy}>` |
| `getSpeedKmh(position)` | Convert `position.coords.speed` (m/s) to km/h; returns `0` if null |

```javascript
// gps.js — updated with user-facing error callback (previously console-only)

let _watchId = null;

export function startTracking(callback, onError = () => {}) {
  if (!navigator.geolocation) {
    onError({ code: 0, message: "Geolocation មិនគាំទ្រទេ" });
    return;
  }
  _watchId = navigator.geolocation.watchPosition(
    (pos) => callback(normalise(pos)),
    (err) => onError(err),   // was: console.error only — now bubbles to UI
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
  );
}

export function stopTracking() {
  if (_watchId !== null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 0, message: "Geolocation មិនគាំទ្រទេ" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(normalise(pos)),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export function getSpeedKmh(pos) {
  return pos.speed != null ? Math.round(pos.speed * 3.6) : 0;
}

function normalise(pos) {
  return {
    lat:      pos.coords.latitude,
    lng:      pos.coords.longitude,
    speed:    getSpeedKmh(pos),
    accuracy: pos.coords.accuracy,
  };
}
```

---

### 5.2 `map.js`

Wraps Leaflet.js to display the map, markers, and route polylines. *(មិនប្រែប្រួល — សូមមើលកូដដើម)*

**Key functions**

| Function | Description |
|----------|-------------|
| `initMap(elementId)` | Initialize Leaflet map in the given HTML element |
| `setView(lat, lng, zoom)` | Pan and zoom to a coordinate |
| `updateUserMarker(lat, lng)` | Move the live-position marker |
| `drawRoute(coordinates)` | Draw a polyline from an array of `[lat, lng]` pairs |
| `clearRoute()` | Remove the current route polyline |
| `addDestinationMarker(lat, lng, label)` | Place a pin at the destination |
| `clearDestinationMarker()` | Remove the destination pin |

```javascript
// map.js
import L from "leaflet";

let _map, _userMarker, _routeLayer, _destMarker;

export function initMap(elementId) {
  _map = L.map(elementId).setView([11.5564, 104.9282], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(_map);
}

export function setView(lat, lng, zoom = 15) {
  _map.setView([lat, lng], zoom);
}

export function updateUserMarker(lat, lng) {
  if (!_userMarker) {
    _userMarker = L.circleMarker([lat, lng], {
      radius: 10, color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.9,
    }).addTo(_map);
  } else {
    _userMarker.setLatLng([lat, lng]);
  }
}

export function drawRoute(coordinates) {
  clearRoute();
  _routeLayer = L.polyline(coordinates, { color: "#2563eb", weight: 5 }).addTo(_map);
  _map.fitBounds(_routeLayer.getBounds(), { padding: [40, 40] });
}

export function clearRoute() {
  if (_routeLayer) { _map.removeLayer(_routeLayer); _routeLayer = null; }
}

export function addDestinationMarker(lat, lng, label = "ទីតាំង") {
  clearDestinationMarker();
  _destMarker = L.marker([lat, lng]).addTo(_map).bindPopup(label).openPopup();
}

export function clearDestinationMarker() {
  if (_destMarker) { _map.removeLayer(_destMarker); _destMarker = null; }
}
```

---

### 5.3 `navigator.js`

Main orchestrator — connects GPS, map, API calls, voice, and UI state.

**State**

```javascript
let state = {
  isNavigating:  false,
  currentPos:    null,       // { lat, lng, speed }
  destination:   null,       // { lat, lng, label }
  routeSteps:    [],         // array of step instructions
  currentStep:   0,
  persona:       "navigation",
};
```

**Key functions — implementations added (missing from original doc)**

```javascript
import { startTracking, stopTracking, getCurrentPosition } from "./gps.js";
import { initMap, setView, updateUserMarker, drawRoute, clearRoute,
         addDestinationMarker, clearDestinationMarker } from "./map.js";
import { speak } from "./voice.js";

async function init() {
  initMap("map");
  try {
    const pos = await getCurrentPosition();
    state.currentPos = pos;
    setView(pos.lat, pos.lng);
    updateUserMarker(pos.lat, pos.lng);
  } catch (err) {
    handleGpsError(err);
  }
  startTracking(onPositionUpdate, handleGpsError);
}

async function searchDestination(query) {
  if (!query || !query.trim()) return;
  try {
    const resp = await fetch(`/api/navigator/geocode?q=${encodeURIComponent(query)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const place = await resp.json();
    selectDestination(place.lat, place.lng, place.label);
  } catch (err) {
    handleApiError(err, "រកមិនឃើញទីតាំងនេះទេ");
  }
}

function selectDestination(lat, lng, label) {
  state.destination = { lat, lng, label };
  addDestinationMarker(lat, lng, label);
  setView(lat, lng);
}

async function startNavigation() {
  if (!state.currentPos || !state.destination) {
    speak("សូមជ្រើសរើសទីតាំងគោលដៅជាមុនសិន", "navigation");
    return;
  }
  try {
    const resp = await fetch("/api/navigator/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin_lat: state.currentPos.lat,
        origin_lng: state.currentPos.lng,
        dest_lat:   state.destination.lat,
        dest_lng:   state.destination.lng,
        mode:       "driving",
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const route = await resp.json();

    state.routeSteps  = route.steps;
    state.currentStep = 0;
    state.isNavigating = true;

    drawRoute(route.polyline);
    announceStep(route.steps[0]);
  } catch (err) {
    handleApiError(err, "មិនអាចគណនាផ្លូវបានទេ");
  }
}

function stopNavigation() {
  state.isNavigating = false;
  state.routeSteps = [];
  state.currentStep = 0;
  clearRoute();
}

async function centerOnUser() {
  try {
    const pos = await getCurrentPosition();
    setView(pos.lat, pos.lng);
  } catch (err) {
    handleGpsError(err);
  }
}

function onPositionUpdate(pos) {
  state.currentPos = pos;
  updateUserMarker(pos.lat, pos.lng);
  updateSpeedDisplay(pos.speed);

  if (!state.isNavigating) return;

  const step = state.routeSteps[state.currentStep];
  if (!step) return;

  const dist = haversineDistance(pos.lat, pos.lng, step.lat, step.lng);
  if (dist < 30) {
    state.currentStep++;
    const next = state.routeSteps[state.currentStep];
    if (next) {
      announceStep(next);
    } else {
      speak("ដំណើរការបានបញ្ចប់ — អ្នកបានដល់គោលដៅហើយ", "navigation");
      stopNavigation();
    }
  }
}

function announceStep(step) {
  if (step) speak(step.instruction, "navigation");
}

// Utility: was referenced but not defined in the original doc
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// UI helper — was referenced but not defined in the original doc
function updateSpeedDisplay(speedKmh) {
  const el = document.getElementById("speed-display");
  if (el) el.textContent = `${speedKmh} km/h`;
}
```

---

## 6. Backend Modules

### 6.1 `navigator_engine.py`

Pure logic — route calculation and step generation. No Flask here.

> ⚠️ **សំខាន់:** `calculate_route()` ខាងក្រោមជា **stub** — វា return តែចំណុចចាប់ផ្តើម/បញ្ចប់ ២ ចំណុច ដោយ `distance_m`/`duration_s` តែងតែ `0.0`។ `ROUTING_API_URL`/`ROUTING_API_KEY` ត្រូវបានប្រកាសប៉ុន្តែ **មិនទាន់ត្រូវបានប្រើ** ក្នុងកូដ។ ត្រូវភ្ជាប់ទៅ routing provider ពិត (OSRM/OpenRouteService/Google) មុន production។

```python
# core/navigator_engine.py
from __future__ import annotations
import logging
import os
import math
import requests

logger = logging.getLogger(__name__)

ROUTING_API_URL = os.getenv("ROUTING_API_URL", "")
ROUTING_API_KEY = os.getenv("ROUTING_API_KEY", "")


class RouteResult:
    def __init__(self, steps: list[dict], polyline: list[list[float]],
                 distance_m: float, duration_s: float):
        self.steps      = steps
        self.polyline   = polyline
        self.distance_m = distance_m
        self.duration_s = duration_s

    def to_dict(self) -> dict:
        return {
            "steps":        self.steps,
            "polyline":     self.polyline,
            "distance_m":   self.distance_m,
            "duration_s":   self.duration_s,
            "distance_km":  round(self.distance_m / 1000, 2),
            "duration_min": round(self.duration_s / 60, 1),
        }


def _haversine_m(lat1, lng1, lat2, lng2) -> float:
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def calculate_route(
    origin_lat: float, origin_lng: float,
    dest_lat: float,   dest_lng: float,
    mode: str = "driving",
) -> RouteResult:
    """
    Calculate a route between two coordinates.
    STUB: returns a straight-line "route" — replace with a real routing API call.
    Now at least computes a real straight-line distance instead of hardcoded 0.0,
    so the UI doesn't show "0.0 km" while this is still a stub.
    """
    logger.info(
        "Route requested: (%.4f, %.4f) → (%.4f, %.4f) [%s]",
        origin_lat, origin_lng, dest_lat, dest_lng, mode,
    )

    distance_m = _haversine_m(origin_lat, origin_lng, dest_lat, dest_lng)
    # Rough estimate only — NOT real travel time (no road network / traffic)
    avg_speed_mps = {"driving": 11.0, "walking": 1.4, "bicycle": 4.0}.get(mode, 11.0)
    duration_s = distance_m / avg_speed_mps

    return RouteResult(
        steps=[
            {"instruction": "ចាប់ផ្ដើម", "lat": origin_lat, "lng": origin_lng},
            {"instruction": "ឈានដល់គោលដៅ", "lat": dest_lat, "lng": dest_lng},
        ],
        polyline=[[origin_lat, origin_lng], [dest_lat, dest_lng]],
        distance_m=distance_m,
        duration_s=duration_s,
    )


def geocode(query: str) -> dict | None:
    """
    Convert a place name to coordinates via Nominatim (OpenStreetMap).

    NOTE — Nominatim Usage Policy: max ~1 request/second, valid User-Agent
    required, no heavy/bulk usage. For production traffic, switch to a paid
    provider (Google/Mapbox/OpenRouteService) or self-hosted Nominatim.
    """
    if not query or len(query.strip()) == 0:
        return None
    if len(query) > 200:
        query = query[:200]

    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": "KHOEM_AI/2.2 (contact: TODO-add-contact-email)"},
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json()
        if results:
            r = results[0]
            return {"lat": float(r["lat"]), "lng": float(r["lon"]), "label": r["display_name"]}
    except requests.RequestException as exc:
        logger.error("Geocode error: %s", exc)
    return None
```

---

### 6.2 `navigator_routes.py`

Flask blueprint exposing the Navigator REST API — now with input validation via `core/security_engine.py`.

```python
# core/navigator_routes.py
from __future__ import annotations
from flask import Blueprint, jsonify, request
from .navigator_engine import calculate_route, geocode
from .security_engine import safe_validate_input   # cross-ref security.md §6

navigator_bp = Blueprint("navigator", __name__, url_prefix="/api/navigator")


@navigator_bp.route("/route", methods=["POST"])
def route():
    data = request.get_json(silent=True) or {}
    required = ["origin_lat", "origin_lng", "dest_lat", "dest_lng"]
    missing  = [f for f in required if data.get(f) is None]
    if missing:
        return jsonify({"error": f"ខ្វះទុតតម្រូវការ: {', '.join(missing)}"}), 400

    try:
        result = calculate_route(
            float(data["origin_lat"]), float(data["origin_lng"]),
            float(data["dest_lat"]),   float(data["dest_lng"]),
            mode=data.get("mode", "driving"),
        )
    except (TypeError, ValueError):
        return jsonify({"error": "coordinates ត្រូវតែជាលេខ"}), 400
    except Exception as exc:  # fail closed — don't leak internals
        return jsonify({"error": "មិនអាចគណនាផ្លូវបានទេ"}), 500

    return jsonify(result.to_dict())


@navigator_bp.route("/geocode", methods=["GET"])
def geocode_endpoint():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "ខ្វះទុតតម្រូវការ: q"}), 400

    # Validate search text through the shared security engine
    is_valid, cleaned_or_msg = safe_validate_input(query)
    if not is_valid:
        return jsonify({"error": cleaned_or_msg}), 400

    result = geocode(cleaned_or_msg)
    if not result:
        return jsonify({"error": "រកមិនឃើញទីតាំង"}), 404
    return jsonify(result)
```

**Register the blueprint in `app.py`**
```python
from core.navigator_routes import navigator_bp
app.register_blueprint(navigator_bp)
```

---

## 7. API Reference

### `POST /api/navigator/route`

Calculate a route between two coordinates.

**Request body**

| Field        | Type   | Required | Description                               |
|--------------|--------|----------|--------------------------------------------|
| `origin_lat` | number | ✅       | Starting latitude                          |
| `origin_lng` | number | ✅       | Starting longitude                         |
| `dest_lat`   | number | ✅       | Destination latitude                       |
| `dest_lng`   | number | ✅       | Destination longitude                      |
| `mode`       | string | ❌       | `driving` (default), `walking`, `bicycle`  |

```json
{
  "origin_lat": 11.5564,
  "origin_lng": 104.9282,
  "dest_lat":   11.5700,
  "dest_lng":   104.9100,
  "mode":       "driving"
}
```

**Response `200`** — see updated `to_dict()` (now with real haversine distance/duration estimate, still not true road-network routing)

**Response `400`** — missing/invalid coordinates
**Response `500`** — internal error (fails closed, no internals leaked)

---

### `GET /api/navigator/geocode?q=<query>`

Convert a place name to coordinates. Input is now passed through `security_engine.safe_validate_input()` before hitting the geocoding provider.

**Response `200`**
```json
{
  "lat":   11.5694,
  "lng":   104.9210,
  "label": "Central Market, Phnom Penh, Cambodia"
}
```

**Response `400`** — empty/blocked query
**Response `404`** — place not found

---

## 8. Voice Navigation

Navigator uses the KHOEM_AI Voice Engine (`voice.md`) with the `"navigation"` persona (mapped to `male_adult` voice profile). Spoken "ដឹកនាំ …" commands are already implemented in `voice.js` §8/§9 of `voice.md` — **this is not a separate future feature**; see §13 note below.

```javascript
import { speak } from "./voice.js";

function announceStep(step) {
  if (step) speak(step.instruction, "navigation");
}
```

---

## 9. Saved Places Integration

```javascript
async function loadSavedPlaces(sessionId) {
  try {
    const resp = await fetch(`/api/places/${encodeURIComponent(sessionId)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    renderSavedPlacesList(data.places);
  } catch (err) {
    handleApiError(err, "មិនអាចផ្ទុកទីតាំងដែលបានរក្សាទុកបានទេ");
  }
}

function onSavedPlaceSelect(place) {
  selectDestination(place.lat, place.lng, place.label);
}
```

---

## 10. Error Handling

Follows the same fail-safe pattern established in `voice.md` §10 — every failure gets (1) a console log, (2) a Khmer user-facing message, (3) a safe fallback so the UI is never left stuck silently.

```javascript
function handleGpsError(err) {
  const messages = {
    0: "ទីតាំង GPS មិនអាចប្រើបានទេ",
    1: "អ្នកមិនបានអនុញ្ញាតទីតាំង (GPS) ទេ",   // PERMISSION_DENIED
    2: "មិនអាចរកទីតាំងបានទេ",                  // POSITION_UNAVAILABLE
    3: "ការស្នើសុំទីតាំងអស់ពេលកំណត់",          // TIMEOUT
  };
  const msg = messages[err.code] ?? err.message ?? "មានបញ្ហាមិនស្គាល់ជាមួយ GPS";
  console.error("GPS error:", err);
  showToast(msg);
}

function handleApiError(err, userMessage) {
  console.error("Navigator API error:", err);
  showToast(userMessage || "មានបញ្ហាបច្ចេកទេស សូមព្យាយាមម្ដងទៀត");
}
```

---

## 11. Security Considerations

- **Destination search (`/api/navigator/geocode`)** now runs through `security_engine.safe_validate_input()` (see `security.md` §3/§6) before being sent to the external Nominatim API — previously unvalidated user text was forwarded directly to a third-party service.
- **Route endpoint** validates coordinate types (`float`) and fails closed (`500` with generic message) on unexpected errors, instead of leaking stack traces.
- **Third-party geocoding (Nominatim)**: query text and approximate location leave KHOEM_AI's server — worth documenting in a privacy note (cross-ref `voice.md` §11) since destination searches are, effectively, location data leaving the system.

---

## 12. Known Gaps / TODO

- `calculate_route()` is still a straight-line stub, not real road-network routing — `ROUTING_API_URL`/`ROUTING_API_KEY` env vars exist but are unused.
- No rate limiting on `/api/navigator/geocode` — Nominatim's usage policy (~1 req/s) could get the server IP blocked under load; ties into `security.md` §8 "Rate Limiter" (currently 🔴 Planned).
- No caching of geocode results — repeated searches for the same place hit Nominatim every time.
- `Route History` (§13) would need a `routes` table — not yet in `database.md` schema (worth checking).

---

## 13. Future Roadmap

| Feature                 | Status      | Notes                                                        |
|---------------------------|-------------|----------------------------------------------------------------|
| **Traffic Information** | 🔜 Planned  | Real-time congestion overlay via traffic API                 |
| **Offline Maps**        | 🔜 Planned  | Tile caching with Service Worker + IndexedDB                 |
| **Multiple Stops**      | 🔜 Planned  | Waypoint support in route planner                             |
| **Avoid Toll Roads**    | 🔜 Planned  | Routing preference flag                                       |
| **Avoid Highways**      | 🔜 Planned  | Routing preference flag                                       |
| **Walking Mode**        | 🔜 Planned  | Pedestrian routing with footpath support                     |
| **Motorbike Mode**      | 🔜 Planned  | Optimized for Cambodian motorbike travel patterns             |
| **Car Mode**            | 🔜 Planned  | Default driving mode                                           |
| **Bicycle Mode**        | 🔜 Planned  | Cycling-friendly routing                                       |
| ~~Voice Commands~~      | ✅ Already implemented | Removed from "future" — already live via `voice.md` §8/§9 |
| **Real Routing Engine** | 🔴 Planned  | Replace stub in §6.1 with OSRM/OpenRouteService/Google Maps  |
| **ETA Prediction**      | 🔜 Planned  | ML-based arrival time adjusted for local traffic             |
| **Fuel Estimation**     | 🔜 Planned  | Based on distance + vehicle type input                        |
| **Route History**       | 🔜 Planned  | Store past routes per session in SQLite                       |

---

*khoem-new/docs/navigator.md — Built with Leaflet.js + Web Geolocation API*
