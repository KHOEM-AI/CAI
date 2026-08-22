// ==============================================================================
// KHOEM_AI 3.0
// File : static/js/navigator.js
// Module : Navigation Core (Parts 1-4 merged, syntax + naming fixed)
// ==============================================================================

const KhoemNavigator = {

    // =====================================================
    // SYSTEM INFORMATION
    // =====================================================

    version: "3.0",
    initialized: false,
    map: null,
    route: null,
    watchId: null,
    voiceEnabled: true,
    navigating: false,
    currentLocation: null,
    destination: null,
    destinationName: "",
    lastDistance: null,
    lastDuration: null,
    rerouteCount: 0,
    autoCenter: true,
    routeCoordinates: [],
    favoritePlaces: [],
    history: [],
    instructions: [],
    currentInstructionIndex: 0,
    navigationTimer: null,
    userMarker: null,
    destinationMarker: null,
    onPositionUpdate: null,

    settings: {
        voiceGuidance: true,
        vibration: true,
        autoReroute: true,
        autoCenter: true,
        announceArrival: true,
        distanceUnit: "km"
    },

    // =====================================================
    // INITIALIZE
    // =====================================================

    init(mapInstance) {
        this.map = mapInstance;
        this.initialized = true;
        console.log("Navigator initialized.");
    },

    // ============================================================================
    // PART 2: Route Management + Distance + ETA + Arrival Detection
    // ============================================================================

    // ចម្ងាយ (Haversine Formula)
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    updateNavigation() {
        if (!this.currentLocation) return;
        if (!this.destination) return;

        const distance = this.calculateDistance(
            this.currentLocation[0], this.currentLocation[1],
            this.destination[0], this.destination[1]
        );

        this.remainingDistance = distance;
        this.updateETA(distance);
        this.checkArrival(distance);
    },

    updateETA(distance) {
        const speed = 1.4; // m/s ដើរដោយថ្មើរជើង
        const sec = distance / speed;
        this.etaMinutes = Math.round(sec / 60);
    },

    checkArrival(distance) {
        if (distance <= 15) {
            this.speak("អ្នកបានទៅដល់គោលដៅហើយ");
            this.clearRoute();
        }
    },

    getNavigationInfo() {
        return {
            currentLocation: this.currentLocation,
            destination: this.destination,
            remainingDistance: this.remainingDistance,
            etaMinutes: this.etaMinutes,
            gpsRunning: this.watchId !== null
        };
    },

    isNavigating() {
        return this.destination !== null;
    },

    clearRoute() {
        this.route = null;
        this.routeCoordinates = [];
        this.navigating = false;
    },

    stopGPS() {
        if (this.watchId !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        this.watchId = null;
    },

    // តាមដានទីតាំងជាបន្តបន្ទាប់ (មិនធ្លាប់ implement ក្នុងកូដដើម)
    watchPosition() {
        if (!navigator.geolocation) return;

        this.watchId = navigator.geolocation.watchPosition(
            (pos) => {
                this.currentLocation = [pos.coords.latitude, pos.coords.longitude];
            },
            (err) => console.error("[Navigator] GPS error:", err),
            { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
        );
    },

    resumeGPS() {
        if (!this.map) return;
        this.init(this.map);
    },

    // ============================================================================
    // PART 3: Turn-by-Turn Navigation + Voice Guidance + Engine Loop
    // ============================================================================

    announceInstruction(text) {
        if (!text) return;
        console.log("[Navigator]", text);
        this.speak(text);
    },

    setInstructions(instructions = []) {
        this.instructions = instructions;
        this.currentInstructionIndex = 0;
    },

    getCurrentInstruction() {
        if (!this.instructions) return null;
        return this.instructions[this.currentInstructionIndex] || null;
    },

    nextInstruction() {
        if (!this.instructions) return;
        this.currentInstructionIndex++;
        if (this.currentInstructionIndex >= this.instructions.length) {
            this.currentInstructionIndex = this.instructions.length - 1;
        }
    },

    checkInstructionProgress() {
        const instruction = this.getCurrentInstruction();
        if (!instruction || !this.currentLocation) return;

        const distance = this.calculateDistance(
            this.currentLocation[0], this.currentLocation[1],
            instruction.lat, instruction.lng
        );

        if (distance <= 30) {
            this.announceInstruction(instruction.text);
            this.nextInstruction();
        }
    },

    checkOffRoute() {
        if (!this.currentLocation) return;
        if (!this.destination) return;

        const distance = this.calculateDistance(
            this.currentLocation[0], this.currentLocation[1],
            this.destination[0], this.destination[1]
        );

        if (distance > 5000) {
            this.announceInstruction("កំពុងគណនាផ្លូវថ្មី...");

            if (window.KhoemMap && typeof KhoemMap.recalculateRoute === "function") {
                KhoemMap.recalculateRoute(
                    this.currentLocation[0], this.currentLocation[1],
                    this.destination[0], this.destination[1]
                );
            }
        }
    },

    navigationLoop() {
        this.updateNavigation();
        this.checkInstructionProgress();
        this.checkOffRoute();

        // ជូនដំណឹងទីតាំងថ្មីទៅ callback (index.html ប្រើដើម្បីធ្វើ update លើផែនទី)
        if (typeof this.onPositionUpdate === "function" && this.currentLocation) {
            this.onPositionUpdate({
                lat: this.currentLocation[0],
                lng: this.currentLocation[1]
            });
        }
    },

    startNavigationEngine() {
        this.stopNavigationEngine();
        this.navigationTimer = setInterval(() => {
            this.navigationLoop();
        }, 3000);
    },

    stopNavigationEngine() {
        if (this.navigationTimer) {
            clearInterval(this.navigationTimer);
            this.navigationTimer = null;
        }
    },

    // -------------------------------------------------------------------
    // Public API — ត្រូវនឹងអ្វីដែល index.html ហៅ៖
    //   KhoemNavigator.start(route, (pos) => { ... })
    //   KhoemNavigator.stop()
    // -------------------------------------------------------------------
    start(route, onPositionUpdate) {
        this.route = route;
        this.routeCoordinates = route?.coordinates || [];
        this.onPositionUpdate = onPositionUpdate || null;
        this.navigating = true;

        this.watchPosition();

        if (!this.currentLocation) {
            this.speak("កំពុងរង់ចាំសញ្ញា GPS");
        } else {
            this.speak("ចាប់ផ្តើមការនាំផ្លូវ");
        }

        this.startNavigationEngine();
    },

    stop() {
        this.stopNavigationEngine();
        this.stopGPS();
        this.clearRoute();
        this.navigating = false;
    },

    // ============================================================================
    // PART 4: Destination Manager + Voice Guidance + Cleanup
    // ============================================================================

    hasDestination() {
        return this.destination !== null;
    },

    removeDestination() {
        this.destination = null;

        if (this.destinationMarker && this.map) {
            this.map.removeLayer(this.destinationMarker);
            this.destinationMarker = null;
        }

        this.clearRoute();
    },

    speak(text) {
        if (!this.voiceEnabled) return;
        if (window.KhoemVoice) {
            KhoemVoice.speak(text);
        }
    },

    mute() {
        this.voiceEnabled = false;
    },

    unmute() {
        this.voiceEnabled = true;
    },

    toggleVoice() {
        this.voiceEnabled = !this.voiceEnabled;
        return this.voiceEnabled;
    },

    isRunning() {
        return this.watchId !== null;
    },

    getCurrentLocation() {
        return this.currentLocation;
    },

    getDestination() {
        return this.destination;
    },

    reset() {
        this.stopNavigationEngine();
        this.stopGPS();
        this.clearRoute();

        if (this.userMarker && this.map) {
            this.map.removeLayer(this.userMarker);
            this.userMarker = null;
        }

        if (this.destinationMarker && this.map) {
            this.map.removeLayer(this.destinationMarker);
            this.destinationMarker = null;
        }

        this.currentLocation = null;
        this.destination = null;
        this.destinationName = "";
        this.lastDistance = null;
        this.lastDuration = null;
        this.rerouteCount = 0;

        console.log("Navigator Reset");
    },

    destroy() {
        this.reset();
        this.map = null;
        console.log("Navigator Destroyed");
    }

};

// ============================================================================
// GLOBAL EXPORT
// ============================================================================

window.KhoemNavigator = KhoemNavigator;
console.log("Navigator 3.0 Loaded");

