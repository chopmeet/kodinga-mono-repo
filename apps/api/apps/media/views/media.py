import logging

from django.core.files.storage import default_storage
from django.http import FileResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.media.models.media_asset import MediaAsset, MediaPurpose
from apps.media.models.video_asset import VideoAsset, VideoStatus
from apps.media.serializers.media import (
    BannerUploadRequestSerializer,
    ConfirmUploadRequestSerializer,
    MediaAssetSerializer,
    PresignedUploadRequestSerializer,
)
from apps.media.serializers.video import VideoAssetSerializer
from apps.media.services.mux_service import MuxVideoService
from apps.media.services.uploadthing_service import UploadThingService
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response

logger = logging.getLogger("kodinga.media")


class PresignedUploadView(APIView):
    """
    Generate presigned upload parameters for direct client upload (UploadThing / Storage).
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Media"],
        summary="Générer une URL pré-signée pour upload de document/image/vidéo",
        request=PresignedUploadRequestSerializer,
        responses={201: None},
    )
    def post(self, request):
        serializer = PresignedUploadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        upload_params = UploadThingService.generate_upload_url(
            user=request.user,
            file_name=data["file_name"],
            file_size=data["file_size"],
            mime_type=data["mime_type"],
            purpose=data.get("purpose", "general"),
            target_type=data.get("target_type", ""),
            target_id=data.get("target_id", ""),
        )
        return success_response(
            data=upload_params,
            message="Paramètres d'upload générés avec succès.",
            status_code=status.HTTP_201_CREATED,
        )


class ConfirmUploadView(APIView):
    """
    Confirm that the client has completed upload and make asset ready for use.
    If the asset is a video, automatically ingest into Mux for HLS streaming.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Media"],
        summary="Confirmer l'upload réussi d'un média (image, document, vidéo)",
        request=ConfirmUploadRequestSerializer,
        responses={200: MediaAssetSerializer},
    )
    def post(self, request):
        serializer = ConfirmUploadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        asset = UploadThingService.confirm_upload(
            user=request.user,
            file_key=data["file_key"],
            file_url=data["file_url"],
            file_size=data.get("file_size"),
            metadata=data.get("metadata"),
        )
        response_data = MediaAssetSerializer(asset).data

        # Si l'asset confirmé est une vidéo de leçon, créer/lier automatiquement la ressource Mux
        # (les vidéos de publications de posts restent 100% sur UploadThing sans Mux)
        if asset.purpose == MediaPurpose.LESSON_VIDEO or (
            asset.purpose != MediaPurpose.POST_VIDEO
            and asset.mime_type
            and asset.mime_type.startswith("video/")
        ):
            try:
                video_asset = VideoAsset.objects.filter(
                    metadata__source_url=asset.file_url
                ).first()
                if not video_asset:
                    video_asset = MuxVideoService.create_asset_from_url(
                        user=request.user,
                        input_url=asset.file_url,
                        title=asset.file_name,
                    )
                    v_asset_meta = (
                        video_asset.metadata
                        if isinstance(video_asset.metadata, dict)
                        else {}
                    )
                    if v_asset_meta.get("mux_fallback"):
                        video_asset.provider = "uploadthing"
                        video_asset.status = VideoStatus.READY
                        v_meta = dict(video_asset.metadata or {})
                        v_meta.update(
                            {
                                "media_asset_id": str(asset.id),
                                "file_key": asset.file_key,
                                "file_name": asset.file_name,
                                "file_size": asset.file_size,
                                "mime_type": asset.mime_type,
                                "source_url": asset.file_url,
                                "file_url": asset.file_url,
                                "source_provider": "uploadthing",
                            }
                        )
                        video_asset.metadata = v_meta
                        video_asset.save(
                            update_fields=["provider", "status", "metadata", "updated_at"]
                        )

                    asset_meta = dict(asset.metadata or {})
                    asset_meta["video_asset_id"] = str(video_asset.id)
                    asset.metadata = asset_meta
                    asset.save(update_fields=["metadata", "updated_at"])
                response_data["video_asset"] = VideoAssetSerializer(video_asset).data
            except Exception as exc:
                logger.warning("Auto Mux ingestion failed on confirm upload: %s", exc)

        return success_response(
            data=response_data, message="Média validé et disponible."
        )


class DirectFileUploadView(APIView):
    """
    POST /api/v1/media/upload/
    Direct multipart upload endpoint for images, documents, or videos.
    If uploading a video, it is stored on UploadThing and automatically ingests into Mux.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=["Media"],
        summary="Téléverser un fichier directement (multipart/form-data)",
        responses={201: None},
    )
    def post(self, request):
        files_list = request.FILES.getlist("files")
        file_obj = (
            request.FILES.get("file")
            or request.FILES.get("image")
            or request.FILES.get("video")
            or request.FILES.get("document")
            or (files_list[0] if len(files_list) == 1 else None)
        )
        if not file_obj and not files_list:
            return error_response(
                "Aucun fichier fourni ('file' ou 'files').",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        purpose = request.data.get("purpose", "general")

        # Multi-file upload support (e.g., multiple images or documents for a post)
        if len(files_list) > 1:
            max_batch = 10
            if len(files_list) > max_batch:
                return error_response(
                    f"Vous ne pouvez pas téléverser plus de {max_batch} fichiers simultanément.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )
            uploaded_items = []
            for f_obj in files_list:
                f_name = getattr(f_obj, "name", "upload.bin")
                f_mime = (
                    getattr(f_obj, "content_type", "application/octet-stream")
                    or "application/octet-stream"
                )
                item_res = UploadThingService.upload_file_direct(
                    user=request.user,
                    file_name=f_name,
                    mime_type=f_mime,
                    purpose=purpose,
                    file_obj=f_obj,
                )
                uploaded_items.append(item_res)
            return success_response(
                data={
                    "items": uploaded_items,
                    "count": len(uploaded_items),
                    "asset_ids": [item["asset_id"] for item in uploaded_items],
                },
                message=f"{len(uploaded_items)} fichiers téléversés avec succès.",
                status_code=status.HTTP_201_CREATED,
            )

        file_name = getattr(file_obj, "name", "upload.bin")
        mime_type = (
            getattr(file_obj, "content_type", "application/octet-stream")
            or "application/octet-stream"
        )

        res = UploadThingService.upload_file_direct(
            user=request.user,
            file_name=file_name,
            mime_type=mime_type,
            purpose=purpose,
            file_obj=file_obj,
        )

        # Ingestion automatique dans Mux pour les vidéos de cours
        # (les vidéos de posts restent 100% sur UploadThing sans Mux pour éviter le délai "processing")
        if purpose == "lesson_video" or (
            purpose not in ("post_video", "post_attachment")
            and mime_type
            and mime_type.startswith("video/")
        ):
            try:
                title = request.data.get("title") or file_name
                description = request.data.get("description", "")
                video_asset = MuxVideoService.create_asset_from_url(
                    user=request.user,
                    input_url=res["file_url"],
                    title=title,
                    description=description,
                )
                current_meta = dict(video_asset.metadata or {})
                current_meta.update(
                    {
                        "media_asset_id": res.get("asset_id"),
                        "file_key": res.get("file_key"),
                        "file_name": file_name,
                        "file_size": res.get("file_size"),
                        "mime_type": mime_type,
                        "source_url": res["file_url"],
                        "source_provider": "uploadthing",
                    }
                )
                video_asset.metadata = current_meta
                video_asset.save(update_fields=["metadata", "updated_at"])
                res["video_asset"] = VideoAssetSerializer(video_asset).data
            except Exception as exc:
                logger.warning("Auto Mux ingestion failed for video upload: %s", exc)

        return success_response(
            data=res,
            message="Fichier téléversé avec succès.",
            status_code=status.HTTP_201_CREATED,
        )


class BannerUploadView(APIView):
    """
    POST / DELETE /api/v1/media/banners/
    Centralized banner upload, replacement, and deletion service for
    Events, Hackathons, Courses, Communities, and Profiles (BE-15).
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        tags=["Media"],
        summary="Téléverser ou remplacer une bannière (Événement, Hackathon, Cours, Communauté)",
        request=BannerUploadRequestSerializer,
        responses={201: None},
    )
    def post(self, request):
        serializer = BannerUploadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        file_obj = (
            request.FILES.get("file")
            or request.FILES.get("banner")
            or request.FILES.get("image")
            or request.FILES.get("cover_image")
            or request.FILES.get("thumbnail")
        )
        if not file_obj:
            return error_response(
                "Aucun fichier d'image fourni. Envoyez le fichier via 'file', 'banner' ou 'cover_image'.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        result = UploadThingService.upload_banner(
            user=request.user,
            file_obj=file_obj,
            target_type=data.get("target_type", ""),
            target_id=data.get("target_id", ""),
            community_slug=data.get("community_slug", ""),
        )
        return success_response(
            data=result,
            message="Bannière téléversée avec succès.",
            status_code=status.HTTP_201_CREATED,
        )

    @extend_schema(
        tags=["Media"],
        summary="Supprimer la bannière d'une ressource (Événement, Hackathon, Cours, Communauté)",
        request=BannerUploadRequestSerializer,
        responses={200: None},
    )
    def delete(self, request):
        target_type = request.data.get("target_type") or request.query_params.get(
            "target_type", ""
        )
        target_id = request.data.get("target_id") or request.query_params.get(
            "target_id", ""
        )
        community_slug = request.data.get("community_slug") or request.query_params.get(
            "community_slug", ""
        )

        result = UploadThingService.remove_banner(
            user=request.user,
            target_type=target_type,
            target_id=target_id,
            community_slug=community_slug,
        )
        return success_response(
            data=result,
            message="Bannière supprimée avec succès.",
        )


class MediaAssetListView(APIView):
    """
    List user's uploaded files and assets with filtering.
    """

    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=["Media"],
        summary="Lister ses fichiers et documents hébergés",
        parameters=[
            OpenApiParameter(
                name="purpose",
                description="Filtrer par destination (avatar, banner, document...)",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="status",
                description="Filtrer par statut (pending, ready, failed)",
                required=False,
                type=str,
            ),
        ],
        responses={200: MediaAssetSerializer(many=True)},
    )
    def get(self, request):
        qs = MediaAsset.objects.filter(user=request.user).exclude(status="deleted")
        purpose = request.query_params.get("purpose")
        status_filter = request.query_params.get("status")
        if purpose:
            qs = qs.filter(purpose=purpose)
        if status_filter:
            qs = qs.filter(status=status_filter)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = MediaAssetSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class MediaAssetDetailView(APIView):
    """
    Retrieve or delete an uploaded asset.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Media"],
        summary="Détails d'un média hébergé",
        responses={200: MediaAssetSerializer},
    )
    def get(self, request, asset_id):
        try:
            asset = MediaAsset.objects.get(id=asset_id, user=request.user)
        except MediaAsset.DoesNotExist:
            return success_response(None, status_code=404, message="Média introuvable.")
        return success_response(data=MediaAssetSerializer(asset).data)

    @extend_schema(
        tags=["Media"], summary="Supprimer un média hébergé", responses={200: None}
    )
    def delete(self, request, asset_id):
        UploadThingService.delete_asset(request.user, str(asset_id))
        return success_response(message="Média supprimé avec succès.")


class MediaAssetDownloadView(APIView):
    """
    GET /api/v1/media/assets/<uuid:asset_id>/download/
    Verifies read permissions (e.g., private community membership) and returns
    secure download details or streams local file as an attachment (never executed).
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=["Media"],
        summary="Télécharger un document ou média avec vérification des permissions",
        responses={200: None},
    )
    def get(self, request, asset_id):
        try:
            asset = MediaAsset.objects.get(id=asset_id)
        except MediaAsset.DoesNotExist as err:
            raise NotFound("Fichier introuvable.") from err

        UploadThingService.check_asset_read_permission(request.user, asset)

        meta = asset.metadata if isinstance(asset.metadata, dict) else {}
        local_path = meta.get("local_storage_path")
        if (
            request.query_params.get("stream") == "1"
            and local_path
            and default_storage.exists(local_path)
        ):
            response = FileResponse(
                default_storage.open(local_path, "rb"),
                content_type="application/octet-stream",
                as_attachment=True,
                filename=asset.file_name,
            )
            response["X-Content-Type-Options"] = "nosniff"
            return response

        return success_response(
            data={
                "id": str(asset.id),
                "file_name": asset.file_name,
                "file_url": asset.file_url,
                "mime_type": asset.mime_type,
                "file_size": asset.file_size,
                "media_category": asset.media_category,
                "content_disposition": f'attachment; filename="{asset.file_name}"',
            },
            message="Téléchargement autorisé.",
        )
