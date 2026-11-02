from rest_framework import serializers

from apps.posts.models.poll import Poll, PollOption, PollVote
from common.serializers.base import BaseModelSerializer


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
        min_length=1,
        help_text="Identifiants des options sélectionnées."
    )


class PollInputSerializer(serializers.Serializer):
    question = serializers.CharField(
        max_length=255,
        required=False,
        help_text="Question du sondage (par défaut le titre du post)."
    )
    options = serializers.ListField(
        child=serializers.CharField(max_length=255),
        min_length=2,
        help_text="Liste des choix possibles (au moins 2 options requises)."
    )
    is_multiple_choice = serializers.BooleanField(
        required=False,
        default=False,
        help_text="Autorise les votes multiples si True."
    )
    duration_days = serializers.IntegerField(
        required=False,
        default=7,
        min_value=1,
        max_value=30,
        help_text="Durée de validité du sondage en jours (1 à 30 jours, défaut 7)."
    )
