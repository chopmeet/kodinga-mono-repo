from django.contrib import admin

from apps.media.models.media_asset import MediaAsset
from apps.media.models.video_asset import VideoAsset


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ['file_name', 'user', 'purpose', 'mime_type', 'file_size', 'status', 'provider', 'created_at']
    list_filter = ['purpose', 'status', 'provider']
    search_fields = ['file_name', 'file_key', 'user__username', 'user__email']
    readonly_fields = ['file_key', 'created_at', 'updated_at']


@admin.register(VideoAsset)
class VideoAssetAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'status', 'duration', 'aspect_ratio', 'resolution', 'is_public', 'created_at']
    list_filter = ['status', 'is_public', 'provider']
    search_fields = ['title', 'upload_id', 'asset_id', 'playback_id', 'user__username']
    readonly_fields = ['upload_id', 'asset_id', 'playback_id', 'hls_url', 'thumbnail_url', 'created_at', 'updated_at']
