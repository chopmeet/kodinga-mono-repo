from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from common.utils.responses import success_response, error_response
from apps.communities.selectors.community_selector import CommunitySelector
from apps.communities.serializers.rule import CommunityRuleSerializer
from apps.communities.serializers.settings import CommunitySettingsSerializer
from apps.communities.services.community_service import CommunityService


class CommunitySettingsView(APIView):
    """
    Manage feature toggles and community policies.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Consulter les paramètres d'une communauté",
        responses={200: CommunitySettingsSerializer}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        settings = getattr(community, 'settings', None)
        return success_response(data=CommunitySettingsSerializer(settings).data if settings else {})

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Mettre à jour les paramètres d'une communauté",
        request=CommunitySettingsSerializer,
        responses={200: CommunitySettingsSerializer}
    )
    def patch(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = CommunitySettingsSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated_settings = CommunityService.update_settings(community, request.user, serializer.validated_data)
        return success_response(
            data=CommunitySettingsSerializer(updated_settings).data,
            message="Paramètres mis à jour."
        )


class CommunityRulesView(APIView):
    """
    List and add charter rules to a community.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Lister les règles de la communauté",
        responses={200: CommunityRuleSerializer(many=True)}
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        return success_response(data=CommunityRuleSerializer(community.rules.all(), many=True).data)

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Ajouter une règle à la charte",
        request=CommunityRuleSerializer,
        responses={201: CommunityRuleSerializer}
    )
    def post(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = CommunityRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        rule = CommunityService.add_rule(
            community=community,
            user=request.user,
            title=serializer.validated_data['title'],
            description=serializer.validated_data.get('description', ''),
            order=serializer.validated_data.get('order', 0)
        )
        return success_response(
            data=CommunityRuleSerializer(rule).data,
            message="Règle ajoutée avec succès.",
            status_code=status.HTTP_201_CREATED
        )


class CommunityRuleDetailView(APIView):
    """
    Delete a specific rule from the community charter.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Communities & Memberships'],
        summary="Supprimer une règle de la charte",
        responses={200: None}
    )
    def delete(self, request, slug, rule_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        CommunityService.delete_rule(community, request.user, str(rule_id))
        return success_response(message="Règle supprimée avec succès.")
