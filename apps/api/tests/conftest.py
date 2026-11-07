"""Unit tests configuration module."""

import pytest


@pytest.fixture(autouse=True)
def configure_test_settings(settings):
    """
    Override settings during test execution to prevent external network calls.
    """
    from config.celery import app as celery_app

    settings.IS_TESTING = True
    settings.AI_MODERATION_ENABLED = True
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
    celery_app.conf.update(
        task_always_eager=True,
        task_eager_propagates=True,
    )
    settings.PASSWORD_HASHERS = [
        "django.contrib.auth.hashers.MD5PasswordHasher",
    ]
    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }
    settings.PAYDUNYA_MASTER_KEY = "test_paydunya_master_key_12345"
    settings.PAYDUNYA_PRIVATE_KEY = "test_private_key"
    settings.PAYDUNYA_PUBLIC_KEY = "test_public_key"
    settings.PAYDUNYA_TOKEN = "test_token"
    settings.GOOGLE_CLIENT_ID = "test_google_client_id"
    settings.GOOGLE_CLIENT_SECRET = "test_google_client_secret"
    settings.GITHUB_CLIENT_ID = "test_github_client_id"
    settings.GITHUB_CLIENT_SECRET = "test_github_client_secret"
    settings.GEMINI_API_KEY = ""
    settings.OPENAI_API_KEY = ""


@pytest.fixture(autouse=True)
def reset_ai_circuit_breaker():
    """Reset AI circuit breaker state before and after every test."""
    from apps.ai.providers.circuit_breaker import gemini_circuit_breaker

    gemini_circuit_breaker.reset()
    yield
    gemini_circuit_breaker.reset()


@pytest.fixture(autouse=True)
def mock_default_ai_moderation():
    """
    Ensure hermetic tests without external AI API dependencies for general
    posting and messaging tests. Individual AI tests can override this patch.
    """
    from unittest.mock import patch

    from apps.ai.schemas import ModerationResult

    with patch("apps.ai.router.ai_router.moderate_content") as mock_mod:
        mock_mod.return_value = ModerationResult(
            decision="allow",
            flagged=False,
            categories=[],
            confidence=1.0,
            provider="mock_test",
        )
        yield mock_mod
