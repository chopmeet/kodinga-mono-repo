import os
from typing import Any, Optional

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.hackathons.models.application import ApplicationStatus, HackathonApplication
from apps.hackathons.models.hackathon import Hackathon
from apps.hackathons.models.submission import (
    HackathonSubmission,
    HackathonSubmissionFile,
    SubmissionFileType,
    SubmissionStatus,
)
from apps.hackathons.selectors.hackathon_selector import HackathonSelector
from apps.notifications.models.notification import NotificationType
from apps.notifications.services.notification_service import NotificationService
from apps.memberships.permissions import check_community_membership

DEFAULT_ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "zip", "mp4", "webm", "gif"}
DANGEROUS_EXTENSIONS = {"exe", "bat", "cmd", "sh", "php", "py", "js", "html", "htm", "vbs", "ps1"}


class HackathonSubmissionService:
    """
    Handles project submission drafting, external demo/repository link verification,
    secure attachment uploads, and deadline enforcement.
    """

    @classmethod
    def check_submission_allowed(cls, user: User, hackathon: Hackathon) -> Optional[HackathonSubmission]:
        if not user or not user.is_authenticated:
            raise PermissionDenied("Authentification requise pour soumettre un projet.")

        check_community_membership(user, hackathon.community, "soumettre un projet à ce hackathon")

        # Ensure user has an accepted application
        is_accepted = HackathonApplication.objects.filter(
            hackathon=hackathon,
            applicant=user,
            status=ApplicationStatus.ACCEPTED,
        ).exists()
        if not is_accepted:
            raise PermissionDenied("Vous devez être un participant accepté pour soumettre un projet.")


        # Server-side strict deadline check
        now = timezone.now()
        if now > hackathon.submission_deadline:
            raise ValidationError(
                {"hackathon": "La date limite de soumission de projet est dépassée."}
            )

    @classmethod
    @transaction.atomic
    def get_or_create_submission(
        cls, user: User, hackathon: Hackathon
    ) -> tuple[HackathonSubmission, bool]:
        cls.check_submission_allowed(user, hackathon)

        team = HackathonSelector.get_user_team(hackathon, user)

        if team:
            submission, created = HackathonSubmission.objects.get_or_create(
                hackathon=hackathon,
                team=team,
                defaults={
                    "applicant": user,
                    "title": f"Projet de {team.name}",
                    "description": "",
                },
            )
            return submission, created

        submission, created = HackathonSubmission.objects.get_or_create(
            hackathon=hackathon,
            applicant=user,
            team__isnull=True,
            defaults={
                "title": f"Projet de {user.username}",
                "description": "",
            },
        )
        return submission, created

    @classmethod
    @transaction.atomic
    def update_submission(
        cls,
        user: User,
        hackathon: Hackathon,
        data: dict[str, Any],
    ) -> HackathonSubmission:
        cls.check_submission_allowed(user, hackathon)
        submission, _ = cls.get_or_create_submission(user, hackathon)

        # Permission check: must be submission applicant or team member
        if submission.team:
            user_team = HackathonSelector.get_user_team(hackathon, user)
            if not user_team or user_team.id != submission.team_id:
                raise PermissionDenied("Vous ne faites pas partie de l'équipe de ce projet.")
        else:
            if submission.applicant_id != user.id:
                raise PermissionDenied("Vous n'êtes pas l'auteur de ce projet.")

        tech_ids = data.pop("technology_ids", None)
        technologies = data.pop("technologies", None)

        for attr, value in data.items():
            setattr(submission, attr, value)

        submission.save()

        if tech_ids is not None:
            from apps.profiles.models.technology import Technology
            submission.technologies.set(Technology.objects.filter(id__in=tech_ids))
        elif technologies is not None:
            submission.technologies.set(technologies)

        return submission

    @classmethod
    @transaction.atomic
    def attach_file(
        cls,
        user: User,
        hackathon: Hackathon,
        file_name: str,
        file_url: str,
        file_size: int,
        mime_type: str,
        file_type: str = SubmissionFileType.OTHER,
    ) -> HackathonSubmissionFile:
        cls.check_submission_allowed(user, hackathon)
        submission, _ = cls.get_or_create_submission(user, hackathon)

        # Check file limits
        if submission.files.count() >= hackathon.max_files_count:
            raise ValidationError(
                {"files": f"Le nombre maximal de fichiers ({hackathon.max_files_count}) est atteint."}
            )

        # Validate file size
        max_bytes = hackathon.max_file_size_mb * 1024 * 1024
        if file_size > max_bytes:
            raise ValidationError(
                {"file_size": f"Fichier trop volumineux. Limite: {hackathon.max_file_size_mb} Mo."}
            )

        # Validate file extension (OWASP defense)
        _, ext = os.path.splitext(file_name)
        ext_clean = ext.lower().replace(".", "").strip()

        if ext_clean in DANGEROUS_EXTENSIONS:
            raise ValidationError({"file_name": f"Le type d'extension .{ext_clean} est strictement interdit."})

        allowed_list = set(hackathon.allowed_file_types) if hackathon.allowed_file_types else DEFAULT_ALLOWED_EXTENSIONS
        if ext_clean not in allowed_list:
            raise ValidationError(
                {"file_name": f"Extension .{ext_clean} non autorisée. Formats acceptés : {', '.join(allowed_list)}"}
            )

        attachment = HackathonSubmissionFile.objects.create(
            submission=submission,
            file_name=file_name.strip(),
            file_url=file_url.strip(),
            file_size=file_size,
            mime_type=mime_type.strip(),
            file_type=file_type,
            uploaded_by=user,
        )
        return attachment

    @classmethod
    @transaction.atomic
    def delete_file(cls, user: User, hackathon: Hackathon, file_id: str) -> bool:
        cls.check_submission_allowed(user, hackathon)
        submission, _ = cls.get_or_create_submission(user, hackathon)

        file_obj = HackathonSubmissionFile.objects.filter(
            id=file_id, submission=submission
        ).first()

        if not file_obj:
            return False

        file_obj.delete()
        return True

    @classmethod
    @transaction.atomic
    def submit_final_project(cls, user: User, hackathon: Hackathon) -> HackathonSubmission:
        cls.check_submission_allowed(user, hackathon)
        submission, _ = cls.get_or_create_submission(user, hackathon)

        errors = {}
        if not submission.title or not submission.title.strip():
            errors["title"] = "Le nom du projet est obligatoire pour la soumission finale."
        if not submission.description or not submission.description.strip():
            errors["description"] = "La description détaillée du projet est requise."

        if hackathon.require_demo_url and not submission.demo_url:
            errors["demo_url"] = "L'URL de la démonstration en ligne est obligatoire."

        if hackathon.require_video_url and not submission.video_url:
            errors["video_url"] = "L'URL de la vidéo de présentation est obligatoire."

        if hackathon.require_repo_url and not (submission.repository_url or submission.gitlab_url):
            errors["repository_url"] = "Un lien vers le dépôt GitHub ou GitLab est obligatoire."

        if errors:
            raise ValidationError(errors)

        now = timezone.now()
        submission.status = SubmissionStatus.SUBMITTED
        submission.is_final = True
        submission.submitted_at = now
        submission.save(update_fields=["status", "is_final", "submitted_at", "updated_at"])

        # Send confirmation to user
        NotificationService.create_notification(
            recipient=user,
            title=f"Projet soumis : {submission.title} 🎉",
            body=f"Votre projet pour le hackathon {hackathon.title} a été validé avec succès !",
            notification_type=NotificationType.SYSTEM,
            action_url=f"/communities/{hackathon.community.slug}/hackathons/{hackathon.slug}",
            target_type="hackathon_submission",
            target_id=str(submission.id),
        )

        # Notify team members if team
        if submission.team:
            for member in submission.team.members.exclude(user=user):
                NotificationService.create_notification(
                    recipient=member.user,
                    title=f"Projet d'équipe soumis : {submission.title}",
                    body=f"{user.username} a finalisé la soumission du projet de l'équipe {submission.team.name}.",
                    notification_type=NotificationType.SYSTEM,
                    action_url=f"/communities/{hackathon.community.slug}/hackathons/{hackathon.slug}",
                    target_type="hackathon_submission",
                    target_id=str(submission.id),
                )

        return submission
