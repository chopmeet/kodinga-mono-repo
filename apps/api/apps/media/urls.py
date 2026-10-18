from django.urls import path

from apps.media.views.media import (
    ConfirmUploadView,
    MediaAssetDetailView,
    MediaAssetListView,
    PresignedUploadView,
)
from apps.media.views.video import (
    MuxDirectUploadView,
    VideoAssetDetailView,
    VideoAssetListView,
)
from apps.media.views.webhooks import MuxWebhookView

app_name = 'media'

urlpatterns = [
    # Static & Document Assets (UploadThing / Storage)
    path('media/upload-url/', PresignedUploadView.as_view(), name='media_upload_url'),
    path('media/confirm-upload/', ConfirmUploadView.as_view(), name='media_confirm_upload'),
    path('media/assets/', MediaAssetListView.as_view(), name='media_assets_list'),
    path('media/assets/<uuid:asset_id>/', MediaAssetDetailView.as_view(), name='media_asset_detail'),

    # Video Management & Streaming (Mux)
    path('media/videos/upload-url/', MuxDirectUploadView.as_view(), name='mux_upload_url'),
    path('media/videos/', VideoAssetListView.as_view(), name='video_assets_list'),
    path('media/videos/<uuid:video_id>/', VideoAssetDetailView.as_view(), name='video_asset_detail'),

    # Mux Webhook
    path('media/mux/webhook/', MuxWebhookView.as_view(), name='mux_webhook'),
]
