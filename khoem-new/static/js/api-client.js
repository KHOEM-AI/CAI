/* ==============================================================================
   static/js/api-client.js — KHOEM_AI 3.3
   Wrapper រួមសម្រាប់ហៅ API ទាំងអស់ — ភ្ជាប់ X-API-Key ស្វ័យប្រវត្តិ
   ព្រមទាំងគ្រប់គ្រង error 401 (key ខុស) និង 429 (ហៅញឹកពេក)
   ==============================================================================
   របៀបប្រើក្នុង app.js / chat.js ដទៃទៀត (ជំនួស fetch() ធម្មតា):

       // ចាស់:
       const response = await fetch("/api/chat", { method: "POST", ... });

       // ថ្មី:
       const data = await KhoemAPI.post("/api/chat", { session_id, message });

   ============================================================================== */

const KhoemAPI = (function () {
    "use strict";

    // សូមដាក់ key ដូចគ្នានឹង APP_API_KEY ក្នុង .env របស់ server
    // ⚠️ សម្រាប់ production ពិត មិនគួរ hardcode key ក្នុង client-side JS ទេ
    //    (អ្នកប្រើ "View Source" អាចឃើញបាន) — ជម្រើសសុវត្ថិភាពជាងគឺ៖
    //    1) ប្រើ session cookie + server-side auth ជំនួស API key ត្រង់ៗ, ឬ
    //    2) ចេញ key បណ្តោះអាសន្ន (short-lived token) ពី endpoint login
    //    ខាងក្រោមនេះសមស្របសម្រាប់ដំណាក់កាល MVP/personal-use tier ដំបូង។
    let apiKey = window.KHOEM_API_KEY || localStorage.getItem("khoem_api_key") || "";

    function setApiKey(key) {
        apiKey = key;
        localStorage.setItem("khoem_api_key", key);
    }

    async function _request(path, options = {}) {
        const headers = Object.assign(
            { "Content-Type": "application/json" },
            options.headers || {}
        );
        if (apiKey) headers["X-API-Key"] = apiKey;

        let response;
        try {
            response = await fetch(path, Object.assign({}, options, { headers }));
        } catch (networkError) {
            throw new KhoemAPIError("network", "មិនអាចភ្ជាប់ទៅ server បានទេ", 0);
        }

        if (response.status === 401) {
            throw new KhoemAPIError("unauthorized", "API key មិនត្រឹមត្រូវ ឬខ្វះខាត", 401);
        }

        if (response.status === 429) {
            const body = await response.json().catch(() => ({}));
            const retryAfter = body.retry_after_seconds || response.headers.get("Retry-After") || 5;
            throw new KhoemAPIError(
                "rate_limited",
                `សំណើច្រើនពេក សូមរង់ចាំ ${retryAfter} វិនាទី`,
                429,
                { retryAfter }
            );
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new KhoemAPIError("server", data.error || "កំហុសមិនស្គាល់", response.status);
        }
        return data;
    }

    class KhoemAPIError extends Error {
        constructor(type, message, status, extra = {}) {
            super(message);
            this.name = "KhoemAPIError";
            this.type = type;
            this.status = status;
            Object.assign(this, extra);
        }
    }

    return {
        setApiKey,
        get: (path) => _request(path, { method: "GET" }),
        post: (path, body) => _request(path, { method: "POST", body: JSON.stringify(body) }),
        del: (path) => _request(path, { method: "DELETE" }),
        Error: KhoemAPIError,
    };
})();

/* ==============================================================================
   ឧទាហរណ៍ការប្រើក្នុង chat.js ជាមួយការគ្រប់គ្រង error គ្រប់ករណី:

   try {
       const data = await KhoemAPI.post("/api/chat", { session_id: sid, message: msg });
       addMessage("assistant", data.reply);
   } catch (err) {
       if (err.type === "rate_limited") {
           addMessage("assistant", `⏳ ${err.message}`);
       } else if (err.type === "unauthorized") {
           addMessage("assistant", "🔒 សូមកំណត់ API key ឲ្យត្រឹមត្រូវជាមុនសិន");
       } else {
           addMessage("assistant", `⚠️ ${err.message}`);
       }
   }
   ============================================================================== */
