import contextlib

from django.db import transaction
from django.db.models import F
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.memberships.permissions import check_community_membership
from apps.notifications.models.notification import NotificationType
from apps.notifications.services.notification_service import NotificationService
from apps.opportunities.models.application import (
    ApplicationStatus,
    OpportunityApplication,
)
from apps.opportunities.models.opportunity import (
    Opportunity,
    OpportunityStatus,
)
from common.permissions.base import is_superadmin_user


class OpportunityService:
    """
    Business logic for job and freelance opportunities and applications.
    """

    @classmethod
    @transaction.atomic
    def create_opportunity(cls, poster, validated_data, technology_ids=None):
        community = validated_data.get("community")
        if community:
            check_community_membership(poster, community, "publier une opportunité dans cette communauté")

        opportunity = Opportunity.objects.create(poster=poster, **validated_data)
        if technology_ids:
            opportunity.technologies.set(technology_ids)
        return opportunity

    @classmethod
    @transaction.atomic
    def update_opportunity(cls, opportunity, user, validated_data, technology_ids=None):
        if opportunity.poster_id != user.id and not (user.is_staff or is_superadmin_user(user)):
            raise PermissionDenied("Vous n'êtes pas autorisé à modifier cette offre.")

        community = validated_data.get("community")
        if community:
            check_community_membership(user, community, "associer cette opportunité à cette communauté")

        for key, value in validated_data.items():
            setattr(opportunity, key, value)
        opportunity.save()

        if technology_ids is not None:
            opportunity.technologies.set(technology_ids)

        return opportunity

    @classmethod
    def close_opportunity(cls, opportunity, user):
        if opportunity.poster_id != user.id and not (user.is_staff or is_superadmin_user(user)):
            raise PermissionDenied("Vous n'êtes pas autorisé à clôturer cette offre.")

        opportunity.status = OpportunityStatus.CLOSED
        opportunity.save(update_fields=["status", "updated_at"])
        return opportunity

    @classmethod
    @transaction.atomic
    def apply_to_opportunity(cls, opportunity, applicant, data):
        if opportunity.community:
            check_community_membership(applicant, opportunity.community, "postuler à cette opportunité")

        if opportunity.status != OpportunityStatus.OPEN:
            raise ValidationError("Cette opportunité n'accepte plus de candidatures.")


        if OpportunityApplication.objects.filter(opportunity=opportunity, applicant=applicant).exists():
            raise ValidationError("Vous avez déjà postulé à cette opportunité.")

        application = OpportunityApplication.objects.create(
            opportunity=opportunity,
            applicant=applicant,
            resume_url=data.get("resume_url", ""),
            cover_letter=data.get("cover_letter", ""),
            portfolio_url=data.get("portfolio_url", ""),
            status=ApplicationStatus.PENDING,
        )

        Opportunity.objects.filter(id=opportunity.id).update(
            applications_count=F("applications_count") + 1
        )
        opportunity.refresh_from_db(fields=["applications_count"])

        with contextlib.suppress(Exception):
            NotificationService.create_notification(
                recipient=opportunity.poster,
                title="Nouvelle candidature reçue",
                body=f"{applicant.username} a postulé à votre offre '{opportunity.title}'.",
                notification_type=NotificationType.SYSTEM,
                actor=applicant,
                action_url=f"/opportunities/{opportunity.slug}/applications",
                metadata={"opportunity_id": str(opportunity.id), "application_id": str(application.id)},
            )

        return application

    @classmethod
    @transaction.atomic
    def update_application_status(cls, application, user, new_status):
        if application.opportunity.poster_id != user.id and not (user.is_staff or is_superadmin_user(user)):
            raise PermissionDenied("Vous n'êtes pas autorisé à gérer cette candidature.")

        application.status = new_status
        application.save(update_fields=["status", "updated_at"])

        with contextlib.suppress(Exception):
            NotificationService.create_notification(
                recipient=application.applicant,
                title="Mise à jour de votre candidature",
                body=f"Le statut de votre candidature pour '{application.opportunity.title}' est maintenant: {application.get_status_display()}.",
                notification_type=NotificationType.SYSTEM,
                actor=user,
                action_url=f"/opportunities/{application.opportunity.slug}",
                metadata={"opportunity_id": str(application.opportunity.id), "status": new_status},
            )

        return application
