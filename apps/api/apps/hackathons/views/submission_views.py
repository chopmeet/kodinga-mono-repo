import mimetypes
import os

from common.utils.pagination import StandardResultsSetPagination
from common.utils.responses import error_response, success_response
from django.core.files.storage import default_storage
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.hackathons.models.submission import HackathonSubmission, SubmissionFileType
from apps.hackathons.selectors.hackathon_selector import HackathonSelector
from apps.hackathons.serializers.submission import (
    AttachFileRequestSerializer,
    HackathonSubmissionDetailSerializer,
    HackathonSubmissionFileSerializer,
    HackathonSubmissionListSerializer,
    HackathonSubmissionUpdateSerializer,
)
from apps.hackathons.services.submission_service import HackathonSubmissionService


class HackathonMySubmissionView(APIView):
    """
    GET / PATCH /api/v1/communities/<slug>/hackathons/<hackathon_slug>/submissions/my-project/
    Initializes or updates the user/team project submission draft.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Consulter mon projet (Brouillon ou Final)",
        responses={200: HackathonSubmissionDetailSerializer},
    )
    def get(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        submission = HackathonSelector.get_user_submission(hackathon, request.user)
        if not submission:
            # Create initial draft automatically if eligible
            submission, _ = HackathonSubmissionService.get_or_create_submission(
                request.user, hackathon
            )

        return success_response(data=HackathonSubmissionDetailSerializer(submission).data)

    @extend_schema(
        tags=["Hackathons"],
        summary="Mettre à jour mon projet de hackathon",
        request=HackathonSubmissionUpdateSerializer,
        responses={200: HackathonSubmissionDetailSerializer},
    )
    def patch(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        serializer = HackathonSubmissionUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated = HackathonSubmissionService.update_submission(
            user=request.user,
            hackathon=hackathon,
            data=serializer.validated_data,
        )
        return success_response(
            data=HackathonSubmissionDetailSerializer(updated).data,
            message="Projet sauvegardé avec succès.",
        )


class HackathonSubmissionFileAttachView(APIView):
    """
    POST /api/v1/communities/<slug>/hackathons/<hackathon_slug>/submissions/my-project/files/
    Attaches a validated file (PDF, screenshot, technical doc, zip) to the project.
    Supports direct multipart/form-data upload or pre-uploaded file URL.
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        tags=["Hackathons"],
        summary="Uploader ou joindre un fichier au projet",
        request=AttachFileRequestSerializer,
        responses={201: HackathonSubmissionFileSerializer},
    )
    def post(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        serializer = AttachFileRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        uploaded_file = request.FILES.get("file") or data.get("file")
        if uploaded_file:
            file_name = data.get("file_name") or uploaded_file.name
            file_size = uploaded_file.size
            mime_type = (
                data.get("mime_type")
                or getattr(uploaded_file, "content_type", None)
                or mimetypes.guess_type(file_name)[0]
                or "application/octet-stream"
            )

            # Upload to configured UploadThing storage
            from apps.media.services.uploadthing_service import UploadThingService

            try:
                upload_res = UploadThingService.upload_file_direct(
                    user=request.user,
                    file_name=file_name,
                    file_bytes=uploaded_file.read(),
                    mime_type=mime_type,
                    purpose="document",
                )
                file_url = upload_res["file_url"]
            except Exception:
                # Resilient fallback to local default storage if UploadThing is offline or mock
                uploaded_file.seek(0)
                storage_path = os.path.join(
                    "hackathons", "submissions", str(hackathon.id), file_name
                ).replace("\\", "/")
                saved_name = default_storage.save(storage_path, uploaded_file)
                file_url = request.build_absolute_uri(default_storage.url(saved_name))
        else:
            file_name = data["file_name"]
            file_url = data["file_url"]
            file_size = data["file_size"]
            mime_type = data["mime_type"]

        file_obj = HackathonSubmissionService.attach_file(
            user=request.user,
            hackathon=hackathon,
            file_name=file_name,
            file_url=file_url,
            file_size=file_size,
            mime_type=mime_type,
            file_type=data.get("file_type", SubmissionFileType.OTHER),
        )

        # If a video was uploaded and project has no video_url yet, automatically link it
        if mime_type.startswith("video/") or file_name.lower().endswith((".mp4", ".webm", ".mov")):
            submission = file_obj.submission
            if not submission.video_url:
                submission.video_url = file_url
                submission.save(update_fields=["video_url", "updated_at"])

        return success_response(
            data=HackathonSubmissionFileSerializer(file_obj).data,
            message="Fichier attaché avec succès via UploadThing.",
            status_code=status.HTTP_201_CREATED,
        )


class HackathonSubmissionFileDeleteView(APIView):
    """
    DELETE /api/v1/communities/<slug>/hackathons/<hackathon_slug>/submissions/my-project/files/<uuid:file_id>/
    Removes an attachment from the project.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Hackathons"],
        summary="Supprimer une pièce jointe",
        responses={200: None},
    )
    def delete(self, request, slug, hackathon_slug, file_id):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        HackathonSubmissionService.delete_file(request.user, hackathon, file_id)
        return success_response(message="Pièce jointe supprimée.")


class HackathonSubmissionFinalizeView(APIView):
    """
    POST /api/v1/communities/<slug>/hackathons/<hackathon_slug>/submissions/my-project/submit/
    Submits project definitively before the deadline.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = HackathonSubmissionDetailSerializer

    @extend_schema(
        tags=["Hackathons"],
        summary="Finaliser la soumission du projet",
        request=None,
        responses={200: HackathonSubmissionDetailSerializer},
    )
    def post(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )
        final_submission = HackathonSubmissionService.submit_final_project(
            user=request.user,
            hackathon=hackathon,
        )
        return success_response(
            data=HackathonSubmissionDetailSerializer(final_submission).data,
            message="Votre projet a été soumis officiellement avec succès !",
        )


class HackathonSubmissionListView(APIView):
    """
    GET /api/v1/communities/<slug>/hackathons/<hackathon_slug>/submissions/
    Lists submitted projects (Managers & Judges, or public if results published).
    """

    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Hackathons"],
        summary="Lister les projets soumis au hackathon",
        parameters=[
            OpenApiParameter(name="final_only", type=bool, required=False, description="Uniquement projets finalisés (défaut: true)"),
        ],
        responses={200: HackathonSubmissionListSerializer(many=True)},
    )
    def get(self, request, slug, hackathon_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        is_mgr = HackathonSelector.is_community_manager(request.user, hackathon.community)
        is_judge = HackathonSelector.is_hackathon_judge(request.user, hackathon)

        qs = (
            HackathonSubmission.objects.filter(hackathon=hackathon)
            .select_related("team", "applicant")
            .prefetch_related("technologies", "files")
            .order_by("-submitted_at")
        )

        if not (is_mgr or is_judge):
            if not hackathon.results_published:
                # Regular users can only see their own submission
                user_sub = HackathonSelector.get_user_submission(hackathon, request.user)
                if user_sub:
                    qs = qs.filter(id=user_sub.id)
                else:
                    return success_response(data=[])
            else:
                qs = qs.filter(is_final=True)

        final_only = request.query_params.get("final_only", "true").lower() in ["true", "1"]
        if final_only:
            qs = qs.filter(is_final=True)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request)
        serializer = HackathonSubmissionListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class HackathonSubmissionDetailView(APIView):
    """
    GET /api/v1/communities/<slug>/hackathons/<hackathon_slug>/submissions/<slug:submission_slug>/
    Retrieves a single project submission details.
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    @extend_schema(
        tags=["Hackathons"],
        summary="Détail d'un projet soumis",
        responses={200: HackathonSubmissionDetailSerializer},
    )
    def get(self, request, slug, hackathon_slug, submission_slug):
        hackathon = HackathonSelector.get_hackathon_by_slug(
            community_slug=slug,
            hackathon_slug=hackathon_slug,
            user=request.user,
        )

        submission = (
            HackathonSubmission.objects.filter(
                hackathon=hackathon, slug=submission_slug
            )
            .select_related("team", "applicant")
            .prefetch_related("technologies", "files")
            .first()
        )

        if not submission:
            return error_response("Projet introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        is_mgr = HackathonSelector.is_community_manager(request.user, hackathon.community)
        is_judge = HackathonSelector.is_hackathon_judge(request.user, hackathon)
        is_author = request.user.is_authenticated and (
            submission.applicant_id == request.user.id
            or (submission.team and submission.team.members.filter(user=request.user).exists())
        )

        if not (is_mgr or is_judge or is_author or hackathon.results_published):
            return error_response(
                "Ce projet n'est pas encore accessible publiquement.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        return success_response(data=HackathonSubmissionDetailSerializer(submission).data)
