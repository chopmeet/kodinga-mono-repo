from rest_framework import serializers

from apps.accounts.models.user import User
from apps.hackathons.models.judge import HackathonJudge


class JudgeUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]


class HackathonJudgeSerializer(serializers.ModelSerializer):
    user = JudgeUserSerializer(read_only=True)
    user_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = HackathonJudge
        fields = [
            "id",
            "user",
            "user_id",
            "can_evaluate_all",
            "created_at",
        ]


class AssignJudgesRequestSerializer(serializers.Serializer):
    user_ids = serializers.ListField(
        child=serializers.UUIDField(),
        help_text="Liste des UUIDs des utilisateurs à désigner comme jurés",
    )
