from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.ai.serializers import CommunityAISettingsSerializer
from apps.communities.models.settings import CommunitySettings
from apps.communities.selectors.community_selector import CommunitySelector
from apps.memberships.models.member import CommunityMember, MembershipStatus
from common.permissions.base import is_superadmin_user
from common.utils.responses import error_response, success_response


class CommunityAISettingsView(APIView):
    """
    Manage AI feature configuration for a community (languages, auto-translation,
    sentiment analytics, and non-mandatory moderation).
    Platform-wide safety rules remain permanently locked and non-modifiable.
    """

    permission_classes = [IsAuthenticated]

    def _check_manager_permission(self, user, community):
        if is_superadmin_user(user):
            return True
        if community.owner_id == user.id:
            return True
        member = CommunityMember.objects.filter(
            community=community, user=user, status=MembershipStatus.ACTIVE
        ).first()
        return bool(member and member.is_admin)

    @extend_schema(
        tags=["AI Services"],
        summary="Consulter les paramètres IA de la communauté",
        responses={200: CommunityAISettingsSerializer},
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        if not self._check_manager_permission(request.user, community):
            return error_response(
                "Seuls les gestionnaires de la communauté peuvent accéder aux paramètres IA.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        settings_obj, _ = CommunitySettings.objects.get_or_create(community=community)

        data = {
            "ai_translation_enabled": getattr(settings_obj, "ai_translation_enabled", True),
            "default_community_language": getattr(settings_obj, "default_community_language", "fr"),
            "supported_languages": getattr(settings_obj, "supported_languages", ["fr", "en", "wo", "bm"]),
            "sentiment_analytics_enabled": getattr(settings_obj, "sentiment_analytics_enabled", True),
            "non_mandatory_moderation": getattr(settings_obj, "non_mandatory_moderation", {}),
            "moderation_strictness": getattr(settings_obj, "moderation_strictness", "standard"),
        }
        serializer = CommunityAISettingsSerializer(data)
        return success_response(data=serializer.data, status_code=status.HTTP_200_OK)

    @extend_schema(
        tags=["AI Services"],
        summary="Mettre à jour les paramètres IA de la communauté",
        request=CommunityAISettingsSerializer,
        responses={200: CommunityAISettingsSerializer},
    )
    def patch(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        if not self._check_manager_permission(request.user, community):
            return error_response(
                "Seuls les gestionnaires de la communauté peuvent modifier les paramètres IA.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        serializer = CommunityAISettingsSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return error_response(
                "Données invalides.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details=serializer.errors,
            )

        settings_obj, _ = CommunitySettings.objects.get_or_create(community=community)

        # Apply allowed configurable fields
        val_data = serializer.validated_data
        for field in [
            "ai_translation_enabled",
            "default_community_language",
            "supported_languages",
            "sentiment_analytics_enabled",
            "non_mandatory_moderation",
            "moderation_strictness",
        ]:
            if field in val_data:
                setattr(settings_obj, field, val_data[field])

        settings_obj.save()

        # Re-fetch data including locked platform invariants
        response_data = {
            "ai_translation_enabled": getattr(settings_obj, "ai_translation_enabled", True),
            "default_community_language": getattr(settings_obj, "default_community_language", "fr"),
            "supported_languages": getattr(settings_obj, "supported_languages", ["fr", "en", "wo", "bm"]),
            "sentiment_analytics_enabled": getattr(settings_obj, "sentiment_analytics_enabled", True),
            "non_mandatory_moderation": getattr(settings_obj, "non_mandatory_moderation", {}),
            "moderation_strictness": getattr(settings_obj, "moderation_strictness", "standard"),
        }
        return success_response(
            data=CommunityAISettingsSerializer(response_data).data,
            message="Paramètres IA de la communauté mis à jour.",
            status_code=status.HTTP_200_OK,
        )
