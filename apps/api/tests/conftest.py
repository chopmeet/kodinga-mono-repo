"""Unit tests configuration module."""

import pytest


@pytest.fixture(autouse=True)
def configure_test_settings(settings):
    """
    Override settings during test execution to prevent external network calls.
    """
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
    settings.PASSWORD_HASHERS = [
        "django.contrib.auth.hashers.MD5PasswordHasher",
    ]
