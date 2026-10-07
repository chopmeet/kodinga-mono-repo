from rest_framework import serializers
from common.serializers.base import BaseModelSerializer
from apps.posts.models.poll import Poll, PollOption, PollVote


class PollOptionSerializer(BaseModelSerializer):
    percentage = serializers.FloatField(read_only=True)

    class Meta:
        model = PollOption
        fields = ['id', 'text', 'votes_count', 'percentage', 'order']
        read_only_fields = ['id', 'votes_count', 'percentage']


class PollSerializer(BaseModelSerializer):
    options = PollOptionSerializer(many=True, read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    user_has_voted = serializers.SerializerMethodField()
    user_voted_option_ids = serializers.SerializerMethodField()

    class Meta:
        model = Poll
        fields = [
            'id',
            'question',
            'is_multiple_choice',
            'expires_at',
            'total_votes',
            'is_expired',
            'options',
            'user_has_voted',
            'user_voted_option_ids',
        ]
        read_only_fields = ['id', 'total_votes', 'is_expired', 'options', 'user_has_voted', 'user_voted_option_ids']

    def get_user_has_voted(self, obj) -> bool:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return PollVote.objects.filter(option__poll=obj, user=request.user).exists()

    def get_user_voted_option_ids(self, obj) -> list:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return []
        return list(PollVote.objects.filter(option__poll=obj, user=request.user).values_list('option_id', flat=True))


class VotePollRequestSerializer(serializers.Serializer):
    option_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1
    )
