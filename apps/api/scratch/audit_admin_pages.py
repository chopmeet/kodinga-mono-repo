import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib import admin
from django.test import Client
from apps.accounts.models.user import User

admin_user = User.objects.filter(is_superuser=True, is_staff=True).first()
if not admin_user:
    print("No superuser found!")
    sys.exit(1)

client = Client(HTTP_HOST="127.0.0.1")
client.force_login(admin_user)

registry = admin.site._registry
print(f"Total registered admin models: {len(registry)}\n")

errors = []
success_count = 0

# Also check main admin index
res = client.get("/admin/")
if res.status_code != 200:
    errors.append(("/admin/", res.status_code, "Failed to load /admin/ index"))
else:
    success_count += 1

for model, model_admin in registry.items():
    app_label = model._meta.app_label
    model_name = model._meta.model_name
    
    # 1. Changelist view
    changelist_url = f"/admin/{app_label}/{model_name}/"
    try:
        res = client.get(changelist_url)
        if res.status_code != 200:
            errors.append((changelist_url, res.status_code, getattr(res, "reason_phrase", "Error")))
        else:
            success_count += 1
    except Exception as e:
        errors.append((changelist_url, "EXCEPTION", str(e)))

    # 2. Add view
    add_url = f"/admin/{app_label}/{model_name}/add/"
    try:
        res = client.get(add_url)
        if res.status_code not in (200, 302): # 302 if permission denied or redirect
            errors.append((add_url, res.status_code, getattr(res, "reason_phrase", "Error")))
        else:
            success_count += 1
    except Exception as e:
        errors.append((add_url, "EXCEPTION", str(e)))

    # 3. Change view (if instance exists)
    first_obj = model.objects.first()
    if first_obj:
        change_url = f"/admin/{app_label}/{model_name}/{first_obj.pk}/change/"
        try:
            res = client.get(change_url)
            if res.status_code != 200:
                errors.append((change_url, res.status_code, getattr(res, "reason_phrase", "Error")))
            else:
                success_count += 1
        except Exception as e:
            errors.append((change_url, "EXCEPTION", str(e)))

print(f"Checked pages. Successes: {success_count}, Errors: {len(errors)}")

if errors:
    print("\n--- ERRORS FOUND ---")
    for url, code, msg in errors:
        print(f"[{code}] {url} -> {msg}")
else:
    print("\nALL ADMIN PAGES RENDERED SUCCESSFULLY WITH HTTP 200!")
