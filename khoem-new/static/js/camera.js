// ============================================================================
// FILE: static/js/camera.js
// PROJECT : KHOEM_AI 3.0
// MODULE  : Camera Engine
// VERSION : 3.0
// AUTHOR  : KHOEM SOKSIVUTHA
// ============================================================================

const KhoemCamera = {
    // ============================================================
    // CAMERA STATE
    // ============================================================
    initialized: false,
    stream: null,
    videoElement: null,
    canvasElement: null,
    imageElement: null,
    currentDeviceId: null,
    devices: [],

    // ============================================================
    // SETTINGS
    // ============================================================
    settings: {
        imageQuality: 0.90,
        imageType: "image/jpeg",
        maxWidth: 1280,
        maxHeight: 720,
        facingMode: "environment"
    },

    // ============================================================
    // CALLBACKS
    // ============================================================
    onCapture: null,
    onError: null,
    onReady: null,

    // ============================================================
    // INITIALIZE
    // ============================================================
    init() {
        this.initialized = true;
        this.loadSettings();
        console.log("KhoemCamera initialized");
        return true;
    },

    // ============================================================
    // LOAD SETTINGS
    // ============================================================
    loadSettings() {
        const saved = localStorage.getItem("khoem_camera_settings");
        if (!saved) return;
        try {
            Object.assign(this.settings, JSON.parse(saved));
        } catch (error) {
            console.warn("Camera settings load failed");
        }
    },

    // ============================================================
    // SAVE SETTINGS
    // ============================================================
    saveSettings() {
        localStorage.setItem("khoem_camera_settings", JSON.stringify(this.settings));
    },

    isReady() {
        return this.initialized;
    },

    // ============================================================
    // REQUEST CAMERA PERMISSION
    // ============================================================
    async requestPermission() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            console.error(error);
            if (typeof this.onError === "function") this.onError(error);
            return false;
        }
    },

    // ============================================================
    // LOAD CAMERA DEVICES
    // ============================================================
    async loadDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.devices = devices.filter(device => device.kind === "videoinput");
            return this.devices;
        } catch (error) {
            console.error(error);
            return [];
        }
    },

    // ============================================================
    // START CAMERA
    // ============================================================
    async start(videoElement) {
        this.videoElement = videoElement;
        if (this.stream) this.stop();

        const constraints = {
            video: {
                width: this.settings.maxWidth,
                height: this.settings.maxHeight,
                facingMode: this.settings.facingMode,
                deviceId: this.currentDeviceId ? { exact: this.currentDeviceId } : undefined
            },
            audio: false
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            await this.videoElement.play();
            if (typeof this.onReady === "function") this.onReady();
            return true;
        } catch (error) {
            console.error(error);
            if (typeof this.onError === "function") this.onError(error);
            return false;
        }
    },

    // ============================================================
    // STOP CAMERA
    // ============================================================
    stop() {
        if (!this.stream) return;
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
        if (this.videoElement) this.videoElement.srcObject = null;
    },

    // ============================================================
    // SWITCH CAMERA
    // ============================================================
    async switchCamera() {
        this.settings.facingMode = this.settings.facingMode === "environment" ? "user" : "environment";
        this.saveSettings();
        if (this.videoElement) await this.start(this.videoElement);
    },

    // ============================================================
    // CAPTURE IMAGE
    // ============================================================
    capture() {
        if (!this.videoElement) throw new Error("Camera is not started.");
        const canvas = document.createElement("canvas");
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        const context = canvas.getContext("2d");
        context.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
        return canvas;
    },

    captureBase64() {
        const canvas = this.capture();
        return canvas.toDataURL(this.settings.imageType, this.settings.imageQuality).split(",")[1];
    },

    captureDataURL() {
        const canvas = this.capture();
        return canvas.toDataURL(this.settings.imageType, this.settings.imageQuality);
    },

    captureBlob() {
        return new Promise((resolve) => {
            const canvas = this.capture();
            canvas.toBlob((blob) => { resolve(blob); }, this.settings.imageType, this.settings.imageQuality);
        });
    },

    // ============================================================
    // FILE TO BASE64
    // ============================================================
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => { resolve(reader.result.split(",")[1]); };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    preview(imageElement, base64) {
        imageElement.src = "data:image/jpeg;base64," + base64;
    },

    // ============================================================
    // COMPRESS IMAGE
    // ============================================================
    compress(base64, quality = 0.75) {
        return new Promise((resolve) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = image.width;
                canvas.height = image.height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(image, 0, 0);
                const compressed = canvas.toDataURL("image/jpeg", quality).split(",")[1];
                resolve(compressed);
            };
            image.src = "data:image/jpeg;base64," + base64;
        });
    },

    // ============================================================
    // VALIDATE IMAGE FILE
    // ============================================================
    validateFile(file) {
        if (!file) return false;
        if (!file.type.startsWith("image/")) return false;
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) return false;
        return true;
    },

    async openGallery(file) {
        if (!this.validateFile(file)) throw new Error("Invalid image file.");
        return await this.fileToBase64(file);
    },

    // ============================================================
    // SEND IMAGE TO VISION API (កែសម្រួលដើម្បីចងភ្ជាប់ Backend ឱ្យជិត)
    // ============================================================
    async analyzeImage(base64Image, question = "", sessionId = "") {
        const textPrompt = question || "Please analyze this image.";
        
        const response = await fetch("/api/vision", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                image: base64Image,
                question: textPrompt,
                message: textPrompt,      // បន្ថែម message ក្រែង Backend ត្រូវការ
                session_id: sessionId,    // សំខាន់បំផុត សម្រាប់ចងភ្ជាប់ប្រវត្តិ!
                mime_type: this.settings.imageType
            })
        });
        return await response.json();
    },

    // ============================================================
    // CLEAR CAMERA & DESTROY
    // ============================================================
    clear() {
        this.stop();
        this.videoElement = null;
        this.canvasElement = null;
        this.imageElement = null;
    },

    destroy() {
        this.clear();
        this.devices = [];
        this.currentDeviceId = null;
        this.initialized = false;
        console.log("KhoemCamera destroyed");
    }
};

// ============================================================================
// AUTO INITIALIZE
// ============================================================================
KhoemCamera.init();
