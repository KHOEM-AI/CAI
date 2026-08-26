// ==============================================================================
// static/js/vault.js — Secure Vault Matrix (frontend)
//
// Depends on:
//   - face-api.js (CDN, loaded in index.html) for browser-side face descriptors
//   - Model weights served from /static/models/ (download once, see comment below)
//
// The unlock token is kept ONLY in memory (a JS variable), never in
// localStorage — closing the tab forces a fresh unlock, which is the point.
// ==============================================================================

(function () {
    "use strict";

    const CATEGORY_ICONS = { document: "📄", image: "🖼️", video: "🎥", code: "💻", audio: "🎵" };
    const CATEGORY_LABELS = { document: "ឯកសារ", image: "រូបភាព", video: "វីដេអូ", code: "កូដ", audio: "សំឡេង" };

    let unlockToken = null;      // in-memory only
    let activeCategory = "document";
    let faceModelsLoaded = false;
    let faceStream = null;

    function $(id) { return document.getElementById(id); }

    function fmtSize(bytes) {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    async function api(path, options) {
        options = options || {};
        options.headers = Object.assign({}, options.headers);
        if (unlockToken) options.headers["X-Vault-Token"] = unlockToken;
        options.credentials = "same-origin";
        const res = await fetch("/api/vault" + path, options);
        let body = null;
        try { body = await res.json(); } catch (e) { /* non-JSON (file download handled separately) */ }
        if (!res.ok) {
            const err = new Error((body && body.error) || ("HTTP " + res.status));
            err.status = res.status;
            err.body = body;
            throw err;
        }
        return body;
    }

    function showError(message) {
        const el = $("vault-error");
        el.textContent = message;
        el.classList.add("is-visible");
    }
    function clearError() { $("vault-error").classList.remove("is-visible"); }

    // -------------------------------------------------------------------
    // Status / gate rendering
    // -------------------------------------------------------------------

    async function refreshStatus() {
        const status = await api("/status");
        const stateEl = $("vault-state");

        if (!status.vault_exists) {
            stateEl.textContent = "មិនទាន់រៀបចំ — សូមកំណត់ Password";
            stateEl.className = "vault-state";
            renderSetupGate();
        } else if (!unlockToken) {
            stateEl.textContent = "🔒 បិទសោ";
            stateEl.className = "vault-state";
            renderUnlockGate(status);
        } else {
            stateEl.textContent = "🔓 បើកសោហើយ";
            stateEl.className = "vault-state unlocked";
            renderUnlocked(status);
        }
    }

    function renderSetupGate() {
        $("vault-gate").hidden = false;
        $("vault-unlocked").hidden = true;
        $("vault-gate-title").textContent = "កំណត់ Password សម្រាប់ Vault";
        $("vault-gate-password").value = "";
        $("vault-face-unlock-btn").hidden = true;
        $("vault-gate-submit").textContent = "បង្កើត Vault";
        $("vault-gate-submit").onclick = handleSetup;
    }

    function renderUnlockGate(status) {
        $("vault-gate").hidden = false;
        $("vault-unlocked").hidden = true;
        $("vault-gate-title").textContent = "បញ្ចូល Password ដើម្បីបើក Vault";
        $("vault-gate-password").value = "";
        $("vault-face-unlock-btn").hidden = !status.face_enrolled;
        $("vault-gate-submit").textContent = "បើកសោ";
        $("vault-gate-submit").onclick = handleUnlock;
    }

    function renderUnlocked(status) {
        $("vault-gate").hidden = true;
        $("vault-unlocked").hidden = false;
        renderGoogleRow(status);
        loadFiles();
    }

    function renderGoogleRow(status) {
        const row = $("vault-google-row");
        if (status.google_linked) {
            row.innerHTML = `<span class="linked">✅ ភ្ជាប់ជាមួយ ${status.google_email}</span>
                              <button class="vault-btn" id="vault-google-unlink">ផ្តាច់</button>`;
            $("vault-google-unlink").onclick = async () => {
                await api("/google/unlink", { method: "POST" });
                refreshStatus();
            };
        } else {
            row.innerHTML = `<span>មិនទាន់ភ្ជាប់ Google Email</span>
                              <button class="vault-btn primary" id="vault-google-link">ភ្ជាប់ Google</button>`;
            $("vault-google-link").onclick = () => { window.location.href = "/api/vault/google/login"; };
        }
    }

    // -------------------------------------------------------------------
    // Setup / password unlock
    // -------------------------------------------------------------------

    async function handleSetup() {
        clearError();
        const password = $("vault-gate-password").value;
        if (password.length < 8) { showError("Password ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ"); return; }
        try {
            const result = await api("/setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            unlockToken = result.unlock_token;
            await refreshStatus();
        } catch (e) { showError(e.message); }
    }

    async function handleUnlock() {
        clearError();
        const password = $("vault-gate-password").value;
        if (!password) { showError("សូមបញ្ចូល Password"); return; }
        try {
            const result = await api("/unlock", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            unlockToken = result.unlock_token;
            await refreshStatus();
        } catch (e) { showError(e.message); }
    }

    // -------------------------------------------------------------------
    // Face capture (enroll + verify) using face-api.js
    // Model weights: download once from
    // https://github.com/justadudewhohacks/face-api.js/tree/master/weights
    // and place tiny_face_detector + face_landmark_68 + face_recognition
    // model files under /static/models/
    // -------------------------------------------------------------------

    async function ensureFaceModels() {
        if (faceModelsLoaded) return true;
        if (typeof faceapi === "undefined") { showError("face-api.js មិនទាន់ load"); return false; }
        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri("/static/models");
            await faceapi.nets.faceLandmark68Net.loadFromUri("/static/models");
            await faceapi.nets.faceRecognitionNet.loadFromUri("/static/models");
            faceModelsLoaded = true;
            return true;
        } catch (e) {
            showError("មិនអាច load Face model បានទេ — ពិនិត្យ /static/models");
            return false;
        }
    }

    async function openFaceCapture(onDescriptor) {
        clearError();
        const box = $("vault-face-box");
        const video = $("vault-face-video");
        box.hidden = false;

        const ready = await ensureFaceModels();
        if (!ready) { box.hidden = true; return; }

        try {
            faceStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
            video.srcObject = faceStream;
            await video.play();
        } catch (e) {
            showError("មិនអាចបើកកាមេរ៉ាបានទេ — សូមអនុញ្ញាត camera permission");
            box.hidden = true;
            return;
        }

        $("vault-face-capture-btn").hidden = false;
        $("vault-face-capture-btn").onclick = async () => {
            const detection = await faceapi
                .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();
            if (!detection) { showError("រកមិនឃើញមុខ — សូមសាកម្តងទៀត"); return; }
            closeFaceCapture();
            onDescriptor(Array.from(detection.descriptor));
        };
    }

    function closeFaceCapture() {
        $("vault-face-box").hidden = true;
        $("vault-face-capture-btn").hidden = true;
        if (faceStream) { faceStream.getTracks().forEach((t) => t.stop()); faceStream = null; }
    }

    $("vault-enroll-face-btn") && ($("vault-enroll-face-btn").onclick = () => {
        openFaceCapture(async (descriptor) => {
            try {
                await api("/face/enroll", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ descriptor }),
                });
                refreshStatus();
            } catch (e) { showError(e.message); }
        });
    });

    $("vault-face-unlock-btn") && ($("vault-face-unlock-btn").onclick = () => {
        openFaceCapture(async (descriptor) => {
            try {
                const result = await api("/face/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ descriptor }),
                });
                unlockToken = result.unlock_token;
                refreshStatus();
            } catch (e) { showError(e.message); }
        });
    });

    // -------------------------------------------------------------------
    // Category tabs
    // -------------------------------------------------------------------

    function initTabs() {
        document.querySelectorAll(".vault-tab").forEach((tab) => {
            tab.addEventListener("click", () => {
                document.querySelectorAll(".vault-tab").forEach((t) => t.classList.remove("is-active"));
                tab.classList.add("is-active");
                activeCategory = tab.dataset.category;
                loadFiles();
            });
        });
    }

    // -------------------------------------------------------------------
    // Upload (dropzone)
    // -------------------------------------------------------------------

    function initDropzone() {
        const zone = $("vault-dropzone");
        const input = $("vault-file-input");

        zone.addEventListener("click", () => input.click());
        input.addEventListener("change", () => { if (input.files[0]) uploadFile(input.files[0]); });

        ["dragenter", "dragover"].forEach((evt) =>
            zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add("is-dragover"); })
        );
        ["dragleave", "drop"].forEach((evt) =>
            zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove("is-dragover"); })
        );
        zone.addEventListener("drop", (e) => {
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) uploadFile(file);
        });
    }

    function uploadFile(file) {
        clearError();
        const form = new FormData();
        form.append("file", file);
        form.append("category", activeCategory);

        const bar = $("vault-upload-progress");
        const fill = bar.querySelector("span");
        bar.classList.add("is-visible");
        fill.style.width = "0%";

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/vault/files");
        if (unlockToken) xhr.setRequestHeader("X-Vault-Token", unlockToken);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) fill.style.width = Math.round((e.loaded / e.total) * 100) + "%";
        };
        xhr.onload = () => {
            bar.classList.remove("is-visible");
            if (xhr.status >= 200 && xhr.status < 300) {
                loadFiles();
            } else {
                try { showError(JSON.parse(xhr.responseText).error); }
                catch (e) { showError("Upload បរាជ័យ"); }
            }
        };
        xhr.onerror = () => { bar.classList.remove("is-visible"); showError("Upload បរាជ័យ — បញ្ហាបណ្តាញ"); };
        xhr.send(form);
    }

    // -------------------------------------------------------------------
    // File list
    // -------------------------------------------------------------------

    async function loadFiles() {
        const listEl = $("vault-file-list");
        try {
            const result = await api("/files?category=" + encodeURIComponent(activeCategory));
            renderFiles(result.files || []);
        } catch (e) {
            if (e.status === 401) { unlockToken = null; refreshStatus(); return; }
            listEl.innerHTML = `<div class="vault-empty">មិនអាចទាញយកបញ្ជីឯកសារបានទេ</div>`;
        }
    }

    function renderFiles(files) {
        const listEl = $("vault-file-list");
        if (!files.length) {
            listEl.innerHTML = `<div class="vault-empty">មិនទាន់មានឯកសារ ${CATEGORY_LABELS[activeCategory]} នៅឡើយទេ</div>`;
            return;
        }
        listEl.innerHTML = "";
        files.forEach((f) => {
            const row = document.createElement("div");
            row.className = "vault-file-row";
            row.innerHTML = `
                <span class="vault-file-icon">${CATEGORY_ICONS[f.category] || "📄"}</span>
                <div class="vault-file-meta">
                    <div class="vault-file-name">${escapeHtml(f.original_name)}</div>
                    <div class="vault-file-sub">${fmtSize(f.size_bytes)} · ${new Date(f.uploaded_at).toLocaleString()}</div>
                </div>
                <div class="vault-file-actions">
                    <button class="vault-icon-btn" title="Download" data-action="download" data-id="${f.id}">⭳</button>
                    <button class="vault-icon-btn danger" title="Delete" data-action="delete" data-id="${f.id}">✕</button>
                </div>`;
            listEl.appendChild(row);
        });

        listEl.querySelectorAll("[data-action='download']").forEach((btn) => {
            btn.addEventListener("click", () => downloadFile(btn.dataset.id));
        });
        listEl.querySelectorAll("[data-action='delete']").forEach((btn) => {
            btn.addEventListener("click", () => deleteFile(btn.dataset.id));
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    async function downloadFile(id) {
        try {
            const res = await fetch(`/api/vault/files/${id}/download`, {
                headers: unlockToken ? { "X-Vault-Token": unlockToken } : {},
                credentials: "same-origin",
            });
            if (!res.ok) { const body = await res.json(); showError(body.error || "Download បរាជ័យ"); return; }
            const blob = await res.blob();
            const disposition = res.headers.get("Content-Disposition") || "";
            const match = disposition.match(/filename="?([^"]+)"?/);
            const filename = match ? match[1] : "file";
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
        } catch (e) { showError("Download បរាជ័យ"); }
    }

    async function deleteFile(id) {
        if (!window.confirm("លុបឯកសារនេះ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។")) return;
        try {
            await api(`/files/${id}`, { method: "DELETE" });
            loadFiles();
        } catch (e) { showError(e.message); }
    }

    // -------------------------------------------------------------------
    // Boot
    // -------------------------------------------------------------------

    document.addEventListener("DOMContentLoaded", function () {
        if (!$("vault-card")) return; // section not present on this page
        initTabs();
        initDropzone();
        refreshStatus();

        // If we just came back from a Google OAuth redirect, drop the query param
        if (window.location.search.includes("vault_google_linked")) {
            window.history.replaceState({}, "", window.location.pathname);
        }
    });
})();
