from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.billing.models.plan import BillingInterval, Plan
from apps.billing.selectors.billing_selector import BillingSelector
from apps.billing.serializers.plan import (
    CommunityPlanCreateUpdateSerializer,
    PlanSerializer,
)
from apps.communities.models.community import Community, CommunityPricing
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from common.permissions.base import is_superadmin_user
from common.utils.responses import success_response


class PlansListView(APIView):
    """
    List available subscription and membership plans or create custom community membership formulas.
    """
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    @extend_schema(
        tags=['Billing & Affiliates'],
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

    @extend_schema(
        tags=['Billing & Affiliates'],
        summary="Créer une formule d'adhésion payante pour une communauté (Réservé aux créateurs Pro)",
        request=CommunityPlanCreateUpdateSerializer,
        responses={201: PlanSerializer}
    )
    def post(self, request):
        serializer = CommunityPlanCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not (is_superadmin_user(user) or user.is_pro):
            raise PermissionDenied(
                f"Seuls les utilisateurs avec un abonnement Pro actif ({ __import__('apps.billing.services.billing_service', fromlist=['BillingService']).BillingService.get_pro_monthly_price_label() }) peuvent créer des formules de paiement."
            )

        community_id = serializer.validated_data['community_id']
        try:
            community = Community.objects.get(id=community_id)
        except Community.DoesNotExist as err:
            raise NotFound("Communauté introuvable.") from err

        # Check owner / admin permissions
        if not is_superadmin_user(user) and community.owner_id != user.id:
            is_admin = CommunityMember.objects.filter(
                community=community,
                user=user,
                status=MembershipStatus.ACTIVE,
                role__in=[CommunityRole.OWNER, CommunityRole.ADMIN]
            ).exists()
            if not is_admin:
                raise PermissionDenied("Vous n'avez pas les droits de gestion sur cette communauté.")

        # Ensure community is marked as paid
        if community.pricing_type != CommunityPricing.PAID:
            community.pricing_type = CommunityPricing.PAID
            community.save(update_fields=['pricing_type', 'updated_at'])

        slug = serializer.validated_data.get('slug')
        billing_interval = serializer.validated_data.get('billing_interval', BillingInterval.MONTH)
        if not slug:
            base_slug = f"{community.slug}-{billing_interval}"
            slug = base_slug
            count = 1
            while Plan.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{count}"
                count += 1
            serializer.validated_data['slug'] = slug

        plan = Plan.objects.create(
            community=community,
            name=serializer.validated_data['name'],
            slug=serializer.validated_data['slug'],
            description=serializer.validated_data.get('description', ''),
            price=serializer.validated_data['price'],
            currency=serializer.validated_data.get('currency', 'XOF'),
            billing_interval=billing_interval,
            interval_count=serializer.validated_data.get('interval_count', 1),
            features=serializer.validated_data.get('features', []),
            is_active=serializer.validated_data.get('is_active', True)
        )

        return success_response(
            data=PlanSerializer(plan).data,
            message="Formule d'adhésion créée avec succès.",
            status_code=status.HTTP_201_CREATED
        )


class CommunityPlanDetailView(APIView):
    """
    Manage an individual community membership plan (price, interval, deactivation).
    """
    permission_classes = [IsAuthenticated]

    def _get_plan_and_check_permission(self, plan_id, user):
        try:
            plan = Plan.objects.select_related('community').get(id=plan_id)
        except Plan.DoesNotExist as err:
            raise NotFound("Plan introuvable.") from err

        if not plan.community:
            if not is_superadmin_user(user):
                raise PermissionDenied("Seul un superadmin peut modifier les forfaits globaux Kodinga.")
            return plan

        if not (is_superadmin_user(user) or user.is_pro):
            raise PermissionDenied("Un abonnement Pro actif est requis pour administrer les formules de paiement.")

        if not is_superadmin_user(user) and plan.community.owner_id != user.id:
            is_admin = CommunityMember.objects.filter(
                community=plan.community,
                user=user,
                status=MembershipStatus.ACTIVE,
                role__in=[CommunityRole.OWNER, CommunityRole.ADMIN]
            ).exists()
            if not is_admin:
                raise PermissionDenied("Vous n'avez pas les droits d'administration sur cette communauté.")

        return plan

    @extend_schema(
        tags=['Billing & Affiliates'],
        summary="Modifier une formule de paiement de communauté",
        request=CommunityPlanCreateUpdateSerializer,
        responses={200: PlanSerializer}
    )
    def patch(self, request, plan_id):
        plan = self._get_plan_and_check_permission(plan_id, request.user)

        for field in ['name', 'description', 'price', 'billing_interval', 'interval_count', 'features', 'is_active']:
            if field in request.data:
                setattr(plan, field, request.data[field])

        plan.save()
        return success_response(
            data=PlanSerializer(plan).data,
            message="Formule d'adhésion mise à jour avec succès."
        )

    @extend_schema(
        tags=['Billing & Affiliates'],
        summary="Désactiver une formule de paiement de communauté",
        responses={200: dict}
    )
    def delete(self, request, plan_id):
        plan = self._get_plan_and_check_permission(plan_id, request.user)
        plan.is_active = False
        plan.save(update_fields=['is_active', 'updated_at'])
        return success_response(message="Formule désactivée avec succès.")
