from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import success_response
from apps.media.models.media_asset import MediaAsset
from apps.media.serializers.media import (
    ConfirmUploadRequestSerializer,
    MediaAssetSerializer,
    PresignedUploadRequestSerializer,
)
from apps.media.services.uploadthing_service import UploadThingService


class PresignedUploadView(APIView):
    """
    Generate presigned upload parameters for direct client upload (UploadThing / Storage).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Media'],
        summary="Générer une URL pré-signée pour upload de document/image",
        request=PresignedUploadRequestSerializer,
        responses={201: None}
    )
    def post(self, request):
        serializer = PresignedUploadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        upload_params = UploadThingService.generate_upload_url(
            user=request.user,
            file_name=data['file_name'],
            file_size=data['file_size'],
            mime_type=data['mime_type'],
            purpose=data.get('purpose', 'general')
        )
        return success_response(
            data=upload_params,
            message="Paramètres d'upload générés avec succès.",
            status_code=status.HTTP_201_CREATED
        )


class ConfirmUploadView(APIView):
    """
    Confirm that the client has completed upload and make asset ready for use.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Media'],
        summary="Confirmer l'upload réussi d'un média",
        request=ConfirmUploadRequestSerializer,
        responses={200: MediaAssetSerializer}
    )
    def post(self, request):
        serializer = ConfirmUploadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        asset = UploadThingService.confirm_upload(
            user=request.user,
            file_key=data['file_key'],
            file_url=data['file_url'],
            file_size=data.get('file_size'),
            metadata=data.get('metadata')
        )
        return success_response(
            data=MediaAssetSerializer(asset).data,
            message="Média validé et disponible."
        )


class MediaAssetListView(APIView):
    """
    List user's uploaded files and assets with filtering.
    """
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    @extend_schema(
        tags=['Media'],
        summary="Lister ses fichiers et documents hébergés",
        parameters=[
            OpenApiParameter(name='purpose', description="Filtrer par destination (avatar, banner, document...)", required=False, type=str),
            OpenApiParameter(name='status', description="Filtrer par statut (pending, ready, failed)", required=False, type=str),
        ],
        responses={200: MediaAssetSerializer(many=True)}
    )
    def get(self, request):
        qs = MediaAsset.objects.filter(user=request.user).exclude(status='deleted')
        purpose = request.query_params.get('purpose')
        status_filter = request.query_params.get('status')
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
        tags=['Media'],
        summary="Détails d'un média hébergé",
        responses={200: MediaAssetSerializer}
    )
    def get(self, request, asset_id):
        try:
            asset = MediaAsset.objects.get(id=asset_id, user=request.user)
        except MediaAsset.DoesNotExist:
            return success_response(None, status_code=404, message="Média introuvable.")
        return success_response(data=MediaAssetSerializer(asset).data)

    @extend_schema(
        tags=['Media'],
        summary="Supprimer un média hébergé",
        responses={200: None}
    )
    def delete(self, request, asset_id):
        UploadThingService.delete_asset(request.user, str(asset_id))
        return success_response(message="Média supprimé avec succès.")
