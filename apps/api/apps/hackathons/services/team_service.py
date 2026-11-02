import uuid

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
from apps.hackathons.models.team import (
    HackathonTeam,
    HackathonTeamMember,
    TeamInvitationStatus,
    TeamMemberRole,
)
from apps.hackathons.selectors.hackathon_selector import HackathonSelector
from apps.memberships.permissions import check_community_membership
from apps.notifications.models.notification import NotificationType
from apps.notifications.services.notification_service import NotificationService


def _is_valid_uuid(val: str) -> bool:
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


class HackathonTeamService:
    """
    Manages team formation, member invites, role transitions,
    and size constraints for hackathon participants.
    """

    @classmethod
    def check_participant_accepted(cls, user: User, hackathon: Hackathon):
        has_accepted = HackathonApplication.objects.filter(
            hackathon=hackathon,
            applicant=user,
            status=ApplicationStatus.ACCEPTED,
        ).exists()
        if not has_accepted:
            raise PermissionDenied(
                "Vous devez avoir une candidature acceptée pour participer à une équipe."
            )

    @classmethod
    def _ensure_invitee_application(cls, invitee: User, hackathon: Hackathon, team_name: str = ""):
        """
        Ensures the invited teammate either already has an accepted application or,
        when `hackathon.auto_accept_applications` is True, automatically registers/accepts
        their participation so team captains can invite community members seamlessly.
        """
        existing_app = HackathonApplication.objects.filter(
            hackathon=hackathon,
            applicant=invitee,
        ).first()

        if existing_app:
            if existing_app.status == ApplicationStatus.ACCEPTED:
                return existing_app
            if existing_app.status == ApplicationStatus.REJECTED:
                raise PermissionDenied(
                    "La candidature de cet utilisateur pour ce hackathon a été refusée."
                )
            if hackathon.auto_accept_applications:
                existing_app.status = ApplicationStatus.ACCEPTED
                if team_name and not existing_app.team_name:
                    existing_app.team_name = team_name
                existing_app.save(update_fields=["status", "team_name", "updated_at"])
                return existing_app
            raise PermissionDenied(
                "Cet utilisateur doit avoir une candidature acceptée pour rejoindre l'équipe."
            )

        if hackathon.auto_accept_applications:
            return HackathonApplication.objects.create(
                hackathon=hackathon,
                applicant=invitee,
                participation_mode=ParticipationMode.TEAM,
                team_name=team_name,
                status=ApplicationStatus.ACCEPTED,
            )

        raise PermissionDenied(
            "Cet utilisateur doit d'abord candidater et être accepté au hackathon pour rejoindre l'équipe."
        )

    @classmethod
    @transaction.atomic
    def create_team(
        cls,
        leader: User,
        hackathon: Hackathon,
        name: str,
        tagline: str = "",
        avatar_url: str = "",
    ) -> HackathonTeam:
        if not hackathon.allow_teams:
            raise ValidationError(
                {"hackathon": "Ce hackathon ne permet que les participations individuelles."}
            )

        check_community_membership(leader, hackathon.community, "créer une équipe pour ce hackathon")
        cls.check_participant_accepted(leader, hackathon)

        # Check leader isn't already part of an active team in this hackathon
        existing_team = HackathonSelector.get_user_team(hackathon, leader)
        if existing_team:
            raise ValidationError(
                {"leader": f"Vous appartenez déjà à l'équipe '{existing_team.name}' pour ce hackathon."}
            )

        if HackathonTeam.objects.filter(hackathon=hackathon, name__iexact=name.strip()).exists():
            raise ValidationError({"name": f"Le nom d'équipe '{name}' est déjà pris dans ce hackathon."})

        team = HackathonTeam.objects.create(
            hackathon=hackathon,
            name=name.strip(),
            tagline=tagline.strip(),
            avatar_url=avatar_url.strip(),
            leader=leader,
        )

        HackathonTeamMember.objects.create(
            team=team,
            user=leader,
            role=TeamMemberRole.LEADER,
            status=TeamInvitationStatus.ACCEPTED,
            responded_at=timezone.now(),
        )

        return team

    @classmethod
    @transaction.atomic
    def invite_member(
        cls,
        leader: User,
        team: HackathonTeam,
        invitee_identifier: str,
    ) -> HackathonTeamMember:
        if team.leader_id != leader.id:
            raise PermissionDenied("Seul le capitaine de l'équipe peut envoyer des invitations.")

        # Check maximum team size
        active_count = team.members.filter(status=TeamInvitationStatus.ACCEPTED).count()
        if active_count >= team.hackathon.max_team_size:
            raise ValidationError(
                {"team": f"L'équipe a atteint sa taille maximale autorisée ({team.hackathon.max_team_size} membres)."}
            )

        cleaned = (invitee_identifier or "").strip()
        invitee = None
        if _is_valid_uuid(cleaned):
            invitee = User.objects.filter(id=cleaned).first()
        if not invitee:
            invitee = (
                User.objects.filter(username__iexact=cleaned).first()
                or User.objects.filter(email__iexact=cleaned).first()
            )

        if not invitee or not invitee.is_active:
            raise ValidationError({"invitee": "Utilisateur introuvable avec cet identifiant ou adresse email."})

        if invitee.id == leader.id:
            raise ValidationError({"invitee": "Vous ne pouvez pas vous inviter vous-même."})

        check_community_membership(invitee, team.hackathon.community, "rejoindre une équipe pour ce hackathon")
        cls._ensure_invitee_application(invitee, team.hackathon, team_name=team.name)

        # Check if already in another team
        existing_team = HackathonSelector.get_user_team(team.hackathon, invitee)
        if existing_team:
            raise ValidationError(
                {"invitee": f"Cet utilisateur fait déjà partie de l'équipe '{existing_team.name}'."}
            )

        membership, created = HackathonTeamMember.objects.get_or_create(
            team=team,
            user=invitee,
            defaults={
                "role": TeamMemberRole.MEMBER,
                "status": TeamInvitationStatus.INVITED,
            },
        )

        if not created and membership.status == TeamInvitationStatus.INVITED:
            raise ValidationError({"invitee": "Une invitation a déjà été envoyée à ce membre."})

        if not created and membership.status == TeamInvitationStatus.ACCEPTED:
            raise ValidationError({"invitee": "Ce membre fait déjà partie de l'équipe."})

        if not created:
            membership.status = TeamInvitationStatus.INVITED
            membership.responded_at = None
            membership.save(update_fields=["status", "responded_at", "updated_at"])

        leader_display = leader.get_full_name() or leader.username
        NotificationService.create_notification(
            recipient=invitee,
            actor=leader,
            title=f"Invitation d'équipe : {team.name}",
            body=f"{leader_display} vous invite à rejoindre son équipe '{team.name}' pour le hackathon {team.hackathon.title}.",
            notification_type=NotificationType.COMMUNITY_INVITE,
            action_url=f"/communities/{team.hackathon.community.slug}/hackathons/{team.hackathon.slug}/teams",
            target_type="hackathon_team",
            target_id=str(team.id),
            metadata={
                "invitation_id": str(membership.id),
                "team_id": str(team.id),
                "team_name": team.name,
                "hackathon_id": str(team.hackathon.id),
                "hackathon_slug": team.hackathon.slug,
                "community_slug": team.hackathon.community.slug,
                "status": TeamInvitationStatus.INVITED,
            },
        )

        return membership

    @classmethod
    @transaction.atomic
    def respond_invitation(
        cls,
        user: User,
        team_id: str | None = None,
        accept: bool = True,
        invitation_id: str | None = None,
    ) -> HackathonTeamMember:
        qs = HackathonTeamMember.objects.filter(
            user=user,
            status=TeamInvitationStatus.INVITED,
        ).select_related("team__hackathon", "team__hackathon__community", "team__leader")

        if invitation_id:
            qs = qs.filter(id=invitation_id)
        elif team_id:
            qs = qs.filter(team_id=team_id)

        membership = qs.first()

        if not membership:
            raise ValidationError("Aucune invitation d'équipe en attente trouvée.")

        team = membership.team

        if accept:
            # Recheck team capacity
            active_count = team.members.filter(status=TeamInvitationStatus.ACCEPTED).count()
            if active_count >= team.hackathon.max_team_size:
                raise ValidationError(
                    {"team": f"L'équipe a atteint sa taille maximale ({team.hackathon.max_team_size} membres)."}
                )

            # Check user is not in another team
            existing_team = HackathonSelector.get_user_team(team.hackathon, user)
            if existing_team and existing_team.id != team.id:
                raise ValidationError(
                    {"user": f"Vous appartenez déjà à l'équipe '{existing_team.name}' pour ce hackathon."}
                )

            cls._ensure_invitee_application(user, team.hackathon, team_name=team.name)

            membership.status = TeamInvitationStatus.ACCEPTED
            membership.responded_at = timezone.now()
            membership.save(update_fields=["status", "responded_at", "updated_at"])

            # Notify team leader
            NotificationService.create_notification(
                recipient=team.leader,
                actor=user,
                title=f"Nouveau membre dans l'équipe : {user.username} !",
                body=f"{user.username} a accepté votre invitation et rejoint l'équipe {team.name}.",
                notification_type=NotificationType.SYSTEM,
                action_url=f"/communities/{team.hackathon.community.slug}/hackathons/{team.hackathon.slug}/teams",
                target_type="hackathon_team",
                target_id=str(team.id),
                metadata={
                    "invitation_id": str(membership.id),
                    "team_id": str(team.id),
                    "team_name": team.name,
                    "status": TeamInvitationStatus.ACCEPTED,
                },
            )
        else:
            membership.status = TeamInvitationStatus.DECLINED
            membership.responded_at = timezone.now()
            membership.save(update_fields=["status", "responded_at", "updated_at"])

            # Notify team leader
            NotificationService.create_notification(
                recipient=team.leader,
                actor=user,
                title=f"Invitation déclinée : {team.name}",
                body=f"{user.username} a décliné l'invitation à rejoindre l'équipe {team.name}.",
                notification_type=NotificationType.SYSTEM,
                action_url=f"/communities/{team.hackathon.community.slug}/hackathons/{team.hackathon.slug}/teams",
                target_type="hackathon_team",
                target_id=str(team.id),
                metadata={
                    "invitation_id": str(membership.id),
                    "team_id": str(team.id),
                    "team_name": team.name,
                    "status": TeamInvitationStatus.DECLINED,
                },
            )

        return membership

    @classmethod
    @transaction.atomic
    def leave_team(cls, user: User, team: HackathonTeam) -> bool:
        if team.leader_id == user.id:
            # If leader is alone, delete team
            active_members = team.members.filter(status=TeamInvitationStatus.ACCEPTED).exclude(user=user)
            if not active_members.exists():
                team.delete()
                return True
            raise ValidationError(
                {"leader": "En tant que capitaine, vous devez transférer le leadership avant de quitter l'équipe."}
            )

        membership = HackathonTeamMember.objects.filter(team=team, user=user).first()
        if not membership:
            return False

        membership.status = TeamInvitationStatus.LEFT
        membership.save(update_fields=["status", "updated_at"])
        return True
