# KHOEM_AI Accessibility

> **Version:** 2.2  
> **Backend:** `core/accessibility_engine.py` · `routes/accessibility_routes.py`  
> **Frontend:** `templates/magnifying_glass.html` · `static/css/magnifying_glass.css` · `static/js/magnifying_glass.js`

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Features](#2-features)
3. [Components — File Mapping](#3-components--file-mapping)
4. [Settings Persistence](#4-settings-persistence) ⬅️ **NEW**
5. [API Reference](#5-api-reference) ⬅️ **NEW**
6. [Frontend Implementation Sketch](#6-frontend-implementation-sketch) ⬅️ **NEW**
7. [Error Handling](#7-error-handling) ⬅️ **NEW**
8. [Standards / WCAG Reference](#8-standards--wcag-reference) ⬅️ **NEW**
9. [Known Overlaps with Other Modules](#9-known-overlaps-with-other-modules) ⬅️ **NEW**
10. [Future Features](#10-future-features)

---

## 1. Purpose

Accessibility features help users with low vision, motor difficulties, or reading difficulties use KHOEM_AI more comfortably.

---

## 2. Features

| Feature | ការពិពណ៌នា | Status |
|---|---|---|
| Screen Magnifier | Zoom into a region of the screen with a movable lens | 🟡 In Progress |
| Zoom | Overall page zoom in/out | 🟡 In Progress |
| Rotate | Rotate magnifier/content orientation | 🟡 In Progress |
| Large Text | Increase base font size app-wide | 🔴 Planned — no implementing file identified (see §3) |
| High Contrast | High-contrast color scheme for low vision | 🔴 Planned — no implementing file identified |
| Dark Theme | Dark color scheme | 🔴 Planned — no implementing file identified |
| Light Theme | Light color scheme (default) | 🔴 Planned — no implementing file identified |
| Keyboard Friendly | Full keyboard navigation, visible focus states | 🔴 Planned — no spec of which keys/shortcuts |
| Touch Friendly | Larger tap targets, gesture support | 🔴 Planned — no spec of minimum tap-target size |

> ⚠️ **ចន្លោះខ្វះ:** ឯកសារដើមរាយ 9 features ប៉ុន្តែ §3 "Components" មានតែឯកសារសម្រាប់ magnifier ( `magnifying_glass.*` ) ប៉ុណ្ណោះ។ Large Text / High Contrast / Dark-Light Theme / Keyboard Friendly / Touch Friendly **គ្មាន file ណាមួយអនុវត្តវាទេ** នៅក្នុង Components list ដើម — ត្រូវបញ្ជាក់ថា implement នៅឯណា ឬថានៅតែ planned។

---

## 3. Components — File Mapping

| File | Covers |
|---|---|
| `templates/magnifying_glass.html` | Screen Magnifier UI markup |
| `static/css/magnifying_glass.css` | Magnifier lens styling |
| `static/js/magnifying_glass.js` | Magnifier drag/zoom/rotate logic |
| `core/accessibility_engine.py` | Server-side: persist user's accessibility settings |
| `routes/accessibility_routes.py` | REST API for accessibility settings (§5) |

> ⚠️ Theme (Dark/Light/High Contrast) and Large Text are typically pure CSS/JS (e.g., a `data-theme` attribute + CSS variables) with no dedicated backend file — worth adding `static/css/themes.css` and `static/js/accessibility.js` (separate from the magnifier-specific files) to the component list once built.

---

## 4. Settings Persistence

*(ខ្វះទាំងស្រុងក្នុងឯកសារដើម)* Accessibility preferences (theme, text size, magnifier on/off) should persist across visits — otherwise the user has to reconfigure every session.

Cross-reference `database.md` §10 — the `settings` table is currently 🔴 Planned. Suggested schema:

```sql
CREATE TABLE IF NOT EXISTS accessibility_settings (
    session_id      TEXT PRIMARY KEY,
    theme           TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark','high_contrast')),
    text_scale      REAL NOT NULL DEFAULT 1.0 CHECK (text_scale BETWEEN 0.8 AND 2.0),
    magnifier_on    INTEGER NOT NULL DEFAULT 0,
    keyboard_mode   INTEGER NOT NULL DEFAULT 0,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 5. API Reference

*(ខ្វះទាំងស្រុងក្នុងឯកសារដើម — `routes/accessibility_routes.py` ត្រូវបានលើកឡើងតែឈ្មោះ)*

### `GET /api/accessibility/settings?session_id=<id>`

**Response `200`**
```json
{
  "theme": "dark",
  "text_scale": 1.2,
  "magnifier_on": false,
  "keyboard_mode": true
}
```
ប្រសិនបើ session មិនទាន់មាន settings ត្រូវ return default values, មិនមែន `404`។

### `POST /api/accessibility/settings`

**Request**
```json
{
  "session_id": "abc123",
  "theme": "high_contrast",
  "text_scale": 1.4
}
```

**Response `200`** `{ "saved": true }`
**Response `400`** — invalid `theme` value or `text_scale` out of range

```python
# routes/accessibility_routes.py — sketch
from flask import Blueprint, jsonify, request
from core.accessibility_engine import get_settings, save_settings

accessibility_bp = Blueprint("accessibility", __name__, url_prefix="/api/accessibility")

VALID_THEMES = {"light", "dark", "high_contrast"}


@accessibility_bp.route("/settings", methods=["GET"])
def get_settings_endpoint():
    session_id = request.args.get("session_id", "").strip()
    if not session_id:
        return jsonify({"error": "ខ្វះ session_id"}), 400
    return jsonify(get_settings(session_id))


@accessibility_bp.route("/settings", methods=["POST"])
def save_settings_endpoint():
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id", "").strip()
    theme = data.get("theme", "light")
    text_scale = data.get("text_scale", 1.0)

    if not session_id:
        return jsonify({"error": "ខ្វះ session_id"}), 400
    if theme not in VALID_THEMES:
        return jsonify({"error": "theme មិនត្រឹមត្រូវ"}), 400
    try:
        text_scale = float(text_scale)
        if not (0.8 <= text_scale <= 2.0):
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "text_scale ត្រូវនៅចន្លោះ 0.8–2.0"}), 400

    save_settings(session_id, theme=theme, text_scale=text_scale)
    return jsonify({"saved": True})
```

---

## 6. Frontend Implementation Sketch

*(ខ្វះទាំងស្រុងក្នុងឯកសារដើម)* Theme/text-scale toggles that don't need a full magnifier module:

```javascript
// static/js/accessibility.js
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function applyTextScale(scale) {
  document.documentElement.style.setProperty("--text-scale", scale);
}

async function loadSettings(sessionId) {
  try {
    const resp = await fetch(`/api/accessibility/settings?session_id=${encodeURIComponent(sessionId)}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const s = await resp.json();
    applyTheme(s.theme);
    applyTextScale(s.text_scale);
  } catch (err) {
    console.error("Accessibility settings load failed:", err);
    applyTheme("light"); // safe default fallback
  }
}
```

```css
/* static/css/themes.css — suggested new file */
:root { --text-scale: 1.0; }
body { font-size: calc(1rem * var(--text-scale)); }

[data-theme="dark"] { background: #111; color: #eee; }
[data-theme="high_contrast"] { background: #000; color: #fff; }
[data-theme="high_contrast"] a { color: #ffff00; text-decoration: underline; }
```

---

## 7. Error Handling

Follows the same fail-safe pattern as other modules (`voice.md` §10, `navigator.md` §10) — always fall back to a safe default (light theme, 1.0 scale) rather than a broken/blank UI.

| Failure | Fallback |
|---|---|
| Settings fetch fails | Apply light theme + default text scale |
| Invalid stored value (e.g. corrupted `text_scale`) | Clamp to nearest valid value (0.8–2.0), don't crash |
| Magnifier JS fails to load | Rest of the page must still be usable — magnifier should be a progressive enhancement, not a blocking dependency |

---

## 8. Standards / WCAG Reference

*(ខ្វះទាំងស្រុងក្នុងឯកសារដើម)* No mention of which accessibility standard this targets. Recommend documenting a target level explicitly, e.g.:

- Target: **WCAG 2.1 Level AA**
- Minimum touch target size: 44×44px (relevant to "Touch Friendly")
- Minimum contrast ratio: 4.5:1 for normal text (relevant to "High Contrast")
- All interactive elements reachable via `Tab`, with visible `:focus` state (relevant to "Keyboard Friendly")

Without a stated target, "Keyboard Friendly" and "Touch Friendly" have no concrete acceptance criteria to test against.

---

## 9. Known Overlaps with Other Modules

- **OCR Reading** (Future Features here) overlaps with **OCR** already listed in `roadmap.md` Version 2.3 — same feature, tracked in two places. Should be implemented once and cross-referenced, not duplicated.
- **Voice Reading** (Future Features here) overlaps heavily with **KHOEM_AI Voice Engine** (`voice.md`) — unclear if "Voice Reading" means using the existing TTS (`speak()` in `voice.js`) to read page content aloud, or a separate implementation. Recommend: reuse `voice.md`'s `speak()` function with a dedicated `"reading"` persona rather than building a new engine.
- **Screen Reader** (Future) is a different concept from "Voice Reading" — Screen Reader typically means ARIA-compliant markup that works with OS-level screen readers (NVDA, VoiceOver, TalkBack), not KHOEM_AI reading text aloud itself. Worth splitting these into two distinct roadmap items since they need entirely different engineering work.

---

## 10. Future Features

| Feature | Status | Notes |
|---|---|---|
| Screen Reader | 🔴 Future | ARIA/semantic HTML compliance — see §9 |
| OCR Reading | 🔴 Future | Duplicate of `roadmap.md` Version 2.3 "OCR" — merge |
| Voice Reading | 🔴 Future | Should reuse `voice.md` `speak()` — see §9 |
| Color Blind Mode | 🔴 Future | Needs specific palette (protanopia/deuteranopia/tritanopia) |
| Large Cursor | 🔴 Future | — |
| Reading Mode | 🔴 Future | Simplified/distraction-free content view |
| Gesture Control | 🔴 Future | — |
| Eye Tracking | 🔴 Future | Requires hardware support — low near-term priority |

---

*khoem-new/docs/accessibility.md*
