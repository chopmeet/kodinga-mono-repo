from rest_framework import serializers

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.gamification.models.badge import Badge, UserBadge
from apps.gamification.models.reputation import (
    ReputationTransaction,
    UserReputation,
)


class GamificationCommunitySimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Community
        fields = ["id", "name", "slug", "avatar_url"]


class GamificationUserSimpleSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "name",
            "avatar_url",
        ]

    def get_name(self, obj) -> str:
        return obj.get_full_name() or obj.username

    def get_avatar_url(self, obj) -> str:
        return getattr(getattr(obj, "profile", None), "avatar_url", "") or ""


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = [
            "id",
            "slug",
            "name",
            "description",
            "icon_url",
            "category",
            "points_reward",
            "created_at",
        ]


class UserBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer(read_only=True)
    community = GamificationCommunitySimpleSerializer(read_only=True)

    class Meta:
        model = UserBadge
        fields = [
            "id",
            "badge",
            "community",
            "awarded_at",
        ]


class ReputationTransactionSerializer(serializers.ModelSerializer):
    community_name = serializers.CharField(
        source="community.name", read_only=True, default=None
    )

    class Meta:
        model = ReputationTransaction
        fields = [
            "id",
            "action",
            "points",
            "description",
            "community_name",
            "created_at",
        ]


class UserReputationSerializer(serializers.ModelSerializer):
    user = GamificationUserSimpleSerializer(read_only=True)
    badges_count = serializers.SerializerMethodField()

    class Meta:
        model = UserReputation
        fields = [
            "user",
            "total_points",
            "level",
            "rank_title",
            "current_streak_days",
            "last_activity_date",
            "badges_count",
        ]

    def get_badges_count(self, obj) -> int:
        return UserBadge.objects.filter(user=obj.user).count()


class LeaderboardEntrySerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    user = GamificationUserSimpleSerializer()
    points = serializers.IntegerField()
    level = serializers.IntegerField()
    rank_title = serializers.CharField()
