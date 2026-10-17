from typing import Any, Optional

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.hackathons.models.application import ApplicationStatus, HackathonApplication
from apps.hackathons.models.criterion import HackathonCriterion
from apps.hackathons.models.evaluation import HackathonEvaluation
from apps.hackathons.models.hackathon import Hackathon, HackathonStatus
from apps.hackathons.models.judge import HackathonJudge
from apps.hackathons.models.prize import HackathonPrize
from apps.hackathons.selectors.hackathon_selector import HackathonSelector
from apps.notifications.models.notification import NotificationType
from apps.notifications.services.notification_service import NotificationService


class HackathonService:
    """
    Business logic for managing hackathon lifecycle, permissions,
    judge assignments, prizes, and dashboard analytics.
    """

    @classmethod
    def require_manager(cls, actor: User, community: Community):
        if not HackathonSelector.is_community_manager(actor, community):
            raise PermissionDenied(
                "Action réservée aux organisateurs et administrateurs de la communauté."
            )

    @classmethod
    @transaction.atomic
    def create_hackathon(
        cls,
        actor: User,
        community: Community,
        data: dict[str, Any],
    ) -> Hackathon:
        cls.require_manager(actor, community)

        # Validate schedule coherence
        reg_start = data.get("registration_start")
        reg_end = data.get("registration_end")
        start_time = data.get("start_time")
        sub_deadline = data.get("submission_deadline")
        judging_end = data.get("judging_end")

        if reg_start and reg_end and reg_start >= reg_end:
            raise ValidationError(
                {"registration_end": "La clôture des inscriptions doit être après leur ouverture."}
            )
        if start_time and sub_deadline and start_time >= sub_deadline:
            raise ValidationError(
                {"submission_deadline": "La date limite de soumission doit être postérieure au début du hackathon."}
            )
        if sub_deadline and judging_end and sub_deadline >= judging_end:
            raise ValidationError(
                {"judging_end": "La fin des délibérations doit être postérieure à la date limite de soumission."}
            )

        prizes_data = data.pop("prizes", [])
        criteria_data = data.pop("criteria", [])
        tech_ids = data.pop("technology_ids", [])
        technologies = data.pop("technologies", [])

        hackathon = Hackathon.objects.create(
            community=community,
            organizer=actor,
            **data,
        )

        if tech_ids:
            from apps.profiles.models.technology import Technology
            hackathon.technologies.set(Technology.objects.filter(id__in=tech_ids))
        elif technologies:
            hackathon.technologies.set(technologies)

        # Create prizes if supplied
        for index, p_data in enumerate(prizes_data):
            HackathonPrize.objects.create(
                hackathon=hackathon,
                display_order=index,
                **p_data,
            )

        # Create criteria if supplied
        for index, c_data in enumerate(criteria_data):
            HackathonCriterion.objects.create(
                hackathon=hackathon,
                display_order=index,
                **c_data,
            )

        return hackathon

    @classmethod
    @transaction.atomic
    def update_hackathon(
        cls,
        actor: User,
        hackathon: Hackathon,
        data: dict[str, Any],
    ) -> Hackathon:
        cls.require_manager(actor, hackathon.community)

        # Prevent critical date corruption if submissions already received
        if (
            hackathon.submissions.filter(is_final=True).exists()
            and "submission_deadline" in data
            and data["submission_deadline"] < timezone.now()
        ):
            raise ValidationError(
                {"submission_deadline": "Impossible d'avancer la date limite dans le passé."}
            )

        prizes_data = data.pop("prizes", None)
        criteria_data = data.pop("criteria", None)
        tech_ids = data.pop("technology_ids", None)
        technologies = data.pop("technologies", None)

        for attr, value in data.items():
            setattr(hackathon, attr, value)
        hackathon.save()

        if tech_ids is not None:
            from apps.profiles.models.technology import Technology
            hackathon.technologies.set(Technology.objects.filter(id__in=tech_ids))
        elif technologies is not None:
            hackathon.technologies.set(technologies)

        if prizes_data is not None:
            hackathon.prizes.all().delete()
            for index, p_data in enumerate(prizes_data):
                HackathonPrize.objects.create(
                    hackathon=hackathon,
                    display_order=index,
                    **p_data,
                )

        if (
            criteria_data is not None
            and not HackathonEvaluation.objects.filter(
                submission__hackathon=hackathon, is_submitted=True
            ).exists()
        ):
            hackathon.criteria.all().delete()
            for index, c_data in enumerate(criteria_data):
                HackathonCriterion.objects.create(
                    hackathon=hackathon,
                    display_order=index,
                    **c_data,
                )

        return hackathon

    @classmethod
    @transaction.atomic
    def publish_hackathon(cls, actor: User, hackathon: Hackathon) -> Hackathon:
        cls.require_manager(actor, hackathon.community)

        if hackathon.status != HackathonStatus.DRAFT:
            raise ValidationError("Le hackathon est déjà publié.")

        now = timezone.now()
        if hackathon.registration_start <= now <= hackathon.registration_end:
            hackathon.status = HackathonStatus.REGISTRATION_OPEN
        else:
            hackathon.status = HackathonStatus.PUBLISHED

        hackathon.save(update_fields=["status", "updated_at"])

        # Notify active community members about the new hackathon
        from apps.memberships.models.member import CommunityMember, MembershipStatus
        members = CommunityMember.objects.filter(
            community=hackathon.community,
            status=MembershipStatus.ACTIVE,
        ).select_related("user")[:200]

        for m in members:
            NotificationService.create_notification(
                recipient=m.user,
                actor=actor,
                title=f"Nouveau Hackathon : {hackathon.title}",
                body=f"La communauté {hackathon.community.name} organise un hackathon ! Découvrez les défis et inscrivez-vous.",
                notification_type=NotificationType.COMMUNITY_INVITE,
                action_url=f"/communities/{hackathon.community.slug}/hackathons/{hackathon.slug}",
                target_type="hackathon",
                target_id=str(hackathon.id),
            )

        return hackathon

    @classmethod
    @transaction.atomic
    def transition_lifecycle(
        cls,
        actor: User,
        hackathon: Hackathon,
        target_status: str,
    ) -> Hackathon:
        cls.require_manager(actor, hackathon.community)

        allowed_statuses = [choice[0] for choice in HackathonStatus.choices]
        if target_status not in allowed_statuses:
            raise ValidationError({"status": f"Statut non valide. Choix: {allowed_statuses}"})

        # Disallow reverting from COMPLETED or CANCELLED to DRAFT
        if (
            hackathon.status in [HackathonStatus.COMPLETED, HackathonStatus.CANCELLED]
            and target_status == HackathonStatus.DRAFT
        ):
            raise ValidationError("Un hackathon terminé ou annulé ne peut pas repasser en brouillon.")

        hackathon.status = target_status
        hackathon.save(update_fields=["status", "updated_at"])
        return hackathon

    @classmethod
    @transaction.atomic
    def assign_judges(
        cls,
        actor: User,
        hackathon: Hackathon,
        user_ids: list[str],
    ) -> list[HackathonJudge]:
        cls.require_manager(actor, hackathon.community)

        users = User.objects.filter(id__in=user_ids)
        assigned = []
        for u in users:
            judge, _ = HackathonJudge.objects.get_or_create(
                hackathon=hackathon,
                user=u,
                defaults={"assigned_by": actor, "can_evaluate_all": True},
            )
            assigned.append(judge)
            NotificationService.create_notification(
                recipient=u,
                actor=actor,
                title=f"Nomination Jury : {hackathon.title}",
                body=f"Vous avez été désigné comme membre du jury pour le hackathon {hackathon.title}.",
                notification_type=NotificationType.SYSTEM,
                action_url=f"/communities/{hackathon.community.slug}/hackathons/{hackathon.slug}/judging",
                target_type="hackathon",
                target_id=str(hackathon.id),
            )

        return assigned

    @classmethod
    @transaction.atomic
    def remove_judge(cls, actor: User, hackathon: Hackathon, user_id: str) -> bool:
        cls.require_manager(actor, hackathon.community)
        deleted, _ = HackathonJudge.objects.filter(
            hackathon=hackathon, user_id=user_id
        ).delete()
        return deleted > 0

    @classmethod
    @transaction.atomic
    def publish_results(
        cls,
        actor: User,
        hackathon: Hackathon,
        winners_mapping: Optional[list[dict[str, Any]]] = None,
    ) -> Hackathon:
        """
        Publishes official results, links prizes to winning submissions,
        and marks hackathon as COMPLETED.
        """
        cls.require_manager(actor, hackathon.community)

        if winners_mapping:
            for item in winners_mapping:
                prize_id = item.get("prize_id")
                submission_id = item.get("submission_id")
                if prize_id and submission_id:
                    HackathonPrize.objects.filter(
                        id=prize_id, hackathon=hackathon
                    ).update(winner_submission_id=submission_id)

        hackathon.results_published = True
        hackathon.results_published_at = timezone.now()
        hackathon.status = HackathonStatus.COMPLETED
        hackathon.save(update_fields=["results_published", "results_published_at", "status", "updated_at"])

        # Notify participants of results publication
        participants = HackathonApplication.objects.filter(
            hackathon=hackathon, status=ApplicationStatus.ACCEPTED
        ).select_related("applicant")

        for app in participants:
            NotificationService.create_notification(
                recipient=app.applicant,
                actor=actor,
                title=f"Résultats publiés : {hackathon.title} 🏆",
                body=f"Les résultats officiels du hackathon {hackathon.title} sont maintenant en ligne !",
                notification_type=NotificationType.SYSTEM,
                action_url=f"/communities/{hackathon.community.slug}/hackathons/{hackathon.slug}/results",
                target_type="hackathon",
                target_id=str(hackathon.id),
            )

        return hackathon

    @classmethod
    def get_dashboard_metrics(cls, actor: User, hackathon: Hackathon) -> dict[str, Any]:
        cls.require_manager(actor, hackathon.community)

        total_applications = hackathon.applications.count()
        accepted_applications = hackathon.applications.filter(status=ApplicationStatus.ACCEPTED).count()
        pending_applications = hackathon.applications.filter(status=ApplicationStatus.PENDING).count()

        total_teams = hackathon.teams.count()
        total_submissions = hackathon.submissions.count()
        final_submissions = hackathon.submissions.filter(is_final=True).count()
        draft_submissions = hackathon.submissions.filter(is_final=False).count()

        judges_count = hackathon.judge_assignments.count()
        evaluations_completed = HackathonEvaluation.objects.filter(
            submission__hackathon=hackathon, is_submitted=True
        ).count()

        return {
            "hackathon_id": str(hackathon.id),
            "status": hackathon.status,
            "total_applications": total_applications,
            "accepted_applications": accepted_applications,
            "pending_applications": pending_applications,
            "total_teams": total_teams,
            "total_submissions": total_submissions,
            "final_submissions": final_submissions,
            "draft_submissions": draft_submissions,
            "judges_count": judges_count,
            "evaluations_completed": evaluations_completed,
            "is_registration_open": hackathon.is_registration_open,
            "is_submission_open": hackathon.is_submission_open,
            "results_published": hackathon.results_published,
        }
