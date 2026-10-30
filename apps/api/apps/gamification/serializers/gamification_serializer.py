from rest_framework import serializers

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.gamification.models.badge import Badge, UserBadge
from apps.gamification.models.reputation import (
    CATALOG_BY_ACTION,
    CommunityPointRule,
    CommunityPointRuleAuditLog,
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
    headline = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "name",
            "avatar_url",
            "headline",
        ]

    def get_name(self, obj) -> str:
        return obj.get_full_name() or obj.username

    def get_avatar_url(self, obj) -> str:
        return getattr(getattr(obj, "profile", None), "avatar_url", "") or ""

    def get_headline(self, obj) -> str:
        return getattr(getattr(obj, "profile", None), "headline", "") or ""


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
    user = GamificationUserSimpleSerializer(read_only=True)
    community_id = serializers.UUIDField(
        source="community.id", read_only=True, default=None
    )
    community_name = serializers.CharField(
        source="community.name", read_only=True, default=None
    )
    community_slug = serializers.CharField(
        source="community.slug", read_only=True, default=None
    )
    action_label = serializers.CharField(
        source="get_action_display", read_only=True
    )
    source_label = serializers.CharField(
        source="get_source_display", read_only=True
    )
    awarded_by = GamificationUserSimpleSerializer(read_only=True)

    class Meta:
        model = ReputationTransaction
        fields = [
            "id",
            "user",
            "community_id",
            "community_name",
            "community_slug",
            "action",
            "action_label",
            "reference_type",
            "reference_id",
            "points",
            "source",
            "source_label",
            "awarded_by",
            "description",
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
    rank = serializers.IntegerField(allow_null=True)
    position = serializers.IntegerField(required=False, allow_null=True)
    is_tied = serializers.BooleanField(required=False, default=False)
    user = GamificationUserSimpleSerializer()
    points = serializers.IntegerField()
    level = serializers.IntegerField()
    rank_title = serializers.CharField()
    activities_count = serializers.IntegerField(required=False, default=0)
    role = serializers.CharField(required=False, allow_null=True)
    custom_title = serializers.CharField(required=False, allow_blank=True)


class MemberLeaderboardPositionSerializer(serializers.Serializer):
    community_id = serializers.CharField()
    community_slug = serializers.CharField()
    rank = serializers.IntegerField(allow_null=True)
    position = serializers.IntegerField(allow_null=True)
    is_tied = serializers.BooleanField()
    points = serializers.IntegerField()
    level = serializers.IntegerField()
    rank_title = serializers.CharField()
    activities_count = serializers.IntegerField()
    total_ranked_members = serializers.IntegerField()
    points_to_next_rank = serializers.IntegerField()
    surrounding_entries = LeaderboardEntrySerializer(many=True)


class ActionBreakdownItemSerializer(serializers.Serializer):
    action = serializers.CharField()
    action_label = serializers.CharField()
    points = serializers.IntegerField()
    count = serializers.IntegerField()


class MemberCommunityPointsSerializer(serializers.Serializer):
    user = GamificationUserSimpleSerializer()
    community_id = serializers.CharField()
    community_slug = serializers.CharField()
    community_name = serializers.CharField()
    total_points = serializers.IntegerField()
    level = serializers.IntegerField()
    rank_title = serializers.CharField()
    rank = serializers.IntegerField(allow_null=True)
    position = serializers.IntegerField(allow_null=True)
    is_tied = serializers.BooleanField()
    total_ranked_members = serializers.IntegerField()
    points_to_next_rank = serializers.IntegerField()
    transactions_count = serializers.IntegerField()
    breakdown_by_action = ActionBreakdownItemSerializer(many=True)


class CommunityPointRuleSerializer(serializers.ModelSerializer):
    default_points = serializers.SerializerMethodField()
    updated_by = GamificationUserSimpleSerializer(read_only=True)

    class Meta:
        model = CommunityPointRule
        fields = [
            "id",
            "action",
            "label",
            "description",
            "points",
            "default_points",
            "is_active",
            "allow_multiple_per_reference",
            "updated_by",
            "updated_at",
        ]

    def get_default_points(self, obj) -> int:
        cat = CATALOG_BY_ACTION.get(obj.action)
        return int(cat["default_points"]) if cat else obj.points


class CommunityPointRuleUpdateSerializer(serializers.Serializer):
    points = serializers.IntegerField(required=False, min_value=0)
    is_active = serializers.BooleanField(required=False)
    allow_multiple_per_reference = serializers.BooleanField(required=False)
    note = serializers.CharField(
        required=False, allow_blank=True, max_length=255
    )

    def validate(self, attrs):
        if (
            "points" not in attrs
            and "is_active" not in attrs
            and "allow_multiple_per_reference" not in attrs
        ):
            raise serializers.ValidationError(
                "Veuillez fournir au moins 'points' ou 'is_active'."
            )
        return attrs


class CommunityPointRuleBulkItemSerializer(serializers.Serializer):
    action = serializers.CharField()
    points = serializers.IntegerField(required=False, min_value=0)
    is_active = serializers.BooleanField(required=False)
    allow_multiple_per_reference = serializers.BooleanField(required=False)
    note = serializers.CharField(
        required=False, allow_blank=True, max_length=255
    )


class CommunityPointRuleBulkUpdateSerializer(serializers.Serializer):
    rules = CommunityPointRuleBulkItemSerializer(many=True, allow_empty=False)
    note = serializers.CharField(
        required=False, allow_blank=True, max_length=255
    )


class CommunityPointRuleAuditLogSerializer(serializers.ModelSerializer):
    changed_by = GamificationUserSimpleSerializer(read_only=True)
    action_label = serializers.CharField(
        source="get_action_display", read_only=True
    )

    class Meta:
        model = CommunityPointRuleAuditLog
        fields = [
            "id",
            "action",
            "action_label",
            "previous_points",
            "new_points",
            "previous_is_active",
            "new_is_active",
            "note",
            "changed_by",
            "created_at",
        ]


class ManualPointsAdjustmentRequestSerializer(serializers.Serializer):
    user_id = serializers.UUIDField(
        help_text="Identifiant UUID du membre concerné par l'ajustement"
    )
    points = serializers.IntegerField(
        help_text="Nombre de points à ajouter (positif) ou retirer (négatif). Différent de 0."
    )
    reason = serializers.CharField(
        max_length=255,
        allow_blank=False,
        help_text="Motif obligatoire justifiant l'ajustement manuel des points.",
    )

    def validate_points(self, value: int) -> int:
        if value == 0:
            raise serializers.ValidationError(
                "Le nombre de points doit être différent de 0."
            )
        return value

    def validate_reason(self, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Le motif est obligatoire.")
        return cleaned


class CommunityStatsActionBreakdownSerializer(serializers.Serializer):
    action = serializers.CharField()
    action_label = serializers.CharField()
    total_points = serializers.IntegerField()
    transactions_count = serializers.IntegerField()
    unique_members_count = serializers.IntegerField()


class CommunityGamificationStatsSerializer(serializers.Serializer):
    community_id = serializers.CharField()
    community_slug = serializers.CharField()
    community_name = serializers.CharField()
    total_points_awarded = serializers.IntegerField()
    positive_points_awarded = serializers.IntegerField()
    manual_adjustments_net = serializers.IntegerField()
    total_transactions_count = serializers.IntegerField()
    active_rewarded_members_count = serializers.IntegerField()
    total_community_members_count = serializers.IntegerField()
    average_points_per_rewarded_member = serializers.FloatField()
    breakdown_by_action = CommunityStatsActionBreakdownSerializer(many=True)
    top_3_members = LeaderboardEntrySerializer(many=True)
