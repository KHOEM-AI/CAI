#!/usr/bin/env python3
import re, shutil, time

def backup(path):
    b = f"{path}.bak.{int(time.time())}"
    shutil.copy(path, b)
    return b

changed_any = False

with open("templates/index.html", "r", encoding="utf-8") as f:
    html = f.read()

if 'id="vault-toggle-btn"' in html:
    print("  [skip] index.html already has the toggle button")
else:
    pattern = re.compile(r'(SECURE VAULT MATRIX\s*</h3>)(\s*</div>)')
    new_html, n = pattern.subn(
        r'\1\n            <button id="vault-toggle-btn" class="vault-toggle-btn" type="button" aria-label="Collapse or expand">▾</button>\2',
        html, count=1,
    )
    if n == 0:
        print("  [WARN] Could not find the vault title pattern in templates/index.html")
    else:
        backup("templates/index.html")
        with open("templates/index.html", "w", encoding="utf-8") as f:
            f.write(new_html)
        print("  ✅ index.html patched")
        changed_any = True

with open("static/css/vault.css", "r", encoding="utf-8") as f:
    css = f.read()

if "vault-toggle-btn" in css:
    print("  [skip] vault.css already has toggle styles")
else:
    css_addition = """

/* --- Collapse/expand toggle --- */
.card-title { position: relative; }
.vault-toggle-btn {
    width: 28px; height: 28px;
    display: grid; place-items: center;
    border: 1px solid var(--line);
    border-radius: 8px;
    color: var(--cyan);
    background: rgba(97, 228, 239, .08);
    cursor: pointer;
    font-size: 12px;
    flex: 0 0 auto;
    transition: transform 180ms ease;
}
.vault-toggle-btn:hover { border-color: var(--cyan); }
.vault-card.is-collapsed #vault-state,
.vault-card.is-collapsed #vault-error,
.vault-card.is-collapsed #vault-gate,
.vault-card.is-collapsed #vault-unlocked {
    display: none !important;
}
"""
    backup("static/css/vault.css")
    with open("static/css/vault.css", "w", encoding="utf-8") as f:
        f.write(css + css_addition)
    print("  ✅ vault.css patched")
    changed_any = True

with open("static/js/vault.js", "r", encoding="utf-8") as f:
    js = f.read()

if "initToggle" in js:
    print("  [skip] vault.js already has toggle logic")
else:
    anchor_def = "    function initTabs() {"
    toggle_fn = '''    function initToggle() {
        const btn = document.getElementById("vault-toggle-btn");
        const card = document.getElementById("vault-card");
        if (!btn || !card) return;
        btn.addEventListener("click", () => {
            const collapsed = card.classList.toggle("is-collapsed");
            btn.textContent = collapsed ? "\\u25b8" : "\\u25be";
        });
    }

'''
    if anchor_def not in js:
        print("  [WARN] Could not find initTabs() in vault.js")
    else:
        js = js.replace(anchor_def, toggle_fn + anchor_def, 1)
        call_anchor = "        initTabs();\n        initDropzone();"
        if call_anchor in js:
            js = js.replace(call_anchor, "        initTabs();\n        initToggle();\n        initDropzone();", 1)
            backup("static/js/vault.js")
            with open("static/js/vault.js", "w", encoding="utf-8") as f:
                f.write(js)
            print("  ✅ vault.js patched")
            changed_any = True
        else:
            print("  [WARN] Could not find boot sequence in vault.js")

if not changed_any:
    print("\nNo changes were made.")
else:
    print("\nDone. Backups saved as *.bak.<timestamp>.")
    print("Restart the server and hard-refresh the browser.")
