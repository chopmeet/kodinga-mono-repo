from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from common.utils.responses import success_response
from apps.billing.selectors.billing_selector import BillingSelector
from apps.billing.serializers.plan import PlanSerializer


class PlansListView(APIView):
    """
    List available subscription and membership plans.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Billing & PayDunya'],
        summary="Lister les plans d'abonnement disponibles (Global Pro ou Communauté)",
        parameters=[
            OpenApiParameter(
                name='community',
                description="Slug de la communauté (si non spécifié, liste les plans Pro globaux)",
                required=False,
                type=str
            )
        ],
        responses={200: PlanSerializer(many=True)}
    )
    def get(self, request):
        community_slug = request.query_params.get('community')
        plans = BillingSelector.get_active_plans(community_slug=community_slug)
        serializer = PlanSerializer(plans, many=True, context={'request': request})
        return success_response(data=serializer.data)
