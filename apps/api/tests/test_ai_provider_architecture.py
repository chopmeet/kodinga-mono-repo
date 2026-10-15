import contextlib
from unittest.mock import MagicMock, patch

import pytest
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.ai.models.audit import ModerationAuditLog, ModerationDecision
from apps.ai.models.translation import TranslationCache
from apps.ai.providers.circuit_breaker import QuotaCircuitBreaker
from apps.ai.providers.exceptions import (
    AllProvidersFailedError,
    ConfigurationError,
    QuotaExhaustedError,
    RateLimitError,
    RecoverableProviderError,
    SafetyRejectionError,
)
from apps.ai.providers.gemini import GeminiAdapter
from apps.ai.providers.openai_adapter import OpenAIAdapter
from apps.ai.router import ProviderRouter
from apps.ai.schemas import (
    LanguageDetectionResult,
    ModerationResult,
    SentimentResult,
    TranslationResult,
)
from apps.ai.services.moderation_service import ModerationService
from apps.ai.services.translation_service import TranslationService
from apps.communities.models.community import Community, CommunityPrivacy
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.posts.services.post_service import PostService


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        email="admin@kodinga.com",
        username="admin",
        password="SecurePassword123!",
    )


@pytest.fixture
def owner(db):
    return User.objects.create_user(
        email="owner_ai@kodinga.com",
        username="owner_ai",
        password="SecurePassword123!",
    )


@pytest.fixture
def member(db):
    return User.objects.create_user(
        email="member_ai@kodinga.com",
        username="member_ai",
        password="SecurePassword123!",
    )


@pytest.fixture
def stranger(db):
    return User.objects.create_user(
        email="stranger_ai@kodinga.com",
        username="stranger_ai",
        password="SecurePassword123!",
    )


@pytest.fixture
def community(owner, member):
    comm = Community.objects.create(
        owner=owner,
        name="AI Builders Dakar",
        slug="ai-builders-dakar",
        privacy_type=CommunityPrivacy.PUBLIC,
    )
    CommunityMember.objects.create(
        community=comm,
        user=owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=member,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.fixture
def other_community(stranger):
    comm = Community.objects.create(
        owner=stranger,
        name="Other Community",
        slug="other-community",
        privacy_type=CommunityPrivacy.PUBLIC,
    )
    CommunityMember.objects.create(
        community=comm,
        user=stranger,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


# ==============================================================================
# 1. UNIT & ROUTER TESTS (Gemini-First with OpenAI Fallback)
# ==============================================================================


@pytest.mark.django_db
class TestAIRouterAndProviders:
    def test_gemini_succeeds_openai_not_called(self):
        """1. When Gemini succeeds, OpenAI fallback is never called."""
        gemini_mock = MagicMock(spec=GeminiAdapter)
        openai_mock = MagicMock(spec=OpenAIAdapter)
        cb = QuotaCircuitBreaker(cooldown_seconds=60)

        gemini_mock.translate_text.return_value = TranslationResult(
            translated_text="Bonjour le monde",
            source_language="en",
            target_language="fr",
            provider="gemini",
        )

        router = ProviderRouter(
            gemini_adapter=gemini_mock,
            openai_adapter=openai_mock,
            circuit_breaker=cb,
        )

        result = router.translate_text("Hello world", target_lang="fr")
        assert result.translated_text == "Bonjour le monde"
        assert result.provider == "gemini"
        assert gemini_mock.translate_text.call_count == 1
        assert openai_mock.translate_text.call_count == 0

    def test_gemini_quota_exhausted_fallback_and_circuit_breaker(self):
        """2 & 15. When Gemini quota is exhausted, OpenAI is used automatically and circuit breaker opens."""
        gemini_mock = MagicMock(spec=GeminiAdapter)
        openai_mock = MagicMock(spec=OpenAIAdapter)
        cb = QuotaCircuitBreaker(cooldown_seconds=60)

        gemini_mock.translate_text.side_effect = QuotaExhaustedError(
            "RESOURCE_EXHAUSTED: Daily quota exceeded"
        )
        openai_mock.translate_text.return_value = TranslationResult(
            translated_text="Bonjour le monde (OpenAI)",
            source_language="en",
            target_language="fr",
            provider="openai",
        )

        router = ProviderRouter(
            gemini_adapter=gemini_mock,
            openai_adapter=openai_mock,
            circuit_breaker=cb,
        )

        # 1st call: Gemini fails with quota -> OpenAI fallback
        res1 = router.translate_text("Hello world", target_lang="fr")
        assert res1.provider == "openai"
        assert cb.state == QuotaCircuitBreaker.STATE_OPEN
        assert gemini_mock.translate_text.call_count == 1
        assert openai_mock.translate_text.call_count == 1

        # 2nd call (requirement 15): Circuit breaker is OPEN -> bypass Gemini directly to OpenAI
        res2 = router.translate_text("Hello again", target_lang="fr")
        assert res2.provider == "openai"
        assert gemini_mock.translate_text.call_count == 1  # Not probed again!
        assert openai_mock.translate_text.call_count == 2

    def test_gemini_rate_limit_or_503_fallback(self):
        """3. When Gemini returns 429 or 503, fallback to OpenAI works."""
        gemini_mock = MagicMock(spec=GeminiAdapter)
        openai_mock = MagicMock(spec=OpenAIAdapter)
        cb = QuotaCircuitBreaker(cooldown_seconds=60)

        gemini_mock.detect_language.side_effect = RateLimitError(
            "429 Too Many Requests"
        )
        openai_mock.detect_language.return_value = LanguageDetectionResult(
            language_code="wo", confidence=0.98, provider="openai"
        )

        router = ProviderRouter(
            gemini_adapter=gemini_mock,
            openai_adapter=openai_mock,
            circuit_breaker=cb,
        )

        res = router.detect_language("Na nga def")
        assert res.language_code == "wo"
        assert res.provider == "openai"

    def test_gemini_timeout_bounded_fallback(self):
        """4. When Gemini times out, fallback to OpenAI works within bounded time."""
        gemini_mock = MagicMock(spec=GeminiAdapter)
        openai_mock = MagicMock(spec=OpenAIAdapter)
        cb = QuotaCircuitBreaker(cooldown_seconds=60)

        gemini_mock.analyze_sentiment.side_effect = RecoverableProviderError(
            "DEADLINE_EXCEEDED: timeout after 15000ms"
        )
        openai_mock.analyze_sentiment.return_value = SentimentResult(
            sentiment="positive", score=0.8, provider="openai"
        )

        router = ProviderRouter(
            gemini_adapter=gemini_mock,
            openai_adapter=openai_mock,
            circuit_breaker=cb,
        )

        res = router.analyze_sentiment("Excellent travail sur cette fonctionnalité!")
        assert res.sentiment == "positive"
        assert res.provider == "openai"

    def test_gemini_invalid_api_key_configuration_error(self):
        """5. When Gemini has invalid API key, error is logged and fallback is used safely without retry loop."""
        gemini_mock = MagicMock(spec=GeminiAdapter)
        openai_mock = MagicMock(spec=OpenAIAdapter)
        cb = QuotaCircuitBreaker(cooldown_seconds=60)

        gemini_mock.detect_language.side_effect = ConfigurationError(
            "API key not valid. Please pass a valid API key."
        )
        openai_mock.detect_language.return_value = LanguageDetectionResult(
            language_code="fr", confidence=0.99, provider="openai"
        )

        router = ProviderRouter(
            gemini_adapter=gemini_mock,
            openai_adapter=openai_mock,
            circuit_breaker=cb,
        )

        res = router.detect_language("Bonjour")
        assert res.provider == "openai"
        # Only called once; did not retry broken configuration
        assert gemini_mock.detect_language.call_count == 1

    def test_both_providers_fail_raises_all_providers_failed(self):
        """6. When both Gemini and OpenAI fail, AllProvidersFailedError is raised."""
        gemini_mock = MagicMock(spec=GeminiAdapter)
        openai_mock = MagicMock(spec=OpenAIAdapter)
        cb = QuotaCircuitBreaker(cooldown_seconds=60)

        gemini_mock.moderate_content.side_effect = RecoverableProviderError(
            "Gemini 503"
        )
        openai_mock.moderate_content.side_effect = RecoverableProviderError(
            "OpenAI 503"
        )

        router = ProviderRouter(
            gemini_adapter=gemini_mock,
            openai_adapter=openai_mock,
            circuit_breaker=cb,
        )

        with pytest.raises(AllProvidersFailedError):
            router.moderate_content("Texte de test")

    def test_gemini_legitimate_safety_rejection_not_treated_as_provider_failure(self):
        """7. Gemini safety rejection is a policy decision, NOT a provider failure (no OpenAI call)."""
        gemini_mock = MagicMock(spec=GeminiAdapter)
        openai_mock = MagicMock(spec=OpenAIAdapter)
        cb = QuotaCircuitBreaker(cooldown_seconds=60)

        gemini_mock.moderate_content.side_effect = SafetyRejectionError(
            "Blocked by Gemini safety filter"
        )

        router = ProviderRouter(
            gemini_adapter=gemini_mock,
            openai_adapter=openai_mock,
            circuit_breaker=cb,
        )

        result = router.moderate_content("Contenu dangereux")
        assert result.decision == "reject"
        assert result.provider == "gemini"
        # OpenAI was NOT called!
        assert openai_mock.moderate_content.call_count == 0


# ==============================================================================
# 2. MULTILINGUAL TRANSLATION (French, English, Wolof, Bambara)
# ==============================================================================


@pytest.mark.django_db
class TestMultilingualTranslation:
    def test_french_english_wolof_bambara_translation_flow(self):
        """9. Test translation flow for French, English, Wolof, and Bambara."""
        with patch("apps.ai.router.ai_router.translate_text") as mock_trans:
            mock_trans.return_value = TranslationResult(
                translated_text="Naka subaka ci (Bonjour en Wolof)",
                source_language="fr",
                target_language="wo",
                provider="gemini",
                confidence=0.96,
            )

            res = TranslationService.translate(
                "Bonjour tout le monde", target_lang="wo"
            )
            assert res.translated_text == "Naka subaka ci (Bonjour en Wolof)"
            assert res.target_language == "wo"
            assert mock_trans.call_count == 1

            # Bambara test
            mock_trans.return_value = TranslationResult(
                translated_text="I ni sogoma (Bonjour en Bambara)",
                source_language="fr",
                target_language="bm",
                provider="gemini",
                confidence=0.95,
            )
            res_bm = TranslationService.translate("Bonjour à tous", target_lang="bm")
            assert res_bm.translated_text == "I ni sogoma (Bonjour en Bambara)"
            assert res_bm.target_language == "bm"

    def test_caching_and_original_message_unchanged(self):
        """10. Original messages remain unchanged, cached translations are reused."""
        with patch("apps.ai.router.ai_router.translate_text") as mock_trans:
            mock_trans.return_value = TranslationResult(
                translated_text="Hello community",
                source_language="fr",
                target_language="en",
                provider="gemini",
            )

            original_text = "Bonjour la communauté"
            # 1st call -> hit AI
            res1 = TranslationService.translate(original_text, target_lang="en")
            assert res1.translated_text == "Hello community"
            assert res1.cached is False
            assert mock_trans.call_count == 1

            # 2nd call -> hit Cache! AI not called again
            res2 = TranslationService.translate(original_text, target_lang="en")
            assert res2.translated_text == "Hello community"
            assert res2.cached is True
            assert mock_trans.call_count == 1  # Unchanged!

            # Verify in DB
            content_hash = TranslationService.get_content_hash(original_text)
            cached_entry = TranslationCache.objects.filter(
                content_hash=content_hash, target_language="en"
            ).first()
            assert cached_entry is not None
            assert cached_entry.hit_count == 2


# ==============================================================================
# 3. CONTENT MODERATION & PLATFORM SAFETY ENFORCEMENT
# ==============================================================================


@pytest.mark.django_db
class TestContentModerationAndSafety:
    def test_legitimate_criticism_allowed_not_banned(self):
        """11. Negative but legitimate technical criticism is NOT automatically banned."""
        with patch("apps.ai.router.ai_router.moderate_content") as mock_mod:
            mock_mod.return_value = ModerationResult(
                decision="allow",
                flagged=False,
                categories=[],
                confidence=0.98,
                reason="Critique technique constructive sans attaque personnelle",
                provider="gemini",
            )

            criticism = "Votre architecture a des lenteurs de chargement et le code présente des faiblesses."
            result = ModerationService.evaluate_content(criticism)
            assert result.decision == "allow"
            assert result.flagged is False

    def test_sexual_harassment_and_targeted_abuse_blocked(self, owner, community):
        """12. Sexual harassment, targeted abuse, and humiliating attacks are blocked."""
        with patch("apps.ai.router.ai_router.moderate_content") as mock_mod:
            mock_mod.return_value = ModerationResult(
                decision="reject",
                flagged=True,
                categories=["sexual_harassment", "targeted_harassment"],
                confidence=0.99,
                reason="Propos abusifs et harcèlement ciblé prohibés",
                provider="gemini",
            )

            # Pre-publication check must raise PermissionDenied
            with pytest.raises(PermissionDenied) as exc_info:
                PostService.create_post(
                    author=owner,
                    community=community,
                    data={"title": "Attack", "content": "Attaque personnelle abusive"},
                )
            assert "sécurité de la plateforme" in str(exc_info.value)

    def test_fail_closed_when_both_providers_fail(self, owner, community):
        """6. Fail-closed: If both providers fail, unmoderated message CANNOT be published."""
        with patch("apps.ai.router.ai_router.moderate_content") as mock_mod:
            mock_mod.side_effect = AllProvidersFailedError("All AI providers down")

            with pytest.raises(ValidationError) as exc_info:
                PostService.create_post(
                    author=owner,
                    community=community,
                    data={"title": "Test Post", "content": "Hello"},
                )
            assert "temporairement indisponible" in str(exc_info.value)

    def test_community_owner_cannot_disable_mandatory_protections(
        self, api_client, owner, community
    ):
        """13. Community owners cannot disable or weaken mandatory platform protections."""
        api_client.force_authenticate(user=owner)
        url = f"/api/v1/communities/{community.slug}/ai-settings/"

        # Fetch settings
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        data = response.data["data"]
        assert "platform_locked_rules" in data
        assert data["platform_locked_rules"]["prohibit_sexual_harassment"] is True
        assert (
            data["platform_locked_rules"]["mandatory_pre_publication_moderation"]
            is True
        )
        assert data["platform_locked_rules"]["is_customizable_by_owner"] is False

        # Attempt to inject disabling parameters
        patch_response = api_client.patch(
            url,
            {
                "prohibit_sexual_harassment": False,
                "mandatory_pre_publication_moderation": False,
                "ai_translation_enabled": False,
            },
            format="json",
        )
        assert patch_response.status_code == status.HTTP_200_OK
        res_data = patch_response.data["data"]
        # Configurable field updated
        assert res_data["ai_translation_enabled"] is False
        # Platform locked rules remain strictly active!
        assert res_data["platform_locked_rules"]["prohibit_sexual_harassment"] is True
        assert (
            res_data["platform_locked_rules"]["mandatory_pre_publication_moderation"]
            is True
        )

    def test_repeated_violations_audit_logging(self, owner, community):
        """14. Moderation decisions are logged in ModerationAuditLog for transparency."""
        with patch("apps.ai.router.ai_router.moderate_content") as mock_mod:
            mock_mod.return_value = ModerationResult(
                decision="reject",
                flagged=True,
                categories=["targeted_harassment"],
                confidence=0.97,
                reason="Attaque ciblée",
                provider="gemini",
            )

            with contextlib.suppress(PermissionDenied):
                ModerationService.enforce_pre_publication(
                    "Contenu toxique répété", community=community, author=owner
                )

            log = ModerationAuditLog.objects.filter(
                user=owner, decision=ModerationDecision.REJECT
            ).first()
            assert log is not None
            assert "targeted_harassment" in log.categories
            assert log.provider == "gemini"


# ==============================================================================
# 4. TENANT BOUNDARIES & OBSERVABILITY
# ==============================================================================


@pytest.mark.django_db
class TestTenantBoundariesAndObservability:
    def test_tenant_boundary_moderation_logs(
        self, api_client, owner, stranger, community, other_community
    ):
        """16. Tenant isolation: stranger cannot inspect another community's moderation logs."""
        ModerationAuditLog.objects.create(
            community=community,
            content_preview="Violating snippet",
            content_hash="hash123",
            decision=ModerationDecision.REJECT,
            categories=["targeted_harassment"],
        )

        api_client.force_authenticate(user=stranger)
        # Stranger attempts to view community's moderation logs
        url = f"/api/v1/ai/moderation/logs/?community={community.slug}"
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_health_observability(self, api_client, admin_user):
        """Health service endpoint returns provider availability and circuit breaker status."""
        api_client.force_authenticate(user=admin_user)
        resp = api_client.get("/api/v1/admin/ai/health/")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.data["data"]
        assert "primary_provider" in data
        assert "fallback_provider" in data
        assert data["primary_provider"]["name"] == "gemini"
        assert data["fallback_provider"]["name"] == "openai"
        assert "circuit_breaker" in data["primary_provider"]
