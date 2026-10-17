from rest_framework import serializers

from apps.hackathons.models.prize import HackathonPrize


class HackathonPrizeSerializer(serializers.ModelSerializer):
    winner_submission_title = serializers.CharField(
        source="winner_submission.title", read_only=True
    )

    class Meta:
        model = HackathonPrize
        fields = [
            "id",
            "title",
            "description",
            "reward_amount",
            "reward_currency",
            "reward_description",
            "rank",
            "display_order",
            "winner_submission",
            "winner_submission_title",
        ]
