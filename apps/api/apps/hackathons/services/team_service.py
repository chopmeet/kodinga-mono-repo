from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.hackathons.models.application import ApplicationStatus, HackathonApplication
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

        # Lookup invitee by username or email
        invitee = User.objects.filter(
            username=invitee_identifier.strip()
        ).first() or User.objects.filter(
            email__iexact=invitee_identifier.strip()
        ).first()

        if not invitee:
            raise ValidationError({"invitee": "Utilisateur introuvable avec cet identifiant ou adresse email."})

        if invitee.id == leader.id:
            raise ValidationError({"invitee": "Vous ne pouvez pas vous inviter vous-même."})

        check_community_membership(invitee, team.hackathon.community, "rejoindre une équipe pour ce hackathon")
        cls.check_participant_accepted(invitee, team.hackathon)

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

        NotificationService.create_notification(
            recipient=invitee,
            actor=leader,
            title=f"Invitation d'équipe : {team.name}",
            body=f"{leader.username} vous invite à rejoindre son équipe '{team.name}' pour le hackathon {team.hackathon.title}.",
            notification_type=NotificationType.COMMUNITY_INVITE,
            action_url=f"/communities/{team.hackathon.community.slug}/hackathons/{team.hackathon.slug}/teams",
            target_type="hackathon_team",
            target_id=str(team.id),
        )

        return membership

    @classmethod
    @transaction.atomic
    def respond_invitation(
        cls,
        user: User,
        team_id: str,
        accept: bool,
    ) -> HackathonTeamMember:
        membership = HackathonTeamMember.objects.filter(
            team_id=team_id,
            user=user,
            status=TeamInvitationStatus.INVITED,
        ).select_related("team__hackathon").first()

        if not membership:
            raise ValidationError("Aucune invitation d'équipe en attente trouvée.")

        team = membership.team

        if accept:
            # Recheck team capacity with select_for_update
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
