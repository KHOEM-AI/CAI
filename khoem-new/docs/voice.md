# KHOEM_AI Voice Engine

> **Version:** 2.2  <!-- កែពី 3.3 ឲ្យត្រូវនឹង roadmap.md Version 2.2 -->
> **Module (backend):** `core/voice_engine.py`  
> **Module (frontend):** `static/js/voice.js`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Features](#2-features)
3. [Browser Support](#3-browser-support)
4. [Voice Profiles](#4-voice-profiles)
5. [Persona Mapping](#5-persona-mapping)
6. [Frontend — voice.js](#6-frontend--voicejs)
7. [Backend — voice_engine.py](#7-backend--voice_enginepy)
8. [Voice Commands](#8-voice-commands)
9. [Voice Navigation](#9-voice-navigation)
10. [Error Handling](#10-error-handling) ⬅️ **NEW**
11. [Privacy & Data Retention](#11-privacy--data-retention) ⬅️ **NEW**
12. [Future Roadmap](#12-future-roadmap)

---

## 1. Overview

KHOEM_AI Voice Engine adds full speech capability to the assistant — both **listening** (Speech Recognition) and **speaking** (Text-to-Speech). It runs entirely in the browser using the **Web Speech API**, requires no external API key for basic use, and maps each AI persona to an appropriate voice profile.

```
User speaks  →  SpeechRecognition  →  KHOEM_AI  →  SpeechSynthesis  →  User hears
```

---

## 2. Features

| Feature                | Description                                                        |
|------------------------|--------------------------------------------------------------------|
| **Speech Recognition** | Convert user speech to text, sent to `/api/chat`                  |
| **Text-to-Speech**     | Read AI replies aloud using the matched voice profile             |
| **Browser Voice**      | Uses Web Speech API — no server round-trip, no API key needed     |
| **Voice Profiles**     | 6 distinct voices (age × gender) selectable per persona           |
| **Voice Commands**     | Trigger actions by speaking keywords (stop, repeat, navigate …)  |
| **Voice Navigation**   | Speak a destination to invoke `/api/directions`                   |

---

## 3. Browser Support

| API                    | Chrome | Edge | Firefox | Safari |
|------------------------|--------|------|---------|--------|
| `SpeechRecognition`    | ✅     | ✅   | ⚠️ partial | ⚠️ partial |
| `SpeechSynthesis`      | ✅     | ✅   | ✅       | ✅     |
| **Web Speech API**     | ✅ Full | ✅ Full | ⚠️ Limited | ⚠️ Limited |

> **Recommended browser:** Google Chrome or Microsoft Edge for full functionality.

**Detection snippet (voice.js)**
```javascript
const hasSpeechRecognition =
  "SpeechRecognition" in window || "webkitSpeechRecognition" in window;

const hasSpeechSynthesis = "speechSynthesis" in window;
```

---

## 4. Voice Profiles

Six profiles are defined by two dimensions: **gender** (Male / Female) and **age group** (Child / Adult / Elder).

| Profile ID      | Gender | Age Group | Pitch | Rate  | Typical Use             |
|-----------------|--------|-----------|-------|-------|--------------------------|
| `male_child`    | Male   | Child     | High  | Fast  | Kids Mode               |
| `male_adult`    | Male   | Adult     | Mid   | Normal| Teaching, Navigation    |
| `male_elder`    | Male   | Elder     | Low   | Slow  | Analysis, Authority     |
| `female_child`  | Female | Child     | High  | Fast  | Kids Mode               |
| `female_adult`  | Female | Adult     | Mid   | Normal| Friendly Chat, Assistant|
| `female_elder`  | Female | Elder     | Low   | Slow  | Formal contexts         |

**Profile object structure**
```javascript
const VOICE_PROFILES = {
  male_child:   { gender: "male",   pitch: 1.6, rate: 1.2 },
  male_adult:   { gender: "male",   pitch: 1.0, rate: 1.0 },
  male_elder:   { gender: "male",   pitch: 0.7, rate: 0.85 },
  female_child: { gender: "female", pitch: 1.8, rate: 1.2 },
  female_adult: { gender: "female", pitch: 1.2, rate: 1.0 },
  female_elder: { gender: "female", pitch: 0.9, rate: 0.85 },
};
```

---

## 5. Persona Mapping

| Persona          | Voice Profile   | Rationale                                  |
|------------------|-----------------|--------------------------------------------|
| **Analysis**     | `male_elder`    | Deep, authoritative tone for data analysis |
| **Teaching**     | `male_adult`    | Clear, measured pace for explaining topics |
| **Friendly Chat**| `female_adult`  | Warm and approachable conversational tone  |
| **Kids Mode**    | `male_child` / `female_child` | Bright, energetic tone for children |
| **Navigation**   | `male_adult`    | Calm, directive voice for turn-by-turn     |
| **Assistant**    | `female_adult`  | Professional and helpful everyday voice    |

```javascript
const PERSONA_VOICE_MAP = {
  analysis:      "male_elder",
  teaching:      "male_adult",
  friendly_chat: "female_adult",
  kids_mode:     "female_child",
  navigation:    "male_adult",
  assistant:     "female_adult",
};

function getVoiceProfile(persona) {
  const id = PERSONA_VOICE_MAP[persona] ?? "female_adult";
  return VOICE_PROFILES[id];
}
```

---

## 6. Frontend — `voice.js`

### Speech Recognition

```javascript
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = new SpeechRecognition();
recognition.lang       = "km-KH";
recognition.continuous = false;
recognition.interimResults = false;

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript.trim();
  handleVoiceInput(transcript);
};

// NOTE: onerror is now fully handled in §10, not just console.log
recognition.onerror = (event) => handleRecognitionError(event);

function startListening() {
  try {
    recognition.start();
  } catch (err) {
    handleRecognitionError({ error: "start-failed", message: err.message });
  }
}

function stopListening() {
  recognition.stop();
}
```

### Text-to-Speech (with voice-loading fix)

```javascript
// Chrome loads voices asynchronously — getVoices() can return []
// on first call. Cache voices once they're ready.
let cachedVoices = [];

function loadVoices() {
  cachedVoices = window.speechSynthesis.getVoices();
}

loadVoices();
if (hasSpeechSynthesis && "onvoiceschanged" in window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text, persona = "assistant") {
  if (!hasSpeechSynthesis) {
    showTextFallback(text); // §10 — degrade gracefully
    return;
  }

  window.speechSynthesis.cancel();

  const profile   = getVoiceProfile(persona);
  const utterance = new SpeechSynthesisUtterance(text);

  utterance.lang  = "km-KH";
  utterance.pitch = profile.pitch;
  utterance.rate  = profile.rate;

  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();
  const match  = voices.find((v) =>
    v.lang.startsWith("km") ||
    v.name.toLowerCase().includes(profile.gender)
  );
  if (match) utterance.voice = match;

  utterance.onerror = (event) => handleSynthesisError(event);

  window.speechSynthesis.speak(utterance);
}
```

### handleVoiceInput

```javascript
async function handleVoiceInput(transcript) {
  if (handleVoiceCommand(transcript)) return;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: SESSION_ID, message: transcript }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data.reply) {
      appendMessage("assistant", data.reply);
      speak(data.reply, currentPersona);
    }
  } catch (err) {
    handleNetworkError(err); // §10
  }
}
```

---

## 7. Backend — `voice_engine.py`

```python
# core/voice_engine.py

VOICE_PROFILES: dict[str, dict] = {
    "male_child":   {"gender": "male",   "pitch": 1.6, "rate": 1.2},
    "male_adult":   {"gender": "male",   "pitch": 1.0, "rate": 1.0},
    "male_elder":   {"gender": "male",   "pitch": 0.7, "rate": 0.85},
    "female_child": {"gender": "female", "pitch": 1.8, "rate": 1.2},
    "female_adult": {"gender": "female", "pitch": 1.2, "rate": 1.0},
    "female_elder": {"gender": "female", "pitch": 0.9, "rate": 0.85},
}

PERSONA_VOICE_MAP: dict[str, str] = {
    "analysis":      "male_elder",
    "teaching":      "male_adult",
    "friendly_chat": "female_adult",
    "kids_mode":     "female_child",
    "navigation":    "male_adult",
    "assistant":     "female_adult",
}


def get_voice_profile(persona: str) -> dict:
    profile_id = PERSONA_VOICE_MAP.get(persona, "female_adult")
    return VOICE_PROFILES[profile_id]


def list_profiles() -> list[dict]:
    return [{"id": pid, **profile} for pid, profile in VOICE_PROFILES.items()]
```

### API Endpoint — `GET /api/voices`

**Route wiring (routes/voice_routes.py)** — *មិនទាន់មានក្នុងឯកសារដើម, ត្រូវបន្ថែម:*
```python
from flask import Blueprint, jsonify
from core.voice_engine import list_profiles

voice_bp = Blueprint("voice", __name__)

@voice_bp.route("/api/voices", methods=["GET"])
def get_voices():
    try:
        return jsonify(list_profiles()), 200
    except Exception as e:
        return jsonify({"error": "voice_profiles_unavailable", "detail": str(e)}), 500
```

Register in `app.py`:
```python
from routes.voice_routes import voice_bp
app.register_blueprint(voice_bp)
```

**Response `200`**
```json
[
  { "id": "male_child",   "gender": "male",   "pitch": 1.6, "rate": 1.2  },
  { "id": "male_adult",   "gender": "male",   "pitch": 1.0, "rate": 1.0  },
  { "id": "male_elder",   "gender": "male",   "pitch": 0.7, "rate": 0.85 },
  { "id": "female_child", "gender": "female", "pitch": 1.8, "rate": 1.2  },
  { "id": "female_adult", "gender": "female", "pitch": 1.2, "rate": 1.0  },
  { "id": "female_elder", "gender": "female", "pitch": 0.9, "rate": 0.85 }
]
```

---

## 8. Voice Commands

| Command (spoken)           | Action                                          |
|-----------------------------|-------------------------------------------------|
| `"ឈប់"` / `"stop"`        | Stop current speech synthesis                   |
| `"ថ្មី"` / `"new"`         | Clear chat and start a new session              |
| `"និយាយម្ដងទៀត"` / `"repeat"` | Re-read the last assistant reply           |
| `"ជំនួយ"` / `"help"`      | Read out available voice commands               |
| `"ស្ងាត់"` / `"mute"`      | Disable TTS until `"unmute"` is spoken          |
| `"ដឹកនាំ …"` / `"navigate to …"` | Trigger voice navigation (see §9)       |

**Improved matching — supports partial phrases, not just exact match**
```javascript
function handleVoiceCommand(transcript) {
  const t = transcript.toLowerCase().trim();

  if (t.includes("ឈប់") || t.includes("stop")) {
    window.speechSynthesis.cancel();
    return true;
  }
  if (t.includes("ថ្មី") || t.includes("new")) {
    clearChat();
    return true;
  }
  if (t.includes("និយាយម្ដងទៀត") || t.includes("repeat")) {
    if (lastReply) speak(lastReply, currentPersona);
    return true;
  }
  if (t.startsWith("ដឹកនាំ") || t.startsWith("navigate to")) {
    const destination = t.replace(/^ដឹកនាំ|^navigate to/i, "").trim();
    if (!destination) {
      speak("សូមប្រាប់ទីតាំងដែលចង់ទៅ", "navigation");
      return true;
    }
    handleVoiceNavigation(destination);
    return true;
  }

  return false; // not a command — pass to chat
}
```

---

## 9. Voice Navigation

```javascript
async function handleVoiceNavigation(destination) {
  if (!navigator.geolocation) {
    speak("ទូរស័ព្ទរបស់អ្នកមិនគាំទ្រ GPS ទេ", "navigation");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
      try {
        const response = await fetch("/api/directions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin, destination, mode: "driving" }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        speak(data.instruction, "navigation");
      } catch (err) {
        handleNetworkError(err);
      }
    },
    (geoErr) => handleGeolocationError(geoErr) // §10
  );
}
```

---

## 10. Error Handling

All voice-related failures degrade gracefully — the user should never be left with silence and no explanation.

### 10.1 Microphone / Recognition Errors

```javascript
function handleRecognitionError(event) {
  const messages = {
    "not-allowed":    "សូមអនុញ្ញាតឲ្យប្រើមីក្រូហ្វូន ដើម្បីប្រើមុខងារនិយាយ",
    "no-speech":      "មិនឮសំឡេងទេ សូមព្យាយាមម្ដងទៀត",
    "audio-capture":  "រកមិនឃើញមីក្រូហ្វូនទេ",
    "network":        "មានបញ្ហាបណ្តាញ សូមព្យាយាមម្ដងទៀត",
    "start-failed":   "មិនអាចចាប់ផ្តើមស្តាប់សំឡេងបានទេ",
  };

  const msg = messages[event.error] || "មានបញ្ហាមិនស្គាល់ជាមួយការស្តាប់សំឡេង";
  console.error("SpeechRecognition error:", event.error);
  showToast(msg);       // visible UI feedback, not just console
  appendMessage("system", msg);
}
```

### 10.2 Speech Synthesis Errors

```javascript
function handleSynthesisError(event) {
  console.error("SpeechSynthesis error:", event.error);
  showToast("មិនអាចអានសំឡេងបានទេ — សូមអានពីអត្ថបទជំនួសវិញ");
  // Text is already appended to chat via appendMessage, so user
  // still has the reply visible even if audio fails.
}
```

### 10.3 Network / API Errors

```javascript
function handleNetworkError(err) {
  console.error("Network error:", err);
  const msg = "មិនអាចភ្ជាប់ទៅ server បានទេ សូមពិនិត្យអ៊ីនធឺណិត";
  showToast(msg);
  appendMessage("system", msg);
}
```

### 10.4 Geolocation Errors (Voice Navigation)

```javascript
function handleGeolocationError(geoErr) {
  const messages = {
    1: "អ្នកមិនបានអនុញ្ញាតទីតាំង (GPS) ទេ",  // PERMISSION_DENIED
    2: "មិនអាចរកទីតាំងបានទេ",                 // POSITION_UNAVAILABLE
    3: "ការស្នើសុំទីតាំងអស់ពេលកំណត់",         // TIMEOUT
  };
  const msg = messages[geoErr.code] || "មានបញ្ហាមិនស្គាល់ជាមួយទីតាំង";
  speak(msg, "navigation");
  showToast(msg);
}
```

### 10.5 Unsupported Browser Fallback

```javascript
function showTextFallback(text) {
  // If TTS is unavailable, at minimum ensure the text
  // is visibly rendered (it already is via appendMessage),
  // and optionally flash a banner once per session.
  if (!sessionStorageWarned) {
    showToast("កម្មវិធីរុករករបស់អ្នកមិនគាំទ្រការអានសំឡេងទេ");
    sessionStorageWarned = true;
  }
}
```

> **Design rule:** every voice failure must have (1) a console log for developers, (2) a Khmer user-facing message via `showToast`/`appendMessage`, and (3) a safe fallback so the conversation itself is never blocked.

---

## 11. Privacy & Data Retention

- **Transcript storage:** *(ត្រូវបញ្ជាក់ — តើ voice transcript រក្សាទុកក្នុង `logs/` ឬ database ដែរឬទេ, រយៈពេលប៉ុន្មាន)*
- **Audio storage:** Web Speech API មិនផ្ញើ raw audio ទៅ server ក្នុង implementation បច្ចុប្បន្ន (ដំណើរការក្នុង browser ទាំងស្រុង) — គួររក្សាការធានានេះឲ្យច្បាស់ក្នុងឯកសារ
- **Voice Cloning (§12):** នៅតែជាប់លក្ខខណ្ឌថា ប្រើតែសំឡេងផ្ទាល់ខ្លួនរបស់អ្នកប្រើ ដែលបានយល់ព្រមប៉ុណ្ណោះ

---

## 12. Future Roadmap

| Feature                   | Status      | Notes                                              |
|----------------------------|-------------|------------------------------------------------------|
| **OpenAI TTS**            | 🔜 Planned  | Server-side, higher quality, via `/api/tts`        |
| **ElevenLabs TTS**        | 🔜 Planned  | Premium quality, realistic Khmer voices            |
| **Offline Voice**         | 🔜 Planned  | On-device model (e.g. Coqui TTS / Whisper)         |
| **Voice Cloning**         | 🔜 Planned  | User-owned voices only — no third-party voice use  |
| **Emotion Voice**         | 🔜 Planned  | Adjust tone based on sentiment in AI reply         |
| **Multi-language Voice**  | 🔜 Planned  | Auto-switch lang based on detected input language  |

> **Privacy note on Voice Cloning:** Voice cloning will only be available for voices that the user themselves records and consents to. Cloning third-party voices is not supported.

---

*KHOEM_AI 2.2 — Voice Engine — Built with Web Speech API*
