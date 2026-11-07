from rest_framework import serializers

from apps.accounts.models.user import User
from apps.hackathons.models.team import (
    HackathonTeam,
    HackathonTeamMember,
)


class TeamUserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "avatar_url"]

    def get_avatar_url(self, obj) -> str:
        profile = getattr(obj, "profile", None)
        return profile.avatar_url if profile else ""


class HackathonTeamMemberSerializer(serializers.ModelSerializer):
    user = TeamUserSerializer(read_only=True)
    leader = TeamUserSerializer(source="team.leader", read_only=True)
    team_id = serializers.UUIDField(source="team.id", read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True)
    hackathon_slug = serializers.CharField(source="team.hackathon.slug", read_only=True)
    hackathon_title = serializers.CharField(source="team.hackathon.title", read_only=True)
    community_slug = serializers.CharField(source="team.hackathon.community.slug", read_only=True)

    class Meta:
        model = HackathonTeamMember
        fields = [
            "id",
            "team_id",
            "team_name",
            "leader",
            "hackathon_slug",
            "hackathon_title",
            "community_slug",
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
        required=False,
        allow_blank=True,
        help_text="Nom d'utilisateur, adresse email ou UUID du membre à inviter",
    )
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        help_text="Adresse email du coéquipier à inviter",
    )
    username = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Nom d'utilisateur du coéquipier à inviter",
    )
    user_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="UUID du coéquipier à inviter",
    )

    def validate(self, attrs):
        raw = (
            (attrs.get("identifier") or "").strip()
            or (attrs.get("email") or "").strip()
            or (attrs.get("username") or "").strip()
            or (str(attrs["user_id"]) if attrs.get("user_id") else "")
        )
        if not raw:
            raise serializers.ValidationError(
                {"identifier": "Veuillez fournir un nom d'utilisateur, un email ou un identifiant utilisateur."}
            )
        attrs["identifier"] = raw
        return attrs


class RespondInvitationRequestSerializer(serializers.Serializer):
    team_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Identifiant UUID de l'équipe",
    )
    invitation_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Identifiant UUID de l'invitation d'équipe (HackathonTeamMember)",
    )
    accept = serializers.BooleanField(
        required=False,
        allow_null=True,
        help_text="True pour accepter, False pour décliner",
    )
    status = serializers.ChoiceField(
        choices=["accepted", "declined", "rejected"],
        required=False,
        allow_blank=True,
        help_text="Alternative à 'accept' : 'accepted' ou 'declined'",
    )

    def validate(self, attrs):
        if not attrs.get("team_id") and not attrs.get("invitation_id"):
            raise serializers.ValidationError(
                {"team_id": "Veuillez fournir 'team_id' ou 'invitation_id'."}
            )
        accept = attrs.get("accept")
        status_val = (attrs.get("status") or "").strip().lower()
        if accept is None:
            if status_val == "accepted":
                accept = True
            elif status_val in ["declined", "rejected"]:
                accept = False
            else:
                raise serializers.ValidationError(
                    {"accept": "Veuillez préciser votre décision ('accept': true/false ou 'status': 'accepted'/'declined')."}
                )
        attrs["accept"] = bool(accept)
        return attrs
