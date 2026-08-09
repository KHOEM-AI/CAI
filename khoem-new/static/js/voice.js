// ============================================================================
// KHOEM_AI 3.0
// File : static/js/voice.js
// Module : Voice Engine
// Part : 1 / 4
// ============================================================================

const KhoemVoice = {

    recognition: null,
    synthesis: window.speechSynthesis,
    availableVoices: [],
    selectedVoice: null,
    currentProfile: "young_man",
    isListening: false,
    voiceEnabled: true,
    autoRead: true,
    language: "km-KH",
    settingsKey: "khoem_ai_voice_settings",

    settings: {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
    },

    profiles: {
        boy: { id: "boy", name: "👦 Boy", rate: 1.10, pitch: 1.40 },
        girl: { id: "girl", name: "👧 Girl", rate: 1.10, pitch: 1.50 },
        young_man: { id: "young_man", name: "👨 Young Man", rate: 1.00, pitch: 1.00 },
        young_woman: { id: "young_woman", name: "👩 Young Woman", rate: 1.00, pitch: 1.20 },
        adult_man: { id: "adult_man", name: "🧔 Adult Man", rate: 0.95, pitch: 0.95 },
        adult_woman: { id: "adult_woman", name: "👩 Adult Woman", rate: 0.95, pitch: 1.10 },
        elder_man: { id: "elder_man", name: "👴 Elder Man", rate: 0.80, pitch: 0.90 },
        elder_woman: { id: "elder_woman", name: "👵 Elder Woman", rate: 0.80, pitch: 1.00 },
        robot: { id: "robot", name: "🤖 AI Robot", rate: 1.00, pitch: 0.70 }
    },

    init() {
        this.loadSettings();
        this.loadVoices();
        if (window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = () => {
                this.loadVoices();
            };
        }
        console.log("KHOEM_AI Voice Engine Ready");
    },

    loadVoices() {
        if (!window.speechSynthesis) return;
        this.availableVoices = window.speechSynthesis.getVoices();
    },

    getVoiceOptions() {
        return this.availableVoices.map((voice, index) => ({
            index,
            name: voice.name,
            lang: voice.lang,
            isDefault: voice.default
        }));
    },

    saveSettings() {
        localStorage.setItem(
            this.settingsKey,
            JSON.stringify({
                currentProfile: this.currentProfile,
                voiceEnabled: this.voiceEnabled,
                autoRead: this.autoRead,
                language: this.language,
                selectedVoice: this.selectedVoice ? this.selectedVoice.name : null,
                settings: this.settings
            })
        );
    },

    loadSettings() {
        const saved = localStorage.getItem(this.settingsKey);
        if (!saved) return;
        try {
            const data = JSON.parse(saved);
            this.currentProfile = data.currentProfile || this.currentProfile;
            this.voiceEnabled = data.voiceEnabled ?? true;
            this.autoRead = data.autoRead ?? true;
            this.language = data.language || "km-KH";
            this.settings = data.settings || this.settings;
        } catch(err) {
            console.error(err);
        }
    },

    setProfile(profile) {
        if(!this.profiles[profile]) return;
        this.currentProfile = profile;
        this.saveSettings();
    },

    getProfile() {
        return this.profiles[this.currentProfile];
    },

    setVoice(index){
        this.selectedVoice = this.availableVoices[index] || null;
        this.saveSettings();
    },

// ============================================================================
// KHOEM_AI 3.0
// File : static/js/voice.js
// Part : 2 / 4
// Speech Recognition + Speech Synthesis + Voice Selection
// ============================================================================

    initRecognition(onResult, onError) {
        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            onError("Speech Recognition is not supported.");
            return false;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = this.language;
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;

        this.recognition.onresult = (event) => {
            this.isListening = false;
            const text = event.results[0][0].transcript;
            onResult(text);
        };

        this.recognition.onerror = (event) => {
            this.isListening = false;
            onError(event.error);
        };

        this.recognition.onend = () => {
            this.isListening = false;
        };

        this.loadVoices();
        if (window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = () => {
                this.loadVoices();
            };
        }

        return true;
    },

    startListening() {
        if (!this.recognition) return;
        if (this.isListening) return;
        this.isListening = true;
        this.recognition.start();
    },

    stopListening() {
        if (!this.recognition) return;
        this.recognition.stop();
        this.isListening = false;
    },

    speak(text, lang = "km-KH") {
        if (!window.speechSynthesis) return;
        if (!this.voiceEnabled) return;
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        const profile = this.profiles[this.currentProfile];

        if (this.selectedVoice) {
            utterance.voice = this.selectedVoice;
        } else {
            const khmerVoice = this.availableVoices.find(v => v.lang.startsWith("km"));
            if (khmerVoice) {
                utterance.voice = khmerVoice;
            } else {
                utterance.lang = this.availableVoices[0]?.lang || lang;
            }
        }

        utterance.rate = profile.rate;
        utterance.pitch = profile.pitch;
        utterance.volume = this.settings.volume;

        window.speechSynthesis.speak(utterance);
    },

    stopSpeaking() {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
    },

// ============================================================================
// KHOEM_AI 3.0
// File : static/js/voice.js
// Module : Voice Engine
// Part : 3 / 4
// Auto Read • Voice ON/OFF • Volume • Rate • Pitch • Queue Management
// ============================================================================

    enableVoice() {
        this.voiceEnabled = true;
        this.saveSettings();
    },

    disableVoice() {
        this.voiceEnabled = false;
        this.stopSpeaking();
        this.saveSettings();
    },

    toggleVoice() {
        this.voiceEnabled = !this.voiceEnabled;
        if (!this.voiceEnabled) {
            this.stopSpeaking();
        }
        this.saveSettings();
    },

    isVoiceEnabled() {
        return this.voiceEnabled;
    },

    enableAutoRead() {
        this.autoRead = true;
        this.saveSettings();
    },

    disableAutoRead() {
        this.autoRead = false;
        this.saveSettings();
    },

    toggleAutoRead() {
        this.autoRead = !this.autoRead;
        this.saveSettings();
    },

    isAutoReadEnabled() {
        return this.autoRead;
    },

    setVolume(value) {
        value = Number(value);
        if (isNaN(value)) return;
        if (value < 0) value = 0;
        if (value > 1) value = 1;
        this.settings.volume = value;
        this.saveSettings();
    },

    getVolume() {
        return this.settings.volume;
    },

    setRate(value) {
        value = Number(value);
        if (isNaN(value)) return;
        if (value < 0.5) value = 0.5;
        if (value > 2.0) value = 2.0;
        this.settings.rate = value;
        this.saveSettings();
    },

    getRate() {
        return this.settings.rate;
    },

    setPitch(value) {
        value = Number(value);
        if (isNaN(value)) return;
        if (value < 0.5) value = 0.5;
        if (value > 2.0) value = 2.0;
        this.settings.pitch = value;
        this.saveSettings();
    },

    getPitch() {
        return this.settings.pitch;
    },

    clearQueue() {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
    },

    pauseSpeaking() {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.pause();
    },

    resumeSpeaking() {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.resume();
    },

    isSpeaking() {
        if (!window.speechSynthesis) return false;
        return window.speechSynthesis.speaking;
    },

    testVoice() {
        this.speak("សួស្តី។ នេះគឺជាការសាកល្បងសម្លេងរបស់ KHOEM AI។");
    },

    getStatus() {
        return {
            enabled: this.voiceEnabled,
            autoRead: this.autoRead,
            listening: this.isListening,
            speaking: this.isSpeaking(),
            profile: this.currentProfile,
            volume: this.settings.volume,
            rate: this.settings.rate,
            pitch: this.settings.pitch,
            language: this.language
        };
    },

// ============================================================================
// KHOEM_AI 3.0
// File : static/js/voice.js
// Module : Voice Engine
// Part : 4 / 4
// UI Integration • Initialization • Export
// ============================================================================

    applySettings() {
        const volumeSlider = document.getElementById("volume-slider");
        const speedSlider = document.getElementById("speed-slider");
        const pitchSlider = document.getElementById("pitch-slider");

        if (volumeSlider) volumeSlider.value = this.settings.volume;
        if (speedSlider) speedSlider.value = this.settings.rate;
        if (pitchSlider) pitchSlider.value = this.settings.pitch;
    },

    bindVoiceButton() {
        const button = document.getElementById("voice-toggle");
        if (!button) return;
        button.addEventListener("click", () => {
            this.toggleVoice();
            button.textContent = this.voiceEnabled ? "🔊" : "🔇";
        });
    },

    bindAutoReadButton() {
        const button = document.getElementById("auto-read");
        if (!button) return;
        button.addEventListener("click", () => {
            this.toggleAutoRead();
            button.textContent = this.autoRead ? "📖 Auto Read ON" : "📖 Auto Read OFF";
        });
    },

    bindProfileSelector() {
        const select = document.getElementById("voice-profile");
        if (!select) return;
        select.innerHTML = "";
        Object.values(this.profiles).forEach(profile => {
            const option = document.createElement("option");
            option.value = profile.id;
            option.textContent = profile.name;
            if(profile.id === this.currentProfile){
                option.selected = true;
            }
            select.appendChild(option);
        });
        select.addEventListener("change", (e) => {
            this.setProfile(e.target.value);
        });
    },

    bindBrowserVoiceSelector() {
        const select = document.getElementById("voice-select");
        if(!select) return;
        select.innerHTML = "";
        this.getVoiceOptions().forEach(voice => {
            const option = document.createElement("option");
            option.value = voice.index;
            option.textContent = voice.name + " (" + voice.lang + ")";
            select.appendChild(option);
        });
        select.addEventListener("change", (e) => {
            this.setVoice(Number(e.target.value));
        });
    },

    bindVolumeSlider(){
        const slider = document.getElementById("volume-slider");
        if(!slider) return;
        slider.value = this.settings.volume;
        slider.addEventListener("input", (e) => {
            this.setVolume(e.target.value);
        });
    },

    bindRateSlider(){
        const slider = document.getElementById("speed-slider");
        if(!slider) return;
        slider.value = this.settings.rate;
        slider.addEventListener("input", (e) => {
            this.setRate(e.target.value);
        });
    },

    bindPitchSlider(){
        const slider = document.getElementById("pitch-slider");
        if(!slider) return;
        slider.value = this.settings.pitch;
        slider.addEventListener("input", (e) => {
            this.setPitch(e.target.value);
        });
    },

    bindTestButton(){
        const button = document.getElementById("voice-test");
        if(!button) return;
        button.addEventListener("click", () => {
            this.testVoice();
        });
    },

    initializeUI(){
        this.applySettings();
        this.bindVoiceButton();
        this.bindAutoReadButton();
        this.bindProfileSelector();
        this.bindBrowserVoiceSelector();
        this.bindVolumeSlider();
        this.bindRateSlider();
        this.bindPitchSlider();
        this.bindTestButton();
    },

    start(){
        this.loadSettings();
        this.loadVoices();
        this.initializeUI();
        console.log("================================");
        console.log("KHOEM_AI Voice Engine 3.0");
        console.log("Voice Enabled :", this.voiceEnabled);
        console.log("Auto Read :", this.autoRead);
        console.log("Profile :", this.currentProfile);
        console.log("Voices :", this.availableVoices.length);
        console.log("================================");
    }

};

document.addEventListener("DOMContentLoaded", () => {
    KhoemVoice.start();
});

window.KhoemVoice = KhoemVoice;
