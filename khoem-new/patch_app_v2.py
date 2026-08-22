#!/usr/bin/env python3
import re
import shutil
import sys
import time

TARGET = "app.py"
with open(TARGET, "r", encoding="utf-8") as f:
    original = f.read()
content = original
changes = []

if "init_vault_db" in content:
    content = re.sub(r"from routes\.vault_routes\s+import\s+vault_bp\s*,\s*init_vault_db",
                      "from routes.vault_routes         import vault_bp", content)
    content = re.sub(r"\n[ \t]*init_vault_db\(\)\s*", "\n", content)
    if "init_vault_db" not in content:
        changes.append("removed stale init_vault_db import/call")
    else:
        print("  [WARN] Could not fully remove init_vault_db references — check app.py by hand.")

secret_key_block = '''app.secret_key = (
    os.getenv("SESSION_SECRET")
    or os.getenv("FLASK_SECRET_KEY")
    or "dev-only-change-this-secret"
)'''
if "app.permanent_session_lifetime" in content:
    print("  [skip] permanent_session_lifetime already present")
elif secret_key_block in content:
    content = content.replace(
        secret_key_block,
        secret_key_block + "\napp.permanent_session_lifetime = datetime.timedelta(days=365)",
        1,
    )
    changes.append("permanent_session_lifetime")
else:
    print("  [WARN] Could not find app.secret_key block — add by hand:")
    print("         app.permanent_session_lifetime = datetime.timedelta(days=365)")

if "app.register_blueprint(vault_bp)" not in content and "from routes.vault_routes" in content:
    content = content.replace(
        "app.register_blueprint(navigator_bp)",
        "app.register_blueprint(navigator_bp)\n    app.register_blueprint(vault_bp)",
        1,
    )
    changes.append("vault_bp registration")
elif "app.register_blueprint(vault_bp)" in content:
    print("  [skip] vault_bp already registered")

if not changes:
    print("\nNo changes made — check WARN lines above.")
    sys.exit(0)

backup_name = f"app.py.bak.{int(time.time())}"
shutil.copy(TARGET, backup_name)
with open(TARGET, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n✅ Patched: {', '.join(changes)}")
print(f"✅ Backup saved as: {backup_name}")
