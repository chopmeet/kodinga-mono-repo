from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from common.utils.responses import error_response, success_response
from apps.billing.selectors.billing_selector import BillingSelector
from apps.billing.serializers.affiliate import AffiliateSerializer
from apps.billing.services.affiliate_service import AffiliateService


class MyAffiliateView(APIView):
    """
    Get user's affiliate dashboard, stats, referral link and generated 50% commissions.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Billing & PayDunya'],
        summary="Tableau de bord affilié et commissions",
        responses={200: AffiliateSerializer}
    )
    def get(self, request):
        affiliate = BillingSelector.get_affiliate_profile(user=request.user)
        if not affiliate:
            return error_response(
                "Vous n'avez pas encore activé votre profil affilié. Exécutez POST /api/v1/billing/affiliate/join/.",
                status_code=status.HTTP_404_NOT_FOUND
            )

        serializer = AffiliateSerializer(affiliate, context={'request': request})
        return success_response(data=serializer.data)


class JoinAffiliateView(APIView):
    """
    Activate affiliate partner status and generate a unique referral link.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Billing & PayDunya'],
        summary="Activer le programme d'affiliation (50% de commission)",
        request=None,
        responses={201: AffiliateSerializer}
    )
    def post(self, request):
        affiliate = AffiliateService.get_or_create_affiliate_profile(user=request.user)
        serializer = AffiliateSerializer(affiliate, context={'request': request})
        return success_response(
            data=serializer.data,
            message="Programme d'affiliation activé avec succès !",
            status_code=status.HTTP_201_CREATED
        )
