import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.classroom.models.lesson import Lesson
from apps.classroom.models.module import CourseModule
from apps.classroom.selectors.classroom_selector import ClassroomSelector
from apps.classroom.serializers.lesson import (
    LessonCreateUpdateSerializer,
    LessonDetailSerializer,
)
from apps.classroom.services.classroom_service import ClassroomService
from apps.communities.selectors.community_selector import CommunitySelector
from apps.media.services.uploadthing_service import UploadThingService
from common.utils.responses import error_response, success_response

logger = logging.getLogger("kodinga.classroom")


class CourseLessonListView(APIView):
    """
    Create a lesson inside a module (Owner or Admin).
    Supports multipart upload for video, cover image, attachments, code_blocks, and quiz_data.
    Decouples lesson persistence from large video transfer so lesson content is never lost on upload error (BE-08).
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        tags=['Classroom'],
        summary="Ajouter une leçon à un module ou cours (Owner ou Admin)",
        description="Crée une leçon dans un module. L'ID du module peut être spécifié dans l'URL ou dans le corps JSON via `module_id`. Accepte également le téléversement multipart d'une vidéo ('video') ou d'une couverture ('cover_image').",
        request=LessonCreateUpdateSerializer,
        responses={201: LessonDetailSerializer}
    )
    def post(self, request, slug, course_slug, module_id=None):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        target_module_id = module_id or request.data.get('module_id')
        if not target_module_id:
            return error_response(
                "Le champ 'module_id' est requis pour associer la leçon à un module.",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            module = CourseModule.objects.select_related('course__community').get(
                id=target_module_id,
                course__slug=course_slug,
                course__community=community
            )
        except CourseModule.DoesNotExist:
            return error_response("Module ou cours introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = LessonCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        lesson_data = dict(serializer.validated_data)

        # Handle direct cover image file upload if provided in multipart
        cover_file = request.FILES.get('cover_image') or request.FILES.get('cover_image_file')
        if cover_file:
            ClassroomService.check_manager_permission(request.user, community)
            res_cover = UploadThingService.upload_banner(
                user=request.user,
                file_obj=cover_file,
            )
            lesson_data['cover_image_url'] = res_cover['file_url']

        video_file = request.FILES.get('video') or request.FILES.get('video_file')
        # If a binary video file is uploaded alongside, save the lesson first so lesson data is preserved even if video transfer fails (BE-08)
        if video_file:
            lesson_data.pop('video_url', None)

        lesson = ClassroomService.create_lesson(
            actor_user=request.user,
            module=module,
            data=lesson_data
        )

        video_upload_error = None
        if video_file:
            try:
                lesson = ClassroomService.attach_video_to_lesson(
                    actor_user=request.user,
                    lesson=lesson,
                    video_file=video_file,
                )
            except Exception as exc:
                logger.warning("Video upload failed after lesson %s creation: %s", lesson.id, exc)
                video_upload_error = str(getattr(exc, 'detail', exc))

        # Handle direct attachments upload if provided
        attachment_files = request.FILES.getlist('attachments') or request.FILES.getlist('files')
        if not attachment_files and (request.FILES.get('attachment') or request.FILES.get('file')):
            single = request.FILES.get('attachment') or request.FILES.get('file')
            attachment_files = [single]

        for att_f in attachment_files:
            ClassroomService.add_attachment_to_lesson(
                actor_user=request.user,
                lesson=lesson,
                attachment_file=att_f,
            )

        lesson.refresh_from_db()
        lesson._viewer_is_manager = True
        payload = LessonDetailSerializer(lesson, context={'request': request}).data
        if video_upload_error:
            payload['video_upload_status'] = 'errored'
            payload['video_upload_error'] = video_upload_error
            return success_response(
                data=payload,
                message="La leçon a été enregistrée, mais le téléversement de la vidéo a échoué. Vous pouvez réessayer l'envoi de la vidéo.",
                status_code=status.HTTP_201_CREATED,
            )

        return success_response(
            data=payload,
            message="Leçon ajoutée avec succès.",
            status_code=status.HTTP_201_CREATED
        )


class CourseLessonDetailView(APIView):
    """
    Retrieve lesson content and Mux/External video streaming (Active connected members only), or update/delete lesson.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        tags=['Classroom'],
        summary="Consulter le contenu d'une leçon et flux vidéo",
        responses={200: LessonDetailSerializer}
    )
    def get(self, request, slug, course_slug, lesson_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
        except Exception:
            return error_response("Communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        lesson = ClassroomSelector.get_lesson_by_id(
            community=community,
            course_slug=course_slug,
            lesson_id=str(lesson_id),
            user=request.user
        )

        if lesson.is_locked:
            return error_response(
                "Cette leçon est verrouillée. Vous devez terminer les leçons précédentes d'abord.",
                status_code=status.HTTP_403_FORBIDDEN
            )

        return success_response(
            data=LessonDetailSerializer(lesson, context={'request': request}).data
        )

    @extend_schema(
        tags=['Classroom'],
        summary="Modifier une leçon (Owner ou Admin)",
        request=LessonCreateUpdateSerializer,
        responses={200: LessonDetailSerializer}
    )
    def patch(self, request, slug, course_slug, lesson_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            lesson = Lesson.objects.select_related('module__course__community').get(
                id=lesson_id,
                module__course__slug=course_slug,
                module__course__community=community
            )
        except Exception:
            return error_response("Leçon introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = LessonCreateUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        patch_data = dict(serializer.validated_data)

        # Handle cover image upload if sent in multipart
        cover_file = request.FILES.get('cover_image') or request.FILES.get('cover_image_file')
        if cover_file:
            ClassroomService.check_manager_permission(request.user, community)
            res_cover = UploadThingService.upload_banner(
                user=request.user,
                file_obj=cover_file,
            )
            patch_data['cover_image_url'] = res_cover['file_url']

        video_file = request.FILES.get('video') or request.FILES.get('video_file')
        if video_file:
            patch_data.pop('video_url', None)

        updated = ClassroomService.update_lesson(
            actor_user=request.user,
            lesson=lesson,
            data=patch_data
        )

        video_upload_error = None
        if video_file:
            try:
                updated = ClassroomService.attach_video_to_lesson(
                    actor_user=request.user,
                    lesson=updated,
                    video_file=video_file,
                )
            except Exception as exc:
                logger.warning("Video upload failed on lesson %s update: %s", updated.id, exc)
                video_upload_error = str(getattr(exc, 'detail', exc))

        # Handle attachment files upload if sent
        attachment_files = request.FILES.getlist('attachments') or request.FILES.getlist('files')
        if not attachment_files and (request.FILES.get('attachment') or request.FILES.get('file')):
            single = request.FILES.get('attachment') or request.FILES.get('file')
            attachment_files = [single]

        for att_f in attachment_files:
            ClassroomService.add_attachment_to_lesson(
                actor_user=request.user,
                lesson=updated,
                attachment_file=att_f,
            )

        updated.refresh_from_db()
        updated._viewer_is_manager = True
        payload = LessonDetailSerializer(updated, context={'request': request}).data
        if video_upload_error:
            payload['video_upload_status'] = 'errored'
            payload['video_upload_error'] = video_upload_error
            return success_response(
                data=payload,
                message="Les modifications de la leçon ont été sauvegardées, mais le téléversement de la vidéo a échoué.",
            )

        return success_response(
            data=payload,
            message="Leçon mise à jour avec succès."
        )

    @extend_schema(
        tags=['Classroom'],
        summary="Supprimer une leçon (Owner ou Admin)",
        responses={200: None}
    )
    def delete(self, request, slug, course_slug, lesson_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            lesson = Lesson.objects.select_related('module__course__community').get(
                id=lesson_id,
                module__course__slug=course_slug,
                module__course__community=community
            )
        except Exception:
            return error_response("Leçon introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        ClassroomService.delete_lesson(request.user, lesson)
        return success_response(message="Leçon supprimée avec succès.")


class CourseLessonVideoUploadView(APIView):
    """
    Dedicated endpoint to upload or link a video for a lesson (BE-08 & BE-09).
    Supports:
    - Direct video file upload ('video' or 'file') up to 500 MB
    - Presigned video asset linking ('video_asset_id')
    - External video links ('video_url': YouTube, Vimeo, Dailymotion, or direct .mp4/.webm/.m3u8)
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        tags=['Classroom'],
        summary="Téléverser ou lier une vidéo pour une leçon (UploadThing + Mux + YouTube/Vimeo/Dailymotion)",
        responses={200: LessonDetailSerializer}
    )
    def post(self, request, slug, course_slug, lesson_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            lesson = Lesson.objects.select_related('module__course__community').get(
                id=lesson_id,
                module__course__slug=course_slug,
                module__course__community=community,
            )
        except Exception:
            return error_response("Leçon ou communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        video_file = request.FILES.get('video') or request.FILES.get('file') or request.FILES.get('video_file')
        video_url = (request.data.get('video_url') or '').strip()
        video_asset_id = (request.data.get('video_asset_id') or '').strip()

        if not video_file and not video_url and not video_asset_id:
            return error_response(
                "Veuillez fournir un fichier vidéo ('video' ou 'file'), une URL vidéo ('video_url') ou un 'video_asset_id'.",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        try:
            updated_lesson = ClassroomService.attach_video_to_lesson(
                actor_user=request.user,
                lesson=lesson,
                video_file=video_file,
                video_url=video_url,
                video_asset_id=video_asset_id,
            )
        except ValidationError as exc:
            return error_response(
                "Lien ou fichier vidéo invalide.",
                status_code=status.HTTP_400_BAD_REQUEST,
                details=exc.detail if hasattr(exc, 'detail') else str(exc),
            )
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)

        updated_lesson._viewer_is_manager = True
        return success_response(
            data=LessonDetailSerializer(updated_lesson, context={'request': request}).data,
            message="Vidéo associée à la leçon avec succès."
        )


class CourseLessonAttachmentUploadView(APIView):
    """
    Dedicated endpoint to upload one or more downloadable attachments/documents to UploadThing and link them to the lesson.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        tags=['Classroom'],
        summary="Téléverser un ou plusieurs documents / fichiers joints pour une leçon (UploadThing)",
        description="Téléverse des fichiers (PDF, ZIP, code source, etc.) stockés en dur sur UploadThing et enregistrés dans la liste des pièces jointes de la leçon.",
        responses={201: LessonDetailSerializer}
    )
    def post(self, request, slug, course_slug, lesson_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            lesson = Lesson.objects.select_related('module__course__community').get(
                id=lesson_id,
                module__course__slug=course_slug,
                module__course__community=community,
            )
        except Exception:
            return error_response("Leçon ou communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        files = request.FILES.getlist('files') or request.FILES.getlist('attachments')
        if not files:
            single = request.FILES.get('file') or request.FILES.get('attachment')
            if single:
                files = [single]

        if not files:
            return error_response(
                "Aucun fichier fourni. Envoyez un fichier via le champ 'file' ou plusieurs fichiers via 'files'.",
                status_code=status.HTTP_400_BAD_REQUEST
            )

        added_attachments = []
        try:
            for f in files:
                item = ClassroomService.add_attachment_to_lesson(
                    actor_user=request.user,
                    lesson=lesson,
                    attachment_file=f,
                )
                added_attachments.append(item)
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)

        lesson.refresh_from_db()
        lesson._viewer_is_manager = True

        return success_response(
            data={
                'added_attachments': added_attachments,
                'lesson': LessonDetailSerializer(lesson, context={'request': request}).data,
            },
            message=f"{len(added_attachments)} fichier(s) téléversé(s) avec succès.",
            status_code=status.HTTP_201_CREATED
        )


class CourseLessonAttachmentDeleteView(APIView):
    """
    Remove an attachment from a lesson.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Classroom'],
        summary="Supprimer une pièce jointe d'une leçon (Owner ou Admin)",
        responses={200: LessonDetailSerializer}
    )
    def delete(self, request, slug, course_slug, lesson_id, attachment_id):
        try:
            community = CommunitySelector.get_community_by_slug(slug, user=request.user)
            lesson = Lesson.objects.select_related('module__course__community').get(
                id=lesson_id,
                module__course__slug=course_slug,
                module__course__community=community,
            )
        except Exception:
            return error_response("Leçon ou communauté introuvable.", status_code=status.HTTP_404_NOT_FOUND)

        try:
            updated_lesson = ClassroomService.remove_attachment_from_lesson(
                actor_user=request.user,
                lesson=lesson,
                attachment_id_or_url=str(attachment_id),
            )
        except Exception as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)

        updated_lesson._viewer_is_manager = True
        return success_response(
            data=LessonDetailSerializer(updated_lesson, context={'request': request}).data,
            message="Pièce jointe retirée avec succès."
        )
