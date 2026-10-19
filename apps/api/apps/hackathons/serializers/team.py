from rest_framework import serializers

from apps.accounts.models.user import User
from apps.hackathons.models.team import (
    HackathonTeam,
    HackathonTeamMember,
)


class TeamUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name"]


class HackathonTeamMemberSerializer(serializers.ModelSerializer):
    user = TeamUserSerializer(read_only=True)

    class Meta:
        model = HackathonTeamMember
        fields = [
            "id",
            "user",
            "role",
            "status",
            "invited_at",
            "responded_at",
        ]


class HackathonTeamSerializer(serializers.ModelSerializer):
    leader = TeamUserSerializer(read_only=True)
    members = HackathonTeamMemberSerializer(many=True, read_only=True)
    active_members_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = HackathonTeam
        fields = [
            "id",
            "hackathon",
            "name",
            "slug",
            "tagline",
            "avatar_url",
            "leader",
            "members",
            "active_members_count",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "hackathon",
            "slug",
            "leader",
            "members",
            "active_members_count",
            "created_at",
        ]


class CreateTeamRequestSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=255,
        help_text="Nom unique de l'équipe au sein du hackathon",
    )
    tagline = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Slogan ou brève devise de l'équipe",
    )
    avatar_url = serializers.URLField(
        required=False,
        allow_blank=True,
        help_text="Logo ou avatar de l'équipe",
    )


class InviteMemberRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField(
        help_text="Nom d'utilisateur ou adresse email du membre à inviter",
    )


class RespondInvitationRequestSerializer(serializers.Serializer):
    team_id = serializers.UUIDField(help_text="Identifiant UUID de l'équipe")
    accept = serializers.BooleanField(help_text="True pour accepter, False pour décliner")
