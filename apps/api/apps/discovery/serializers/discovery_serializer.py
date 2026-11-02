from apps.classroom.models.course import Course
from apps.communities.models.community import Community
from apps.events.models.event import Event
from apps.posts.models.post import Post
from apps.profiles.models.profile import DeveloperProfile
from rest_framework import serializers


class DiscoveryCommunitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Community
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "avatar_url",
            "banner_url",
            "members_count",
            "pricing_type",
        ]


class DiscoveryCourseSerializer(serializers.ModelSerializer):
    community_slug = serializers.CharField(
        source="community.slug", read_only=True
    )
    community_name = serializers.CharField(
        source="community.name", read_only=True
    )
    students_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "thumbnail_url",
            "level",
            "lessons_count",
            "duration_seconds",
            "students_count",
            "community_slug",
            "community_name",
        ]

    def get_students_count(self, obj) -> int:
        if hasattr(obj, "students_count"):
            return obj.students_count
        try:
            return obj.enrollments.count()
        except Exception:
            return 0


class DiscoveryEventSerializer(serializers.ModelSerializer):
    community_slug = serializers.CharField(
        source="community.slug", read_only=True
    )
    community_name = serializers.CharField(
        source="community.name", read_only=True
    )

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "cover_image_url",
            "event_type",
            "format",
            "status",
            "start_time",
            "end_time",
            "timezone",
            "attendees_count",
            "community_slug",
            "community_name",
        ]


class DiscoveryDeveloperSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = DeveloperProfile
        fields = [
            "id",
            "username",
            "full_name",
            "avatar_url",
            "headline",
            "bio",
            "years_of_experience",
            "availability_status",
        ]

    def get_full_name(self, obj) -> str:
        return obj.user.get_full_name() or obj.user.username


class DiscoveryPostSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(
        source="author.username", read_only=True
    )
    community_slug = serializers.CharField(
        source="community.slug", read_only=True
    )

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "content",
            "post_type",
            "author_username",
            "community_slug",
            "reactions_count",
            "comments_count",
            "created_at",
        ]


class DiscoverySearchResponseSerializer(serializers.Serializer):
    communities = DiscoveryCommunitySerializer(many=True)
    courses = DiscoveryCourseSerializer(many=True)
    events = DiscoveryEventSerializer(many=True)
    developers = DiscoveryDeveloperSerializer(many=True)
    posts = DiscoveryPostSerializer(many=True)


class DiscoveryTrendingResponseSerializer(serializers.Serializer):
    communities = DiscoveryCommunitySerializer(many=True)
    courses = DiscoveryCourseSerializer(many=True)
    events = DiscoveryEventSerializer(many=True)


class DiscoveryRecommendationsResponseSerializer(serializers.Serializer):
    matched_technologies = serializers.ListField(
        child=serializers.CharField()
    )
    recommended_communities = DiscoveryCommunitySerializer(many=True)
    recommended_courses = DiscoveryCourseSerializer(many=True)
