#!/bin/sh
set -e

# ==============================================================================
# KODINGA BACKEND API — DOCKER ENTRYPOINT SCRIPT
# Handles database readiness, automated migrations, and process dispatching
# ==============================================================================

# Function to test database availability
wait_for_database() {
    echo "🔍 Checking database connectivity..."
    python - <<'EOF'
import sys
import time
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

try:
    django.setup()
    from django.db import connections
    from django.db.utils import OperationalError
except Exception as e:
    print(f"⚠️ Django setup failed: {e}", file=sys.stderr)
    sys.exit(0)

retries = int(os.environ.get('DB_WAIT_RETRIES', '20'))
delay = int(os.environ.get('DB_WAIT_INTERVAL', '2'))

for attempt in range(1, retries + 1):
    try:
        db_conn = connections['default']
        with db_conn.cursor() as cursor:
            cursor.execute("SELECT 1;")
        print("✅ Database connection successful and ready.")
        sys.exit(0)
    except OperationalError as err:
        print(f"⏳ Database unavailable (attempt {attempt}/{retries}). Retrying in {delay}s...")
        time.sleep(delay)
    except Exception as err:
        print(f"ℹ️ Non-fatal database check warning: {err}")
        sys.exit(0)

print("❌ Database connection timed out.", file=sys.stderr)
sys.exit(1)
EOF
}

# 1. Web Service Flow (Gunicorn / Development Server)
if [ "$1" = "gunicorn" ] || [ "$1" = "runserver" ]; then
    # Wait for DB if not disabled
    if [ "${WAIT_FOR_DB:-true}" = "true" ]; then
        wait_for_database
    fi

    # Execute database migrations if enabled
    if [ "${MIGRATE_ON_BOOT:-true}" = "true" ]; then
        echo "🚀 Applying database migrations..."
        python manage.py migrate --noinput
    fi

    # Collect static files if runtime collection is requested
    if [ "${COLLECTSTATIC_ON_BOOT:-false}" = "true" ]; then
        echo "📦 Collecting static files..."
        python manage.py collectstatic --noinput
    fi
fi

# 2. Celery Worker Flow
if [ "$1" = "celery" ] && [ "$2" = "-A" ]; then
    if [ "${WAIT_FOR_DB:-true}" = "true" ]; then
        wait_for_database
    fi
fi

echo "🟢 Starting process: $@"
exec "$@"
