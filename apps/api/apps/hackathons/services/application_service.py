from typing import Any, Optional

from django.db import transaction
from django.utils import timezone
from realtime.broadcast import broadcast_hackathon_registration_updated
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.hackathons.models.application import (
    ApplicationStatus,
    HackathonApplication,
    ParticipationMode,
)
from apps.hackathons.models.hackathon import Hackathon, HackathonStatus
from apps.hackathons.selectors.hackathon_selector import HackathonSelector
from apps.memberships.permissions import check_community_membership
from apps.notifications.models.notification import NotificationType
from apps.notifications.services.notification_service import NotificationService


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

        now = timezone.now()
        if hackathon.status in [HackathonStatus.CANCELLED, HackathonStatus.DRAFT]:
            raise ValidationError(
                {"hackathon": "Ce hackathon n'accepte pas de candidatures actuellement."}
            )
        if now > hackathon.registration_end or hackathon.status in [
            HackathonStatus.REGISTRATION_CLOSED,
            HackathonStatus.IN_PROGRESS,
            HackathonStatus.SUBMISSION_CLOSED,
            HackathonStatus.JUDGING,
            HackathonStatus.COMPLETED,
        ]:
            raise ValidationError(
                {
                    "hackathon": (
                        "La date limite de candidature pour ce hackathon est dépassée. "
                        "Les candidatures hors délai ne sont pas autorisées."
                    )
                }
            )
        if now < hackathon.registration_start:
            raise ValidationError(
                {"hackathon": "La période de candidature pour ce hackathon n'a pas encore débuté."}
            )
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
        locked_hackathon = Hackathon.objects.select_for_update().get(pk=hackathon.pk)
        cls.check_eligibility(applicant, locked_hackathon)

        existing_app = HackathonApplication.objects.filter(
            hackathon=locked_hackathon, applicant=applicant
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
                if locked_hackathon.auto_accept_applications
                else ApplicationStatus.PENDING
            )
            existing_app.terms_accepted = True
            existing_app.save()
            application = existing_app
        else:
            initial_status = (
                ApplicationStatus.ACCEPTED
                if locked_hackathon.auto_accept_applications
                else ApplicationStatus.PENDING
            )
            application = HackathonApplication.objects.create(
                hackathon=locked_hackathon,
                applicant=applicant,
                participation_mode=participation_mode,
                answers=answers or {},
                team_name=team_name.strip(),
                status=initial_status,
                terms_accepted=True,
            )

        broadcast_hackathon_registration_updated(
            locked_hackathon,
            user_id=str(applicant.id),
            status=application.status,
        )

        # Notify applicant
        status_msg = (
            "Votre inscription a été acceptée avec succès !"
            if application.status == ApplicationStatus.ACCEPTED
            else "Votre candidature a été reçue et est en cours d'examen par l'organisateur."
        )

        NotificationService.create_notification(
            recipient=applicant,
            title=f"Candidature enregistrée : {locked_hackathon.title}",
            body=status_msg,
            notification_type=NotificationType.SYSTEM,
            action_url=f"/communities/{locked_hackathon.community.slug}/hackathons/{locked_hackathon.slug}",
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
        if (
            application.hackathon.organizer_id != actor.id
            and not HackathonSelector.is_community_manager(actor, application.hackathon.community)
        ):
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

        broadcast_hackathon_registration_updated(
            application.hackathon,
            user_id=str(application.applicant_id),
            status=application.status,
        )

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

        broadcast_hackathon_registration_updated(
            hackathon,
            user_id=str(applicant.id),
            status=ApplicationStatus.WITHDRAWN,
        )
        return True
