from apps.accounts.models.user import User
from apps.communities.selectors.community_selector import CommunitySelector
from apps.gamification.selectors.gamification_selector import (
    GamificationSelector,
)
from apps.gamification.serializers.gamification_serializer import (
    CommunityPointRuleAuditLogSerializer,
    CommunityPointRuleBulkUpdateSerializer,
    CommunityPointRuleSerializer,
    CommunityPointRuleUpdateSerializer,
    ManualPointsAdjustmentRequestSerializer,
    ReputationTransactionSerializer,
)
from apps.gamification.services.gamification_service import GamificationService
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView


class CommunityPointRuleListUpdateView(APIView):
    """
    GET /api/v1/communities/<slug:slug>/gamification/rules/
    PATCH /api/v1/communities/<slug:slug>/gamification/rules/
    Retrieve or bulk-update the configurable point scale (barème) for a community.
    Modifications are restricted to the Community Owner or an authorized Admin.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Gamification - Configuration"],
        summary="Récupérer le barème des points d'une communauté",
        responses={200: CommunityPointRuleSerializer(many=True)},
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(
                slug, user=request.user
            )
        except Exception:
            return error_response(
                "Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        rules = GamificationSelector.get_community_rules(community=community)
        serializer = CommunityPointRuleSerializer(rules, many=True)
        return success_response(
            data=serializer.data, status_code=status.HTTP_200_OK
        )

    @extend_schema(
        tags=["Gamification - Configuration"],
        summary="Modifier en masse plusieurs règles du barème d'une communauté (Propriétaire / Admin)",
        request=CommunityPointRuleBulkUpdateSerializer,
        responses={200: CommunityPointRuleSerializer(many=True)},
    )
    def patch(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(
                slug, user=request.user
            )
        except Exception:
            return error_response(
                "Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            GamificationService.check_can_manage_gamification(
                request.user, community
            )
        except PermissionDenied as e:
            return error_response(
                str(e.detail), status_code=status.HTTP_403_FORBIDDEN
            )

        serializer = CommunityPointRuleBulkUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Données invalides.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            rules = GamificationService.bulk_update_community_rules(
                actor=request.user,
                community=community,
                rules_data=serializer.validated_data["rules"],
                note=serializer.validated_data.get("note", ""),
            )
        except ValidationError as e:
            return error_response(
                "Erreur de validation.",
                details=e.detail,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return success_response(
            data=CommunityPointRuleSerializer(rules, many=True).data,
            message="Barème des points mis à jour avec succès.",
            status_code=status.HTTP_200_OK,
        )


class CommunityPointRuleDetailView(APIView):
    """
    PATCH /api/v1/communities/<slug:slug>/gamification/rules/<str:action>/
    Modify the points or active status (`is_active`) of a specific rewardable
    activity in a community. Restricted to Community Owner / authorized Admin.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Gamification - Configuration"],
        summary="Modifier les points ou activer/désactiver une règle de récompense (Propriétaire / Admin)",
        request=CommunityPointRuleUpdateSerializer,
        responses={200: CommunityPointRuleSerializer},
    )
    def patch(self, request, slug, action):
        try:
            community = CommunitySelector.get_community_by_slug(
                slug, user=request.user
            )
        except Exception:
            return error_response(
                "Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            GamificationService.check_can_manage_gamification(
                request.user, community
            )
        except PermissionDenied as e:
            return error_response(
                str(e.detail), status_code=status.HTTP_403_FORBIDDEN
            )

        serializer = CommunityPointRuleUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Données invalides.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        try:
            rule = GamificationService.update_community_rule(
                actor=request.user,
                community=community,
                action=action,
                points=serializer.validated_data.get("points"),
                is_active=serializer.validated_data.get("is_active"),
                allow_multiple_per_reference=serializer.validated_data.get(
                    "allow_multiple_per_reference"
                ),
                note=serializer.validated_data.get("note", ""),
            )
        except ValidationError as e:
            return error_response(
                "Activité ou valeur invalide.",
                details=e.detail,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return success_response(
            data=CommunityPointRuleSerializer(rule).data,
            message="Règle de récompense mise à jour avec succès.",
            status_code=status.HTTP_200_OK,
        )


class CommunityPointRuleAuditHistoryView(APIView):
    """
    GET /api/v1/communities/<slug:slug>/gamification/rules/history/
    Consult the audit history of modifications made to the community's point scale.
    Restricted to Community Owner / authorized Admin.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Gamification - Configuration"],
        summary="Consulter l'historique des modifications apportées au barème d'une communauté",
        parameters=[
            OpenApiParameter(
                name="action",
                description="Filtrer par activité (ex: course_completed, event_attended, post_created)",
                required=False,
                type=str,
            ),
        ],
        responses={200: CommunityPointRuleAuditLogSerializer(many=True)},
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(
                slug, user=request.user
            )
        except Exception:
            return error_response(
                "Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            GamificationService.check_can_manage_gamification(
                request.user, community
            )
        except PermissionDenied as e:
            return error_response(
                str(e.detail), status_code=status.HTTP_403_FORBIDDEN
            )

        action = request.query_params.get("action")
        logs = GamificationSelector.get_community_rule_audit_logs(
            community=community, action=action
        )
        serializer = CommunityPointRuleAuditLogSerializer(logs, many=True)
        return success_response(
            data=serializer.data, status_code=status.HTTP_200_OK
        )


class CommunityManualPointsAdjustView(APIView):
    """
    POST /api/v1/communities/<slug:slug>/gamification/points/adjust/
    Manually add or deduct points for a community member with a mandatory reason.
    Restricted to Community Owner / authorized Admin.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Gamification - Administration"],
        summary="Ajouter ou retirer manuellement des points à un membre avec motif obligatoire",
        request=ManualPointsAdjustmentRequestSerializer,
        responses={201: ReputationTransactionSerializer},
    )
    def post(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(
                slug, user=request.user
            )
        except Exception:
            return error_response(
                "Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            GamificationService.check_can_manage_gamification(
                request.user, community
            )
        except PermissionDenied as e:
            return error_response(
                str(e.detail), status_code=status.HTTP_403_FORBIDDEN
            )

        serializer = ManualPointsAdjustmentRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Données d'ajustement invalides.",
                details=serializer.errors,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        target_user_id = serializer.validated_data["user_id"]
        target_user = User.objects.filter(
            id=target_user_id, is_active=True
        ).first()
        if not target_user:
            return error_response(
                "Membre introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            _, tx = GamificationService.adjust_member_points(
                actor=request.user,
                community=community,
                target_user=target_user,
                points_delta=serializer.validated_data["points"],
                reason=serializer.validated_data["reason"],
            )
        except ValidationError as e:
            return error_response(
                "Impossible d'effectuer l'ajustement.",
                details=e.detail,
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return success_response(
            data=ReputationTransactionSerializer(tx).data,
            message="Ajustement manuel des points enregistré avec succès.",
            status_code=status.HTTP_201_CREATED,
        )


class CommunityTransactionsAdminListView(APIView):
    """
    GET /api/v1/communities/<slug:slug>/gamification/transactions/
    Consult the full audit history of automatic point attributions and
    manual adjustments within a community.
    Restricted to Community Owner / authorized Admin.
    """

    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["Gamification - Administration"],
        summary="Consulter l'historique complet des attributions et ajustements de points d'une communauté",
        parameters=[
            OpenApiParameter(
                name="user_id",
                description="Filtrer par identifiant UUID du membre",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="action",
                description="Filtrer par activité (course_completed, event_attended, post_created, manual_adjustment)",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="source",
                description="Filtrer par source (automatic, manual_adjustment, badge_reward)",
                required=False,
                type=str,
            ),
        ],
        responses={200: ReputationTransactionSerializer(many=True)},
    )
    def get(self, request, slug):
        try:
            community = CommunitySelector.get_community_by_slug(
                slug, user=request.user
            )
        except Exception:
            return error_response(
                "Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND
            )

        try:
            GamificationService.check_can_manage_gamification(
                request.user, community
            )
        except PermissionDenied as e:
            return error_response(
                str(e.detail), status_code=status.HTTP_403_FORBIDDEN
            )

        user_id = request.query_params.get("user_id")
        action = request.query_params.get("action")
        source = request.query_params.get("source")

        qs = GamificationSelector.get_community_transactions(
            community=community,
            user_id=user_id,
            action=action,
            source=source,
        )

        if "page" in request.query_params or "page_size" in request.query_params:
            paginator = self.pagination_class()
            paginated = paginator.paginate_queryset(qs, request)
            serializer = ReputationTransactionSerializer(paginated, many=True)
            return paginator.get_paginated_response(serializer.data)

        serializer = ReputationTransactionSerializer(qs[:100], many=True)
        return success_response(
            data=serializer.data, status_code=status.HTTP_200_OK
        )

