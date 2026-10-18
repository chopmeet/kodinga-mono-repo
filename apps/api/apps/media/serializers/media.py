from rest_framework import serializers

from apps.media.models.media_asset import MediaAsset, MediaPurpose
from common.serializers.base import BaseModelSerializer


class MediaAssetSerializer(BaseModelSerializer):
    class Meta:
        model = MediaAsset
        fields = [
            'id',
            'file_name',
            'file_key',
            'file_url',
            'file_size',
            'mime_type',
            'provider',
            'purpose',
            'status',
            'metadata',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'file_key', 'provider', 'status', 'created_at', 'updated_at']


class PresignedUploadRequestSerializer(serializers.Serializer):
    file_name = serializers.CharField(max_length=255)
    file_size = serializers.IntegerField(min_value=1)
    mime_type = serializers.CharField(max_length=100)
    purpose = serializers.ChoiceField(choices=MediaPurpose.choices, default=MediaPurpose.GENERAL)


class ConfirmUploadRequestSerializer(serializers.Serializer):
    file_key = serializers.CharField(max_length=255)
    file_url = serializers.URLField(max_length=1000)
    file_size = serializers.IntegerField(min_value=1, required=False)
    metadata = serializers.DictField(required=False)
