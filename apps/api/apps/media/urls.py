from django.urls import path

from apps.media.views.media import (
    BannerUploadView,
    ConfirmUploadView,
    DirectFileUploadView,
    MediaAssetDetailView,
    MediaAssetDownloadView,
    MediaAssetListView,
    PresignedUploadView,
)
from apps.media.views.video import (
    MuxDirectUploadView,
    VideoAssetDetailView,
    VideoAssetIngestView,
    VideoAssetListView,
)
from apps.media.views.webhooks import MuxWebhookView

app_name = "media"

urlpatterns = [
    # Static, Banner & Document Assets (UploadThing / Local Storage)
    path("media/upload-url/", PresignedUploadView.as_view(), name="media_upload_url"),
    path(
        "media/confirm-upload/",
        ConfirmUploadView.as_view(),
        name="media_confirm_upload",
    ),
    path("media/upload/", DirectFileUploadView.as_view(), name="media_direct_upload"),
    path("media/banners/", BannerUploadView.as_view(), name="media_banners"),
    path("media/assets/", MediaAssetListView.as_view(), name="media_assets_list"),
    path(
        "media/assets/<uuid:asset_id>/",
        MediaAssetDetailView.as_view(),
        name="media_asset_detail",
    ),
    path(
        "media/assets/<uuid:asset_id>/download/",
        MediaAssetDownloadView.as_view(),
        name="media_asset_download",
    ),
    # Video Management & Streaming (UploadThing + Mux)
    path(
        "media/videos/upload-url/", MuxDirectUploadView.as_view(), name="mux_upload_url"
    ),
    path(
        "media/videos/ingest/",
        VideoAssetIngestView.as_view(),
        name="video_asset_ingest",
    ),
    path("media/videos/", VideoAssetListView.as_view(), name="video_assets_list"),
    path(
        "media/videos/<uuid:video_id>/",
        VideoAssetDetailView.as_view(),
        name="video_asset_detail",
    ),
    # Mux Webhook
    path("media/mux/webhook/", MuxWebhookView.as_view(), name="mux_webhook"),
]
