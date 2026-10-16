class AIProviderError(Exception):
    """Base exception for all AI provider operations."""

    def __init__(self, message: str, provider: str = "", details: dict = None):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.details = details or {}


class RecoverableProviderError(AIProviderError):
    """
    Transient or recoverable error (e.g. timeout, 503, connection drop)
    that permits automatic retry or fallback to secondary provider.
    """
    pass


class RateLimitError(RecoverableProviderError):
    """Temporary rate limit (e.g. HTTP 429 concurrency or RPM limit)."""
    pass


class QuotaExhaustedError(AIProviderError):
    """
    Account or model quota / credit exhaustion (e.g. RESOURCE_EXHAUSTED).
    Triggers the QuotaCircuitBreaker to bypass provider during cooldown.
    """
    pass


class ConfigurationError(AIProviderError):
    """
    Invalid API key, unauthorized access, or invalid model name.
    Indicates administrative configuration error that should not be repeatedly retried.
    """
    pass


class SafetyRejectionError(AIProviderError):
    """
    Content safety violation reported by model safety filters.
    This is a legitimate policy rejection, NOT a provider availability failure.
    """
    pass


class AllProvidersFailedError(AIProviderError):
    """
    Raised when both primary (Gemini) and fallback (OpenAI) providers failed,
    triggering fail-closed security for mandatory operations like moderation.
    """
    pass
