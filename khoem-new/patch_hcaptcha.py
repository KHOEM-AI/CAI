#!/usr/bin/env python3
import re, shutil, time

path = "app.py"
with open(path, "r", encoding="utf-8") as f:
    content = original = f.read()
changes = []

old_import = "from flask import Flask, jsonify, request, render_template"
new_import = "from flask import Flask, jsonify, request, render_template, session, redirect"
if new_import in content:
    print("  [skip] flask imports already include session/redirect")
elif old_import in content:
    content = content.replace(old_import, new_import, 1)
    changes.append("flask imports (session, redirect)")
else:
    print("  [WARN] Could not find flask import line.")

anchor = 'GROQ_API_URL      = "https://api.groq.com/openai/v1/chat/completions"'
addition = '\n\n    HCAPTCHA_SITEKEY = os.getenv("HCAPTCHA_SITEKEY", "")\n    HCAPTCHA_SECRET  = os.getenv("HCAPTCHA_SECRET", "")'
if "HCAPTCHA_SITEKEY" in content:
    print("  [skip] HCAPTCHA config already present")
elif anchor in content:
    content = content.replace(anchor, anchor + addition, 1)
    changes.append("HCAPTCHA config vars")
else:
    print("  [WARN] Could not find GROQ_API_URL anchor.")

old_index = '''@app.route("/")
def index():
    return render_template("index.html")'''

new_index = '''@app.route("/")
def index():
    if not Config.HCAPTCHA_SITEKEY or not Config.HCAPTCHA_SECRET:
        return render_template("index.html")
    if session.get("hcaptcha_verified"):
        return render_template("index.html")
    return render_template("captcha_gate.html", sitekey=Config.HCAPTCHA_SITEKEY)


@app.route("/api/captcha/verify", methods=["POST"])
def captcha_verify():
    token = request.form.get("h-captcha-response", "")
    if not token:
        return render_template("captcha_gate.html", sitekey=Config.HCAPTCHA_SITEKEY,
                                error="សូមបំពេញ captcha ជាមុនសិន"), 400
    try:
        resp = requests.post(
            "https://api.hcaptcha.com/siteverify",
            data={"secret": Config.HCAPTCHA_SECRET, "response": token},
            timeout=10,
        )
        result = resp.json()
    except requests.exceptions.RequestException:
        return render_template("captcha_gate.html", sitekey=Config.HCAPTCHA_SITEKEY,
                                error="មិនអាចផ្ទៀងផ្ទាត់បានទេ សូមព្យាយាមម្តងទៀត"), 502
    if result.get("success"):
        session.permanent = True
        session["hcaptcha_verified"] = True
        return redirect("/")
    return render_template("captcha_gate.html", sitekey=Config.HCAPTCHA_SITEKEY,
                            error="Captcha មិនត្រឹមត្រូវ សូមព្យាយាមម្តងទៀត"), 401'''

if "captcha_verify" in content:
    print("  [skip] captcha_verify route already present")
elif old_index in content:
    content = content.replace(old_index, new_index, 1)
    changes.append("index() gate + /api/captcha/verify route")
else:
    print("  [WARN] Could not find the index() route.")

if not changes:
    print("\nNo changes made.")
else:
    backup = f"{path}.bak.{int(time.time())}"
    shutil.copy(path, backup)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"\n✅ Patched: {', '.join(changes)}")
    print(f"✅ Backup saved as: {backup}")
