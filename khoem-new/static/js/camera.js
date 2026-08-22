    },

    // ============================================================
    // MOBILE BROWSER SUPPORT
    // ============================================================
    isSupported() {
        return !!(
            navigator.mediaDevices &&
            typeof navigator.mediaDevices.getUserMedia === "function"
        );
    },

    getErrorMessage(error) {
        const name = error && error.name ? error.name : "";

        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
            return "សូមអនុញ្ញាត Camera ក្នុង Browser Settings រួចសាកល្បងម្ដងទៀត។";
        }
        if (name === "NotFoundError" || name === "DevicesNotFoundError") {
            return "រកមិនឃើញ Camera នៅលើទូរសព្ទនេះទេ។";
        }
        if (name === "NotReadableError" || name === "TrackStartError") {
            return "Camera កំពុងត្រូវបានប្រើដោយកម្មវិធីផ្សេង។ សូមបិទកម្មវិធីនោះ រួចសាកល្បងម្ដងទៀត។";
        }
        if (name === "OverconstrainedError") {
            return "Camera ទូរសព្ទនេះមិនគាំទ្រការកំណត់ដែលបានជ្រើសទេ។";
        }
        if (name === "SecurityError") {
            return "Camera ត្រូវការបើកតាម HTTPS ឬ localhost។";
        }
        return "មិនអាចបើក Camera បានទេ។ សូមពិនិត្យ Permission រួចសាកល្បងម្ដងទៀត។";
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
        if (!this.isSupported()) {
            const error = new Error("Camera is not supported by this browser.");
            error.name = "NotSupportedError";
            if (typeof this.onError === "function") this.onError(error);
            return false;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: this.settings.facingMode } },
                audio: false
            });
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
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== "function") {
            return [];
        }

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
        if (!videoElement) {
            const error = new Error("A video element is required.");
            error.name = "VideoElementMissingError";
            if (typeof this.onError === "function") this.onError(error);
            return false;
        }

        if (!this.isSupported()) {
            const error = new Error("Camera is not supported by this browser.");
            error.name = "NotSupportedError";
            if (typeof this.onError === "function") this.onError(error);
            return false;
        }

        this.videoElement = videoElement;
        if (this.stream) this.stop();

        // These attributes are important for older Android browsers.
        this.videoElement.setAttribute("autoplay", "true");
        this.videoElement.setAttribute("muted", "true");
        this.videoElement.setAttribute("playsinline", "true");
        this.videoElement.setAttribute("webkit-playsinline", "true");
        this.videoElement.muted = true;
        this.videoElement.playsInline = true;

        const constraints = {
            video: {
                width: { ideal: this.settings.maxWidth },
                height: { ideal: this.settings.maxHeight },
                facingMode: { ideal: this.settings.facingMode }
            },
            audio: false
        };

        if (this.currentDeviceId) {
            constraints.video.deviceId = { exact: this.currentDeviceId };
        }

        try {
            try {
                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (firstError) {
                // Some older phones reject ideal/device constraints.
                console.warn("Retrying camera with simple mobile constraints", firstError);
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }

            this.videoElement.srcObject = this.stream;
            await this.videoElement.play();
            if (typeof this.onReady === "function") this.onReady();
            return true;
        } catch (error) {
            console.error("Camera start failed:", error, this.getErrorMessage(error));
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
        if (
            !this.videoElement ||
            !this.stream ||
            !this.videoElement.videoWidth ||
            !this.videoElement.videoHeight
        ) {
            throw new Error("Camera is not ready yet.");
        }

        const canvas = document.createElement("canvas");
        const videoWidth = this.videoElement.videoWidth;
        const videoHeight = this.videoElement.videoHeight;
        const scale = Math.min(
            1,
            this.settings.maxWidth / videoWidth,
            this.settings.maxHeight / videoHeight
        );

        canvas.width = Math.max(1, Math.round(videoWidth * scale));
        canvas.height = Math.max(1, Math.round(videoHeight * scale));
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
            if (typeof canvas.toBlob === "function") {
                canvas.toBlob((blob) => { resolve(blob); }, this.settings.imageType, this.settings.imageQuality);
                return;
            }

            // Fallback for older Android browsers without canvas.toBlob().
            const dataUrl = canvas.toDataURL(this.settings.imageType, this.settings.imageQuality);
            const parts = dataUrl.split(",");
            const binary = atob(parts[1]);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index);
            }
            resolve(new Blob([bytes], { type: this.settings.imageType }));
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
        
        try {
            const response = await fetch("/api/vision", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    image: base64Image,
                    question: textPrompt,
                    message: textPrompt,
                    session_id: sessionId,
                    mime_type: this.settings.imageType
                })
            });

            const result = await response.json();
            if (!response.ok) {
                const error = new Error(result.error || "Vision API request failed.");
                error.status = response.status;
                throw error;
            }
            return result;
        } catch (error) {
            console.error("Vision request failed:", error);
            if (typeof this.onError === "function") this.onError(error);
            throw error;
        }
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

