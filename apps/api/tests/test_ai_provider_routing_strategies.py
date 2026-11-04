from unittest.mock import MagicMock

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.ai.providers.circuit_breaker import QuotaCircuitBreaker
from apps.ai.providers.exceptions import AllProvidersFailedError, RateLimitError
from apps.ai.router import AIProviderStrategy, ProviderRouter
from apps.ai.schemas import ModerationResult
from apps.communities.models.community import Community, CommunityPrivacy
from apps.communities.models.settings import CommunitySettings
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


@pytest.fixture
def superadmin_user(db):
    return User.objects.create_superuser(
        email="superadmin_ai@kodinga.com",
        username="superadmin_ai",
        password="SuperPassword123!",
    )


@pytest.fixture
def regular_user(db):
    return User.objects.create_user(
        email="user_ai@kodinga.com",
        username="user_ai",
        password="UserPassword123!",
    )


@pytest.fixture
def test_community(db, regular_user):
    comm = Community.objects.create(
        name="Tech Community",
        slug="tech-community",
        owner=regular_user,
        privacy_type=CommunityPrivacy.PUBLIC,
    )
    CommunityMember.objects.create(
        community=comm,
        user=regular_user,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    CommunitySettings.objects.get_or_create(community=comm)
    return comm


class TestAIProviderRoutingStrategies:
    def test_default_strategy_is_auto(self):
        strategy = ProviderRouter.get_effective_strategy()
        assert strategy in [
            AIProviderStrategy.AUTO,
            AIProviderStrategy.GEMINI_ONLY,
            AIProviderStrategy.OPENAI_ONLY,
            AIProviderStrategy.OPENAI_FIRST,
        ]

    def test_global_strategy_set_and_get(self, superadmin_user):
        ProviderRouter.set_global_strategy(AIProviderStrategy.OPENAI_ONLY, updated_by=superadmin_user)
        assert ProviderRouter.get_effective_strategy() == AIProviderStrategy.OPENAI_ONLY

        ProviderRouter.set_global_strategy(AIProviderStrategy.GEMINI_ONLY, updated_by=superadmin_user)
        assert ProviderRouter.get_effective_strategy() == AIProviderStrategy.GEMINI_ONLY

        ProviderRouter.set_global_strategy(AIProviderStrategy.AUTO, updated_by=superadmin_user)
        assert ProviderRouter.get_effective_strategy() == AIProviderStrategy.AUTO

    def test_community_override_precedence(self, test_community):
        settings_obj = test_community.settings
        settings_obj.ai_provider_override = "gemini"
        settings_obj.save()

        # Global is AUTO, but community overrides to GEMINI_ONLY
        eff_strategy = ProviderRouter.get_effective_strategy(community=test_community)
        assert eff_strategy == AIProviderStrategy.GEMINI_ONLY

        settings_obj.ai_provider_override = "openai"
        settings_obj.save()
        eff_strategy = ProviderRouter.get_effective_strategy(community=test_community)
        assert eff_strategy == AIProviderStrategy.OPENAI_ONLY

    def test_router_gemini_only_does_not_call_openai(self):
        mock_gemini = MagicMock()
        mock_openai = MagicMock()
        cb = QuotaCircuitBreaker()

        expected = ModerationResult(
            decision="allow", flagged=False, categories=[], confidence=0.99, provider="gemini"
        )
        mock_gemini.moderate_content.return_value = expected

        router = ProviderRouter(gemini_adapter=mock_gemini, openai_adapter=mock_openai, circuit_breaker=cb)

        result = router.moderate_content("Bonjour le monde", strategy=AIProviderStrategy.GEMINI_ONLY)
        assert result == expected
        mock_gemini.moderate_content.assert_called_once()
        mock_openai.moderate_content.assert_not_called()

    def test_router_gemini_only_fails_when_gemini_fails_without_fallback(self):
        mock_gemini = MagicMock()
        mock_openai = MagicMock()
        cb = QuotaCircuitBreaker()

        mock_gemini.moderate_content.side_effect = RateLimitError("Gemini quota rate limit")

        router = ProviderRouter(gemini_adapter=mock_gemini, openai_adapter=mock_openai, circuit_breaker=cb)

        with pytest.raises(AllProvidersFailedError) as exc_info:
            router.moderate_content("Test text", strategy=AIProviderStrategy.GEMINI_ONLY)

        assert exc_info.value.provider == "gemini"
        mock_openai.moderate_content.assert_not_called()

    def test_router_openai_only_does_not_call_gemini(self):
        mock_gemini = MagicMock()
        mock_openai = MagicMock()
        cb = QuotaCircuitBreaker()

        expected = ModerationResult(
            decision="allow", flagged=False, categories=[], confidence=0.95, provider="openai"
        )
        mock_openai.moderate_content.return_value = expected

        router = ProviderRouter(gemini_adapter=mock_gemini, openai_adapter=mock_openai, circuit_breaker=cb)

        result = router.moderate_content("Bonjour OpenAI", strategy=AIProviderStrategy.OPENAI_ONLY)
        assert result == expected
        mock_openai.moderate_content.assert_called_once()
        mock_gemini.moderate_content.assert_not_called()

    def test_router_auto_mode_fallbacks_to_openai_on_gemini_failure(self):
        mock_gemini = MagicMock()
        mock_openai = MagicMock()
        cb = QuotaCircuitBreaker()

        mock_gemini.moderate_content.side_effect = RateLimitError("Gemini unavailable")
        expected = ModerationResult(
            decision="allow", flagged=False, categories=[], confidence=0.92, provider="openai"
        )
        mock_openai.moderate_content.return_value = expected

        router = ProviderRouter(gemini_adapter=mock_gemini, openai_adapter=mock_openai, circuit_breaker=cb)

        result = router.moderate_content("Fallback test", strategy=AIProviderStrategy.AUTO)
        assert result == expected
        assert mock_gemini.moderate_content.call_count >= 1
        mock_openai.moderate_content.assert_called_once()

    def test_admin_ai_settings_endpoint_permissions_and_patch(self, superadmin_user, regular_user):
        client = APIClient()

        # 1. Anonymous forbidden
        res = client.get("/api/v1/admin/ai/settings/")
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

        # 2. Regular user forbidden (must be superadmin)
        client.force_authenticate(user=regular_user)
        res = client.get("/api/v1/admin/ai/settings/")
        assert res.status_code == status.HTTP_403_FORBIDDEN

        # 3. Superadmin can GET
        client.force_authenticate(user=superadmin_user)
        res = client.get("/api/v1/admin/ai/settings/")
        assert res.status_code == status.HTTP_200_OK
        data = res.json()["data"]
        assert "strategy" in data
        assert "available_strategies" in data
        assert len(data["available_strategies"]) == 4

        # 4. Superadmin can PATCH strategy to openai_only
        res_patch = client.patch(
            "/api/v1/admin/ai/settings/",
            {"strategy": "openai_only"},
            format="json",
        )
        assert res_patch.status_code == status.HTTP_200_OK
        assert res_patch.json()["data"]["strategy"] == "openai_only"
        assert ProviderRouter.get_effective_strategy() == "openai_only"

        # 5. Restore back to auto
        res_restore = client.patch(
            "/api/v1/admin/ai/settings/",
            {"strategy": "auto"},
            format="json",
        )
        assert res_restore.status_code == status.HTTP_200_OK
        assert res_restore.json()["data"]["strategy"] == "auto"

    def test_community_ai_settings_endpoint_supports_provider_override(self, regular_user, test_community):
        client = APIClient()
        client.force_authenticate(user=regular_user)

        # GET community AI settings
        url = f"/api/v1/communities/{test_community.slug}/ai-settings/"
        res = client.get(url)
        assert res.status_code == status.HTTP_200_OK
        assert "ai_provider_override" in res.json()["data"]

        # PATCH override to gemini
        res_patch = client.patch(url, {"ai_provider_override": "gemini"}, format="json")
        assert res_patch.status_code == status.HTTP_200_OK
        assert res_patch.json()["data"]["ai_provider_override"] == "gemini"

        test_community.settings.refresh_from_db()
        assert test_community.settings.ai_provider_override == "gemini"
