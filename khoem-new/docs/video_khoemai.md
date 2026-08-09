# KHOEM_AI Video AI Engine

> **App Version:** 2.2  <!-- ⚠️ ឯកសារដើមសរសេរ "KHOEM_AI 3.0" — មិនត្រូវនឹង roadmap.md ដែលកំពុងនៅ Version 2.2, ហើយ Video AI មិនត្រូវបានរាយក្នុង roadmap.md ទាល់តែសោះ (2.2/2.3/3.0/4.0) — ត្រូវបញ្ចូល feature នេះទៅ roadmap ផងបើ module នេះមានស្រាប់ -->
> **Module Version:** 1.0.0  
> **Module:** Video AI Engine  
> **Main files:** `core/video_khoemai.py` · `templates/video_khoemai.html` · `static/js/video_khoemai.js` · `static/css/video_khoemai.css`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Purpose](#2-purpose)
3. [Supported Input / Output](#3-supported-input--output)
4. [Plan Limits](#4-plan-limits)
5. [Workflow](#5-workflow)
6. [API Reference](#6-api-reference)
7. [Storage](#7-storage)
8. [Error Handling](#8-error-handling) ⬅️ **NEW**
9. [Security & Content Moderation](#9-security--content-moderation) ⬅️ **NEW**
10. [Database Requirements](#10-database-requirements) ⬅️ **NEW**
11. [Known Gaps / TODO](#11-known-gaps--todo) ⬅️ **NEW**
12. [Future Features](#12-future-features)

---

## 1. Overview

Video AI Engine គឺជាម៉ូឌុលសម្រាប់បង្កើតវីដេអូដោយប្រើ Artificial Intelligence។ Module នេះត្រូវបានរចនាឡើងឲ្យដំណើរការដាច់ដោយឡែក ប៉ុន្តែភ្ជាប់ជាមួយ KHOEM_AI តាម API។

> ⚠️ **ត្រូវបញ្ជាក់:** តើ video generation ដំណើរការក្នុង server ខ្លួនឯង ឬហៅទៅ third-party API ខាងក្រៅ (ឧ. Runway, Pika, Sora API)? ចំណុចនេះប៉ះពាល់ដល់ cost model, latency, និង privacy (prompt/image អ្នកប្រើផ្ញើទៅក្រៅឬអត់)។ ឯកសារដើមមិនបញ្ជាក់ច្បាស់។

---

## 2. Purpose

- Generate Video from Text
- Generate Video from Image
- Generate Video with AI Voice — *(ភ្ជាប់ជាមួយ `voice.md` — តើប្រើ persona/profile ដូចគ្នាទេ?)*
- Subtitle Support
- Background Music
- Video History
- Download Video
- Share Video

---

## 3. Supported Input / Output

| Input | Status |
|---|---|
| Text Prompt | ✅ |
| Image | ✅ |
| Voice Prompt | 🔴 Future |
| JSON API | ✅ |

| Output | Status |
|---|---|
| MP4 | ✅ |
| WEBM | 🔴 Future |
| GIF | 🔴 Future |

---

## 4. Plan Limits

| Limit | Free Plan | Premium Plan |
|---|---|---|
| Maximum Video Length | 6 minutes | *(មិនបញ្ជាក់ — ត្រូវកំណត់លេខច្បាស់)* |
| Maximum Resolution | 720p | *(មិនបញ្ជាក់ — 1080p? 4K?)* |
| Daily Generation Limit | *(⚠️ មិនបញ្ជាក់ចំនួន — ត្រូវកំណត់លេខ)* | *(⚠️ មិនបញ្ជាក់)* |
| Watermark | Enabled | Disabled |
| Generation Speed | Standard queue | *(⚠️ "Faster" — ត្រូវកំណត់ mechanism: priority queue? dedicated worker?)* |

> ⚠️ **សំខាន់:** "Daily Generation Limit" ត្រូវមានលេខជាក់លាក់ (ឧ. 5/ថ្ងៃ) មុននឹង implement — បើគ្មានលេខ មិនអាចសរសេរ rate-limiting logic បានទេ។ ភ្ជាប់ជាមួយ `security.md` §8 "Rate Limiter" (🔴 Planned)។ តើមានវិធីសម្គាល់ Free vs Premium user ដោយរបៀបណា? (ត្រូវការ `users` table — ឃើញក្នុង `database.md` §10 Future Tables, 🔴 មិនទាន់មាន)។ **គ្មាន user account/auth system មានន័យថា plan limits មិនអាច enforce បានជាក់ស្តែងនៅឡើយទេ។**

---

## 5. Workflow

```
User
  ↓
HTML Interface (video_khoemai.html)
  ↓
JavaScript Controller (video_khoemai.js)
  ↓
Video API (/api/video/*)
  ↓
Video Engine (core/video_khoemai.py)
  ↓
Video File (storage/videos/)
  ↓
Browser Preview
```

> ⚠️ **Missing: Async job pattern.** Video generation typically takes seconds-to-minutes — a synchronous `POST /api/video/generate` that blocks until the video is ready will hit HTTP timeouts. §6 below adds a job-status pattern (`job_id` + polling) that the original doc didn't have.

---

## 6. API Reference

### `POST /api/video/generate`

**Request**
```json
{
  "session_id": "abc123",
  "prompt": "ព្រះអាទិត្យលិចនៅសមុទ្រ",
  "source": "text",
  "image_base64": null,
  "voice_persona": null,
  "subtitle": true,
  "background_music": false
}
```

**Response `202 Accepted`** *(async — was previously undocumented as sync/async)*
```json
{
  "job_id": "job_9f2a1c",
  "status": "queued"
}
```

**Response `400`** — invalid/missing prompt, or prompt fails `security_engine.safe_validate_input()` (see §9)
**Response `429`** — daily generation limit exceeded (once §4 limits are enforced)

---

### `GET /api/video/info?job_id=<id>`

Poll job status (new — needed for the async pattern above).

**Response `200`**
```json
{
  "job_id": "job_9f2a1c",
  "status": "processing",
  "progress_pct": 40,
  "video_url": null
}
```
`status` ∈ `queued | processing | done | failed`. When `done`, `video_url` points to the file under `storage/videos/`.

---

### `GET /api/video/history?session_id=<id>`

**Response `200`**
```json
{
  "videos": [
    { "job_id": "job_9f2a1c", "prompt": "...", "video_url": "...", "created_at": "..." }
  ]
}
```

---

### `DELETE /api/video/delete`

**Request**
```json
{ "session_id": "abc123", "job_id": "job_9f2a1c" }
```

> ⚠️ **Missing in original doc:** no mention of ownership check — must verify `job_id` belongs to `session_id` before deleting, otherwise any session could delete any other session's video by guessing a `job_id`. Same class of issue flagged in `database.md` §8 for `session_id` generally.

**Response `200`** `{ "deleted": true }`
**Response `403`** `{ "error": "អ្នកមិនមានសិទ្ធិលុបវីដេអូនេះទេ" }`
**Response `404`** `{ "error": "រកមិនឃើញវីដេអូ" }`

---

## 7. Storage

```
storage/videos/
```

> ⚠️ **Missing considerations from the original doc:**
> - **Naming convention** — not specified. Recommend `storage/videos/{session_id}/{job_id}.mp4` to avoid collisions and simplify per-session cleanup.
> - **Disk quota / cleanup policy** — video files are large; with no retention limit, `storage/videos/` will grow unbounded. Needs a TTL or per-plan storage cap (ties to §4 Plan Limits).
> - **Access control** — are files served directly (e.g., static route) or through an authenticated endpoint? Direct static serving means anyone with the URL can access the video, even from another session.

---

## 8. Error Handling

*(ខ្វះទាំងស្រុងក្នុងឯកសារដើម — pattern ដូចគ្នាជាមួយ voice.md §10 / navigator.md §10)*

```python
# core/video_khoemai.py — sketch

class VideoGenerationError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message


def generate_video(session_id: str, prompt: str, source: str = "text") -> dict:
    try:
        # ... call underlying video model/API ...
        pass
    except TimeoutError:
        raise VideoGenerationError("timeout", "ការបង្កើតវីដេអូចំណាយពេលយូរពេក សូមព្យាយាមម្ដងទៀត")
    except ConnectionError:
        raise VideoGenerationError("upstream_unavailable", "សេវាកម្មបង្កើតវីដេអូមិនអាចប្រើបានពេលនេះទេ")
    except Exception as e:
        # fail closed — don't leak internals to the client
        raise VideoGenerationError("internal_error", "មានបញ្ហាបច្ចេកទេស")
```

- **Partial failure**: if generation fails after the job is queued, `status` should transition to `failed` with a user-facing reason — not disappear silently.
- **Storage full**: writing the output file can fail — must be caught and surfaced as a distinct error, not a generic 500.

---

## 9. Security & Content Moderation

*(ខ្វះទាំងស្រុងក្នុងឯកសារដើម — សំខាន់ខ្លាំងសម្រាប់ generative video)*

- **Prompt validation**: `prompt` should go through `security_engine.safe_validate_input()` (`security.md` §3/§6) — same prompt-injection/XSS concerns apply, plus video-specific abuse (generating illegal/harmful content from text).
- **Content moderation**: text-to-video and image-to-video generation need an explicit content policy (no violence, no real people without consent, no CSAM, no illegal content) and ideally an automated moderation check on the *output*, not just the input prompt — a "safe" prompt can still produce unsafe output depending on the model.
- **Image input**: uploaded images for "Generate Video from Image" need the same validation path as any file upload — file type/size checks, and ideally malware/EXIF scanning before it touches the video engine.
- **Cost/abuse control**: video generation is expensive (compute/API cost) — the missing Daily Generation Limit (§4) is a security concern as much as a product one; without it, a single session could exhaust the service's budget or availability.
- **Job ownership**: see §6 `DELETE` endpoint note — `job_id` guessing needs to be prevented.

---

## 10. Database Requirements

`database.md` §10 "Future Tables" lists `vision_history` but **not a video-specific table** — Video History (§2 Purpose, §6 `GET /api/video/history`) has no backing schema yet. Suggested addition to `database.md`:

```sql
CREATE TABLE IF NOT EXISTS video_jobs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id        TEXT    NOT NULL UNIQUE,
    session_id    TEXT    NOT NULL,
    prompt        TEXT    NOT NULL,
    source        TEXT    NOT NULL CHECK (source IN ('text', 'image')),
    status        TEXT    NOT NULL CHECK (status IN ('queued','processing','done','failed')),
    video_path    TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_session_id ON video_jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_job_id      ON video_jobs(job_id);
```

---

## 11. Known Gaps / TODO

- Underlying video-generation backend (self-hosted model vs third-party API) — not specified.
- Numeric limits for video length/resolution/daily count on both plans — not specified.
- No auth/plan system exists yet to actually enforce Free vs Premium (depends on `users` table, still 🔴 Planned in `database.md`).
- Sync vs async API contract was unclear in the original doc — this revision assumes async (`202` + job polling); confirm this matches the real implementation.
- Video AI Engine itself is **not listed anywhere in `roadmap.md`** (Versions 2.2–4.0) despite having its own docs file and API — roadmap should be updated to include it, or this doc should clarify which roadmap version it belongs to.

---

## 12. Future Features

| Feature | Status |
|---|---|
| AI Avatar | 🔴 Future |
| Text to Video | ✅ *(already listed under Purpose §2 — duplicate; keep in one place only)* |
| Image to Video | ✅ *(same — duplicate of §2)* |
| Voice Clone | 🔴 Future — ភ្ជាប់ជាមួយ `voice.md` §12 Voice Cloning (consent-only policy applies here too) |
| Lip Sync | 🔴 Future |
| Multi-language | 🔴 Future |
| Video Translation | 🔴 Future |
| Cloud Rendering | 🔴 Future |
| Team Workspace | 🔴 Future — ត្រូវការ `users`/roles ជាមុនសិន |

---

*khoem-new/docs/video_khoemai.md*
