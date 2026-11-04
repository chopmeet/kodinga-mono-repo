from rest_framework import serializers

from apps.media.models.video_asset import VideoAsset
from common.serializers.base import BaseModelSerializer


class VideoAssetSerializer(BaseModelSerializer):
    hls_url = serializers.CharField(read_only=True)
    source_url = serializers.CharField(read_only=True)
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
            'source_url',
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
            'source_url',
            'thumbnail_url',
            'poster_url',
            'animated_gif_url',
            'created_at',
            'updated_at',
        ]


class VideoUploadRequestSerializer(serializers.Serializer):
    file = serializers.FileField(required=False, help_text="Fichier vidéo binaire (multipart/form-data)")
    file_url = serializers.URLField(required=False, allow_blank=True, help_text="URL brute UploadThing ou externe")
    video_url = serializers.URLField(required=False, allow_blank=True, help_text="Alias de file_url")
    title = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    description = serializers.CharField(required=False, allow_blank=True, default='')
    is_public = serializers.BooleanField(required=False, default=True)


class VideoIngestRequestSerializer(serializers.Serializer):
    file_url = serializers.URLField(required=True, help_text="URL du fichier vidéo hébergé sur UploadThing")
    title = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    description = serializers.CharField(required=False, allow_blank=True, default='')
    is_public = serializers.BooleanField(required=False, default=True)


class MuxUploadRequestSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    cors_origin = serializers.CharField(max_length=255, default='*')


class MuxUploadResponseSerializer(serializers.Serializer):
    video_asset_id = serializers.UUIDField()
    upload_id = serializers.CharField()
    upload_url = serializers.CharField()
    status = serializers.CharField()
