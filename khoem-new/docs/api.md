# KHOEM_AI — API Documentation

> **Base URL (local):** `http://localhost:5000`  
> **Version:** 2.2  <!-- កែពី 3.0 ឲ្យត្រូវនឹង roadmap.md/voice.md/navigator.md/database.md/security.md/accessibility.md -->
> **All request bodies:** `Content-Type: application/json`  
> **All responses:** `Content-Type: application/json`

---

## Table of Contents

1. [System](#1-system)
2. [Chat](#2-chat)
3. [Conversation History](#3-conversation-history)
4. [Vision](#4-vision)
5. [Navigation](#5-navigation) ⚠️ **duplicate endpoints — see note**
6. [Saved Places](#6-saved-places)
7. [Voice](#7-voice) ⬅️ **NEW — was missing entirely**
8. [Video](#8-video) ⬅️ **NEW — was missing entirely**
9. [Accessibility](#9-accessibility) ⬅️ **NEW — was missing entirely**
10. [Authentication & Session Model](#10-authentication--session-model) ⬅️ **NEW**
11. [Input Validation / Security](#11-input-validation--security) ⬅️ **NEW**
12. [HTTP Status Codes](#12-http-status-codes)
13. [Error Format](#13-error-format)
14. [Endpoint Summary Table](#14-endpoint-summary-table) ⬅️ **NEW**

---

## 1. System

### `GET /api/status`

Returns current system and model information.

**Response `200`**
```json
{
  "status": "online",
  "system": "khoem_ai",
  "version": "2.2",
  "model": "llama-3.3-70b-versatile",
  "vision_model": "llama-3.2-90b-vision-preview"
}
```

---

## 2. Chat

### `POST /api/chat`

Send a message and receive an AI reply. Conversation history is automatically stored per `session_id` (`database.md` §2 `conversations`).

**Request body**

| Field           | Type   | Required | Description                                              |
|-----------------|--------|----------|------------------------------------------------------------|
| `session_id`    | string | ✅       | Unique identifier for the conversation session            |
| `message`       | string | ✅       | The user's message (max 4 000 characters)                |
| `system_prompt` | string | ❌       | Override the default AI system instruction                |

```json
{
  "session_id": "abc123",
  "message": "តើអ្នកអាចជួយខ្ញុំអ្វីបាន?",
  "system_prompt": "អ្នកជាជំនួយការឆ្លាតវៃឈ្មោះ KHOEM_AI។"
}
```

**Response `200`**
```json
{
  "reply": "ខ្ញុំអាចជួយអ្នកបានក្នុងការឆ្លើយសំណួរ ...",
  "session_id": "abc123"
}
```

**Response `400`** — missing fields, message too long, or `message`/`system_prompt` blocked by `security_engine.safe_validate_input()` (`security.md` §3/§6 — **not documented in the original api.md at all**)
**Response `502`** — upstream LLM API error

---

## 3. Conversation History

### `GET /api/history/<session_id>`

*(unchanged from original — see below)*

| Query Parameter | Type    | Default | Description                        |
|------------------|---------|---------|--------------------------------------|
| `limit`          | integer | `100`   | Maximum number of messages (≤ 500)  |

**Response `200`**
```json
{
  "session_id": "abc123",
  "messages": [
    { "role": "user",      "content": "តើអ្នកអាចជួយខ្ញុំអ្វីបាន?" },
    { "role": "assistant", "content": "ខ្ញុំអាចជួយអ្នកបានក្នុងការ ..." }
  ]
}
```

### `DELETE /api/history/<session_id>`

**Response `200`**
```json
{ "status": "cleared", "session_id": "abc123" }
```

> ⚠️ **Missing in original doc:** no ownership/auth check — anyone who knows/guesses a `session_id` can read or delete another user's entire chat history. Same class of gap flagged in `database.md` §8 and `video_khoemai.md` §6. See §10 below.

---

## 4. Vision

### `POST /api/vision`

| Field       | Type   | Required | Description                                          |
|-------------|--------|----------|--------------------------------------------------------|
| `image`     | string | ✅       | Base64-encoded image data (without data-URI prefix)   |
| `question`  | string | ❌       | Question about the image (default: describe it)       |
| `mime_type` | string | ❌       | `image/jpeg` (default), `image/png`, `image/webp`     |

**Response `200`**
```json
{ "answer": "រូបភាពនេះបង្ហាញ ..." }
```

**Response `400`** — `image` field missing, or exceeds a max size *(⚠️ no max image size documented in the original — base64 image payloads can be huge; recommend documenting a limit, e.g. 10 MB decoded)*
**Response `502`** — Vision API error

---

## 5. Navigation ⚠️

### `POST /api/directions` *(original, stub)*

> ⚠️ **Duplicate/conflicting endpoint.** `navigator.md` §7 already documents a **working** `POST /api/navigator/route` (with real haversine distance/duration, per the updated `navigator.md`). This older `/api/directions` stub endpoint appears to be superseded by it. Recommend **deprecating `/api/directions`** in favor of `/api/navigator/route`, or clearly documenting why both exist (e.g. one is a simple wrapper, the other the full engine).

**Request body**
```json
{
  "origin": "11.5564, 104.9282",
  "destination": "ផ្សារកណ្តាល",
  "mode": "driving"
}
```

**Response `200`** *(still a stub — see warning above)*
```json
{
  "status": "stub",
  "origin": "11.5564, 104.9282",
  "destination": "ផ្សារកណ្តាល",
  "mode": "driving",
  "instruction": "ការណែនាំផ្លូវនឹងបង្ហាញនៅពេលដែល Maps API ត្រូវបានភ្ជាប់"
}
```

---

### `POST /api/navigator/route` *(cross-ref `navigator.md` §7)*

Real route calculation (straight-line estimate, see `navigator.md` §6.1 for current limitations). See `navigator.md` for full request/response schema — not duplicated here to avoid drift between docs.

### `GET /api/navigator/geocode?q=<query>` *(cross-ref `navigator.md` §7)*

Place-name → coordinates lookup. Query is validated via `security_engine` before being sent to Nominatim (`navigator.md` §11).

---

## 6. Saved Places

### `POST /api/places`

| Field        | Type   | Required | Description                             |
|--------------|--------|----------|--------------------------------------------|
| `session_id` | string | ✅       | Session identifier                        |
| `label`      | string | ✅       | Place name/label ("unique per session" — ⚠️ not enforced at DB level, see note) |
| `lat`        | number | ✅       | Latitude (`-90` to `90`)                   |
| `lng`        | number | ✅       | Longitude (`-180` to `180`)                |

> ⚠️ **Schema mismatch:** this doc states `label` is "unique per session", but `database.md` §3's `saved_places` schema has **no `UNIQUE` constraint** on `(session_id, label)` — as written, saving the same label twice creates a duplicate row rather than updating. Either add the constraint + `UPSERT` logic, or correct this doc to say duplicates are allowed.

**Response `200`**
```json
{ "status": "saved", "label": "ផ្ទះ", "lat": 11.5564, "lng": 104.9282 }
```

**Response `400`** — missing/invalid fields

### `GET /api/places/<session_id>`
### `GET /api/places/<session_id>/<label>`
### `DELETE /api/places/<session_id>/<label>`

*(unchanged from original)* — same ownership-check gap as §3/§10 applies here too.

---

## 7. Voice *(NEW — was completely missing from the original api.md)*

Cross-reference `voice.md` §7 for full detail.

### `GET /api/voices`

Returns the 6 available voice profiles for frontend dropdowns.

**Response `200`** — array of `{ id, gender, pitch, rate }` — see `voice.md` §7 for the exact payload.

---

## 8. Video *(NEW — was completely missing from the original api.md)*

Cross-reference `video_khoemai.md` §6 for full detail. Async job pattern — generation does not block the request.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/video/generate` | Queue a video generation job → `202` + `job_id` |
| `GET` | `/api/video/info?job_id=<id>` | Poll job status |
| `GET` | `/api/video/history?session_id=<id>` | List a session's past videos |
| `DELETE` | `/api/video/delete` | Delete a video (requires ownership check — see `video_khoemai.md` §6) |

---

## 9. Accessibility *(NEW — was completely missing from the original api.md)*

Cross-reference `accessibility.md` §5 for full detail.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/accessibility/settings?session_id=<id>` | Get theme/text-scale/magnifier settings |
| `POST` | `/api/accessibility/settings` | Save settings |

---

## 10. Authentication & Session Model

*(ខ្វះទាំងស្រុងក្នុងឯកសារដើម — សំខាន់ខ្លាំង)*

**Current state:** every endpoint above is scoped by a client-supplied `session_id` string. There is **no authentication** — no login, no token, no proof that a request "owns" a given `session_id`. This means:

- Anyone who obtains/guesses a `session_id` can read chat history (`/api/history`), saved places (`/api/places`), videos (`/api/video/history`), and accessibility settings for that session.
- Nothing currently prevents brute-forcing or enumerating `session_id` values, since there's no rate limiting either (`security.md` §8 "Rate Limiter" / "JWT Authentication" — both 🔴 Planned).

**Until JWT Authentication ships**, recommend at minimum:
- Generating `session_id` as a long random UUID (not a guessable sequence) — client-side generation method isn't documented; should be.
- Rate-limiting per IP as a stopgap (`security.md` §8).

---

## 11. Input Validation / Security

*(ខ្វះទាំងស្រុងក្នុងឯកសារដើម)* Cross-reference `security.md`. The following fields should be (and per the updated companion docs, now are) passed through `security_engine.safe_validate_input()` before reaching business logic:

| Endpoint | Field(s) validated |
|---|---|
| `POST /api/chat` | `message`, `system_prompt` |
| `POST /api/vision` | `question` |
| `GET /api/navigator/geocode` | `q` |
| `POST /api/video/generate` | `prompt` |

Fields **not yet covered** by validation in any doc reviewed so far: `label` in `/api/places` (free-text, stored and later rendered — potential stored-XSS if ever rendered as HTML instead of text).

---

## 12. HTTP Status Codes

| Code | Meaning                                              |
|------|--------------------------------------------------------|
| 200  | Success                                                |
| 202  | Accepted — async job queued (`/api/video/generate`)   |
| 400  | Bad Request — missing, invalid, or blocked input       |
| 401  | Unauthorized *(reserved — not yet used; will apply once JWT Auth ships)* |
| 403  | Forbidden — resource exists but caller doesn't own it (e.g. `/api/video/delete`) |
| 404  | Not Found — resource does not exist                    |
| 405  | Method Not Allowed                                     |
| 429  | Too Many Requests — rate/plan limit exceeded (e.g. daily video generation limit) |
| 500  | Internal Server Error                                  |
| 502  | External API Error — upstream LLM/Maps/Vision provider failed |

> Original table only had `200/400/404/405/500/502` — `202`, `401`, `403`, `429` are used by endpoints documented elsewhere (video, accessibility) but were missing from the status table.

---

## 13. Error Format

```json
{ "error": "Human-readable error description" }
```

**Example — missing field `400`**
```json
{ "error": "ទុតតម្រូវការ: session_id, message" }
```

**Example — upstream provider unavailable `502`**
```json
{ "error": "សេវាកម្ម AI មិនអាចប្រើបានពេលនេះទេ" }
```

> ⚠️ **Changed from original:** the original example exposed the upstream provider's name directly (`"Groq API បញ្ហា (HTTP 503)"`). Recommend a generic user-facing message instead — naming the specific backend provider in a public error response is a minor information-disclosure issue (helps an attacker map your infrastructure). Log the real provider/status code server-side instead.

---

## 14. Endpoint Summary Table

| Method | Path | Section | Auth? |
|---|---|---|---|
| GET | `/api/status` | §1 | none |
| POST | `/api/chat` | §2 | none |
| GET | `/api/history/<session_id>` | §3 | none ⚠️ |
| DELETE | `/api/history/<session_id>` | §3 | none ⚠️ |
| POST | `/api/vision` | §4 | none |
| POST | `/api/directions` | §5 | none — ⚠️ consider deprecating |
| POST | `/api/navigator/route` | §5 | none |
| GET | `/api/navigator/geocode` | §5 | none |
| POST | `/api/places` | §6 | none ⚠️ |
| GET | `/api/places/<session_id>` | §6 | none ⚠️ |
| GET | `/api/places/<session_id>/<label>` | §6 | none ⚠️ |
| DELETE | `/api/places/<session_id>/<label>` | §6 | none ⚠️ |
| GET | `/api/voices` | §7 | none |
| POST | `/api/video/generate` | §8 | none ⚠️ (plan limits unenforced) |
| GET | `/api/video/info` | §8 | none |
| GET | `/api/video/history` | §8 | none ⚠️ |
| DELETE | `/api/video/delete` | §8 | none ⚠️ (needs ownership check) |
| GET | `/api/accessibility/settings` | §9 | none |
| POST | `/api/accessibility/settings` | §9 | none |

⚠️ = flagged in §10 as needing an ownership/auth check once JWT Authentication ships.

---

*khoem-new/docs/api.md — Built with Flask*
