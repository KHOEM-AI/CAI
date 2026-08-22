
        document.addEventListener("DOMContentLoaded", function () {
            const setupBox   = document.getElementById("api-key-setup");
            const keyInput   = document.getElementById("api-key-input");
            const keySaveBtn = document.getElementById("api-key-save-btn");
            const badge      = document.getElementById("api-status-badge");
            const badgeText  = document.getElementById("api-status-text");

            if (!localStorage.getItem("khoem_api_key")) {
                setupBox.style.display = "flex";
            }

            keySaveBtn.addEventListener("click", function () {
                const key = keyInput.value.trim();
                if (!key) return;
                KhoemAPI.setApiKey(key);
                setupBox.style.display = "none";
                badge.className = "api-status-badge";
                badgeText.textContent = "API ready";
            });

            function updateApiStatusBadge(state, message) {
                badge.className = "api-status-badge" + (state ? " " + state : "");
                badgeText.textContent = message || "API ready";
            }

            const sessionId = "session_" + Math.random().toString(36).slice(2, 10);
            const sessionLabel = document.getElementById("session-label");
            const sessionClock = document.getElementById("session-clock");
            const chatBox = document.getElementById("chat-box");
            const input = document.getElementById("user-input");
            const micBtn = document.getElementById("mic-btn");
            const cameraInput = document.getElementById("camera-input");
            const imagePreviewRow = document.getElementById("image-preview-row");
            const imagePreview = document.getElementById("image-preview");
            const imageName = document.getElementById("image-name");
            const clearImageBtn = document.getElementById("clear-image-btn");
            const locationStatus = document.getElementById("location-status");
            const routeInfo = document.getElementById("route-info");
            const mapContainer = document.getElementById("map-container");
            const navControls = document.getElementById("nav-controls");
            const voiceSelect = document.getElementById("voice-select");
            const timezoneSelect = document.getElementById("kmLangSelect");
            const clock = document.getElementById("kmClockTime");
            const timezoneLabel = document.getElementById("timezone-label");
            const timezoneCity = document.getElementById("timezone-city");
            let pendingImageBase64 = null;
            let mapInitialized = false;
            let lastRouteDest = null;
            let zoom = 100;
            let rotation = 0;

            sessionLabel.textContent = sessionId.replace("session_", "").toUpperCase();
            function updateSessionClock() {
                sessionClock.textContent = new Date().toLocaleTimeString("en-GB", { hour12: false });
            }
            updateSessionClock();
            setInterval(updateSessionClock, 1000);

            function safeText(value) {
                return String(value == null ? "" : value);
            }

            function addMessage(role, text) {
                const div = document.createElement("div");
                div.className = "msg " + (role === "user" ? "user" : "assistant");
                const label = document.createElement("span");
                label.className = "msg-label";
                label.textContent = role === "user" ? "You · now" : "KHOEM_AI · now";
                div.appendChild(label);
                div.appendChild(document.createTextNode(safeText(text)));
                chatBox.appendChild(div);
                chatBox.scrollTop = chatBox.scrollHeight;
            }

            function showStatus(element, text) {
                element.textContent = text;
                element.style.display = "block";
            }

            async function sendImageMessage(question) {
                addMessage("user", "[រូបភាព] " + question);
                const image = pendingImageBase64;
                clearImage();
                try {
                    const data = await KhoemAPI.post("/api/vision", { image, question, mime_type: "image/jpeg" });
                    addMessage("assistant", data.answer);
                    updateApiStatusBadge(null, "API ready");
                    if (window.KhoemVoice && typeof KhoemVoice.speak === "function") KhoemVoice.speak(data.answer);
                } catch (error) {
                    handleApiError(error, "បរាជ័យក្នុងការវិភាគរូបភាព");
                }
            }

            async function sendMessage(text) {
                const message = (text || input.value).trim();
                if (pendingImageBase64) {
                    await sendImageMessage(message || "សូមពិពណ៌នារូបភាពនេះ");
                    return;
                }
                if (!message) return;
                addMessage("user", message);
                input.value = "";
                try {
                    const data = await KhoemAPI.post("/api/chat", { session_id: sessionId, message });
                    addMessage("assistant", data.reply);
                    updateApiStatusBadge(null, "API ready");
                    if (window.KhoemVoice && typeof KhoemVoice.speak === "function") KhoemVoice.speak(data.reply);
                } catch (error) {
                    handleApiError(error, "បរាជ័យក្នុងការភ្ជាប់ទៅកាន់ Server");
                }
            }

            function handleApiError(error, fallbackMessage) {
                if (error && error.type === "rate_limited") {
                    addMessage("assistant", "⏳ " + error.message);
                    updateApiStatusBadge("rate-limited", "ហួសកម្រិត");
                } else if (error && error.type === "unauthorized") {
                    addMessage("assistant", "🔒 API key មិនត្រឹមត្រូវ សូមកំណត់ម្តងទៀត");
                    updateApiStatusBadge("unauthorized", "Key ខុស");
                    setupBox.style.display = "flex";
                } else {
                    addMessage("assistant", "error: " + fallbackMessage);
                }
            }

            function clearImage() {
                pendingImageBase64 = null;
                imagePreviewRow.style.display = "none";
                cameraInput.value = "";
            }

            document.getElementById("send-btn").addEventListener("click", function () { sendMessage(); });
            input.addEventListener("keydown", function (event) { if (event.key === "Enter") sendMessage(); });
            clearImageBtn.addEventListener("click", clearImage);

            cameraInput.addEventListener("change", async function (event) {
                const file = event.target.files && event.target.files[0];
                if (!file) return;
                if (window.KhoemCamera && typeof KhoemCamera.fileToBase64 === "function") {
                    pendingImageBase64 = await KhoemCamera.fileToBase64(file);
                } else {
                    pendingImageBase64 = await new Promise(function (resolve, reject) {
                        const reader = new FileReader();
                        reader.onload = function () { resolve(String(reader.result).split(",")[1] || ""); };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }
                imagePreview.src = URL.createObjectURL(file);
                imageName.textContent = file.name;
                imagePreviewRow.style.display = "flex";
            });

            let voiceReady = false;
            if (window.KhoemVoice && typeof KhoemVoice.initRecognition === "function") {
                voiceReady = KhoemVoice.initRecognition(
                    function (transcript) { micBtn.classList.remove("listening"); sendMessage(transcript); },
                    function (error) { micBtn.classList.remove("listening"); addMessage("assistant", "error: " + error); }
                );
            }
            micBtn.addEventListener("click", function () {
                if (voiceReady && window.KhoemVoice) {
                    micBtn.classList.add("listening");
                    KhoemVoice.startListening();
                } else {
                    addMessage("assistant", "ការបញ្ចូលសំឡេងមិនទាន់មាននៅលើ Browser នេះទេ។");
                }
            });

            function populateVoiceList() {
                if (!window.KhoemVoice || typeof KhoemVoice.getVoiceOptions !== "function") return;
                const options = KhoemVoice.getVoiceOptions();
                if (!options.length) return;
                voiceSelect.innerHTML = "";
                options.forEach(function (option) {
                    const item = document.createElement("option");
                    item.value = option.index;
                    item.textContent = option.name + " (" + option.lang + ")";
                    if (option.isDefault) item.selected = true;
                    voiceSelect.appendChild(item);
                });
            }
            voiceSelect.addEventListener("change", function (event) {
                if (window.KhoemVoice && typeof KhoemVoice.setVoice === "function") KhoemVoice.setVoice(Number(event.target.value));
            });
            setTimeout(populateVoiceList, 500);

            function togglePanel(buttonId, panelId) {
                document.getElementById(buttonId).addEventListener("click", function () {
                    document.getElementById(panelId).classList.toggle("is-open");
                });
            }
            togglePanel("accessibility-btn", "accessibility-panel");
            togglePanel("settings-btn", "settings-panel");
            document.getElementById("voice-toggle").addEventListener("click", function () {
                addMessage("assistant", "Voice assistant " + (this.dataset.active === "true" ? "បានបិទ" : "បានបើក") + "។");
                this.dataset.active = this.dataset.active === "true" ? "false" : "true";
            });
            document.getElementById("voice-assistant-btn").addEventListener("click", function () { micBtn.click(); });

            function applyView() {
                document.body.style.zoom = zoom / 100;
                document.body.style.transform = "rotate(" + rotation + "deg)";
                document.getElementById("zoom-value").textContent = zoom + "%";
                document.getElementById("rotation-value").textContent = rotation + "°";
            }
            document.getElementById("zoom-in-btn").addEventListener("click", function () { zoom = Math.min(120, zoom + 10); applyView(); });
            document.getElementById("zoom-out-btn").addEventListener("click", function () { zoom = Math.max(80, zoom - 10); applyView(); });
            document.getElementById("rotate-btn").addEventListener("click", function () { rotation = rotation === 0 ? 180 : 0; applyView(); });
            document.getElementById("reset-view-btn").addEventListener("click", function () { zoom = 100; rotation = 0; applyView(); });
            document.getElementById("save-pref-btn").addEventListener("click", function () { addMessage("assistant", "ចំណូលចិត្តត្រូវបានរក្សាទុកសម្រាប់ session នេះ។"); });
            document.getElementById("reset-pref-btn").addEventListener("click", function () { zoom = 100; rotation = 0; applyView(); });

            function updateClock() {
                const timezone = timezoneSelect.value || "Asia/Phnom_Penh";
                const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date());
                const values = {};
                parts.forEach(function (part) { values[part.type] = part.value; });
                clock.textContent = values.hour + ":" + values.minute + ":" + values.second;
                const names = {
                    "Asia/Phnom_Penh": ["GMT+7", "ភ្នំពេញ"],
                    "Asia/Tokyo": ["GMT+9", "តូក្យូ"],
                    "Asia/Singapore": ["GMT+8", "សិង្ហបុរី"],
                    "Europe/London": ["GMT", "ឡុងដ៍"],
                    "America/New_York": ["GMT-4", "ញូវយ៉ក"]
                };
                const info = names[timezone] || ["Local", "Local"];
                timezoneLabel.textContent = info[0];
                timezoneCity.textContent = info[1];
            }
            timezoneSelect.addEventListener("change", updateClock);
            updateClock();
            setInterval(updateClock, 1000);

            async function startNavigationTo(destinationName) {
                addMessage("user", "នាំផ្លូវទៅ " + destinationName);
                showStatus(routeInfo, "កំពុងស្វែងរកផ្លូវ...");
                try {
                    if (!window.KhoemGPS || !window.KhoemMap) throw new Error("GPS module is not available");
                    if (!KhoemGPS.currentPosition) await KhoemGPS.getCurrentLocation();
                    mapContainer.style.display = "block";
                    if (!mapInitialized) {
                        KhoemMap.init("map-container", KhoemGPS.currentPosition.lat, KhoemGPS.currentPosition.lng);
                        mapInitialized = true;
                    }
                    const destination = await KhoemMap.geocodeSearch(destinationName);
                    const route = await KhoemMap.getRoute(KhoemGPS.currentPosition.lat, KhoemGPS.currentPosition.lng, destination.lat, destination.lng);
                    KhoemMap.drawRoute(route.coordinates, destination.lat, destination.lng);
                    const summary = "ចម្ងាយ " + route.distanceKm + " គីឡូម៉ែត្រ · ប្រើពេលប្រហែល " + route.durationMin + " នាទី";
                    showStatus(routeInfo, summary);
                    addMessage("assistant", summary);
                    lastRouteDest = destination;
                    navControls.style.display = "flex";
                    if (window.KhoemNavigator) KhoemNavigator.start(route, function (position) { KhoemMap.updateUserLocation(position.lat, position.lng); });
                } catch (error) {
                    showStatus(routeInfo, "មិនអាចចាប់ផ្តើមនាំផ្លូវបានទេ។ សូមពិនិត្យ GPS របស់បង។");
                    addMessage("assistant", "សុំទោស មានបញ្ហាជាមួយ GPS ឬផែនទី។");
                }
            }

            document.getElementById("stop-nav-btn").addEventListener("click", function () {
                if (window.KhoemNavigator) KhoemNavigator.stop();
                navControls.style.display = "none";
                routeInfo.style.display = "none";
            });
            document.getElementById("save-place-btn").addEventListener("click", async function () {
                if (!lastRouteDest) return;
                const label = window.prompt("ដាក់ឈ្មោះទីតាំងនេះ (ឧ. ផ្ទះ, ការងារ):");
                if (!label) return;
                try {
                    await KhoemAPI.post("/api/places", { session_id: sessionId, label: label.trim(), lat: lastRouteDest.lat, lng: lastRouteDest.lng });
                    addMessage("assistant", "បានរក្សាទុកទីតាំង \"" + label.trim() + "\" រួចរាល់!");
                    updateApiStatusBadge(null, "API ready");
                } catch (error) {
                    handleApiError(error, "មិនអាចរក្សាទុកទីតាំងបានទេ។");
                }
            });

            function addAudioMessage(role, trackUrl, caption) {
                const div = document.createElement("div");
                div.className = "msg " + (role === "user" ? "user" : "assistant");
                const label = document.createElement("span");
                label.className = "msg-label";
                label.textContent = role === "user" ? "You · now" : "KHOEM_AI · now";
                div.appendChild(label);
                if (caption) div.appendChild(document.createTextNode(safeText(caption)));
                const audio = document.createElement("audio");
                audio.controls = true;
                audio.src = trackUrl;
                audio.style.display = "block";
                audio.style.marginTop = "8px";
                audio.style.width = "100%";
                div.appendChild(audio);
                chatBox.appendChild(div);
                chatBox.scrollTop = chatBox.scrollHeight;
            }

            async function generateMusic(promptText) {
                const text = (promptText || "").trim();
                if (!text) return;
                addMessage("user", "🎵 បង្កើតបទចម្រៀង: " + text);
                try {
                    const data = await KhoemAPI.post("/api/music/generate", {
                        session_id: sessionId,
                        prompt: text,
                        duration: 30
                    });
                    if (data.status === "stub") {
                        addMessage("assistant", "🎵 " + (data.message || "Music API មិនទាន់បានកំណត់ configure នៅឡើយទេ។"));
                    } else if (data.track_url) {
                        addAudioMessage("assistant", data.track_url, "🎵 បទចម្រៀងរបស់បងរួចរាល់ហើយ!");
                        if (window.KhoemVoice && typeof KhoemVoice.speak === "function") {
                            KhoemVoice.speak("បទចម្រៀងរបស់បងរួចរាល់ហើយ");
                        }
                    } else {
                        addMessage("assistant", "⚠️ មិនអាចបង្កើតបទចម្រៀងបានទេ");
                    }
                    updateApiStatusBadge(null, "API ready");
                } catch (error) {
                    handleApiError(error, "បរាជ័យក្នុងការបង្កើតបទចម្រៀង");
                }
            }

            async function generateVideoWithMusic(videoPrompt, musicPrompt) {
                const vText = (videoPrompt || "").trim();
                if (!vText) return;
                addMessage("user", "🎬🎵 បង្កើតវីដេអូ+ចម្រៀង: " + vText);
                try {
                    const data = await KhoemAPI.post("/api/video/generate-with-music", {
                        session_id: sessionId,
                        video_prompt: vText,
                        music_prompt: (musicPrompt || vText).trim(),
                        duration: 10
                    });
                    const videoUrl = data.final_video_url || data.video_url;
                    if (data.status === "stub") {
                        addMessage("assistant", "⚠️ " + (data.message || "API key មិនទាន់បានកំណត់ configure"));
                    } else if (videoUrl) {
                        const div = document.createElement("div");
                        div.className = "msg assistant";
                        const label = document.createElement("span");
                        label.className = "msg-label";
                        label.textContent = "KHOEM_AI · now";
                        div.appendChild(label);
                        div.appendChild(document.createTextNode("🎬🎵 វីដេអូ+ចម្រៀងរបស់បងរួចរាល់ហើយ!"));
                        const video = document.createElement("video");
                        video.controls = true;
                        video.src = videoUrl;
                        video.style.display = "block";
                        video.style.marginTop = "8px";
                        video.style.width = "100%";
                        video.style.borderRadius = "12px";
                        div.appendChild(video);
                        chatBox.appendChild(div);
                        chatBox.scrollTop = chatBox.scrollHeight;
                        if (window.KhoemVoice && typeof KhoemVoice.speak === "function") {
                            KhoemVoice.speak("វីដេអូ និងចម្រៀងរបស់បងរួចរាល់ហើយ");
                        }
                    } else {
                        addMessage("assistant", "⚠️ មិនអាចបង្កើតបានទេ");
                    }
                    updateApiStatusBadge(null, "API ready");
                } catch (error) {
                    handleApiError(error, "បរាជ័យក្នុងការបង្កើតវីដេអូ+ចម្រៀង");
                }
            }

            document.querySelectorAll(".chip[data-action]").forEach(function (button) {
                button.addEventListener("click", async function () {
                    const action = button.dataset.action;
                    if (action === "location") {
                        showStatus(locationStatus, "កំពុងស្វែងរកទីតាំង...");
                        try {
                            if (!window.KhoemGPS) throw new Error("GPS unavailable");
                            const position = await KhoemGPS.getCurrentLocation();
                            showStatus(locationStatus, "ទីតាំងរបស់បង: " + position.lat.toFixed(5) + ", " + position.lng.toFixed(5));
                            mapContainer.style.display = "block";
                            if (!mapInitialized && window.KhoemMap) {
                                KhoemMap.init("map-container", position.lat, position.lng);
                                mapInitialized = true;
                            } else if (window.KhoemMap) KhoemMap.updateUserLocation(position.lat, position.lng);
                        } catch (error) {
                            showStatus(locationStatus, "មិនអាចទទួលបានទីតាំងបានទេ។ សូមអនុញ្ញាត GPS។");
                        }
                    }
                    if (action === "navigate") {
                        const destination = window.prompt("សូមប្រាប់គោលដៅដែលបងចង់ទៅ:");
                        if (destination) startNavigationTo(destination);
                    }
                    if (action === "goto-home" || action === "goto-work") {
                        const label = action === "goto-home" ? "ផ្ទះ" : "ការងារ";
                        try {
                            const data = await KhoemAPI.get("/api/places/" + sessionId + "/" + encodeURIComponent(label));
                            if (data.lat) startNavigationTo(label);
                            else addMessage("assistant", "មិនទាន់បានកំណត់ទីតាំង" + label + "នៅឡើយទេ។");
                        } catch (error) {
                            addMessage("assistant", "មិនអាចស្វែងរកទីតាំងបានទេ។");
                        }
                    }
                    if (action === "music") {
                        const musicPrompt = window.prompt("ពិពណ៌នាបទចម្រៀងដែលបងចង់បង្កើត (ឧ. បទស្នេហាយឺតៗ សំឡេងគីតា):");
                        if (musicPrompt) generateMusic(musicPrompt);
                    }
                    if (action === "video-music") {
                        const vPrompt = window.prompt("ពិពណ៌នាវីដេអូដែលបងចង់បង្កើត:");
                        if (vPrompt) {
                            const mPrompt = window.prompt("ពិពណ៌នាតន្ត្រី/បទចម្រៀង (ទុកទទេប្រើដូចវីដេអូ):");
                            generateVideoWithMusic(vPrompt, mPrompt);
                        }
                    }
                });
            });
            document.querySelectorAll("[data-place]").forEach(function (button) {
                button.addEventListener("click", function () { startNavigationTo(button.dataset.place); });
            });
            window.openCalendar = function () { addMessage("assistant", "Calendar integration នឹងបើកនៅពេល API calendar ត្រូវបានភ្ជាប់។"); };
        });
    