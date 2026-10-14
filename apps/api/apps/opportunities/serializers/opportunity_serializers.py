from rest_framework import serializers

from apps.accounts.models.user import User
from apps.opportunities.models.application import (
    ApplicationStatus,
    OpportunityApplication,
)
from apps.opportunities.models.opportunity import (
    ExperienceLevel,
    Opportunity,
    OpportunityStatus,
    OpportunityType,
    WorkplaceType,
)
from apps.profiles.models.technology import Technology


class OpportunityPosterSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "avatar_url"]

    def get_avatar_url(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.avatar_url if profile else ""


class OpportunityTechnologySerializer(serializers.ModelSerializer):
    class Meta:
        model = Technology
        fields = ["id", "name", "slug", "icon_url"]


class OpportunitySerializer(serializers.ModelSerializer):
    poster = OpportunityPosterSerializer(read_only=True)
    technologies = OpportunityTechnologySerializer(many=True, read_only=True)
    has_applied = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Opportunity
        fields = [
            "id",
            "title",
            "slug",
            "company_name",
            "company_logo_url",
            "company_website",
            "opportunity_type",
            "workplace_type",
            "location",
            "salary_min",
            "salary_max",
            "currency",
            "experience_level",
            "status",
            "views_count",
            "applications_count",
            "expires_at",
            "has_applied",
            "poster",
            "technologies",
            "created_at",
        ]


class OpportunityDetailSerializer(serializers.ModelSerializer):
    poster = OpportunityPosterSerializer(read_only=True)
    technologies = OpportunityTechnologySerializer(many=True, read_only=True)
    has_applied = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Opportunity
        fields = [
            "id",
            "title",
            "slug",
            "company_name",
            "company_logo_url",
            "company_website",
            "opportunity_type",
            "workplace_type",
            "location",
            "salary_min",
            "salary_max",
            "currency",
            "experience_level",
            "description",
            "requirements",
            "apply_url",
            "apply_email",
            "status",
            "views_count",
            "applications_count",
            "expires_at",
            "has_applied",
            "community_id",
            "poster",
            "technologies",
            "created_at",
            "updated_at",
        ]


class CreateOpportunitySerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=True)
    company_name = serializers.CharField(max_length=255, required=True)
    company_logo_url = serializers.URLField(required=False, allow_blank=True, default="")
    company_website = serializers.URLField(required=False, allow_blank=True, default="")
    opportunity_type = serializers.ChoiceField(
        choices=OpportunityType.choices, default=OpportunityType.FULL_TIME
    )
    workplace_type = serializers.ChoiceField(
        choices=WorkplaceType.choices, default=WorkplaceType.REMOTE
    )
    location = serializers.CharField(max_length=255, required=False, default="Remote")
    salary_min = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    salary_max = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    currency = serializers.CharField(max_length=10, default="XOF")
    experience_level = serializers.ChoiceField(
        choices=ExperienceLevel.choices, default=ExperienceLevel.ALL
    )
    description = serializers.CharField(required=True)
    requirements = serializers.CharField(required=False, allow_blank=True, default="")
    apply_url = serializers.URLField(required=False, allow_blank=True, default="")
    apply_email = serializers.EmailField(required=False, allow_blank=True, default="")
    status = serializers.ChoiceField(
        choices=OpportunityStatus.choices, default=OpportunityStatus.OPEN
    )
    community_id = serializers.UUIDField(required=False, allow_null=True)
    technology_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )


class OpportunityApplicationSerializer(serializers.ModelSerializer):
    applicant = OpportunityPosterSerializer(read_only=True)
    opportunity = OpportunitySerializer(read_only=True)

    class Meta:
        model = OpportunityApplication
        fields = [
            "id",
            "opportunity",
            "applicant",
            "resume_url",
            "cover_letter",
            "portfolio_url",
            "status",
            "created_at",
            "updated_at",
        ]


class CreateApplicationSerializer(serializers.Serializer):
    resume_url = serializers.URLField(required=False, allow_blank=True, default="")
    cover_letter = serializers.CharField(required=False, allow_blank=True, default="")
    portfolio_url = serializers.URLField(required=False, allow_blank=True, default="")


class UpdateApplicationStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=ApplicationStatus.choices)
