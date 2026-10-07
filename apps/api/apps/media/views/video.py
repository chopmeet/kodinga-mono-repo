from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import success_response, error_response
from apps.media.models.video_asset import VideoAsset
from apps.media.serializers.video import (
    MuxUploadRequestSerializer,
    MuxUploadResponseSerializer,
    VideoAssetSerializer,
)
from apps.media.services.mux_service import MuxVideoService


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
    List user's uploaded videos with HLS streaming and status info.
    """
    permission_classes = [IsAuthenticated]
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
