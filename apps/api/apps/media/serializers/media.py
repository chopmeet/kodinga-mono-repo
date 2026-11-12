from rest_framework import serializers

from apps.media.models.media_asset import MediaAsset, MediaPurpose
from common.serializers.base import BaseModelSerializer


class MediaAssetSerializer(BaseModelSerializer):
    media_category = serializers.CharField(read_only=True)
    normalized_status = serializers.CharField(read_only=True)
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = [
            "id",
            "file_name",
            "file_key",
            "file_url",
            "download_url",
            "file_size",
            "mime_type",
            "media_category",
            "provider",
            "purpose",
            "status",
            "normalized_status",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "file_key",
            "download_url",
            "media_category",
            "provider",
            "status",
            "normalized_status",
            "created_at",
            "updated_at",
        ]

    def get_download_url(self, obj: MediaAsset) -> str:
        return f"/api/v1/media/assets/{obj.id}/download/"


class PresignedUploadRequestSerializer(serializers.Serializer):
    file_name = serializers.CharField(max_length=255)
    file_size = serializers.IntegerField(min_value=1)
    mime_type = serializers.CharField(max_length=100)
    purpose = serializers.ChoiceField(
        choices=MediaPurpose.choices, default=MediaPurpose.GENERAL
    )
    target_type = serializers.CharField(
        max_length=50, required=False, allow_blank=True, default=""
    )
    target_id = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )


class ConfirmUploadRequestSerializer(serializers.Serializer):
    file_key = serializers.CharField(max_length=255)
    file_url = serializers.URLField(max_length=1000)
    file_size = serializers.IntegerField(min_value=1, required=False)
    metadata = serializers.DictField(required=False)


class BannerUploadRequestSerializer(serializers.Serializer):
    target_type = serializers.ChoiceField(
        choices=["event", "hackathon", "course", "community", "profile"],
        required=False,
        allow_blank=True,
        default="",
        help_text="Type de ressource cible (event, hackathon, course, community, profile)",
    )
    target_id = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
        help_text="UUID ou slug de la ressource cible",
    )
    community_slug = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
        help_text="Slug de la communauté (optionnel)",
    )
