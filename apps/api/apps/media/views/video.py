import logging

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.media.models.video_asset import VideoAsset
from apps.media.serializers.video import (
    MuxUploadRequestSerializer,
    MuxUploadResponseSerializer,
    VideoAssetSerializer,
    VideoIngestRequestSerializer,
    VideoUploadRequestSerializer,
)
from apps.media.services.mux_service import MuxVideoService
from apps.media.services.uploadthing_service import UploadThingService
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response

logger = logging.getLogger('kodinga.media')


class MuxDirectUploadView(APIView):
    """
    Generate a direct upload URL for video streams via Mux.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Media'],
        summary="Créer une session d'upload direct de vidéo (Mux)",
        request=MuxUploadRequestSerializer,
        responses={201: MuxUploadResponseSerializer}
    )
    def post(self, request):
        serializer = MuxUploadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        upload_data = MuxVideoService.create_direct_upload(
            user=request.user,
            title=data.get('title', ''),
            description=data.get('description', ''),
            cors_origin=data.get('cors_origin', '*')
        )
        return success_response(
            data=upload_data,
            message="Session d'upload Mux initialisée.",
            status_code=status.HTTP_201_CREATED
        )


class VideoAssetListView(APIView):
    """
    List user's uploaded videos or upload/ingest a video file to UploadThing + Mux.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=['Media'],
        summary="Lister ses vidéos de cours et replays",
        parameters=[
            OpenApiParameter(name='status', description="Statut (waiting, preparing, ready, errored)", required=False, type=str),
        ],
        responses={200: VideoAssetSerializer(many=True)}
    )
    def get(self, request):
        qs = VideoAsset.objects.filter(user=request.user).exclude(status='deleted')
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = VideoAssetSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @extend_schema(
        tags=['Media'],
        summary="Téléverser une vidéo (Stockage UploadThing + Ingestion Mux)",
        description=(
            "Téléverse un fichier vidéo binaire (multipart/form-data) ou ingère une URL UploadThing (JSON).\n"
            "Le fichier est stocké sur UploadThing (stockage permanent) et automatiquement ingéré dans Mux "
            "pour le streaming HLS adaptatif mondial (avec playback_id, hls_url, et miniatures)."
        ),
        request=VideoUploadRequestSerializer,
        responses={201: VideoAssetSerializer}
    )
    def post(self, request):
        file_obj = request.FILES.get('file') or request.FILES.get('video') or request.FILES.get('video_file')
        file_url = (request.data.get('file_url') or request.data.get('video_url') or '').strip()

        title = request.data.get('title', '').strip()
        description = request.data.get('description', '').strip()
        is_public_val = request.data.get('is_public', True)
        if isinstance(is_public_val, str):
            is_public_val = is_public_val.lower() in ('true', '1', 'yes')

        if file_obj:
            file_name = getattr(file_obj, 'name', 'video.mp4')
            mime_type = getattr(file_obj, 'content_type', 'video/mp4') or 'video/mp4'
            title = title or file_name

            # Étape 1 : Stockage sur UploadThing
            res_ut = UploadThingService.upload_file_direct(
                user=request.user,
                file_name=file_name,
                mime_type=mime_type,
                purpose='lesson_video',
                file_obj=file_obj,
            )
            raw_url = res_ut['file_url']

            # Étape 2 : Ingestion dans Mux pour streaming adaptatif HLS
            video_asset = MuxVideoService.create_asset_from_url(
                user=request.user,
                input_url=raw_url,
                title=title,
                description=description,
            )
            video_asset.is_public = is_public_val
            current_meta = dict(video_asset.metadata or {})
            current_meta.update({
                'media_asset_id': res_ut.get('asset_id'),
                'file_key': res_ut.get('file_key'),
                'file_size': res_ut.get('file_size'),
                'source_url': raw_url,
                'source_provider': 'uploadthing',
            })
            video_asset.metadata = current_meta
            video_asset.save(update_fields=['is_public', 'metadata', 'updated_at'])

            return success_response(
                data=VideoAssetSerializer(video_asset).data,
                message="Vidéo stockée sur UploadThing et ingérée dans Mux avec succès.",
                status_code=status.HTTP_201_CREATED,
            )

        elif file_url:
            title = title or "Vidéo"
            video_asset = MuxVideoService.create_asset_from_url(
                user=request.user,
                input_url=file_url,
                title=title,
                description=description,
            )
            video_asset.is_public = is_public_val
            video_asset.save(update_fields=['is_public', 'updated_at'])

            return success_response(
                data=VideoAssetSerializer(video_asset).data,
                message="Vidéo ingérée dans Mux avec succès.",
                status_code=status.HTTP_201_CREATED,
            )

        return error_response(
            "Veuillez fournir un fichier vidéo ('file' ou 'video') ou une URL ('file_url').",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class VideoAssetIngestView(APIView):
    """
    Ingest a video already hosted on UploadThing or external URL into Mux.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Media'],
        summary="Ingérer une URL vidéo UploadThing vers Mux",
        request=VideoIngestRequestSerializer,
        responses={201: VideoAssetSerializer}
    )
    def post(self, request):
        serializer = VideoIngestRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        video_asset = MuxVideoService.create_asset_from_url(
            user=request.user,
            input_url=data['file_url'],
            title=data.get('title') or "Vidéo",
            description=data.get('description', ''),
        )
        if 'is_public' in data:
            video_asset.is_public = data['is_public']
            video_asset.save(update_fields=['is_public', 'updated_at'])

        return success_response(
            data=VideoAssetSerializer(video_asset).data,
            message="Vidéo ingérée dans Mux avec succès.",
            status_code=status.HTTP_201_CREATED,
        )


class VideoAssetDetailView(APIView):
    """
    Retrieve streaming playback details or delete a video.
    """
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Media'],
        summary="Détails & URLs de streaming HLS d'une vidéo",
        responses={200: VideoAssetSerializer}
    )
    def get(self, request, video_id):
        try:
            video = MuxVideoService.get_video_by_id(str(video_id))
        except Exception:
            return error_response(message="Vidéo introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        if not video.is_public and (not request.user.is_authenticated or request.user.id != video.user_id):
            return error_response(message="Accès refusé à cette vidéo.", status_code=status.HTTP_403_FORBIDDEN)

        return success_response(data=VideoAssetSerializer(video).data)

    @extend_schema(
        tags=['Media'],
        summary="Supprimer une vidéo",
        responses={200: None}
    )
    def delete(self, request, video_id):
        if not request.user.is_authenticated:
            return error_response("Authentification requise.", status_code=status.HTTP_401_UNAUTHORIZED)
        MuxVideoService.delete_video(request.user, str(video_id))
        return success_response(message="Vidéo supprimée avec succès.")
