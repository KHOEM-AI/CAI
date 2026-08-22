// ==============================================================================
// KHOEM_AI 3.0 - Core Frontend Controller (Cleaned & Optimized)
// File : static/js/app.js
// ==============================================================================

"use strict";

const APP = {
    name: "KHOEM_AI",
    version: "3.0",
    build: "2026.01",
    author: "KHOEM SOKSIVUTHA"
};

const sessionId = "session_" + Math.random().toString(36).substring(2, 10);

const AppState = {
    initialized: false,
    loading: false,
    voiceReady: false,
    mapReady: false,
    gpsReady: false,
    navigatorReady: false,
    cameraReady: false,
    pendingImage: null
};

// ==============================================================================
// DOM Elements (UI Mapping)
// ==============================================================================

const UI = {
    chatBox: document.getElementById("chat-box"),
    userInput: document.getElementById("user-input"),
    sendButton: document.getElementById("send-btn"),
    micButton: document.getElementById("mic-btn"),
    cameraInput: document.getElementById("camera-input"),
    imagePreview: document.getElementById("image-preview"),
    imagePreviewRow: document.getElementById("image-preview-row"),
    imageName: document.getElementById("image-name"),
    clearImage: document.getElementById("clear-image-btn"),
    map: document.getElementById("map-container"),
    routeInfo: document.getElementById("route-info"),
    locationStatus: document.getElementById("location-status")
};

// Aliases for smooth compatibility with existing functions
const chatBox = UI.chatBox;
const userInput = UI.userInput;
const sendBtn = UI.sendButton;
const micBtn = UI.micButton;
const cameraInput = UI.cameraInput;
const imagePreview = UI.imagePreview;
const imagePreviewRow = UI.imagePreviewRow;
const imageName = UI.imageName;
const clearImageBtn = UI.clearImage;
const mapContainer = UI.map;
const routeInfo = UI.routeInfo;
const locationStatus = UI.locationStatus;

// ==============================================================================
// Utility Functions
// ==============================================================================

function log(message) {
    console.log("[KHOEM_AI]", message);
}

function setLoading(status) {
    AppState.loading = status;
}

function isReady() {
    return AppState.initialized;
}

// ======================================================================
// CHAT & TYPING UTILITIES
// ======================================================================

function addMessage(role, text) {
    if (!chatBox) return;
    const message = document.createElement("div");
    message.className = `msg ${role}`;
    message.innerHTML = `
        <div class="msg-content">
            ${text}
        </div>
    `;
    chatBox.appendChild(message);
    chatBox.scrollTop = chatBox.scrollHeight;
}

let typingElement = null;

function showTyping() {
    hideTyping();
    if (!chatBox) return;
    typingElement = document.createElement("div");
    typingElement.className = "msg assistant typing";
    typingElement.innerHTML = `
        <div class="msg-content">
            KHOEM_AI is typing...
        </div>
    `;
    chatBox.appendChild(typingElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function hideTyping() {
    if (typingElement) {
        typingElement.remove();
        typingElement = null;
    }
}

function speakIfEnabled(text) {
    if (!window.KhoemVoice) return;
    if (!KhoemVoice.settings.voiceEnabled) return;
    if (!KhoemVoice.settings.autoRead) return;
    KhoemVoice.speak(text);
}

// ======================================================================
// MAIN SEND MESSAGE LOGIC
// ======================================================================

function sendMessage(transcriptText = null) {
    const text = transcriptText || userInput.value.trim();

    if (!text && !hasPendingImage()) return;

    // ករណីมีផ្ញើរូបភាព (Vision API)
    if (hasPendingImage()) {
        const image = pendingImageBase64;
        const mime = pendingMimeType;
        clearImage();
        addMessage("user", text || "ផ្ញើរូបភាព");
        sendImageMessageWithData(image, mime, text || "តើនេះជារូបភាពអ្វី?");
        userInput.value = "";
        return;
    }

    // ករណីផ្ញើសារអក្សរធម្មតា
    addMessage("user", text);
    userInput.value = "";
    showTyping();

    fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
    })
    .then(response => response.json())
    .then(data => {
        hideTyping();
        if (data.answer) {
            addMessage("assistant", data.answer);
            speakIfEnabled(data.answer);
        } else {
            addMessage("assistant", "មិនមានចម្លើយពី Server ទេក្ដី។");
        }
    })
    .catch(error => {
        hideTyping();
        addMessage("assistant", "មានបញ្ហាក្នុងការតភ្ជាប់ជាមួយ Server។");
        console.error(error);
    });
}

// Event Listeners for Sending
if (sendBtn) {
    sendBtn.addEventListener("click", () => sendMessage());
}

if (userInput) {
    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            sendMessage();
        }
    });
}

// ======================================================================
// VOICE UI & INITIALIZATION
// ======================================================================

const voiceToggleBtn = document.getElementById("voice-toggle");
const autoReadBtn = document.getElementById("auto-read");
const voiceProfile = document.getElementById("voice-profile");
const voiceSelect = document.getElementById("voice-select");
const volumeSlider = document.getElementById("volume-slider");
const speedSlider = document.getElementById("speed-slider");
const pitchSlider = document.getElementById("pitch-slider");
const voiceTestBtn = document.getElementById("voice-test");
const saveVoiceBtn = document.getElementById("save-voice");

let voiceReady = false;
if (window.KhoemVoice) {
    voiceReady = KhoemVoice.initRecognition(
        (transcript) => {
            if (micBtn) micBtn.classList.remove("listening");
            sendMessage(transcript);
        },
        (error) => {
            if (micBtn) micBtn.classList.remove("listening");
            addMessage("assistant", error);
        }
    );
}

if (micBtn) {
    micBtn.addEventListener("click", () => {
        if (!voiceReady) {
            addMessage("assistant", "Voice Recognition unavailable.");
            return;
        }
        micBtn.classList.add("listening");
        KhoemVoice.startListening();
    });
}

function loadVoiceOptions() {
    if (!window.KhoemVoice || !voiceSelect) return;
    const voices = KhoemVoice.getVoiceOptions();
    voiceSelect.innerHTML = "";
    voices.forEach((voice) => {
        const option = document.createElement("option");
        option.value = voice.index;
        option.textContent = `${voice.name} (${voice.lang})`;
        voiceSelect.appendChild(option);
    });
}
setTimeout(loadVoiceOptions, 500);

if (voiceSelect) {
    voiceSelect.addEventListener("change", (e) => {
        if (window.KhoemVoice) KhoemVoice.setVoice(parseInt(e.target.value));
    });
}

if (voiceProfile) {
    voiceProfile.addEventListener("change", (e) => {
        if (window.KhoemVoice) KhoemVoice.setProfile(e.target.value);
    });
}

if (voiceToggleBtn) {
    voiceToggleBtn.addEventListener("click", () => {
        if (window.KhoemVoice) KhoemVoice.toggleVoice();
    });
}

if (autoReadBtn) {
    autoReadBtn.addEventListener("click", () => {
        if (window.KhoemVoice) KhoemVoice.toggleAutoRead();
    });
}

if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) => {
        if (window.KhoemVoice) KhoemVoice.settings.volume = parseFloat(e.target.value);
    });
}

if (speedSlider) {
    speedSlider.addEventListener("input", (e) => {
        if (window.KhoemVoice) KhoemVoice.settings.rate = parseFloat(e.target.value);
    });
}

if (pitchSlider) {
    pitchSlider.addEventListener("input", (e) => {
        if (window.KhoemVoice) KhoemVoice.settings.pitch = parseFloat(e.target.value);
    });
}

if (voiceTestBtn) {
    voiceTestBtn.addEventListener("click", () => {
        if (window.KhoemVoice) KhoemVoice.speak("សួស្តី! នេះគឺជាការសាកល្បងសំឡេងរបស់ KHOEM AI។");
    });
}

if (saveVoiceBtn) {
    saveVoiceBtn.addEventListener("click", () => {
        if (window.KhoemVoice) {
            KhoemVoice.saveSettings();
            addMessage("assistant", "Voice settings saved.");
        }
    });
}

function restoreVoiceSettings() {
    if (!window.KhoemVoice) return;
    const s = KhoemVoice.settings;
    if (volumeSlider) volumeSlider.value = s.volume;
    if (speedSlider) speedSlider.value = s.rate;
    if (pitchSlider) pitchSlider.value = s.pitch;
}
restoreVoiceSettings();

// ======================================================================
// CAMERA & VISION MODULE
// ======================================================================

let pendingImageBase64 = null;
let pendingMimeType = "image/jpeg";

function clearImage() {
    pendingImageBase64 = null;
    pendingMimeType = "image/jpeg";
    if (imagePreview) imagePreview.src = "";
    if (imageName) imageName.textContent = "";
    if (imagePreviewRow) imagePreviewRow.style.display = "none";
    if (cameraInput) cameraInput.value = "";
}

if (clearImageBtn) {
    clearImageBtn.addEventListener("click", clearImage);
}

if (cameraInput) {
    cameraInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!window.KhoemCamera) {
            addMessage("assistant", "Camera module unavailable.");
            return;
        }

        pendingMimeType = file.type;
        pendingImageBase64 = await KhoemCamera.fileToBase64(file);

        if (imagePreview) {
            imagePreview.src = `data:${file.type};base64,${pendingImageBase64}`;
        }
        if (imageName) {
            imageName.textContent = file.name;
        }
        if (imagePreviewRow) {
            imagePreviewRow.style.display = "flex";
        }
    });
}

function hasPendingImage() {
    return (pendingImageBase64 !== null);
}

async function sendImageMessageWithData(image, mime, question) {
    showTyping();
    try {
        const response = await fetch("/api/vision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                image: image,
                question: question,
                mime_type: mime
            })
        });

        const data = await response.json();
        hideTyping();

        if (data.answer) {
            addMessage("assistant", data.answer);
            speakIfEnabled(data.answer);
        } else {
            addMessage("assistant", "Vision failed.");
        }
    } catch (error) {
        hideTyping();
        addMessage("assistant", "Vision API Error.");
        console.error(error);
    }
}

// ======================================================================
// GPS & MAP MODULE
// ======================================================================

let mapInitialized = false;
let currentLocation = null;

async function getCurrentLocation() {
    try {
        if (!window.KhoemGPS) return null;
        const position = await KhoemGPS.getCurrentLocation();
        currentLocation = position;
        return position;
    } catch (error) {
        addMessage("assistant", "មិនអាចរកទីតាំងបានទេ។");
        return null;
    }
}

async function showCurrentLocation() {
    try {
        if (locationStatus) {
            locationStatus.style.display = "block";
            locationStatus.textContent = "Searching GPS...";
        }

        const position = await getCurrentLocation();
        if (!position) return;

        if (locationStatus) {
            locationStatus.textContent = `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
        }

        if (mapContainer) {
            mapContainer.style.display = "block";
        }

        if (window.KhoemMap) {
            if (!mapInitialized) {
                KhoemMap.init("map-container", position.lat, position.lng);
                mapInitialized = true;
            } else {
                KhoemMap.updateUserLocation(position.lat, position.lng);
            }
        }
    } catch (error) {
        if (locationStatus) locationStatus.textContent = "GPS unavailable";
        console.error(error);
    }
}

const locationBtnElement = document.querySelector('[data-action="location"]');
if (locationBtnElement) {
    locationBtnElement.addEventListener("click", async () => {
        await showCurrentLocation();
    });
}

function startGpsTracking() {
    if (window.KhoemGPS && window.KhoemMap) {
        KhoemGPS.watchPosition((position) => {
            currentLocation = position;
            if (mapInitialized) {
                KhoemMap.updateUserLocation(position.lat, position.lng);
            }
        });
    }
}

async function startNavigation(destination) {
    try {
        if (routeInfo) {
            routeInfo.style.display = "block";
            routeInfo.textContent = "Searching route...";
        }

        if (!KhoemGPS.currentPosition) {
            await KhoemGPS.getCurrentLocation();
        }

        const current = KhoemGPS.currentPosition;
        const dest = await KhoemMap.geocodeSearch(destination);
        const route = await KhoemMap.getRoute(current.lat, current.lng, dest.lat, dest.lng);

        KhoemMap.drawRoute(route.coordinates, dest.lat, dest.lng);

        const summary = `Distance ${route.distanceKm} km • ${route.durationMin} min`;
        if (routeInfo) routeInfo.textContent = summary;

        addMessage("assistant", summary);
        speakIfEnabled(summary);

        if (window.KhoemNavigator) {
            KhoemNavigator.start(route);
        }
    } catch (error) {
        if (routeInfo) routeInfo.textContent = "Navigation failed";
        addMessage("assistant", "Unable to calculate route.");
        console.error(error);
    }
}

// ==============================================================================
// Application Initialization & Export
// ==============================================================================

const KhoemApp = {
    version: "3.0",
    initialized: false,

    async init() {
        if (this.initialized) return;

        console.log("====================================");
        console.log("KHOEM_AI 3.0 - System Initializing...");
        console.log("====================================");

        try {
            if (window.KhoemVoice && typeof KhoemVoice.loadVoices === 'function') {
                KhoemVoice.loadVoices();
            }
            if (window.KhoemSettings && typeof KhoemSettings.load === 'function') {
                KhoemSettings.load();
            }

            addMessage("assistant", "សួស្តី! សូមស្វាគមន៍មកកាន់ KHOEM_AI 3.0");
            speakIfEnabled("សួស្តី! សូមស្វាគមន៍មកកាន់ KHOEM AI");

            this.initialized = true;
            console.log("System Ready");
        } catch (error) {
            console.error("Initialization error:", error);
        }
    }
};

window.addEventListener("load", () => {
    KhoemApp.init();
});

window.KhoemApp = KhoemApp;
