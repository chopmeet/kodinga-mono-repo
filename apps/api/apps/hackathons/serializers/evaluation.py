from rest_framework import serializers

from apps.accounts.models.user import User
from apps.hackathons.models.evaluation import (
    HackathonEvaluation,
    HackathonEvaluationScore,
)
from apps.hackathons.models.submission import HackathonSubmission
from apps.hackathons.serializers.prize import HackathonPrizeSerializer


class JudgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name"]


class HackathonEvaluationScoreSerializer(serializers.ModelSerializer):
    criterion_name = serializers.CharField(source="criterion.name", read_only=True)
    criterion_weight = serializers.DecimalField(
        source="criterion.weight", max_digits=5, decimal_places=2, read_only=True
    )

    class Meta:
        model = HackathonEvaluationScore
        fields = [
            "id",
            "criterion",
            "criterion_name",
            "criterion_weight",
            "score",
            "comment",
        ]


class HackathonEvaluationSerializer(serializers.ModelSerializer):
    judge = JudgeSerializer(read_only=True)
    scores = HackathonEvaluationScoreSerializer(many=True, read_only=True)
    submission_title = serializers.CharField(source="submission.title", read_only=True)

    class Meta:
        model = HackathonEvaluation
        fields = [
            "id",
            "submission",
            "submission_title",
            "judge",
            "weighted_score",
            "general_feedback",
            "private_notes",
            "is_submitted",
            "submitted_at",
            "scores",
        ]


class CriterionScoreInputSerializer(serializers.Serializer):
    criterion_id = serializers.UUIDField(help_text="UUID du critère de notation")
    score = serializers.DecimalField(
        max_digits=5, decimal_places=2, help_text="Note attribuée pour ce critère"
    )
    comment = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Commentaire explicatif optionnel pour ce critère",
    )


class SubmitEvaluationRequestSerializer(serializers.Serializer):
    scores = serializers.ListField(
        child=CriterionScoreInputSerializer(),
        help_text="Liste des notes par critère",
    )
    general_feedback = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Commentaires généraux et retours constructifs",
    )
    private_notes = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Notes confidentielles internes au jury et aux organisateurs",
    )
    is_submitted = serializers.BooleanField(
        default=True,
        help_text="True pour soumettre l'évaluation définitivement, False pour sauvegarder en brouillon",
    )


class LeaderboardItemSerializer(serializers.ModelSerializer):
    applicant_username = serializers.CharField(source="applicant.username", read_only=True)
    team_name = serializers.CharField(source="team.name", default="", read_only=True)
    won_prizes = HackathonPrizeSerializer(many=True, read_only=True)

    class Meta:
        model = HackathonSubmission
        fields = [
            "id",
            "title",
            "slug",
            "tagline",
            "applicant_username",
            "team_name",
            "demo_url",
            "video_url",
            "repository_url",
            "gitlab_url",
            "total_score",
            "evaluations_count",
            "rank",
            "won_prizes",
            "submitted_at",
        ]


class WinnerAssignmentSerializer(serializers.Serializer):
    prize_id = serializers.UUIDField(help_text="UUID du prix")
    submission_id = serializers.UUIDField(help_text="UUID du projet lauréat")


class PublishResultsRequestSerializer(serializers.Serializer):
    winners = serializers.ListField(
        child=WinnerAssignmentSerializer(),
        required=False,
        default=list,
        help_text="Attribution des prix aux projets gagnants",
    )
