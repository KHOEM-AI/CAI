// ============================================================================
// FILE: static/js/gps.js
// PROJECT : KHOEM_AI 3.0
// MODULE  : GPS Engine
// VERSION : 3.0
// AUTHOR  : KHOEM SOKSIVUTHA
// ============================================================================

"use strict";

const KhoemGPS = {
    // ============================================================
    // GPS STATE & INFO
    // ============================================================
    initialized: false,
    watchId: null,
    tracking: false,
    permission: "prompt",
    
    currentPosition: null,
    previousPosition: null,
    history: [],

    latitude: null,
    longitude: null,
    altitude: null,
    accuracy: null,
    heading: null,
    speed: 0,
    timestamp: null,

    // ============================================================
    // SETTINGS
    // ============================================================
    settings: {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
        autoSpeak: true,
        saveHistory: true,
        maxHistory: 500
    },

    // ============================================================
    // CALLBACKS
    // ============================================================
    onLocationUpdate: null,
    onTrackingStart: null,
    onTrackingStop: null,
    onPermissionDenied: null,
    onError: null,

    // ============================================================
    // INITIALIZE & SETTINGS
    // ============================================================
    init() {
        if (!navigator.geolocation) {
            console.error("[KhoemGPS] GPS not supported by this browser.");
            return false;
        }
        this.loadSettings();
        this.initialized = true;
        console.log("[KhoemGPS] Initialized successfully.");
        return true;
    },

    loadSettings() {
        const saved = localStorage.getItem("khoem_gps_settings");
        if (saved) {
            try {
                Object.assign(this.settings, JSON.parse(saved));
            } catch (e) {
                console.warn("[KhoemGPS] Settings load failed", e);
            }
        }
    },

    saveSettings() {
        localStorage.setItem("khoem_gps_settings", JSON.stringify(this.settings));
    },

    // ============================================================
    // PERMISSION & CORE LOCATION
    // ============================================================
    async requestPermission() {
        if (!navigator.permissions) return true;
        try {
            const result = await navigator.permissions.query({ name: "geolocation" });
            this.permission = result.state;
            return result.state !== "denied";
        } catch (error) {
            console.error("[KhoemGPS] Permission error:", error);
            return true; // Fallback
        }
    },

    getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject("GPS not supported");
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.updateCurrentPosition(position);
                    resolve(this.currentPosition);
                },
                (error) => {
                    if (this.onError) this.onError(error);
                    reject(error);
                },
                this.settings
            );
        });
    },

    updateCurrentPosition(position) {
        this.previousPosition = this.currentPosition;
        this.currentPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || null,
            heading: position.coords.heading || null,
            speed: position.coords.speed || 0,
            timestamp: position.timestamp
        };

        // Update root state
        this.latitude = this.currentPosition.lat;
        this.longitude = this.currentPosition.lng;
        this.accuracy = this.currentPosition.accuracy;
        this.altitude = this.currentPosition.altitude;
        this.heading = this.currentPosition.heading;
        this.speed = this.currentPosition.speed;
        this.timestamp = this.currentPosition.timestamp;

        // History Management
        if (this.settings.saveHistory) {
            this.history.push(this.currentPosition);
            if (this.history.length > this.settings.maxHistory) {
                this.history.shift();
            }
        }

        // Cache last location
        localStorage.setItem("khoem_last_location", JSON.stringify(this.currentPosition));

        // Fire callback if assigned
        if (typeof this.onLocationUpdate === "function") {
            this.onLocationUpdate(this.currentPosition);
        }
    },

    restoreLastLocation() {
        const saved = localStorage.getItem("khoem_last_location");
        if (!saved) return null;
        try {
            this.currentPosition = JSON.parse(saved);
            return this.currentPosition;
        } catch {
            return null;
        }
    },

    // ============================================================
    // MATH & CALCULATIONS (Haversine & Bearing)
    // ============================================================
    toRadians(value) {
        return value * Math.PI / 180;
    },

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Radius of Earth in meters
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    calculateBearing(lat1, lng1, lat2, lng2) {
        const y = Math.sin(this.toRadians(lng2 - lng1)) * Math.cos(this.toRadians(lat2));
        const x = Math.cos(this.toRadians(lat1)) * Math.sin(this.toRadians(lat2)) -
                  Math.sin(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.cos(this.toRadians(lng2 - lng1));
        const brng = Math.atan2(y, x) * 180 / Math.PI;
        return (brng + 360) % 360;
    },

    hasReachedDestination(destLat, destLng, toleranceMeters = 20) {
        if (!this.currentPosition) return false;
        const distance = this.calculateDistance(this.currentPosition.lat, this.currentPosition.lng, destLat, destLng);
        return distance <= toleranceMeters;
    },

    // ============================================================
    // UTILITIES
    // ============================================================
    getSpeed() {
        return this.currentPosition ? (this.currentPosition.speed || 0) : 0;
    },

    getAccuracy() {
        return this.currentPosition ? this.currentPosition.accuracy : null;
    },

    formatCoordinates() {
        if (!this.currentPosition) return "";
        return `${this.currentPosition.lat.toFixed(6)}, ${this.currentPosition.lng.toFixed(6)}`;
    },

    isAvailable() {
        return !!navigator.geolocation;
    },

    isTracking() {
        return this.tracking;
    },

    getHistory() {
        return this.history;
    },

    clearHistory() {
        this.history = [];
    },

    // ============================================================
    // LIVE TRACKING (WATCH POSITION)
    // ============================================================
    
    // Alias សម្រាប់ឱ្យត្រូវនឹង app.js ពេលហៅ KhoemGPS.watchPosition(callback)
    watchPosition(callback) {
        if (typeof callback === "function") {
            this.onLocationUpdate = callback;
        }
        return this.startTracking();
    },

    startTracking() {
        if (!navigator.geolocation) return false;
        if (this.tracking) return true;

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.updateCurrentPosition(position);
            },
            (error) => {
                console.error("[KhoemGPS] Tracking Error:", error);
                if (typeof this.onError === "function") this.onError(error);
            },
            this.settings
        );

        this.tracking = true;
        if (typeof this.onTrackingStart === "function") this.onTrackingStart();
        return true;
    },

    stopTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.tracking = false;
        if (typeof this.onTrackingStop === "function") this.onTrackingStop();
    },

    // ============================================================
    // RESET & DESTROY
    // ============================================================
    reset() {
        this.stopTracking();
        this.currentPosition = null;
        this.previousPosition = null;
        this.latitude = null;
        this.longitude = null;
        this.altitude = null;
        this.heading = null;
        this.speed = 0;
        this.accuracy = null;
        this.timestamp = null;
        this.history = [];
    },

    destroy() {
        this.reset();
        this.initialized = false;
        console.log("[KhoemGPS] Destroyed");
    }
};

// Expose to window for global access
window.KhoemGPS = KhoemGPS;

// Initialize on load
KhoemGPS.init();
