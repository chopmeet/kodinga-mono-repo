# ==============================================================================
# KODINGA BACKEND API — MULTI-STAGE PRODUCTION DOCKERFILE
# Ultra-fast builds with Astral `uv`, minimal runtime surface, unprivileged user
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Dependency Resolution
# ------------------------------------------------------------------------------
FROM python:3.14-slim AS builder

# Install uv binary from official Astral image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# UV & Python optimization flags
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PYTHON=/usr/local/bin/python3 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 1. Copy dependency definitions first to maximize Docker layer cache reuse
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev --no-install-project || uv sync --no-dev --no-install-project

# 2. Copy source code & compile project
COPY . .
RUN uv sync --frozen --no-dev || uv sync --no-dev

# 3. Collect static files at build time with dummy SECRET_KEY (WhiteNoise)
RUN SECRET_KEY="kodinga-build-static-placeholder-key" \
    DJANGO_SETTINGS_MODULE="config.settings" \
    .venv/bin/python manage.py collectstatic --noinput

# ------------------------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# ------------------------------------------------------------------------------
FROM python:3.14-slim AS runner

# Install essential runtime utilities (curl for healthchecks, libpq5 for PostgreSQL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Set runtime environment variables
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    DJANGO_SETTINGS_MODULE=config.settings

# Security: Create dedicated unprivileged system group & user (UID/GID 10001)
RUN groupadd --system --gid 10001 appgroup && \
    useradd --system --uid 10001 --gid appgroup --no-create-home --home-dir /app appuser

WORKDIR /app

# Copy built virtual environment and application from builder
COPY --from=builder --chown=appuser:appgroup /app /app

# Configure permissions and directories
RUN chmod +x /app/docker-entrypoint.sh && \
    mkdir -p /app/staticfiles /app/media /app/logs && \
    chown -R appuser:appgroup /app/staticfiles /app/media /app/logs

# Switch to unprivileged user
USER appuser

# Expose HTTP port
EXPOSE 8000

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/v1/health/ || exit 1

# Entrypoint & default CMD for Gunicorn WSGI server
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--threads", "2", \
     "--timeout", "60", \
     "--keep-alive", "5", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
