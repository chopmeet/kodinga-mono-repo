from rest_framework import serializers

from apps.accounts.models.user import User
from apps.hackathons.models.application import (
    ApplicationStatus,
    HackathonApplication,
    ParticipationMode,
)


class ApplicantUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]


class HackathonApplicationSerializer(serializers.ModelSerializer):
    applicant = ApplicantUserSerializer(read_only=True)
    hackathon_title = serializers.CharField(source="hackathon.title", read_only=True)

    class Meta:
        model = HackathonApplication
        fields = [
            "id",
            "hackathon",
            "hackathon_title",
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
        required=True,
        help_text="Confirmation de l'acceptation du règlement et des conditions",
    )

    def validate_accept_terms(self, value):
        if not value:
            raise serializers.ValidationError("Vous devez accepter le règlement pour candidater.")
        return value


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
