# KHOEM_AI System Architecture & Security Specification

> **Version:** 2.2  <!-- ⚠️ ដើមសរសេរ 3.3.0 — មិនត្រូវនឹង roadmap.md/voice.md/security.md/navigator.md/database.md/api.md/video_khoemai.md/accessibility.md ទាំងអស់ដែលនៅ 2.2 -->
> **Author/Owner:** KHOEM SOKSIVUTHA  
> **Environment:** Termux (Android / Linux Core) & Cloud WSGI Enterprise Deployment  
> **Status:** ⚠️ **CONTESTED — see §0 Critical Contradiction below, not confirmed PRODUCTION READY**

---

## 0. ⚠️ Critical Contradiction — Must Be Resolved Before Anything Else

ឯកសារនេះមានជម្លោះធ្ងន់ធ្ងរបំផុតក្នុងចំណោម docs ទាំងអស់ដែលបានពិនិត្យរហូតមកដល់ពេលនេះ:

| ការអះអាងក្នុងឯកសារនេះ | អ្វីដែល security.md / api.md / database.md (ដែលទើបកែ) និយាយ |
|---|---|
| Status: **"PRODUCTION READY (Secured)"** | `security.md` §8: Rate Limiter, JWT Auth, API Key, HTTPS, Encrypted DB, Audit Logs, IP Blocking, Request Signing, Role Permission **ទាំងអស់ជា 🔴 Planned** — មិនទាន់សាងសង់ទេ |
| Endpoint `/api/khoem-ai/process` ត្រូវការ **HMAC-SHA256 signature + Bearer token** | `api.md` §10/§14: រាល់ endpoint (`/api/chat`, `/api/vision`, `/api/places`, ...) មាន **Auth: none** ទាំងអស់ |
| "Hardcoded Credentials... removed" / "fail closed if missing" | `database.md` §1 flag ថា `.env` និង `database/khoem_ai.db` លេចឡើងក្នុង git commit history — ប្រសិនបើពិត `.env` មិនគួរមាន secret ណាសោះ តែឯកសារនេះមិនលើកឡើងអំពីបញ្ហា git-tracking នេះទាល់តែសោះ |
| Checklist §7 មាន **`[ ]` (មិនទាន់ធ្វើ)** ចំនួន 5 ក្នុង 6 ចំណុច (Rotate tokens, Set env vars, gunicorn/debug=False, TLS/proxy/rate-limit, verify HTML load order) | Checklist ខ្លួនឯង **contradicts** ចំណងជើង "PRODUCTION READY" — បើ 5/6 ចំណុចមិនទាន់ធីក តើអះអាងថា production ready បានយ៉ាងណា? |

**សេចក្តីសន្និដ្ឋាន:** ការពិពណ៌នា `core/khoem_ai_app.py` ជា "Production-Grade Refactored" ជាមួយ HMAC signing ហាក់ដូចជា **ផែនការ/prototype design ដែលមិនទាន់ត្រូវ wire ចូល endpoint ជាក់ស្តែងទាំងអស់ដែល `api.md` document** — ឬក៏វាជា endpoint ដាច់ដោយឡែក (`/api/khoem-ai/process`) ខុសពី `/api/chat` ជាដើម។ **ត្រូវការការបញ្ជាក់ពី owner** ថាតើ:
1. `/api/khoem-ai/process` ជា endpoint ថ្មីដាច់ដោយឡែក ហើយ `/api/chat` ជាដើមនៅតែគ្មាន auth ដដែល, ឬ
2. គ្រប់ endpoint ទាំងអស់គួរតែឆ្លងកាត់ HMAC signature នេះ ហើយ `api.md` ត្រូវកែទាំងស្រុង

ដល់ពេលបញ្ជាក់ ខ្ញុំកំណត់ Status ជា "Contested" មិនមែន "Production Ready" ទេ។

---

## 1. Executive Summary

KHOEM_AI គឺជា Enterprise Artificial Intelligence Command Center មាន real-time interactive UI, automated input/output guardrails, voice synthesis, GPS navigation integration, និង dynamic local memory engines។

ឯកសារនេះពិពណ៌នាអំពី security remediation design សម្រាប់ `core/khoem_ai_app.py` — សូមមើល §0 សម្រាប់ស្ថានភាពជាក់ស្តែងធៀបនឹង docs ដទៃទៀត។

---

## 2. Core Architecture & Project Structure

```text
khoem-new/
├── app.py                     # Main Application Entry Point
├── database/
│   └── khoem_ai.db            # SQLite — ⚠️ appears git-tracked, see database.md §1
├── core/
│   ├── khoem_ai_app.py        # Refactored Flask Backend (design) — §0 status unclear
│   ├── security_engine.py     # Input/Output guardrails — see security.md
│   ├── voice_engine.py        # Voice Engine — see voice.md
│   ├── navigator_engine.py    # Route calc — see navigator.md
│   ├── video_khoemai.py       # Video AI Engine — see video_khoemai.md
│   ├── database_engine.py     # DB access layer — see database.md
│   ├── memory_engine.py       # Context/memory — see database.md §6 (⚠️ status mismatch noted there)
│   └── accessibility_engine.py# Settings persistence — see accessibility.md
├── routes/
│   ├── security_routes.py     # ⚠️ NEW — not referenced anywhere in security.md; needs cross-doc sync
│   ├── video_routes.py        # ⚠️ conflicts with video_khoemai.md, which lists no dedicated routes file
│   ├── navigator_routes.py    # see navigator.md §6.2
│   └── accessibility_routes.py# see accessibility.md §5
├── static/
│   ├── css/style.css
│   └── js/
│       ├── app.js
│       ├── gps.js             # ⚠️ documented as ES module (export functions) in navigator.md
│       ├── map.js
│       ├── navigator.js       # ⚠️ here described as global `window.KhoemNavigator` — conflicts with
│       │                      #    navigator.md's ES-module (`import`/`export`) style. Pick one pattern.
│       ├── voice.js
│       └── magnifying_glass.js
├── storage/
│   └── videos/                # see video_khoemai.md §7
└── templates/
    ├── index.html
    └── navigator.html
```

> ⚠️ **§2 module-pattern conflict:** this doc describes `navigator.js` as a single global class (`window.KhoemNavigator`). `navigator.md` §5.3 describes `gps.js`/`map.js`/`navigator.js` as ES modules using `import`/`export`. Both can't be literally true at once — confirm which pattern the actual codebase uses and align both docs.

---

## 3. Technical Audit Findings & Remediation

### 3.1 Critical Risks (claimed resolved — status per §0)

- **Hardcoded Credentials:** fallback tokens removed; secrets required via environment variables, fail-closed if missing/weak.
- **Production Debugger Exposure:** `debug=True` on `0.0.0.0` disabled; `debug=False` enforced for production.

### 3.2 High Risks (claimed resolved — status per §0)

- **Replayable Signature:** replaced with timestamped HMAC-SHA256.
- **Unscoped Authentication:** explicit scopes + separate trust boundaries instead of one generic token.
- **No JSON Schema Validation:** `MAX_CONTENT_LENGTH` (1 MB), string length caps.

  > ⚠️ **Conflicts with `api.md` §2:** `/api/chat`'s `message` field is documented elsewhere as max **4,000 characters**; this doc says string length caps of **2,000 characters**. Pick one number and use it consistently across `api.md` and this doc.

### 3.3 Medium & Low Risks (claimed resolved — status per §0)

- **Output Echoing:** untrusted input no longer reflected into HTML responses (helps prevent stored/reflected XSS — good complement to `security.md` §4 output validation).
- **Structured Error Handling:** generic JSON errors + UUIDv4 `request_id`, no stack traces. *(Cross-ref: `api.md` §13 also recommends not leaking provider names in error text — same principle, should be applied together.)*
- **Unicode Normalization (NFC):** anti-troll filtering for Khmer script. ⚠️ **Missing from `security.md` §3.1 Input Validation checklist** — that table lists HTML/JS/SQL/Prompt Injection/Base64/XSS/Max Length but not Unicode normalization. Should be added there too, since without NFC normalization, blocklist regexes (`security.md`) can be bypassed by combining-character tricks.
- **Simulated Telemetry Isolation:** hardware reports marked `SIMULATED`. ⚠️ Undocumented elsewhere — what hardware, what reports, where surfaced? Needs its own short section once clarified.

---

## 4. Refactored API Request Contract

```
signature = HMAC-SHA256(
    KHOEM_MASTER_SECRET,
    f"{timestamp}.{raw_request_body}"
)
```

| Header | Type | Value / Description |
|---|---|---|
| `Authorization` | String | `Bearer <KHOEM_AI_TOKEN>` |
| `X-Core-Timestamp` | Integer | Unix timestamp in seconds |
| `X-Core-Signature` | Hex String | Lowercase HMAC-SHA256 digest |
| `Content-Type` | String | `application/json` |

> ⚠️ **Scope unclear (see §0):** does this contract apply to `/api/khoem-ai/process` only, or to every endpoint in `api.md`? Recommend adding a `replay window` (e.g. reject timestamps >5 min old) to the spec — HMAC alone without a timestamp-freshness check doesn't fully prevent replay even with a timestamp field, unless the server actually enforces a max age and tracks used signatures.

---

## 5. Module Specifications

### 5.1 Video AI Engine (`core/video_khoemai.py`)

- Endpoint: `/api/video/generate`
- Free Plan: max 6 minutes, 720p, watermarked
- Premium Plan: **unlimited length**, 1080p/4K, clean rendering

> ⚠️ **Reconciles/extends `video_khoemai.md` §4**, which left Premium limits as "*(not specified)*" — this doc gives concrete numbers. Recommend copying these numbers back into `video_khoemai.md` §4 so it's not duplicated-and-drifting. Also: "unlimited length" on Premium has no cost/abuse ceiling — `video_khoemai.md` §9 already flags generation cost as a security concern; "unlimited" makes that worse without a rate limiter, which is still 🔴 Planned.

### 5.2 GIS Navigation Engine (`static/js/navigator.js`)

- Global binding: `window.KhoemNavigator`
- Load order: `navigator.js` after `map.js` in `templates/index.html`

> ⚠️ See §2 note — conflicts with `navigator.md`'s ES-module description of the same files.

---

## 6. Deployment & Execution Instructions

### 6.1 Local Execution (Termux)

```bash
cd ~/khoem-new
export KHOEM_AI_TOKEN="a_very_long_secure_random_api_token_here_32chars"
export KHOEM_MASTER_SECRET="a_very_long_master_secret_key_for_hmac_signing_32chars"
export FLASK_SECRET_KEY="a_very_long_flask_secret_key_for_session_management_32chars"
python app.py
```

> ⚠️ These three env vars should be added to `database.md` §1's `.env` warning — if `.env` is git-tracked, these exact secrets could be exposed in history, not just the DB file.

---

## 7. Production Deployment Checklist

- [x] Rename legacy file paths to KHOEM_AI (`core/khoem_ai_app.py`)
- [ ] Rotate all previous development tokens and secrets
- [ ] Set required environment variables via a deployment secret manager
- [ ] Deploy behind gunicorn with `debug=False`
- [ ] Put the service behind TLS, a trusted proxy, and rate limits
- [ ] Verify frontend HTML dependency load order

> **5 of 6 items are still unchecked.** Per §0, this is the direct evidence that "PRODUCTION READY (Secured)" in the original header is premature — the doc's own checklist contradicts its own status line. Recommend changing the status field to something like **"Design Complete — Deployment Pending"** until these are checked off, and cross-linking each unchecked item to its corresponding 🔴 Planned entry in `security.md` §8 (Rate Limiter ↔ item 5, JWT/API Key ↔ items 2-3, HTTPS ↔ item 5).

---

*khoem-new/docs/khoem_ai.md*
