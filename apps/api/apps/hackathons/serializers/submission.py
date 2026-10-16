from rest_framework import serializers

from apps.accounts.models.user import User
from apps.hackathons.models.submission import (
    HackathonSubmission,
    HackathonSubmissionFile,
    SubmissionFileType,
)
from apps.profiles.models.technology import Technology


class SubmissionUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]


class SubmissionTechnologySerializer(serializers.ModelSerializer):
    class Meta:
        model = Technology
        fields = ["id", "name", "slug"]


class HackathonSubmissionFileSerializer(serializers.ModelSerializer):
    uploaded_by = SubmissionUserSerializer(read_only=True)

    class Meta:
        model = HackathonSubmissionFile
        fields = [
            "id",
            "file_name",
            "file_url",
            "file_size",
            "mime_type",
            "file_type",
            "uploaded_by",
            "created_at",
        ]


class HackathonSubmissionListSerializer(serializers.ModelSerializer):
    applicant = SubmissionUserSerializer(read_only=True)
    team_name = serializers.CharField(source="team.name", default="", read_only=True)
    technologies = SubmissionTechnologySerializer(many=True, read_only=True)
    files_count = serializers.IntegerField(source="files.count", read_only=True)

    class Meta:
        model = HackathonSubmission
        fields = [
            "id",
            "hackathon",
            "team",
            "team_name",
            "applicant",
            "title",
            "slug",
            "tagline",
            "demo_url",
            "video_url",
            "repository_url",
            "gitlab_url",
            "technologies",
            "status",
            "is_final",
            "submitted_at",
            "total_score",
            "evaluations_count",
            "rank",
            "files_count",
        ]


class HackathonSubmissionDetailSerializer(serializers.ModelSerializer):
    applicant = SubmissionUserSerializer(read_only=True)
    team_name = serializers.CharField(source="team.name", default="", read_only=True)
    technologies = SubmissionTechnologySerializer(many=True, read_only=True)
    files = HackathonSubmissionFileSerializer(many=True, read_only=True)

    class Meta:
        model = HackathonSubmission
        fields = [
            "id",
            "hackathon",
            "team",
            "team_name",
            "applicant",
            "title",
            "slug",
            "tagline",
            "description",
            "problem_statement",
            "solution_statement",
            "target_audience",
            "technologies",
            "demo_url",
            "video_url",
            "repository_url",
            "gitlab_url",
            "extra_links",
            "custom_answers",
            "files",
            "status",
            "is_final",
            "submitted_at",
            "total_score",
            "evaluations_count",
            "rank",
            "created_at",
            "updated_at",
        ]


class HackathonSubmissionUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(
        max_length=255,
        required=False,
        help_text="Nom du projet",
    )
    tagline = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Slogan ou présentation en une phrase",
    )
    description = serializers.CharField(
        required=False,
        help_text="Description complète de la solution développée",
    )
    problem_statement = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Problème ciblé et contexte",
    )
    solution_statement = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Solution apportée et impact attendu",
    )
    target_audience = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Public cible de la solution",
    )
    technology_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        help_text="Liste des UUIDs des technologies utilisées",
    )
    demo_url = serializers.URLField(
        required=False,
        allow_blank=True,
        help_text="URL de la démo en ligne",
    )
    video_url = serializers.URLField(
        required=False,
        allow_blank=True,
        help_text="URL de la vidéo de démonstration (YouTube, Loom)",
    )
    repository_url = serializers.URLField(
        required=False,
        allow_blank=True,
        help_text="URL du dépôt GitHub",
    )
    gitlab_url = serializers.URLField(
        required=False,
        allow_blank=True,
        help_text="URL du dépôt GitLab",
    )
    extra_links = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text="Liens additionnels [{type, label, url}]",
    )
    custom_answers = serializers.DictField(
        required=False,
        help_text="Réponses aux questions spécifiques du hackathon",
    )


class AttachFileRequestSerializer(serializers.Serializer):
    file = serializers.FileField(
        required=False,
        help_text="Fichier binaire à uploader (PDF de présentation, capture d'écran, ZIP, doc technique)",
    )
    file_name = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        help_text="Nom original du fichier (déduit automatiquement si un fichier binaire est fourni)",
    )
    file_url = serializers.URLField(
        max_length=1000,
        required=False,
        allow_blank=True,
        help_text="URL sécurisée du fichier (S3 / UploadThing - optionnel si un fichier est uploadé directement)",
    )
    file_size = serializers.IntegerField(
        min_value=1,
        required=False,
        help_text="Taille en octets (calculée automatiquement si un fichier est fourni)",
    )
    mime_type = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        help_text="Type MIME du fichier (déduit automatiquement si un fichier est fourni)",
    )
    file_type = serializers.ChoiceField(
        choices=SubmissionFileType.choices,
        default=SubmissionFileType.OTHER,
        help_text="Type fonctionnel de pièce jointe (presentation_pdf, screenshot, technical_doc, archive, other)",
    )

    def validate(self, attrs):
        uploaded_file = attrs.get("file")
        file_url = attrs.get("file_url")

        if not uploaded_file and not file_url:
            raise serializers.ValidationError(
                "Vous devez soit fournir un fichier ('file'), soit une URL de fichier ('file_url')."
            )
        return attrs
