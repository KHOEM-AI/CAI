#!/usr/bin/env python3
import re, shutil, time as _time

path = "app.py"
with open(path, "r", encoding="utf-8") as f:
    content = original = f.read()
changes = []

if re.search(r"^import time$", content, re.M):
    print("  [skip] 'import time' already present")
else:
    anchor = "import uuid"
    if anchor in content:
        content = content.replace(anchor, anchor + "\nimport time", 1)
        changes.append("import time")
    else:
        print("  [WARN] Could not find 'import uuid' anchor.")

old_fn = '''def call_video_api(prompt: str, duration_sec: int = 5, resolution: str = "720p",
                    style: str = "cinematic", fps: int = 24, quality: str = "standard") -> tuple[bool, dict]:
    if not Config.VIDEO_API_KEY:
        logger.warning("VIDEO_API_KEY មិនទាន់បានកំណត់ — ត្រឡប់ stub response")
        return True, {
            "status": "stub",
            "video_url": Config.VIDEO_STUB_URL,
            "final_video_url": Config.VIDEO_STUB_URL,
            "message": "នេះជាវីដេអូសាកល្បង។ សូមកំណត់ VIDEO_API_KEY ដើម្បីបង្កើតវីដេអូពិតប្រាកដ",
        }

    payload = {
        "prompt": prompt,
        "duration": duration_sec,
        "resolution": resolution,
        "style": style,
        "fps": fps,
        "quality": quality,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {Config.VIDEO_API_KEY}",
    }
    try:
        resp = requests.post(Config.VIDEO_API_URL, headers=headers, json=payload, timeout=120)
        resp.raise_for_status()
        result = resp.json()
        return True, {
            "status": "completed",
            "video_url": result.get("video_url") or result.get("download_url"),
            "final_video_url": result.get("video_url") or result.get("download_url"),
            "job_id": result.get("id") or result.get("job_id"),
        }
    except requests.exceptions.HTTPError as e:
        logger.error("Video API HTTP error: %s — %s", e, resp.text)
        return False, {"error": f"បញ្ហា Video API (HTTP {resp.status_code})"}
    except requests.exceptions.RequestException as e:
        logger.error("Video API request error: %s", e)
        return False, {"error": "បញ្ហាក្នុងការភ្ជាប់ទៅ Video API"}'''

new_fn = '''def call_video_api(prompt: str, duration_sec: int = 5, resolution: str = "720p",
                    style: str = "cinematic", fps: int = 24, quality: str = "standard") -> tuple[bool, dict]:
    """Real video generation via xAI Grok Imagine Video (async submit + poll)."""
    if not Config.VIDEO_API_KEY:
        logger.warning("VIDEO_API_KEY មិនទាន់បានកំណត់ — ត្រឡប់ stub response")
        return True, {
            "status": "stub",
            "video_url": Config.VIDEO_STUB_URL,
            "final_video_url": Config.VIDEO_STUB_URL,
            "message": "នេះជាវីដេអូសាកល្បង។ សូមកំណត់ VIDEO_API_KEY ដើម្បីបង្កើតវីដេអូពិតប្រាកដ",
        }

    xai_duration = max(1, min(int(duration_sec), 15))
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {Config.VIDEO_API_KEY}",
    }
    payload = {
        "model": "grok-imagine-video-1.5",
        "prompt": prompt,
        "duration": xai_duration,
        "aspect_ratio": "16:9",
        "resolution": resolution if resolution in ("480p", "720p", "1080p") else "720p",
    }

    try:
        resp = requests.post("https://api.x.ai/v1/videos/generations", headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        request_id = resp.json().get("request_id")
    except requests.exceptions.HTTPError as e:
        logger.error("xAI Video submit HTTP error: %s — %s", e, resp.text)
        return False, {"error": f"បញ្ហា Video API (HTTP {resp.status_code})"}
    except requests.exceptions.RequestException as e:
        logger.error("xAI Video submit error: %s", e)
        return False, {"error": "បញ្ហាក្នុងការភ្ជាប់ទៅ Video API"}

    if not request_id:
        return False, {"error": "Video API មិនបានត្រឡប់ request_id"}

    poll_url = f"https://api.x.ai/v1/videos/{request_id}"
    deadline = time.time() + 240
    while time.time() < deadline:
        try:
            poll_resp = requests.get(poll_url, headers={"Authorization": headers["Authorization"]}, timeout=15)
            poll_resp.raise_for_status()
            data = poll_resp.json()
        except requests.exceptions.RequestException as e:
            logger.error("xAI Video poll error: %s", e)
            time.sleep(5)
            continue

        status = data.get("status")
        if status == "done":
            video_url = (data.get("video") or {}).get("url")
            return True, {
                "status": "completed",
                "video_url": video_url,
                "final_video_url": video_url,
                "job_id": request_id,
            }
        if status in ("failed", "expired"):
            return False, {"error": f"Video generation {status}"}
        time.sleep(5)

    return False, {"error": "Video generation ប្រើពេលយូរពេក (timeout)"}'''

if "grok-imagine-video" in content:
    print("  [skip] call_video_api() already patched for xAI")
elif old_fn in content:
    content = content.replace(old_fn, new_fn, 1)
    changes.append("call_video_api() → real xAI implementation")
else:
    print("  [WARN] Could not find the original call_video_api() function.")

if not changes:
    print("\nNo changes made.")
else:
    backup = f"{path}.bak.{int(_time.time())}"
    shutil.copy(path, backup)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"\n✅ Patched: {', '.join(changes)}")
    print(f"✅ Backup saved as: {backup}")
