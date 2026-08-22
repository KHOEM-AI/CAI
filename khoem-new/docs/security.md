# KHOEM_AI Security Documentation

> **Version:** 2.2  <!-- ស៊ីគ្នាជាមួយ roadmap.md / voice.md -->
> **Module (backend):** `core/security_engine.py`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Security Flow](#2-security-flow)
3. [Input Validation](#3-input-validation)
4. [Output Validation](#4-output-validation)
5. [Blocked Examples](#5-blocked-examples)
6. [Error Handling](#6-error-handling)
7. [Logging & Audit](#7-logging--audit)
8. [Future Security Roadmap](#8-future-security-roadmap)

---

## 1. Overview

KHOEM_AI Security Engine ការពារប្រព័ន្ធពី input/output ដែលមានគ្រោះថ្នាក់ តាមរយៈ **Input Guardrails** (មុនចូល AI Engine) និង **Output Guardrails** (មុនចេញទៅអ្នកប្រើ)។

```
User Input → Input Guardrails → AI Engine → Output Guardrails → Response
```

---

## 2. Security Flow

| Stage | ការងារ | ករណីបរាជ័យ |
|---|---|---|
| **Input Guardrails** | ត្រួតពិនិត្យ input មុនផ្ញើទៅ AI Engine | Block + return error message (មិនឲ្យទៅដល់ AI Engine ទាល់តែសោះ) |
| **AI Engine** | ដំណើរការសំណើ | — |
| **Output Guardrails** | ត្រួតពិនិត្យ reply មុនបញ្ជូនត្រឡប់ | Block/redact + log incident |

> **គោលការណ៍សំខាន់:** បើ Input Guardrails block ហើយ សំណើនោះ **មិនត្រូវឲ្យទៅដល់ AI Engine ជាដាច់ខាត** ដើម្បីកាត់បន្ថយ token cost និងហានិភ័យ prompt injection។

---

## 3. Input Validation

### 3.1 Checks

| Check | ការពិពណ៌នា | Action ពេលរកឃើញ |
|---|---|---|
| HTML | រកឃើញ HTML tags ក្នុង input | Sanitize / Reject |
| JavaScript | រកឃើញ `<script>`, `javascript:`, event handlers (`onerror=`, `onload=`) | Reject |
| SQL Injection | រកឃើញ SQL keywords (`DROP`, `SELECT`, `--`, `;`) នៅក្នុងបរិបទគួរឲ្យសង្ស័យ | Reject |
| Prompt Injection | រកឃើញឃ្លាដូចជា "ignore previous instructions", "system prompt", "you are now" | Reject |
| Base64 Injection | រកឃើញ base64-encoded payload ដែលពេល decode មាន script/command | Decode → re-scan → Reject |
| XSS | រកឃើញ pattern injection តាម browser (`data:text/html`, `<img onerror=`) | Reject |
| Maximum Length | កំណត់ចំនួន character/token អតិបរមា | Truncate / Reject |

### 3.2 Implementation (draft)

```python
# core/security_engine.py

import re
import base64

MAX_INPUT_LENGTH = 4000  # characters — TODO: ត្រូវបញ្ជាក់តម្លៃពិត

BLOCKED_PATTERNS = {
    "html":            re.compile(r"<[^>]+>"),
    "javascript":      re.compile(r"(javascript:|on\w+\s*=)", re.IGNORECASE),
    "sql_injection":   re.compile(r"(\bDROP\b|\bDELETE\b|\bUNION\b|--|;--)", re.IGNORECASE),
    "prompt_injection":re.compile(r"(ignore (all|previous) instructions|system prompt|you are now)", re.IGNORECASE),
    "xss":             re.compile(r"(data:text/html|<img[^>]+onerror)", re.IGNORECASE),
}


class ValidationError(Exception):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


def validate_input(text: str) -> str:
    """Raises ValidationError if input is unsafe. Returns cleaned text otherwise."""

    if len(text) > MAX_INPUT_LENGTH:
        raise ValidationError("max_length_exceeded")

    # Check base64-encoded payloads first (decode then re-scan)
    decoded = _try_base64_decode(text)
    scan_target = f"{text}\n{decoded}" if decoded else text

    for name, pattern in BLOCKED_PATTERNS.items():
        if pattern.search(scan_target):
            raise ValidationError(name)

    return text.strip()


def _try_base64_decode(text: str) -> str | None:
    try:
        candidate = text.strip()
        if len(candidate) % 4 != 0 or len(candidate) < 8:
            return None
        return base64.b64decode(candidate).decode("utf-8", errors="ignore")
    except Exception:
        return None
```

> ⚠️ **កំណត់ចំណាំ:** នេះជា draft ដំបូង — regex-based filtering មិនគ្រប់ជ្រុងជ្រោយទេ (អាចត្រូវ bypass ដោយ obfuscation)។ សម្រាប់ production គួរបន្ថែម allowlist-based sanitization (ឧ. `bleach` library សម្រាប់ HTML) ជំនួសឬបន្ថែមលើ regex blocklist។

---

## 4. Output Validation

### 4.1 Checks

| Check | ការពិពណ៌នា | Action |
|---|---|---|
| Sensitive Output | រកឃើញ API key, password, PII ក្នុង reply មុនផ្ញើ | Redact |
| Unsafe Content | រកឃើញ content policy violation | Block + fallback message |
| Maximum Length | កំណត់ប្រវែង reply អតិបរមា | Truncate |
| Encoding | ត្រួតពិនិត្យ encoding ត្រឹមត្រូវ (UTF-8) មុនបញ្ជូន | Re-encode / Reject |

### 4.2 Implementation (draft)

```python
SENSITIVE_PATTERNS = {
    "api_key":  re.compile(r"(sk-[a-zA-Z0-9]{20,}|api[_-]?key\s*[:=]\s*\S+)", re.IGNORECASE),
    "password": re.compile(r"password\s*[:=]\s*\S+", re.IGNORECASE),
}

MAX_OUTPUT_LENGTH = 8000


def validate_output(text: str) -> str:
    if len(text) > MAX_OUTPUT_LENGTH:
        text = text[:MAX_OUTPUT_LENGTH] + "…"

    for name, pattern in SENSITIVE_PATTERNS.items():
        if pattern.search(text):
            text = pattern.sub("[REDACTED]", text)

    try:
        text.encode("utf-8")
    except UnicodeEncodeError:
        text = text.encode("utf-8", errors="ignore").decode("utf-8")

    return text
```

---

## 5. Blocked Examples

| Input | ប្រភេទគ្រោះថ្នាក់ | ហេតុអ្វីត្រូវ block |
|---|---|---|
| `<script>alert(1)</script>` | XSS / JavaScript | ដំណើរការ script នៅ client-side |
| `DROP TABLE conversations;` | SQL Injection | អាចលុបទិន្នន័យទាំងមូល |
| `Ignore previous instructions` | Prompt Injection | ព្យាយាមផ្លាស់ប្តូរឥរិយាបថ AI |
| `data:text/html,<script>...</script>` | XSS (data URI) | Bypass regular `<script>` filter |
| Base64 encoded prompt injection | Prompt Injection (obfuscated) | គេច filter ធម្មតាដោយ encode មុន |

---

## 6. Error Handling

Guardrails ត្រូវតែបរាជ័យ **ដោយសុវត្ថិភាព** (fail-safe) — មានន័យថា ប្រសិនបើ validation logic ខ្លួនឯង error, ប្រព័ន្ធត្រូវ **block** មិនមែន **allow through** ទេ។

```python
def safe_validate_input(text: str) -> tuple[bool, str]:
    """Returns (is_valid, message_or_cleaned_text). Fails closed on internal error."""
    try:
        cleaned = validate_input(text)
        return True, cleaned
    except ValidationError as e:
        log_security_event("input_blocked", reason=e.reason, raw_snippet=text[:100])
        return False, _user_message_for(e.reason)
    except Exception as e:
        # Unexpected internal error — fail CLOSED, not open
        log_security_event("validation_engine_error", detail=str(e))
        return False, "សុំទោស មានបញ្ហាបច្ចេកទេស សូមព្យាយាមម្ដងទៀត"


def _user_message_for(reason: str) -> str:
    messages = {
        "max_length_exceeded": "សារវែងពេក សូមកាត់បន្ថយ",
        "html":                "សូមកុំដាក់ HTML tags",
        "javascript":          "សំណើនេះមិនត្រូវបានអនុញ្ញាតទេ",
        "sql_injection":       "សំណើនេះមិនត្រូវបានអនុញ្ញាតទេ",
        "prompt_injection":    "សំណើនេះមិនត្រូវបានអនុញ្ញាតទេ",
        "xss":                 "សំណើនេះមិនត្រូវបានអនុញ្ញាតទេ",
    }
    return messages.get(reason, "សំណើនេះមិនត្រូវបានអនុញ្ញាតទេ")
```

> **គោលការណ៍:** កុំបង្ហាញ regex/pattern ពិតប្រាកដដែល trigger ការ block ទៅអ្នកប្រើ (អាចជួយ attacker ស្គាល់ filter ដើម្បី bypass)។ សារ error គួរទូទៅ។

---

## 7. Logging & Audit

*(ផ្នែកនេះខ្វះក្នុងឯកសារដើម — ត្រូវបំពេញបន្ថែម)*

- តើ security events (blocked input/output) ត្រូវរក្សាទុកនៅឯណា? (`logs/` folder ដែលឃើញក្នុង repo?)
- តើ log មាន raw input ពេញ ឬត្រឹមតែ snippet/hash? (ត្រូវប្រុងប្រយ័ត្នកុំរក្សាទុក PII ក្នុង log ខ្លួនឯង)
- Retention period ប៉ុន្មាន?
- តើមាន alerting ពេលមាន pattern វាយប្រហារម្ដងហើយម្ដងទៀតពី IP/session ដូចគ្នាទេ?

```python
def log_security_event(event_type: str, **details):
    # TODO: wire to logs/ storage ឬ database
    print(f"[SECURITY] {event_type}: {details}")
```

---

## 8. Future Security Roadmap

| Feature | Status | Priority | Notes |
|---|---|---|---|
| Rate Limiter | 🔴 Planned | High | ការពារ brute-force / spam requests |
| JWT Authentication | 🔴 Planned | High | Session/token-based auth |
| API Key Management | 🔴 Planned | High | សម្រាប់ third-party integrations |
| HTTPS Enforcement | 🔴 Planned | High | Redirect HTTP → HTTPS ជាដាច់ខាត |
| Encrypted Database | 🔴 Planned | Medium | Encrypt at rest សម្រាប់ sensitive fields |
| Audit Logs | 🔴 Planned | Medium | ភ្ជាប់ជាមួយ §7 ខាងលើ |
| IP Blocking | 🔴 Planned | Medium | Auto-block IP បន្ទាប់ពី repeated violations |
| Request Signing | 🔴 Planned | Low | ការពារ request tampering |
| Role Permission | 🔴 Planned | Medium | Admin vs User vs Guest access levels |
| Security Score | 🔴 Planned | Low | Dashboard metric សម្រាប់ monitor សុវត្ថិភាពរួម |

---

### Legend
- ✅ Done
- 🟡 In Progress
- 🔴 Planned
- ⚪ Future

---

*khoem-new/docs/security.md*
