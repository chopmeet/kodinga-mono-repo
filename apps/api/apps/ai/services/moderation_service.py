import hashlib
import logging
from typing import Optional

from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.ai.models.audit import ModerationAuditLog, ModerationDecision
from apps.ai.providers.exceptions import AllProvidersFailedError
from apps.ai.router import ai_router
from apps.ai.schemas import ModerationResult
from apps.communities.models.community import Community

logger = logging.getLogger(__name__)


class ModerationService:
    """
    Mandatory pre-publication content moderation service.
    Enforces non-negotiable platform safety rules (sexual harassment, targeted harassment,
    bullying, violence) alongside community-configurable rules.
    Operates on a strict 'Fail Closed' model if both providers are unavailable.
    """

    MANDATORY_SAFETY_CATEGORIES = [
        "sexual_harassment",
        "targeted_harassment",
        "hate_speech_and_humiliation",
        "severe_safety_violation",
    ]

    @classmethod
    def get_content_hash(cls, text: str) -> str:
        return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()

    @classmethod
    def evaluate_content(
        cls,
        text: str,
        community: Optional[Community] = None,
        author: Optional[User] = None,
    ) -> ModerationResult:
        """
        Runs layered moderation via Gemini (primary) with OpenAI fallback.
        Logs decision to ModerationAuditLog.
        """
        clean_text = (text or "").strip()
        if not clean_text:
            return ModerationResult(
                decision="allow",
                flagged=False,
                categories=[],
                confidence=1.0,
                provider="noop",
            )

        content_hash = cls.get_content_hash(clean_text)
        preview = clean_text[:200]

        try:
            mod_result = ai_router.moderate_content(
                clean_text,
                context={
                    "community_id": str(community.id) if community else None,
                    "author_id": str(author.id) if author else None,
                },
            )
        except AllProvidersFailedError as e:
            # Log failure in audit trail
            cls._log_decision(
                community=community,
                user=author,
                content_preview=preview,
                content_hash=content_hash,
                decision=ModerationDecision.REJECT,
                categories=["moderation_service_unavailable"],
                confidence=0.0,
                reason="Échec de tous les fournisseurs d'IA (Fail Closed)",
                provider="none",
                model="",
            )
            raise e

        # Deterministic backend enforcement:
        # Check if any mandatory platform categories were flagged
        has_mandatory_violation = any(
            cat in cls.MANDATORY_SAFETY_CATEGORIES for cat in mod_result.categories
        )

        final_decision = mod_result.decision
        if has_mandatory_violation:
            final_decision = "reject"
            mod_result.decision = "reject"
            mod_result.flagged = True

        # Check community-specific non-mandatory rules if present
        if community and getattr(community, "settings", None):
            settings = community.settings
            non_mandatory_config = getattr(settings, "non_mandatory_moderation", {}) or {}
            for cat in mod_result.categories:
                if (
                    cat in non_mandatory_config
                    and non_mandatory_config.get(cat) is True
                    and final_decision == "allow"
                ):
                    final_decision = "review"
                    mod_result.decision = "review"
                    mod_result.flagged = True

        # Record audit log
        cls._log_decision(
            community=community,
            user=author,
            content_preview=preview,
            content_hash=content_hash,
            decision=final_decision,
            categories=mod_result.categories,
            confidence=mod_result.confidence,
            reason=mod_result.reason,
            provider=mod_result.provider,
            model=mod_result.model,
        )

        return mod_result

    @classmethod
    def enforce_pre_publication(
        cls,
        text: str,
        community: Optional[Community] = None,
        author: Optional[User] = None,
    ) -> None:
        """
        Pre-publication gatekeeper:
        - Blocks content violating mandatory platform safety rules.
        - Fails closed with user-friendly error if providers are unavailable.
        """
        try:
            result = cls.evaluate_content(text, community=community, author=author)
        except AllProvidersFailedError as err:
            # FAIL CLOSED: Do not publish unmoderated content!
            raise ValidationError(
                "Le service de modération et sécurité est temporairement indisponible. "
                "Pour garantir la sécurité de la communauté, votre publication est en pause. "
                "Veuillez réessayer dans un instant."
            ) from err

        if result.decision == "reject":
            violation_names = ", ".join(result.categories) if result.categories else "sécurité"
            raise PermissionDenied(
                f"Ce contenu enfreint les règles strictes de sécurité de la plateforme "
                f"({violation_names}) et ne peut pas être publié."
            )

    @classmethod
    def _log_decision(
        cls,
        community: Optional[Community],
        user: Optional[User],
        content_preview: str,
        content_hash: str,
        decision: str,
        categories: list[str],
        confidence: float,
        reason: str,
        provider: str,
        model: str,
    ) -> None:
        try:
            ModerationAuditLog.objects.create(
                community=community,
                user=user,
                content_preview=content_preview,
                content_hash=content_hash,
                decision=decision,
                categories=categories,
                confidence=confidence,
                reason=reason,
                provider=provider,
                model=model,
            )
        except Exception as e:
            logger.warning(f"[ModerationService] Failed to record audit log: {e}")
