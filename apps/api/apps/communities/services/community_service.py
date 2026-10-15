from typing import Any, Dict, List, Optional
from django.db import transaction
from django.utils.text import slugify
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound
from apps.accounts.models.user import User
from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import Community
from apps.communities.models.rule import CommunityRule
from apps.communities.models.settings import CommunitySettings
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


class CommunityService:
    """
    Atomic creation, updates, rules orchestration and lifecycle management of communities.
    """

    @classmethod
    def create_community(
        cls,
        owner: User,
        data: Dict[str, Any],
        rules_data: Optional[List[Dict[str, Any]]] = None,
        settings_data: Optional[Dict[str, Any]] = None,
    ) -> Community:
        # 1. Check platform setting: is community creation open to Hobby or restricted to Pro only?
        from apps.administration.services.admin_service import AdministrationService
        raw_setting = AdministrationService.get_setting('community_creation_allowed_for', 'all')
        tier = raw_setting.get('tier') if isinstance(raw_setting, dict) else str(raw_setting).lower()
        if tier == 'pro_only' and not owner.is_pro:
            raise PermissionDenied(
                "La création de communauté est actuellement réservée aux abonnés Pro (5 000 FCFA/mois). Veuillez passer au forfait Pro pour créer un espace."
            )

        # 2. Check monetization: Only Pro users can create paid communities
        pricing_type = data.get('pricing_type', 'free')
        if pricing_type == 'paid' and not owner.is_pro:
            raise PermissionDenied(
                "Seuls les utilisateurs avec un abonnement Pro actif (5 000 FCFA/mois) peuvent créer ou configurer une communauté payante."
            )

        # Extract optional membership plan info before creating Community
        membership_price = data.pop('membership_price', None)
        membership_interval = data.pop('membership_interval', 'month')
        membership_plan_name = data.pop('membership_plan_name', None)

        slug = data.get('slug')
        if not slug:
            base_slug = slugify(data.get('name', 'community'))
            slug = base_slug
            count = 1
            while Community.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{count}"
                count += 1
            data['slug'] = slug
        elif Community.objects.filter(slug=slug).exists():
            raise ValidationError({'slug': "Ce slug de communauté est déjà utilisé."})

        category_id = data.pop('category_id', None)
        if category_id:
            try:
                data['category'] = CommunityCategory.objects.get(id=category_id)
            except CommunityCategory.DoesNotExist:
                raise ValidationError({'category_id': "Catégorie introuvable."})

        with transaction.atomic():
            community = Community.objects.create(
                owner=owner,
                members_count=1,
                **data
            )

            # Initialize settings
            settings_payload = settings_data or {}
            CommunitySettings.objects.create(
                community=community,
                **settings_payload
            )

            # Create owner membership record
            CommunityMember.objects.create(
                community=community,
                user=owner,
                role=CommunityRole.OWNER,
                status=MembershipStatus.ACTIVE,
                custom_title="Fondateur"
            )

            # Create initial rules if provided
            if rules_data:
                for idx, r in enumerate(rules_data):
                    CommunityRule.objects.create(
                        community=community,
                        title=r.get('title', ''),
                        description=r.get('description', ''),
                        order=r.get('order', idx)
                    )

            # If paid community and initial plan price provided, create membership Plan
            if community.pricing_type == 'paid' and membership_price:
                from apps.billing.models.plan import Plan, BillingInterval
                interval_choice = (
                    BillingInterval.ONE_TIME if membership_interval == 'one_time'
                    else (BillingInterval.YEAR if membership_interval == 'year' else BillingInterval.MONTH)
                )
                label = 'Définitif' if interval_choice == BillingInterval.ONE_TIME else ('Annuel' if interval_choice == BillingInterval.YEAR else 'Mensuel')
                Plan.objects.create(
                    community=community,
                    name=membership_plan_name or f"Pass {community.name} ({label})",
                    slug=f"{community.slug}-{membership_interval}",
                    description=f"Accès complet à la communauté {community.name}",
                    price=membership_price,
                    currency='XOF',
                    billing_interval=interval_choice,
                    interval_count=1,
                    is_active=True
                )

            return community

    @classmethod
    def update_community(
        cls,
        community: Community,
        user: User,
        data: Dict[str, Any]
    ) -> Community:
        # Check permissions: owner, admin, or superadmin
        from common.permissions.base import is_superadmin_user
        if not is_superadmin_user(user) and community.owner_id != user.id:
            is_admin = CommunityMember.objects.filter(
                community=community,
                user=user,
                status=MembershipStatus.ACTIVE,
                role__in=[CommunityRole.OWNER, CommunityRole.ADMIN]
            ).exists()
            if not is_admin:
                raise PermissionDenied("Vous n'avez pas les droits d'administration de cette communauté.")

        new_pricing_type = data.get('pricing_type')
        if new_pricing_type == 'paid' and community.pricing_type != 'paid' and not user.is_pro:
            raise PermissionDenied("Seuls les utilisateurs avec un abonnement Pro actif peuvent configurer une communauté payante.")

        membership_price = data.pop('membership_price', None)
        membership_interval = data.pop('membership_interval', 'month')
        membership_plan_name = data.pop('membership_plan_name', None)

        category_id = data.pop('category_id', None)
        if category_id is not None:
            if category_id:
                try:
                    data['category'] = CommunityCategory.objects.get(id=category_id)
                except CommunityCategory.DoesNotExist:
                    raise ValidationError({'category_id': "Catégorie introuvable."})
            else:
                data['category'] = None

        new_slug = data.get('slug')
        if new_slug and new_slug != community.slug:
            if Community.objects.filter(slug=new_slug).exclude(id=community.id).exists():
                raise ValidationError({'slug': "Ce slug est déjà utilisé par une autre communauté."})

        with transaction.atomic():
            for key, value in data.items():
                setattr(community, key, value)
            community.save()

            if community.pricing_type == 'paid' and membership_price:
                from apps.billing.models.plan import Plan, BillingInterval
                interval_choice = (
                    BillingInterval.ONE_TIME if membership_interval == 'one_time'
                    else (BillingInterval.YEAR if membership_interval == 'year' else BillingInterval.MONTH)
                )
                label = 'Définitif' if interval_choice == BillingInterval.ONE_TIME else ('Annuel' if interval_choice == BillingInterval.YEAR else 'Mensuel')
                Plan.objects.update_or_create(
                    community=community,
                    billing_interval=interval_choice,
                    defaults={
                        'name': membership_plan_name or f"Pass {community.name} ({label})",
                        'slug': f"{community.slug}-{membership_interval}",
                        'description': f"Accès complet à la communauté {community.name}",
                        'price': membership_price,
                        'currency': 'XOF',
                        'interval_count': 1,
                        'is_active': True
                    }
                )

        return community

    @classmethod
    def delete_community(cls, community: Community, user: User) -> None:
        from common.permissions.base import is_superadmin_user
        if not is_superadmin_user(user) and community.owner_id != user.id:
            raise PermissionDenied("Seul le propriétaire de la communauté peut la supprimer.")

        with transaction.atomic():
            community.is_active = False
            community.save(update_fields=['is_active', 'updated_at'])

    @classmethod
    def update_settings(
        cls,
        community: Community,
        user: User,
        data: Dict[str, Any]
    ) -> CommunitySettings:
        from common.permissions.base import is_superadmin_user
        if not is_superadmin_user(user) and community.owner_id != user.id:
            is_admin = CommunityMember.objects.filter(
                community=community,
                user=user,
                status=MembershipStatus.ACTIVE,
                role__in=[CommunityRole.OWNER, CommunityRole.ADMIN]
            ).exists()
            if not is_admin:
                raise PermissionDenied("Droits administrateur requis.")

        settings, _ = CommunitySettings.objects.get_or_create(community=community)
        for key, value in data.items():
            setattr(settings, key, value)
        settings.save()
        return settings

    @classmethod
    def add_rule(
        cls,
        community: Community,
        user: User,
        title: str,
        description: str = "",
        order: int = 0
    ) -> CommunityRule:
        from common.permissions.base import is_superadmin_user
        if not is_superadmin_user(user) and community.owner_id != user.id:
            is_admin = CommunityMember.objects.filter(
                community=community,
                user=user,
                status=MembershipStatus.ACTIVE,
                role__in=[CommunityRole.OWNER, CommunityRole.ADMIN, CommunityRole.MODERATOR]
            ).exists()
            if not is_admin:
                raise PermissionDenied("Droits modérateur ou administrateur requis.")

        return CommunityRule.objects.create(
            community=community,
            title=title,
            description=description,
            order=order
        )

    @classmethod
    def delete_rule(cls, community: Community, user: User, rule_id: str) -> None:
        from common.permissions.base import is_superadmin_user
        if not is_superadmin_user(user) and community.owner_id != user.id:
            is_admin = CommunityMember.objects.filter(
                community=community,
                user=user,
                status=MembershipStatus.ACTIVE,
                role__in=[CommunityRole.OWNER, CommunityRole.ADMIN, CommunityRole.MODERATOR]
            ).exists()
            if not is_admin:
                raise PermissionDenied("Droits modérateur ou administrateur requis.")

        try:
            rule = CommunityRule.objects.get(id=rule_id, community=community)
            rule.delete()
        except CommunityRule.DoesNotExist:
            raise NotFound("Règle introuvable.")
