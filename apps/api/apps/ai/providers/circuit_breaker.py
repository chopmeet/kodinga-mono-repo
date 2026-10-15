import logging
import threading
import time
from typing import Dict, Any

logger = logging.getLogger(__name__)


class QuotaCircuitBreaker:
    """
    Circuit breaker specifically dedicated to tracking provider quota exhaustion
    (e.g. Google Gemini quota exhaustion).

    States:
      - CLOSED: Provider is healthy; calls proceed normally.
      - OPEN: Quota is exhausted; calls are immediately bypassed to fallback without probing.
      - HALF_OPEN: Cooldown has elapsed; a single probe request is allowed through.
    """

    STATE_CLOSED = "CLOSED"
    STATE_OPEN = "OPEN"
    STATE_HALF_OPEN = "HALF_OPEN"

    def __init__(self, provider_name: str = "gemini", cooldown_seconds: int = 60):
        self.provider_name = provider_name
        self.cooldown_seconds = cooldown_seconds
        self.state = self.STATE_CLOSED
        self.last_opened_at = 0.0
        self.last_error = ""
        self.consecutive_errors = 0
        self.quota_exhausted_count = 0
        self.total_bypassed = 0
        self._lock = threading.Lock()

    def can_attempt(self) -> bool:
        """
        Determines whether the provider should be attempted or bypassed.
        """
        with self._lock:
            if self.state == self.STATE_CLOSED:
                return True

            now = time.time()
            elapsed = now - self.last_opened_at

            if self.state == self.STATE_OPEN:
                if elapsed >= self.cooldown_seconds:
                    logger.info(
                        f"[{self.provider_name}] Circuit breaker cooldown elapsed ({elapsed:.1f}s >= {self.cooldown_seconds}s). Transitioning to HALF_OPEN probe."
                    )
                    self.state = self.STATE_HALF_OPEN
                    return True
                else:
                    self.total_bypassed += 1
                    return False

            if self.state == self.STATE_HALF_OPEN:
                # In half-open, allow the probe attempt
                return True

            return True

    def record_success(self) -> None:
        """
        Called when a request to the provider succeeds.
        Restores CLOSED state if recovering from OPEN or HALF_OPEN.
        """
        with self._lock:
            if self.state != self.STATE_CLOSED:
                logger.info(
                    f"[{self.provider_name}] Provider recovered successfully. Restoring circuit to CLOSED state."
                )
            self.state = self.STATE_CLOSED
            self.consecutive_errors = 0
            self.last_error = ""

    def record_quota_exhausted(self, reason: str = "") -> None:
        """
        Called when the provider returns a quota exhaustion error (e.g. RESOURCE_EXHAUSTED).
        Immediately opens the circuit breaker for cooldown_seconds.
        """
        with self._lock:
            self.state = self.STATE_OPEN
            self.last_opened_at = time.time()
            self.last_error = reason
            self.quota_exhausted_count += 1
            self.consecutive_errors += 1
            logger.warning(
                f"[{self.provider_name}] Quota exhausted! Opening circuit breaker for {self.cooldown_seconds}s. Reason: {reason}"
            )

    def record_transient_error(self, reason: str = "") -> None:
        """
        Called on transient error (e.g. 503 or network timeout).
        Does not automatically open the quota circuit unless error threshold reached.
        """
        with self._lock:
            self.consecutive_errors += 1
            self.last_error = reason

    def reset(self) -> None:
        """Reset the circuit breaker to clean CLOSED state."""
        with self._lock:
            self.state = self.STATE_CLOSED
            self.last_opened_at = 0.0
            self.consecutive_errors = 0
            self.last_error = ""

    def get_status(self) -> Dict[str, Any]:
        """Returns status dictionary for health and observability."""
        with self._lock:
            now = time.time()
            remaining_cooldown = 0
            if self.state == self.STATE_OPEN:
                remaining_cooldown = max(0, int(self.cooldown_seconds - (now - self.last_opened_at)))

            return {
                "provider": self.provider_name,
                "state": self.state,
                "cooldown_seconds": self.cooldown_seconds,
                "remaining_cooldown_seconds": remaining_cooldown,
                "consecutive_errors": self.consecutive_errors,
                "quota_exhausted_count": self.quota_exhausted_count,
                "total_bypassed": self.total_bypassed,
                "last_error": self.last_error,
                "is_available": self.state == self.STATE_CLOSED,
            }


# Centralized singleton circuit breaker for Gemini
gemini_circuit_breaker = QuotaCircuitBreaker(provider_name="gemini", cooldown_seconds=60)
