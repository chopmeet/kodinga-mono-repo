from common.models.base import BaseModel
from django.conf import settings
from django.db import models
from django.utils.text import slugify

from apps.hackathons.models.hackathon import Hackathon


class TeamMemberRole(models.TextChoices):
    LEADER = "leader", "Capitaine / Créateur de l'équipe"
    MEMBER = "member", "Coéquipier"


class TeamInvitationStatus(models.TextChoices):
    INVITED = "invited", "Invitation en attente"
    ACCEPTED = "accepted", "Membre actif"
    DECLINED = "declined", "Invitation refusée"
    LEFT = "left", "A quitté l'équipe"


class HackathonTeam(BaseModel):
    """
    Team formed by participants for a specific hackathon.
    """

    hackathon = models.ForeignKey(
        Hackathon,
        on_delete=models.CASCADE,
        related_name="teams",
        db_index=True,
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, db_index=True)
    tagline = models.CharField(max_length=255, blank=True)
    leader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="led_hackathon_teams",
        db_index=True,
    )
    avatar_url = models.URLField(max_length=1000, blank=True)

    class Meta:
        db_table = "hackathon_teams"
        unique_together = ("hackathon", "name")
        ordering = ["name"]
        verbose_name = "Hackathon Team"
        verbose_name_plural = "Hackathon Teams"

    def __str__(self):
        return f"{self.name} ({self.hackathon.title})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or "team"
            candidate = base_slug
            count = 1
            while HackathonTeam.objects.filter(
                hackathon=self.hackathon, slug=candidate
            ).exclude(pk=self.pk).exists():
                candidate = f"{base_slug}-{count}"
                count += 1
            self.slug = candidate
        super().save(*args, **kwargs)

    @property
    def active_members_count(self) -> int:
        return self.members.filter(status=TeamInvitationStatus.ACCEPTED).count()


class HackathonTeamMember(BaseModel):
    """
    Membership and invitation tracking within a hackathon team.
    """

    team = models.ForeignKey(
        HackathonTeam,
        on_delete=models.CASCADE,
        related_name="members",
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="hackathon_team_memberships",
        db_index=True,
    )
    role = models.CharField(
        max_length=20,
        choices=TeamMemberRole.choices,
        default=TeamMemberRole.MEMBER,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=TeamInvitationStatus.choices,
        default=TeamInvitationStatus.INVITED,
        db_index=True,
    )
    invited_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "hackathon_team_members"
        unique_together = ("team", "user")
        ordering = ["role", "-invited_at"]
        verbose_name = "Hackathon Team Member"
        verbose_name_plural = "Hackathon Team Members"

    def __str__(self):
        return f"{self.user.username} in {self.team.name} ({self.status})"
