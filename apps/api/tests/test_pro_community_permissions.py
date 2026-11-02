from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.administration.models.setting import SystemSetting
from apps.billing.models.plan import BillingInterval, Plan
from apps.billing.models.subscription import Subscription, SubscriptionStatus
from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def category_tech(db):
    return CommunityCategory.objects.create(name="Tech & Code", slug="tech-code")


@pytest.fixture
def user_hobby(db):
    """A standard Hobby user with no paid Pro subscription."""
    return User.objects.create_user(
        email="hobby@kodinga.com",
        username="hobbyuser",
        password="SecurePassword123!",
        first_name="Hobby",
        last_name="User",
    )


@pytest.fixture
def user_pro(db):
    """A user with an active global platform Pro subscription (5000 FCFA/month)."""
    user = User.objects.create_user(
        email="pro@kodinga.com",
        username="prouser",
        password="SecurePassword123!",
        first_name="Pro",
        last_name="Creator",
    )
    plan_pro = Plan.objects.create(
        name="Kodinga Pro Mensuel",
        slug="test-pro-monthly",
        price=Decimal("5000.00"),
        currency="XOF",
        billing_interval=BillingInterval.MONTH,
        interval_count=1,
    )
    Subscription.objects.create(
        user=user,
        plan=plan_pro,
        status=SubscriptionStatus.ACTIVE,
        current_period_start=timezone.now(),
        current_period_end=timezone.now() + timedelta(days=30),
    )
    return user


@pytest.fixture
def user_superadmin(db):
    return User.objects.create_superuser(
        email="superadmin@kodinga.com",
        username="superadmin",
        password="SuperPassword123!",
    )


@pytest.mark.django_db
class TestProCommunityPermissions:
    def test_user_is_pro_property(self, user_hobby, user_pro, user_superadmin):
        assert user_hobby.is_pro is False
        assert user_pro.is_pro is True
        assert user_superadmin.is_pro is True

    def test_hobby_user_can_create_free_community_when_setting_is_all(
        self, api_client, user_hobby, category_tech
    ):
        SystemSetting.objects.update_or_create(
            key="community_creation_allowed_for",
            defaults={"value": "all", "is_public": True},
        )
        api_client.force_authenticate(user=user_hobby)
        payload = {
            "name": "Hobby Space",
            "slug": "hobby-space",
            "tagline": "Espace gratuit",
            "category_id": str(category_tech.id),
            "privacy_type": CommunityPrivacy.PUBLIC,
            "pricing_type": CommunityPricing.FREE,
        }
        res = api_client.post("/api/v1/communities/", payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert Community.objects.filter(slug="hobby-space", owner=user_hobby).exists()

    def test_superadmin_can_toggle_creation_permission_to_pro_only(
        self, api_client, user_superadmin
    ):
        api_client.force_authenticate(user=user_superadmin)
        res = api_client.patch(
            "/api/v1/admin/settings/",
            {
                "key": "community_creation_allowed_for",
                "value": "pro_only",
                "is_public": True,
            },
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK

        setting = SystemSetting.objects.get(key="community_creation_allowed_for")
        assert setting.value == "pro_only"

    def test_hobby_user_cannot_create_community_when_setting_is_pro_only(
        self, api_client, user_hobby, category_tech
    ):
        SystemSetting.objects.update_or_create(
            key="community_creation_allowed_for",
            defaults={"value": "pro_only", "is_public": True},
        )
        api_client.force_authenticate(user=user_hobby)
        payload = {
            "name": "Forbidden Space",
            "slug": "forbidden-space",
            "category_id": str(category_tech.id),
            "pricing_type": CommunityPricing.FREE,
        }
        res = api_client.post("/api/v1/communities/", payload, format="json")
        assert res.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_403_FORBIDDEN,
        ]
        assert not Community.objects.filter(slug="forbidden-space").exists()

    def test_pro_user_can_create_community_when_setting_is_pro_only(
        self, api_client, user_pro, category_tech
    ):
        SystemSetting.objects.update_or_create(
            key="community_creation_allowed_for",
            defaults={"value": "pro_only", "is_public": True},
        )
        api_client.force_authenticate(user=user_pro)
        payload = {
            "name": "Pro Allowed Space",
            "slug": "pro-allowed-space",
            "category_id": str(category_tech.id),
            "pricing_type": CommunityPricing.FREE,
        }
        res = api_client.post("/api/v1/communities/", payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        assert Community.objects.filter(
            slug="pro-allowed-space", owner=user_pro
        ).exists()

    def test_hobby_user_cannot_create_paid_community(
        self, api_client, user_hobby, category_tech
    ):
        SystemSetting.objects.update_or_create(
            key="community_creation_allowed_for",
            defaults={"value": "all", "is_public": True},
        )
        api_client.force_authenticate(user=user_hobby)
        payload = {
            "name": "Hobby Trying Paid",
            "slug": "hobby-trying-paid",
            "category_id": str(category_tech.id),
            "pricing_type": CommunityPricing.PAID,
            "membership_price": 5000,
        }
        res = api_client.post("/api/v1/communities/", payload, format="json")
        assert res.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_403_FORBIDDEN,
        ]
        assert not Community.objects.filter(slug="hobby-trying-paid").exists()

    def test_pro_user_can_create_paid_community_with_pricing(
        self, api_client, user_pro, category_tech
    ):
        api_client.force_authenticate(user=user_pro)
        payload = {
            "name": "VIP React Academy",
            "slug": "vip-react-academy",
            "category_id": str(category_tech.id),
            "pricing_type": CommunityPricing.PAID,
            "membership_price": 7500,
            "membership_interval": "month",
            "membership_plan_name": "Pass VIP Mensuel",
        }
        res = api_client.post("/api/v1/communities/", payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED

        comm = Community.objects.get(slug="vip-react-academy")
        assert comm.pricing_type == CommunityPricing.PAID
        assert comm.owner == user_pro

        # Check membership Plan automatically created
        plan = Plan.objects.filter(community=comm).first()
        assert plan is not None
        assert plan.price == Decimal("7500.00")
        assert plan.billing_interval == BillingInterval.MONTH

    def test_user_cannot_join_paid_community_for_free(
        self, api_client, user_hobby, user_pro, category_tech
    ):
        # Pro creates paid community
        comm = Community.objects.create(
            name="Exclusive Masterminds",
            slug="exclusive-masterminds",
            owner=user_pro,
            category=category_tech,
            pricing_type=CommunityPricing.PAID,
            privacy_type=CommunityPrivacy.PUBLIC,
        )

        # Hobby tries to join without payment or invitation
        api_client.force_authenticate(user=user_hobby)
        res = api_client.post(f"/api/v1/communities/{comm.slug}/join/")
        assert res.status_code == status.HTTP_403_FORBIDDEN
        assert not CommunityMember.objects.filter(
            community=comm, user=user_hobby
        ).exists()

    def test_user_with_active_subscription_can_be_active_in_paid_community(
        self, user_hobby, user_pro, category_tech
    ):
        comm = Community.objects.create(
            name="Exclusive Devs",
            slug="exclusive-devs",
            owner=user_pro,
            category=category_tech,
            pricing_type=CommunityPricing.PAID,
        )
        plan = Plan.objects.create(
            community=comm,
            name="Pass VIP",
            slug="exclusive-devs-pass",
            price=Decimal("10000.00"),
            currency="XOF",
            billing_interval=BillingInterval.ONE_TIME,
        )
        # Create active subscription for hobby user
        Subscription.objects.create(
            user=user_hobby,
            plan=plan,
            community=comm,
            status=SubscriptionStatus.ACTIVE,
            current_period_start=timezone.now(),
            current_period_end=timezone.now() + timedelta(days=3650),
        )

        # Joining now succeeds
        from apps.memberships.services.membership_service import MembershipService

        member = MembershipService.join_community(user=user_hobby, community=comm)
        assert member.status == MembershipStatus.ACTIVE

    def test_pro_owner_can_manage_community_plans_api(
        self, api_client, user_pro, category_tech
    ):
        comm = Community.objects.create(
            name="Python Masters",
            slug="python-masters",
            owner=user_pro,
            category=category_tech,
            pricing_type=CommunityPricing.PAID,
        )
        CommunityMember.objects.create(
            community=comm,
            user=user_pro,
            role=CommunityRole.OWNER,
            status=MembershipStatus.ACTIVE,
        )

        api_client.force_authenticate(user=user_pro)
        # 1. Create a definitive (one_time) plan
        create_res = api_client.post(
            "/api/v1/billing/plans/",
            {
                "community_id": str(comm.id),
                "name": "Accès Définitif à Vie",
                "price": 25000,
                "billing_interval": "one_time",
                "features": ["Accès illimité à vie", "Tous les ateliers"],
            },
            format="json",
        )
        assert create_res.status_code == status.HTTP_201_CREATED
        data = create_res.json()["data"]
        plan_id = data["id"]
        assert Decimal(str(data["price"])) == Decimal("25000.00")
        assert data["billing_interval"] == "one_time"

        # 2. Update the plan price
        update_res = api_client.patch(
            f"/api/v1/billing/plans/{plan_id}/",
            {"price": 30000},
            format="json",
        )
        assert update_res.status_code == status.HTTP_200_OK
        plan = Plan.objects.get(id=plan_id)
        assert plan.price == Decimal("30000.00")

    def test_superadmin_can_change_pro_monthly_price_via_variable_and_admin(
        self, api_client, user_superadmin, user_hobby
    ):
        from apps.billing.services.billing_service import (
            PRO_MONTHLY_PLAN_SLUG,
            PRO_MONTHLY_PRICE_SETTING_KEY,
            BillingService,
        )

        # 1. Initial global Pro Monthly plan at 5000 FCFA
        plan = Plan.objects.create(
            name="Kodinga Pro Mensuel",
            slug=PRO_MONTHLY_PLAN_SLUG,
            price=Decimal("5000.00"),
            currency="XOF",
            billing_interval=BillingInterval.MONTH,
            interval_count=1,
        )
        assert BillingService.get_pro_monthly_price() == Decimal("5000.00")

        # 2. Superadmin updates the variable 'pro_monthly_price' via Admin Settings API
        api_client.force_authenticate(user=user_superadmin)
        res = api_client.patch(
            "/api/v1/admin/settings/",
            {
                "key": PRO_MONTHLY_PRICE_SETTING_KEY,
                "value": 7500,
                "is_public": True,
            },
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK

        # Verify both the variable and the Plan price are updated to 7500.00 FCFA
        assert BillingService.get_pro_monthly_price() == Decimal("7500.00")
        plan.refresh_from_db()
        assert plan.price == Decimal("7500.00")

        # 3. Superadmin updates the Plan price directly (e.g. via Django Admin or Plan API) to 6000 FCFA
        plan.price = Decimal("6000.00")
        plan.save()

        setting = SystemSetting.objects.get(key=PRO_MONTHLY_PRICE_SETTING_KEY)
        assert Decimal(str(setting.value)) == Decimal("6000.00")
        assert BillingService.get_pro_monthly_price() == Decimal("6000.00")
