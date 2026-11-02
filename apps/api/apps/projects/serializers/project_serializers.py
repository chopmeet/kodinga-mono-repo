from apps.accounts.models.user import User
from apps.profiles.models.technology import Technology
from apps.projects.models.comment import ProjectComment
from apps.projects.models.project import Project, ProjectStatus
from rest_framework import serializers


class ProjectOwnerSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    headline = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "avatar_url", "headline"]

    def get_avatar_url(self, obj) -> str:
        profile = getattr(obj, "profile", None)
        return profile.avatar_url if profile else ""

    def get_headline(self, obj) -> str:
        profile = getattr(obj, "profile", None)
        return profile.headline if profile else ""


class ProjectTechnologySerializer(serializers.ModelSerializer):
    class Meta:
        model = Technology
        fields = ["id", "name", "slug", "icon_url"]


class ProjectSerializer(serializers.ModelSerializer):
    owner = ProjectOwnerSerializer(read_only=True)
    technologies = ProjectTechnologySerializer(many=True, read_only=True)
    is_upvoted = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Project
        fields = [
            "id",
            "title",
            "slug",
            "tagline",
            "cover_image_url",
            "demo_images",
            "demo_url",
            "repository_url",
            "status",
            "upvotes_count",
            "views_count",
            "is_featured",
            "is_upvoted",
            "owner",
            "technologies",
            "created_at",
        ]


class ProjectDetailSerializer(serializers.ModelSerializer):
    owner = ProjectOwnerSerializer(read_only=True)
    technologies = ProjectTechnologySerializer(many=True, read_only=True)
    is_upvoted = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Project
        fields = [
            "id",
            "title",
            "slug",
            "tagline",
            "description",
            "cover_image_url",
            "demo_images",
            "demo_url",
            "repository_url",
            "status",
            "upvotes_count",
            "views_count",
            "is_featured",
            "is_upvoted",
            "community_id",
            "owner",
            "technologies",
            "created_at",
            "updated_at",
        ]


class CreateProjectSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=True)
    tagline = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    cover_image_url = serializers.URLField(required=False, allow_blank=True, default="")
    demo_images = serializers.ListField(
        child=serializers.URLField(max_length=1000), required=False, default=list
    )
    demo_url = serializers.URLField(required=False, allow_blank=True, default="")
    repository_url = serializers.URLField(required=False, allow_blank=True, default="")
    community_id = serializers.UUIDField(required=False, allow_null=True)
    status = serializers.ChoiceField(choices=ProjectStatus.choices, default=ProjectStatus.PUBLISHED)
    technology_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )


class ProjectCommentReplySerializer(serializers.ModelSerializer):
    author = ProjectOwnerSerializer(read_only=True)

    class Meta:
        model = ProjectComment
        fields = ["id", "author", "content", "created_at"]


class ProjectCommentSerializer(serializers.ModelSerializer):
    author = ProjectOwnerSerializer(read_only=True)
    replies = ProjectCommentReplySerializer(many=True, read_only=True)

    class Meta:
        model = ProjectComment
        fields = ["id", "author", "content", "parent_id", "replies", "created_at"]


class CreateProjectCommentSerializer(serializers.Serializer):
    content = serializers.CharField(required=True, min_length=1, help_text="Contenu du commentaire")
    parent_id = serializers.UUIDField(required=False, allow_null=True, help_text="ID du commentaire parent en cas de réponse")


class ProjectUpvoteResponseSerializer(serializers.Serializer):
    is_upvoted = serializers.BooleanField()
    upvotes_count = serializers.IntegerField()

