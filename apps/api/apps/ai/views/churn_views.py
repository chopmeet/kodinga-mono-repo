from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.views import APIView

from apps.ai.models.churn import MemberChurnRisk
from apps.ai.serializers import MemberChurnRiskSerializer, SendSmartNudgeSerializer
from apps.ai.services.churn_service import ChurnPredictionService
from apps.ai.views.base import ai_success_response
from apps.communities.models.community import Community
from apps.memberships.permissions import IsCommunityAdmin


class CommunityChurnDashboardView(APIView):
    """
    Predictive churn risk dashboard for community creators and managers.
    Ranks members at risk of disengagement with actionable behavioral signals and AI nudges.
    """

    permission_classes = [permissions.IsAuthenticated, IsCommunityAdmin]

    def get(self, request, slug: str):
        community = get_object_or_404(Community, slug=slug)
        self.check_object_permissions(request, community)

        force_refresh = request.query_params.get("refresh", "false").lower() == "true"
        if force_refresh:
            risks = ChurnPredictionService.evaluate_community_churn(
                community=community, limit=50
            )
        else:
            risks = list(
                MemberChurnRisk.objects.filter(member__community=community)
                .select_related("member__user", "member__community")
                .order_by("-risk_score")[:50]
            )
            if not risks:
                risks = ChurnPredictionService.evaluate_community_churn(
                    community=community, limit=50
                )

        serializer = MemberChurnRiskSerializer(risks, many=True)
        resp_data = {
            "community": community.slug,
            "total_at_risk": len(risks),
            "members": serializer.data,
        }
        return ai_success_response(resp_data, status_code=status.HTTP_200_OK)


class SendSmartNudgeView(APIView):
    """
    Sends and records an AI-generated personalized re-engagement nudge to an at-risk member.
    Dispatches real-time in-app notification to the recipient.
    """

    permission_classes = [permissions.IsAuthenticated, IsCommunityAdmin]

    def post(self, request, pk: str | None = None, churn_id: str | None = None):
        target_id = pk or churn_id
        churn_risk = get_object_or_404(
            MemberChurnRisk.objects.select_related("member__community", "member__user"),
            id=target_id,
        )
        self.check_object_permissions(request, churn_risk.member.community)

        serializer = SendSmartNudgeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        custom_message = serializer.validated_data.get("custom_message")
        updated = ChurnPredictionService.send_smart_nudge(
            churn_risk_id=str(target_id),
            custom_message=custom_message,
            sender=request.user,
        )

        resp_data = {
            "message": "Nudge de réengagement envoyé avec succès.",
            "churn_risk": MemberChurnRiskSerializer(updated).data,
        }
        return ai_success_response(
            resp_data,
            message="Nudge de réengagement envoyé avec succès.",
            status_code=status.HTTP_200_OK,
        )


class GenerateSmartNudgeView(APIView):
    """
    Generates or refreshes a personalized AI nudge on-demand for an at-risk member.
    """

    permission_classes = [permissions.IsAuthenticated, IsCommunityAdmin]

    def post(self, request, pk: str | None = None, churn_id: str | None = None):
        target_id = pk or churn_id
        churn_risk = get_object_or_404(
            MemberChurnRisk.objects.select_related("member__community", "member__user"),
            id=target_id,
        )
        self.check_object_permissions(request, churn_risk.member.community)

        nudge = ChurnPredictionService.generate_or_refresh_nudge(
            churn_risk_id=str(target_id)
        )
        resp_data = {
            "suggested_nudge": nudge,
            "churn_risk_id": str(target_id),
        }
        return ai_success_response(
            resp_data,
            message="Message de relance IA généré avec succès.",
            status_code=status.HTTP_200_OK,
        )
