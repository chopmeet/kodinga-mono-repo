from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.hackathons.models.hackathon import Hackathon, HackathonFormat, HackathonStatus
from apps.hackathons.serializers.criterion import HackathonCriterionSerializer
from apps.hackathons.serializers.judge import HackathonJudgeSerializer
from apps.hackathons.serializers.prize import HackathonPrizeSerializer
from apps.profiles.models.technology import Technology


class HackathonOrganizerSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name"]


class HackathonCommunitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Community
        fields = ["id", "name", "slug", "avatar_url", "privacy_type"]


class HackathonTechnologySerializer(serializers.ModelSerializer):
    class Meta:
        model = Technology
        fields = ["id", "name", "slug"]


class HackathonListSerializer(serializers.ModelSerializer):
    community = HackathonCommunitySerializer(read_only=True)
    organizer = HackathonOrganizerSerializer(read_only=True)
    technologies = HackathonTechnologySerializer(many=True, read_only=True)
    prizes_count = serializers.IntegerField(source="prizes.count", read_only=True)
    participants_count = serializers.IntegerField(source="applications.count", read_only=True)

    class Meta:
        model = Hackathon
        fields = [
            "id",
            "community",
            "organizer",
            "title",
            "slug",
            "tagline",
            "cover_image_url",
            "format",
            "venue_city",
            "venue_country",
            "theme",
            "technologies",
            "main_language",
            "registration_start",
            "registration_end",
            "start_time",
            "submission_deadline",
            "judging_end",
            "results_announced_at",
            "timezone",
            "status",
            "is_registration_open",
            "is_submission_open",
            "results_published",
            "prizes_count",
            "participants_count",
            "created_at",
        ]


class HackathonDetailSerializer(serializers.ModelSerializer):
    community = HackathonCommunitySerializer(read_only=True)
    organizer = HackathonOrganizerSerializer(read_only=True)
    technologies = HackathonTechnologySerializer(many=True, read_only=True)
    prizes = HackathonPrizeSerializer(many=True, read_only=True)
    criteria = HackathonCriterionSerializer(many=True, read_only=True)
    judges = HackathonJudgeSerializer(source="judge_assignments", many=True, read_only=True)
    user_status = serializers.SerializerMethodField()

    class Meta:
        model = Hackathon
        fields = [
            "id",
            "community",
            "organizer",
            "title",
            "slug",
            "tagline",
            "description",
            "cover_image_url",
            "format",
            "venue_name",
            "venue_address",
            "venue_city",
            "venue_country",
            "location_url",
            "main_language",
            "theme",
            "technologies",
            "target_audience",
            "prerequisites",
            "rules_url",
            "terms_and_conditions",
            "registration_start",
            "registration_end",
            "start_time",
            "submission_deadline",
            "judging_end",
            "results_announced_at",
            "timezone",
            "is_member_only",
            "allow_teams",
            "min_team_size",
            "max_team_size",
            "max_participants",
            "auto_accept_applications",
            "custom_registration_questions",
            "require_demo_url",
            "require_video_url",
            "require_repo_url",
            "allowed_file_types",
            "max_file_size_mb",
            "max_files_count",
            "custom_submission_questions",
            "status",
            "is_registration_open",
            "is_submission_open",
            "results_published",
            "results_published_at",
            "prizes",
            "criteria",
            "judges",
            "user_status",
            "created_at",
            "updated_at",
        ]

    @extend_schema_field(serializers.DictField)
    def get_user_status(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None

        from apps.hackathons.selectors.hackathon_selector import HackathonSelector
        app = HackathonSelector.get_user_application(obj, request.user)
        team = HackathonSelector.get_user_team(obj, request.user)
        sub = HackathonSelector.get_user_submission(obj, request.user)
        is_judge = HackathonSelector.is_hackathon_judge(request.user, obj)
        is_mgr = HackathonSelector.is_community_manager(request.user, obj.community)

        return {
            "has_applied": bool(app),
            "application_status": app.status if app else None,
            "team_id": str(team.id) if team else None,
            "team_name": team.name if team else None,
            "has_submission": bool(sub),
            "submission_id": str(sub.id) if sub else None,
            "submission_is_final": sub.is_final if sub else False,
            "is_judge": is_judge,
            "is_manager": is_mgr,
        }


class PrizeInputSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    reward_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    reward_currency = serializers.CharField(max_length=10, default="XOF")
    reward_description = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )
    rank = serializers.IntegerField(default=1)


class CriterionInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    min_score = serializers.DecimalField(max_digits=5, decimal_places=2, default=0.0)
    max_score = serializers.DecimalField(max_digits=5, decimal_places=2, default=20.0)
    weight = serializers.DecimalField(max_digits=5, decimal_places=2, default=1.0)


class HackathonCreateUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    tagline = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    description = serializers.CharField()
    cover_image_url = serializers.URLField(required=False, allow_blank=True, default="")
    format = serializers.ChoiceField(
        choices=HackathonFormat.choices, default=HackathonFormat.ONLINE
    )
    venue_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    venue_address = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    venue_city = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    venue_country = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    location_url = serializers.URLField(required=False, allow_blank=True, default="")
    main_language = serializers.CharField(max_length=10, default="fr")
    theme = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    technology_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    target_audience = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    prerequisites = serializers.CharField(required=False, allow_blank=True, default="")
    rules_url = serializers.URLField(required=False, allow_blank=True, default="")
    terms_and_conditions = serializers.CharField(required=False, allow_blank=True, default="")

    registration_start = serializers.DateTimeField()
    registration_end = serializers.DateTimeField()
    start_time = serializers.DateTimeField()
    submission_deadline = serializers.DateTimeField()
    judging_end = serializers.DateTimeField()
    results_announced_at = serializers.DateTimeField(required=False, allow_null=True)
    timezone = serializers.CharField(max_length=50, default="UTC")

    is_member_only = serializers.BooleanField(default=False)
    allow_teams = serializers.BooleanField(default=True)
    min_team_size = serializers.IntegerField(default=1, min_value=1)
    max_team_size = serializers.IntegerField(default=4, min_value=1)
    max_participants = serializers.IntegerField(required=False, allow_null=True)
    auto_accept_applications = serializers.BooleanField(default=True)
    custom_registration_questions = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )

    require_demo_url = serializers.BooleanField(default=False)
    require_video_url = serializers.BooleanField(default=False)
    require_repo_url = serializers.BooleanField(default=True)
    allowed_file_types = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    max_file_size_mb = serializers.IntegerField(default=25, min_value=1)
    max_files_count = serializers.IntegerField(default=5, min_value=1)
    custom_submission_questions = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )

    prizes = serializers.ListField(child=PrizeInputSerializer(), required=False, default=list)
    criteria = serializers.ListField(child=CriterionInputSerializer(), required=False, default=list)


class LifecycleTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=HackathonStatus.choices,
        help_text="Nouveau statut cible du cycle de vie",
    )


class DashboardMetricsSerializer(serializers.Serializer):
    hackathon_id = serializers.CharField()
    status = serializers.CharField()
    total_applications = serializers.IntegerField()
    accepted_applications = serializers.IntegerField()
    pending_applications = serializers.IntegerField()
    total_teams = serializers.IntegerField()
    total_submissions = serializers.IntegerField()
    final_submissions = serializers.IntegerField()
    draft_submissions = serializers.IntegerField()
    judges_count = serializers.IntegerField()
    evaluations_completed = serializers.IntegerField()
    is_registration_open = serializers.BooleanField()
    is_submission_open = serializers.BooleanField()
    results_published = serializers.BooleanField()
