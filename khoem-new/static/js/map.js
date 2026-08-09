// ============================================================================
// FILE    : static/js/map.js
// PROJECT : KHOEM_AI 3.0
// MODULE  : Smart Map Engine
// VERSION : 3.0
// AUTHOR  : KHOEM AI
// ============================================================================

"use strict";

const KhoemMap = {
    // ============================================================
    // MAP OBJECT & LAYERS
    // ============================================================
    map: null,
    userMarker: null,
    destinationMarker: null,
    routeLayer: null,
    routeLine: null, // បន្ថែមសម្រាប់ផ្ទុកខ្សែបន្ទាត់ផ្លូវ

    // ============================================================
    // CURRENT STATE
    // ============================================================
    initialized: false,
    currentLat: null,
    currentLng: null,
    currentZoom: 17,
    destination: null,

    // ============================================================
    // INITIALIZE MAP
    // ============================================================
    init(containerId, lat, lng) {
        if (this.initialized) return;

        this.currentLat = lat;
        this.currentLng = lng;

        // បង្កើតផែនទី
        this.map = L.map(containerId, { zoomControl: true, attributionControl: true });
        this.map.setView([lat, lng], this.currentZoom);

        // ទាញយក OpenStreetMap Tile
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 20,
            attribution: "© OpenStreetMap Contributors"
        }).addTo(this.map);

        // បង្កើតសញ្ញាសម្គាល់ (Marker) ទីតាំងអ្នកប្រើប្រាស់
        this.userMarker = L.marker([lat, lng], { title: "Current Location" }).addTo(this.map);
        this.userMarker.bindPopup("📍 Your Location");

        this.initialized = true;
        console.log("[KhoemMap] Initialized successfully");
    },

    isReady() {
        return this.initialized && this.map !== null;
    },

    // ============================================================
    // UPDATE USER LOCATION
    // ============================================================
    updateUserLocation(lat, lng) {
        if (!this.isReady()) return;
        
        this.currentLat = lat;
        this.currentLng = lng;

        if (this.userMarker) {
            this.userMarker.setLatLng([lat, lng]);
        }
        this.map.panTo([lat, lng]);
    },

    centerToUser() {
        if (!this.isReady() || this.currentLat === null || this.currentLng === null) return;
        this.map.setView([this.currentLat, this.currentLng], this.currentZoom);
    },

    // ============================================================
    // DESTINATION MANAGEMENT
    // ============================================================
    setDestination(lat, lng, name = "Destination") {
        if (!this.isReady()) return;

        this.destination = { lat, lng, name };

        if (this.destinationMarker) {
            this.map.removeLayer(this.destinationMarker);
        }

        this.destinationMarker = L.marker([lat, lng], { title: name }).addTo(this.map);
        this.destinationMarker.bindPopup(`🎯 ${name}`);
    },

    clearDestination() {
        if (this.destinationMarker) {
            this.map.removeLayer(this.destinationMarker);
            this.destinationMarker = null;
        }
        this.destination = null;
    },

    // ============================================================
    // REFRESH & GETTERS
    // ============================================================
    refreshMap() {
        if (!this.isReady()) return;
        setTimeout(() => { this.map.invalidateSize(); }, 200);
    },

    getCurrentLocation() {
        return { lat: this.currentLat, lng: this.currentLng };
    },

    getDestination() {
        return this.destination;
    },

    // ============================================================
    // GEOCODE SEARCH (Nominatim API)
    // ============================================================
    async geocodeSearch(placeName) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(placeName)}`;
        const response = await fetch(url, { headers: { "Accept-Language": "km,en" } });
        const results = await response.json();

        if (!results || results.length === 0) {
            throw new Error("Location not found.");
        }

        return {
            lat: parseFloat(results[0].lat),
            lng: parseFloat(results[0].lon),
            name: results[0].display_name
        };
    },

    // ============================================================
    // GET ROUTE (OSRM API)
    // ============================================================
    async getRoute(originLat, originLng, destLat, destLng) {
        const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&steps=true&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
            throw new Error("Unable to calculate route.");
        }

        const route = data.routes[0];
        return {
            distanceKm: (route.distance / 1000).toFixed(1),
            durationMin: Math.round(route.duration / 60),
            coordinates: route.geometry.coordinates.map(point => [point[1], point[0]]),
            steps: route.legs[0].steps
        };
    },

    buildRouteSummary(route) {
        return {
            distance: `${route.distanceKm} km`,
            duration: `${route.durationMin} min`,
            steps: route.steps.length
        };
    },

    hasRoute(route) {
        return (route && route.coordinates && route.coordinates.length > 0);
    },

    // ============================================================
    // DRAW & CLEAR ROUTE
    // ============================================================
    drawRoute(routeCoordinates, destLat, destLng) {
        if (!this.isReady()) return;

        this.clearRoute(); // លុបផ្លូវចាស់សិនមុននឹងគូសថ្មី

        this.routeLine = L.polyline(routeCoordinates, {
            color: "#4dabf7",
            weight: 6,
            opacity: 0.9
        }).addTo(this.map);

        this.destinationMarker = L.marker([destLat, destLng]).addTo(this.map);
        this.destinationMarker.bindPopup("📍 Destination");

        this.fitRoute();
    },

    clearRoute() {
        if (!this.map) return;
        
        if (this.routeLine) {
            this.map.removeLayer(this.routeLine);
            this.routeLine = null;
        }
        if (this.destinationMarker) {
            this.map.removeLayer(this.destinationMarker);
            this.destinationMarker = null;
        }
    },

    fitRoute() {
        if (!this.routeLine) return;
        this.map.fitBounds(this.routeLine.getBounds(), { padding: [40, 40] });
    },

    // ============================================================
    // TRANSLATE MANEUVER (បកប្រែការណែនាំផ្លូវ)
    // ============================================================
    translateManeuver(maneuver) {
        const type = maneuver.type;
        const modifier = maneuver.modifier || "";

        if (type === "depart") return "ចាប់ផ្តើមធ្វើដំណើរ";
        if (type === "arrive") return "អ្នកបានមកដល់គោលដៅ";
        
        if (type === "turn") {
            if (modifier.includes("left")) return "បត់ឆ្វេង";
            if (modifier.includes("right")) return "បត់ស្តាំ";
            return "បត់";
        }
        
        if (type === "continue") return "បន្តទៅត្រង់";
        if (type === "roundabout") return "ចូលរង្វង់មូល";

        return "បន្តទៅមុខ";
    },

    highlightCurrentStep(step) {
        if (!step) return;
        console.log("Current Step:", step.instruction);
    },

    // ============================================================
    // DESTROY MAP
    // ============================================================
    destroy() {
        this.clearRoute();
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
            this.userMarker = null;
        }
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
        this.initialized = false;
        console.log("[KhoemMap] Destroyed");
    }
};

// ============================================================================
// EXPORT TO WINDOW (GLOBAL)
// ============================================================================
window.KhoemMap = KhoemMap;
