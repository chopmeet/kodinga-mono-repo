from typing import Any, Optional

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.hackathons.models.application import (
    ApplicationStatus,
    HackathonApplication,
    ParticipationMode,
)
from apps.hackathons.models.hackathon import Hackathon
from apps.hackathons.selectors.hackathon_selector import HackathonSelector
from apps.notifications.models.notification import NotificationType
from apps.notifications.services.notification_service import NotificationService
from apps.memberships.permissions import check_community_membership
from common.permissions.base import is_superadmin_user


class HackathonApplicationService:
    """
    Handles participant eligibility, registration forms, screening,
    and status updates.
    """

    @classmethod
    def check_eligibility(cls, applicant: User, hackathon: Hackathon):
        if not applicant or not applicant.is_authenticated:
            raise PermissionDenied("Authentification requise pour candidater.")

        check_community_membership(applicant, hackathon.community, "participer à ce hackathon")

        if not hackathon.is_registration_open:

            raise ValidationError(
                {"hackathon": "La période de candidature pour ce hackathon est fermée."}
            )

        if hackathon.max_participants:
            accepted_count = HackathonApplication.objects.filter(
                hackathon=hackathon, status=ApplicationStatus.ACCEPTED
            ).count()
            if accepted_count >= hackathon.max_participants:
                raise ValidationError(
                    {"hackathon": "La capacité maximale de participants pour ce hackathon est atteinte."}
                )

    @classmethod
    @transaction.atomic
    def apply(
        cls,
        applicant: User,
        hackathon: Hackathon,
        participation_mode: str = ParticipationMode.INDIVIDUAL,
        answers: Optional[dict[str, Any]] = None,
        team_name: str = "",
    ) -> HackathonApplication:
        cls.check_eligibility(applicant, hackathon)

        existing_app = HackathonApplication.objects.filter(
            hackathon=hackathon, applicant=applicant
        ).first()

        if existing_app:
            if existing_app.status in [ApplicationStatus.ACCEPTED, ApplicationStatus.PENDING]:
                raise ValidationError(
                    {"applicant": "Vous avez déjà soumis une candidature pour ce hackathon."}
                )
            # Re-activate withdrawn or rejected application
            existing_app.participation_mode = participation_mode
            existing_app.answers = answers or {}
            existing_app.team_name = team_name.strip()
            existing_app.status = (
                ApplicationStatus.ACCEPTED
                if hackathon.auto_accept_applications
                else ApplicationStatus.PENDING
            )
            existing_app.terms_accepted = True
            existing_app.save()
            application = existing_app
        else:
            initial_status = (
                ApplicationStatus.ACCEPTED
                if hackathon.auto_accept_applications
                else ApplicationStatus.PENDING
            )
            application = HackathonApplication.objects.create(
                hackathon=hackathon,
                applicant=applicant,
                participation_mode=participation_mode,
                answers=answers or {},
                team_name=team_name.strip(),
                status=initial_status,
                terms_accepted=True,
            )

        # Notify applicant
        status_msg = (
            "Votre inscription a été acceptée avec succès !"
            if application.status == ApplicationStatus.ACCEPTED
            else "Votre candidature a été reçue et est en cours d'examen par l'organisateur."
        )

        NotificationService.create_notification(
            recipient=applicant,
            title=f"Candidature enregistrée : {hackathon.title}",
            body=status_msg,
            notification_type=NotificationType.SYSTEM,
            action_url=f"/communities/{hackathon.community.slug}/hackathons/{hackathon.slug}",
            target_type="hackathon_application",
            target_id=str(application.id),
        )

        return application

    @classmethod
    @transaction.atomic
    def review_application(
        cls,
        actor: User,
        application: HackathonApplication,
        new_status: str,
        reason: str = "",
    ) -> HackathonApplication:
        if not HackathonSelector.is_community_manager(actor, application.hackathon.community):
            raise PermissionDenied(
                "Action réservée aux organisateurs de la communauté."
            )

        allowed = [ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED, ApplicationStatus.WAITLISTED]
        if new_status not in allowed:
            raise ValidationError({"status": f"Statut de décision non valide. Choix: {allowed}"})

        application.status = new_status
        application.rejection_reason = reason if new_status == ApplicationStatus.REJECTED else ""
        application.reviewed_at = timezone.now()
        application.reviewed_by = actor
        application.save()

        # Send decision notification
        labels = {
            ApplicationStatus.ACCEPTED: "acceptée ! Félicitations et bienvenue dans le hackathon.",
            ApplicationStatus.REJECTED: "non retenue.",
            ApplicationStatus.WAITLISTED: "placée sur liste d'attente.",
        }

        NotificationService.create_notification(
            recipient=application.applicant,
            actor=actor,
            title=f"Décision pour {application.hackathon.title}",
            body=f"Votre candidature pour {application.hackathon.title} a été {labels[new_status]}",
            notification_type=NotificationType.SYSTEM,
            action_url=f"/communities/{application.hackathon.community.slug}/hackathons/{application.hackathon.slug}",
            target_type="hackathon_application",
            target_id=str(application.id),
        )

        return application

    @classmethod
    @transaction.atomic
    def withdraw_application(cls, applicant: User, hackathon: Hackathon) -> bool:
        application = HackathonApplication.objects.filter(
            hackathon=hackathon, applicant=applicant
        ).first()

        if not application:
            raise ValidationError("Aucune candidature trouvée à retirer.")

        if application.status == ApplicationStatus.WITHDRAWN:
            return True

        application.status = ApplicationStatus.WITHDRAWN
        application.save(update_fields=["status", "updated_at"])
        return True
