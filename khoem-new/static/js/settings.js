// ============================================================================
// FILE: static/js/settings.js
// PROJECT : KHOEM_AI 3.0
// MODULE  : Settings Manager
// VERSION : 3.0
// AUTHOR  : KHOEM SOKSIVUTHA
// ============================================================================
//
// RESPONSIBILITIES
// ----------------
// ✓ Voice Settings
// ✓ Theme Settings
// ✓ Font Settings
// ✓ GPS Settings
// ✓ Camera Settings
// ✓ Language Settings
// ✓ Accessibility
// ✓ LocalStorage
//
// CONNECTED MODULES
// -----------------
// ✓ voice.js
// ✓ app.js
// ✓ gps.js
// ✓ camera.js
// ✓ index.html
//
// ============================================================================

const KhoemSettings = {

    // ============================================================
    // MODULE INFO
    // ============================================================

    version: "3.0",

    initialized: false,

    storageKey: "khoem_ai_settings",

    // ============================================================
    // DEFAULT SETTINGS
    // ============================================================

    settings: {

        language: "km",

        theme: "dark",

        fontSize: 16,

        voiceEnabled: true,

        autoRead: true,

        voiceProfile: 0,

        volume: 1.0,

        rate: 1.0,

        pitch: 1.0,

        gpsEnabled: true,

        cameraEnabled: true,

        notifications: true,

        vibration: true

    },

      // ============================================================
    // INITIALIZE
    // ============================================================

    init() {

        this.load();

        this.initialized = true;

        console.log(

            "KhoemSettings initialized"

        );

        return true;

    },

    // ============================================================
    // CHECK READY
    // ============================================================

    isReady() {

        return this.initialized;

    },

    // ============================================================
    // GET ALL SETTINGS
    // ============================================================

    getAll() {

        return this.settings;

    },

    // ============================================================
    // GET VALUE
    // ============================================================

    get(key) {

        return this.settings[key];

    },

    // ============================================================
    // SET VALUE
    // ============================================================

    set(key, value) {

        this.settings[key] = value;

        this.save();

    },

    // ============================================================
    // RESET DEFAULT
    // ============================================================

    reset() {

        this.settings = {

            language: "km",

            theme: "dark",

            fontSize: 16,

            voiceEnabled: true,

            autoRead: true,

            voiceProfile: 0,

            volume: 1.0,

            rate: 1.0,

            pitch: 1.0,

            gpsEnabled: true,

            cameraEnabled: true,

            notifications: true,

            vibration: true

        };

        this.save();

    },

    // ============================================================
    // LOAD SETTINGS FROM LOCAL STORAGE
    // ============================================================

    load() {

        try {

            const data = localStorage.getItem(

                this.storageKey

            );

            if (!data) {

                return false;

            }

            const saved = JSON.parse(data);

            this.settings = {

                ...this.settings,

                ...saved

            };

            return true;

        }

        catch (error) {

            console.error(error);

            return false;

        }

    },

    // ============================================================
    // SAVE SETTINGS TO LOCAL STORAGE
    // ============================================================

    save() {

        try {

            localStorage.setItem(

                this.storageKey,

                JSON.stringify(this.settings)

            );

            return true;

        }

        catch (error) {

            console.error(error);

            return false;

        }

    },

    // ============================================================
    // REMOVE ALL SETTINGS
    // ============================================================

    clear() {

        try {

            localStorage.removeItem(

                this.storageKey

            );

            return true;

        }

        catch (error) {

            console.error(error);

            return false;

        }

    },

    // ============================================================
    // EXPORT SETTINGS
    // ============================================================

    exportSettings() {

        return JSON.stringify(

            this.settings,

            null,

            2

        );

    },

    // ============================================================
    // IMPORT SETTINGS
    // ============================================================

    importSettings(jsonText) {

        try {

            const data = JSON.parse(jsonText);

            this.settings = {

                ...this.settings,

                ...data

            };

            this.save();

            return true;

        }

        catch (error) {

            console.error(error);

            return false;

        }

    },

    // ============================================================
    // CHECK STORAGE SUPPORT
    // ============================================================

    storageSupported() {

        try {

            const key = "__khoem_test__";

            localStorage.setItem(key, "1");

            localStorage.removeItem(key);

            return true;

        }

        catch (error) {

            return false;

        }

    },

    // ============================================================
    // APPLY THEME
    // ============================================================

    applyTheme() {

        document.body.classList.remove(

            "light",

            "dark"

        );

        document.body.classList.add(

            this.settings.theme

        );

    },

    // ============================================================
    // CHANGE THEME
    // ============================================================

    setTheme(theme) {

        this.settings.theme = theme;

        this.applyTheme();

        this.save();

    },

    // ============================================================
    // APPLY FONT SIZE
    // ============================================================

    applyFontSize() {

        document.documentElement.style.fontSize =

            this.settings.fontSize + "px";

    },

    // ============================================================
    // SET FONT SIZE
    // ============================================================

    setFontSize(size) {

        this.settings.fontSize = size;

        this.applyFontSize();

        this.save();

    },

    // ============================================================
    // APPLY VOICE SETTINGS
    // ============================================================

    applyVoice() {

        if (!window.KhoemVoice) {

            return;

        }

        KhoemVoice.enabled =

            this.settings.voiceEnabled;

        KhoemVoice.autoRead =

            this.settings.autoRead;

        KhoemVoice.volume =

            this.settings.volume;

        KhoemVoice.rate =

            this.settings.rate;

        KhoemVoice.pitch =

            this.settings.pitch;

    },

    // ============================================================
    // ENABLE / DISABLE VOICE
    // ============================================================

    setVoiceEnabled(enable) {

        this.settings.voiceEnabled = enable;

        this.applyVoice();

        this.save();

    },

    // ============================================================
    // AUTO READ
    // ============================================================

    setAutoRead(enable) {

        this.settings.autoRead = enable;

        this.applyVoice();

        this.save();

    },

    // ============================================================
    // APPLY LANGUAGE
    // ============================================================

    applyLanguage() {

        document.documentElement.lang =

            this.settings.language;

    },

    // ============================================================
    // CHANGE LANGUAGE
    // ============================================================

    setLanguage(language) {

        this.settings.language = language;

        this.applyLanguage();

        this.save();

    },

    // ============================================================
    // ACCESSIBILITY
    // ============================================================

    applyAccessibility() {

        document.body.classList.toggle(

            "large-text",

            this.settings.fontSize >= 20

        );

    },

    // ============================================================
    // APPLY ALL SETTINGS
    // ============================================================

    applyAll() {

        this.applyTheme();

        this.applyFontSize();

        this.applyVoice();

        this.applyLanguage();

        this.applyAccessibility();

    },

    // ============================================================
    // APPLY GPS SETTINGS
    // ============================================================

    applyGPS() {

        if (!window.KhoemGPS) {

            return;

        }

        if (!this.settings.gpsEnabled) {

            KhoemGPS.stopWatching?.();

        }

    },

    // ============================================================
    // ENABLE / DISABLE GPS
    // ============================================================

    setGPSEnabled(enable) {

        this.settings.gpsEnabled = enable;

        this.applyGPS();

        this.save();

    },

    // ============================================================
    // APPLY CAMERA SETTINGS
    // ============================================================

    applyCamera() {

        if (!window.KhoemCamera) {

            return;

        }

    },

    // ============================================================
    // ENABLE / DISABLE CAMERA
    // ============================================================

    setCameraEnabled(enable) {

        this.settings.cameraEnabled = enable;

        this.applyCamera();

        this.save();

    },

    // ============================================================
    // APPLY EVERY MODULE
    // ============================================================

    apply() {

        this.applyAll();

        this.applyGPS();

        this.applyCamera();

    },

    // ============================================================
    // DESTROY
    // ============================================================

    destroy() {

        this.initialized = false;

        console.log("KhoemSettings destroyed");

    }

};

// ============================================================
// EVENT LISTENERS
// ============================================================

window.addEventListener("load", () => {

    KhoemSettings.init();

    KhoemSettings.apply();

});

// ============================================================
// EXPORT
// ============================================================

window.KhoemSettings = KhoemSettings;    
