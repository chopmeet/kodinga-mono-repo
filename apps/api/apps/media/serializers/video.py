from rest_framework import serializers

from apps.media.models.video_asset import VideoAsset
from common.serializers.base import BaseModelSerializer


class VideoAssetSerializer(BaseModelSerializer):
    hls_url = serializers.CharField(read_only=True)
    thumbnail_url = serializers.CharField(read_only=True)
    poster_url = serializers.CharField(read_only=True)
    animated_gif_url = serializers.CharField(read_only=True)

    class Meta:
        model = VideoAsset
        fields = [
            'id',
            'title',
            'description',
            'upload_id',
            'asset_id',
            'playback_id',
            'duration',
            'aspect_ratio',
            'resolution',
            'status',
            'is_public',
            'provider',
            'hls_url',
            'thumbnail_url',
            'poster_url',
            'animated_gif_url',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'upload_id',
            'asset_id',
            'playback_id',
            'duration',
            'aspect_ratio',
            'resolution',
            'status',
            'provider',
            'hls_url',
            'thumbnail_url',
            'poster_url',
            'animated_gif_url',
            'created_at',
            'updated_at',
        ]


class MuxUploadRequestSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    cors_origin = serializers.CharField(max_length=255, default='*')


class MuxUploadResponseSerializer(serializers.Serializer):
    video_asset_id = serializers.UUIDField()
    upload_id = serializers.CharField()
    upload_url = serializers.CharField()
    status = serializers.CharField()
