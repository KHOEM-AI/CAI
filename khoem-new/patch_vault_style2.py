#!/usr/bin/env python3
import re, shutil, time

path = "static/css/vault.css"
with open(path, "r", encoding="utf-8") as f:
    css = f.read()

backup = f"{path}.bak.{int(time.time())}"
shutil.copy(path, backup)
changed = []

old_toggle = re.search(r"\.vault-toggle-btn \{.*?\n\}\n", css, re.S)
new_toggle_css = '''.vault-toggle-btn {
    width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(97, 228, 239, .5);
    border-radius: 10px;
    color: var(--bg-deep);
    background: var(--cyan);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    flex: 0 0 auto;
    transition: transform 180ms ease, background 180ms ease;
}
.vault-toggle-btn:hover { background: var(--cyan-deep); }
.vault-toggle-btn:active { transform: scale(0.94); }
'''
if old_toggle:
    css = css[:old_toggle.start()] + new_toggle_css + css[old_toggle.end():]
    changed.append("toggle button now filled + bigger")
else:
    css += "\n" + new_toggle_css
    changed.append("toggle button styles added")

old_active = ".vault-tab.is-active { border-color: var(--cyan); color: var(--cyan); background: rgba(97, 228, 239, .12); }"
new_active = ".vault-tab.is-active { border-color: var(--cyan); color: var(--bg-deep); background: var(--cyan); font-weight: 700; }"
if new_active in css:
    print("  [skip] active-tab fill already applied")
elif old_active in css:
    css = css.replace(old_active, new_active, 1)
    changed.append("active category tab now fully filled")
else:
    print("  [WARN] Could not find .vault-tab.is-active rule to update — check vault.css by hand.")

with open(path, "w", encoding="utf-8") as f:
    f.write(css)

print("✅ Patched: " + ", ".join(changed) if changed else "No changes made.")
print(f"Backup saved as: {backup}")
