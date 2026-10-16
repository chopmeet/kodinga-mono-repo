from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.affiliates.models.link import AffiliateLink
from apps.affiliates.models.program import AffiliateProgram
from apps.affiliates.selectors.affiliate_selector import AffiliateSelector
from apps.affiliates.serializers.affiliate_serializers import (
    AffiliateLinkSerializer,
    AffiliateStatsSerializer,
    CreateAffiliateLinkSerializer,
    CreatePayoutRequestSerializer,
    PayoutRequestSerializer,
)
from apps.affiliates.services.affiliate_service import AffiliateService


@extend_schema(tags=["Affiliates"])
class AffiliateLinkListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        links = AffiliateSelector.get_user_links(request.user)
        return Response(AffiliateLinkSerializer(links, many=True).data)

    def post(self, request):
        serializer = CreateAffiliateLinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        program_id = serializer.validated_data.get("program_id")
        program = AffiliateProgram.objects.filter(id=program_id).first() if program_id else None

        link = AffiliateService.create_link(
            user=request.user,
            program=program,
            custom_slug=serializer.validated_data.get("custom_slug"),
            target_url=serializer.validated_data.get("target_url", ""),
        )
        return Response(AffiliateLinkSerializer(link).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Affiliates"])
class AffiliateLinkDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, code_or_id):
        link = (
            AffiliateLink.objects.filter(user=request.user)
            .filter(code=code_or_id)
            .first()
            or AffiliateLink.objects.filter(user=request.user)
            .filter(custom_slug=code_or_id)
            .first()
        )
        if not link:
            try:
                link = AffiliateLink.objects.filter(user=request.user, id=code_or_id).first()
            except Exception:
                link = None

        if not link:
            return Response({"detail": "Lien introuvable."}, status=status.HTTP_404_NOT_FOUND)

        return Response(AffiliateLinkSerializer(link).data)


@extend_schema(tags=["Affiliates"])
class AffiliateStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        stats = AffiliateSelector.get_user_stats(request.user)
        return Response(AffiliateStatsSerializer(stats).data)


@extend_schema(tags=["Affiliates"])
class AffiliateClickTrackView(APIView):
    """
    Public endpoint to record clicks on referral links.
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        code = request.data.get("code") or request.data.get("slug")
        if not code:
            return Response({"detail": "Code de parrainage manquant."}, status=status.HTTP_400_BAD_REQUEST)

        ip = request.META.get("REMOTE_ADDR", "")
        referrer = request.data.get("referrer", "") or request.META.get("HTTP_REFERER", "")
        user_agent = request.META.get("HTTP_USER_AGENT", "")

        link = AffiliateService.record_click(
            code_or_slug=code,
            ip_address=ip,
            referrer=referrer,
            user_agent=user_agent,
        )
        if not link:
            return Response({"detail": "Lien introuvable."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "status": "tracked",
            "target_url": link.target_url or "https://kodinga.com",
            "code": link.code,
        })


@extend_schema(tags=["Affiliates"])
class PayoutRequestListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        payouts = AffiliateSelector.get_user_payouts(request.user)
        return Response(PayoutRequestSerializer(payouts, many=True).data)

    def post(self, request):
        serializer = CreatePayoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payout = AffiliateService.request_payout(
            user=request.user,
            amount=serializer.validated_data["amount"],
            payout_method=serializer.validated_data["payout_method"],
            payout_details=serializer.validated_data["payout_details"],
        )
        return Response(PayoutRequestSerializer(payout).data, status=status.HTTP_201_CREATED)
