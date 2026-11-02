from rest_framework import serializers

from apps.accounts.models.user import User
from apps.hackathons.models.application import (
    ApplicationStatus,
    HackathonApplication,
    ParticipationMode,
)


class ApplicantUserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "avatar_url",
        ]

    def get_avatar_url(self, obj) -> str | None:
        try:
            if hasattr(obj, "profile") and obj.profile:
                return obj.profile.avatar_url
        except Exception:
            pass
        return None

    def get_full_name(self, obj) -> str:
        full = f"{obj.first_name or ''} {obj.last_name or ''}".strip()
        return full or obj.username


class HackathonApplicationSerializer(serializers.ModelSerializer):
    applicant = ApplicantUserSerializer(read_only=True)
    hackathon_title = serializers.CharField(source="hackathon.title", read_only=True)
    hackathon_slug = serializers.CharField(source="hackathon.slug", read_only=True)

    class Meta:
        model = HackathonApplication
        fields = [
            "id",
            "hackathon",
            "hackathon_title",
            "hackathon_slug",
            "applicant",
            "participation_mode",
            "team_name",
            "answers",
            "status",
            "rejection_reason",
            "reviewed_at",
            "terms_accepted",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "hackathon",
            "hackathon_title",
            "hackathon_slug",
            "applicant",
            "status",
            "rejection_reason",
            "reviewed_at",
            "created_at",
        ]


class HackathonApplyRequestSerializer(serializers.Serializer):
    participation_mode = serializers.ChoiceField(
        choices=ParticipationMode.choices,
        default=ParticipationMode.INDIVIDUAL,
        help_text="Mode de participation ('individual' ou 'team')",
    )
    team_name = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Nom souhaité de l'équipe (si mode équipe)",
    )
    answers = serializers.DictField(
        required=False,
        default=dict,
        help_text="Réponses aux questions personnalisées sous forme de dictionnaire clé/valeur",
    )
    accept_terms = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Confirmation de l'acceptation du règlement et des conditions",
    )
    terms_accepted = serializers.BooleanField(
        required=False,
        allow_null=True,
        help_text="Alias de accept_terms",
    )

    def validate(self, attrs):
        terms_val = attrs.get("terms_accepted")
        if terms_val is not None:
            accepted = bool(terms_val)
        else:
            accepted = bool(attrs.get("accept_terms", True))
        if not accepted:
            raise serializers.ValidationError(
                {"accept_terms": "Vous devez accepter le règlement pour candidater."}
            )
        attrs["accept_terms"] = True
        return attrs


class ApplicationReviewRequestSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            ApplicationStatus.ACCEPTED,
            ApplicationStatus.REJECTED,
            ApplicationStatus.WAITLISTED,
        ],
        help_text="Décision de l'organisateur ('accepted', 'rejected', 'waitlisted')",
    )
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Motif du refus si la candidature est rejetée",
    )
