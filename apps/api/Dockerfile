# Build context: monorepo root (see compose.yaml)

# ---- deps: resolve the locked environment with uv ----
FROM python:3.14-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PYTHON=/usr/local/bin/python3

WORKDIR /app

# Dependencies first so this layer is cached until uv.lock changes
COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY apps/api/ .
RUN uv sync --locked --no-dev

# collectstatic only needs a placeholder key
RUN SECRET_KEY=collectstatic .venv/bin/python manage.py collectstatic --noinput

# ---- runtime ----
FROM python:3.14-slim

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

RUN groupadd --system app && useradd --system --gid app --no-create-home app

WORKDIR /app
COPY --from=build --chown=app:app /app /app

USER app
EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
