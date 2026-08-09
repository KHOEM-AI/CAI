/**
 * ==============================================================================
 * KHOEM_AI Nexus Hub - Frontend Logic (Updated: Google Sign-In auth)
 * File: static/js/khoem_ai_nexus_hub.js
 *
 * ការផ្លាស់ប្តូរសំខាន់ៗ៖
 * - លុប USER_CREDENTIALS hardcode ចេញ (email/device_id លែងនៅ frontend ទៀតហើយ)
 * - លុប verifyFaceBiometrics() ក្លែងក្លាយចេញ
 * - Server ជាអ្នកផ្ទៀងផ្ទាត់អត្តសញ្ញាណម្ចាស់ (តាម session cookie ដែលបានពី Google Sign-In)
 * - បន្ថែម: ហៅ window.unlockCamera() (បើមាននៅលើទំព័រ) បន្ទាប់ពី Sign-In ជោគជ័យ
 * ==============================================================================
 */

// ១. ដំណើរការពេលទទួល Google Sign-In (ហៅដោយ Google Identity Services library)
async function handleGoogleSignIn(response) {
    try {
        const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // ចាំបាច់ ដើម្បីឲ្យ browser រក្សា session cookie
            body: JSON.stringify({ credential: response.credential })
        });
        const result = await res.json();

        if (result.ok) {
            console.log("[KHOEM_AI] ចូលជោគជ័យ:", result.message);
            const statusEl = document.getElementById("nexus-login-status");
            if (statusEl) statusEl.textContent = result.message;

            // បើទំព័រនេះមាន camera lock (khoem_ai_nexus_hub.html) — ដោះសោវា
            if (typeof window.unlockCamera === "function") {
                window.unlockCamera();
            }

            fetchNexusEcosystem();
        } else {
            alert("ការចូលបរាជ័យ: " + result.message);
        }
    } catch (error) {
        console.error("Google Sign-In error:", error);
        alert("មានបញ្ហាក្នុងការចូលគណនី");
    }
}

// ២. មុខងារពិនិត្យមើលស្ថានភាពឧបករណ៍ទាំងអស់ (Real-time Status)
async function fetchNexusEcosystem() {
    try {
        console.log("[KHOEM_AI] Fetching devices status...");
        const response = await fetch("/api/nexus/status", { credentials: "include" });
        const data = await response.json();

        if (response.ok) {
            console.log("Ecosystem Data:", data);
            // renderDevicesUI(data.ecosystem);
        } else {
            console.error("Failed to load status:", data);
        }
    } catch (error) {
        console.error("Network Error:", error);
    }
}

// ៣. មុខងារបញ្ជាឧបករណ៍
// កំណត់ចំណាំ៖ គ្មាន email/device_id ត្រូវផ្ញើពី client ទៀតទេ —
// server ស្គាល់ថាអ្នកណាបញ្ជា ពី session cookie ដែលបានបង្កើតតាំងពេល Google Sign-In
async function sendCommand(targetDevice, action) {
    console.log(`[KHOEM_AI] Initiating command: ${action} -> ${targetDevice}`);

    const payload = {
        target_device: targetDevice,
        action: action
    };

    try {
        const response = await fetch("/api/nexus/control", {
            method: "POST",
            credentials: "include", // ផ្ញើ session cookie ជាមួយសំណើ
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.status === 401 || response.status === 403) {
            alert("សូមចូលគណនី Google ជាម្ចាស់ជាមុនសិន");
            return;
        }

        if (response.ok) {
            console.log(`✅ Success: ${result.message}`);
            fetchNexusEcosystem();
        } else {
            console.error(`❌ Error: ${result.message}`);
            alert(`ការបញ្ជាបរាជ័យ: ${result.message}`);
        }
    } catch (error) {
        console.error("Critical Error during command execution:", error);
        alert("មានបញ្ហាក្នុងការតភ្ជាប់ទៅកាន់ Server!");
    }
}

// ៤. ដំណើរការមុខងារស្វ័យប្រវត្តិ ពេលបើកវេបសាយ
document.addEventListener("DOMContentLoaded", () => {
    console.log("KHOEM_AI Nexus Hub Frontend JS Loaded.");
    fetchNexusEcosystem();
});

// មុខងារនេះត្រូវហៅតាម Google Identity Services callback (ដាក់ក្នុង HTML):
// <div id="g_id_onload"
//      data-client_id="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
//      data-callback="handleGoogleSignIn">
// </div>
// <div class="g_id_signin"></div>
