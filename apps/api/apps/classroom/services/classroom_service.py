import uuid
from typing import Any

from django.db import models, transaction
from django.db.models import F
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import NotFound, ValidationError

from apps.accounts.models.user import User
from apps.classroom.models.course import Course
from apps.classroom.models.lesson import (
    Lesson,
    LessonType,
    VideoProvider,
    parse_and_normalize_video_url,
)
from apps.classroom.models.module import CourseModule
from apps.communities.models.community import Community
from apps.media.models.video_asset import VideoAsset, VideoStatus
from apps.media.services.mux_service import MuxVideoService
from apps.media.services.uploadthing_service import UploadThingService
from apps.notifications.services.notification_service import NotificationService


class ClassroomService:
    """
    Business service managing pedagogical courses, modules, lessons, code blocks,
    quizzes, and video attachments.
    """

    @classmethod
    def check_manager_permission(cls, user: User, community: Community) -> None:
        """
        Enforces that only community owners or administrators can manage classroom content.
        """
        from common.permissions.base import is_superadmin_user
        if is_superadmin_user(user) or community.owner_id == user.id:
            return

        from apps.memberships.permissions import check_community_permission
        check_community_permission(user, community, 'can_manage_courses', "gérer les cours dans cette communauté")

    @classmethod
    def _notify_course_published(cls, course: Course, actor_user: User) -> None:
        if course.is_published and course.community:
            action_url = f"/communities/{course.community.slug}/classroom/{course.slug}"
            NotificationService.notify_community_content_published(
                community=course.community,
                actor=actor_user,
                content_type="course",
                content_id=str(course.id),
                title=course.title,
                action_url=action_url,
            )

    # ---------------- Validation Helpers (BE-10 & BE-11) ----------------

    @classmethod
    def normalize_code_blocks(
        cls,
        code_blocks: Any,
        code_snippet: str = "",
        code_language: str = "",
    ) -> tuple[list[dict[str, Any]], str, str]:
        """
        Normalizes `code_blocks`, `code_snippet`, and `code_language` while strictly
        preserving indentation, newlines, and special characters (`BE-11`).
        """
        normalized_blocks: list[dict[str, Any]] = []
        if isinstance(code_blocks, list):
            for idx, raw_block in enumerate(code_blocks):
                if not isinstance(raw_block, dict):
                    continue
                code_text = raw_block.get("code")
                if code_text is None:
                    code_text = raw_block.get("content", "")
                code_str = str(code_text)
                lang = str(raw_block.get("language") or code_language or "plaintext").strip().lower()
                title = str(raw_block.get("title") or raw_block.get("filename") or "").strip()
                block_id = str(raw_block.get("id") or f"code_{idx + 1}")
                normalized_blocks.append(
                    {
                        "id": block_id,
                        "language": lang or "plaintext",
                        "title": title,
                        "code": code_str,
                    }
                )

        snippet_str = str(code_snippet) if code_snippet is not None else ""
        lang_str = str(code_language or "").strip().lower()

        if snippet_str and not normalized_blocks:
            normalized_blocks.append(
                {
                    "id": "code_1",
                    "language": lang_str or "plaintext",
                    "title": "",
                    "code": snippet_str,
                }
            )
        elif normalized_blocks and not snippet_str:
            snippet_str = normalized_blocks[0]["code"]
            if not lang_str:
                lang_str = normalized_blocks[0]["language"]

        return normalized_blocks, snippet_str, lang_str

    @classmethod
    def validate_and_normalize_quiz_data(cls, raw_quiz_data: Any) -> dict[str, Any]:
        """
        Validates and normalizes `quiz_data` (`BE-10`), supporting both single-choice
        and multiple-choice questions and multiple frontend payload conventions.
        """
        if not raw_quiz_data:
            return {}

        if isinstance(raw_quiz_data, list):
            questions_input = raw_quiz_data
            passing_score = 50.0
            title = ""
            description = ""
        elif isinstance(raw_quiz_data, dict):
            questions_input = raw_quiz_data.get("questions", [])
            passing_score = float(raw_quiz_data.get("passing_score", 50.0))
            title = str(raw_quiz_data.get("title", "")).strip()
            description = str(raw_quiz_data.get("description", "")).strip()
        else:
            raise ValidationError({"quiz_data": "Format de quiz invalide."})

        if not isinstance(questions_input, list):
            raise ValidationError({"quiz_data": "Le champ 'questions' doit être une liste."})

        normalized_questions: list[dict[str, Any]] = []
        for q_idx, raw_q in enumerate(questions_input):
            if not isinstance(raw_q, dict):
                raise ValidationError(
                    {"quiz_data": f"La question #{q_idx + 1} doit être un objet JSON."}
                )

            q_id = str(raw_q.get("id") or f"q_{q_idx + 1}")
            q_text = str(
                raw_q.get("question")
                or raw_q.get("prompt")
                or raw_q.get("text")
                or raw_q.get("title")
                or ""
            ).strip()
            if not q_text:
                raise ValidationError(
                    {"quiz_data": f"Le libellé de la question #{q_idx + 1} est requis."}
                )

            raw_options = raw_q.get("options") if "options" in raw_q else raw_q.get("choices", [])
            if not isinstance(raw_options, list) or len(raw_options) < 2:
                raise ValidationError(
                    {
                        "quiz_data": (
                            f"La question « {q_text} » doit comporter au moins 2 choix de réponse."
                        )
                    }
                )

            # Determine explicit correct answers if specified at question level
            explicit_correct = raw_q.get("correct_options")
            if explicit_correct is None:
                explicit_correct = raw_q.get("correct_answers")
            if explicit_correct is None and "correct_option" in raw_q:
                explicit_correct = [raw_q["correct_option"]]
            if explicit_correct is None and "correct_answer" in raw_q:
                val = raw_q["correct_answer"]
                explicit_correct = val if isinstance(val, list) else [val]

            explicit_correct_set = (
                {str(x).strip() for x in explicit_correct if x is not None}
                if isinstance(explicit_correct, list)
                else set()
            )

            normalized_options: list[dict[str, Any]] = []
            correct_option_ids: list[str] = []

            for opt_idx, raw_opt in enumerate(raw_options):
                opt_id = f"opt_{opt_idx}"
                if isinstance(raw_opt, dict):
                    opt_id = str(raw_opt.get("id") or opt_id)
                    opt_text = str(
                        raw_opt.get("text")
                        or raw_opt.get("label")
                        or raw_opt.get("value")
                        or ""
                    ).strip()
                    is_correct = bool(raw_opt.get("is_correct", False))
                else:
                    opt_text = str(raw_opt).strip()
                    is_correct = False

                if not opt_text:
                    raise ValidationError(
                        {
                            "quiz_data": (
                                f"Un choix de réponse de la question « {q_text} » est vide."
                            )
                        }
                    )

                if (
                    str(opt_idx) in explicit_correct_set
                    or opt_id in explicit_correct_set
                    or opt_text in explicit_correct_set
                ):
                    is_correct = True

                normalized_options.append(
                    {
                        "id": opt_id,
                        "text": opt_text,
                        "is_correct": is_correct,
                    }
                )
                if is_correct:
                    correct_option_ids.append(opt_id)

            if not correct_option_ids:
                raise ValidationError(
                    {
                        "quiz_data": (
                            f"La question « {q_text} » doit avoir au moins une bonne réponse sélectionnée."
                        )
                    }
                )

            raw_type = str(
                raw_q.get("question_type") or raw_q.get("type") or ""
            ).strip().lower()
            if raw_type in ("multiple_choice", "multiple", "checkbox") or bool(raw_q.get("is_multiple")) or len(correct_option_ids) > 1:
                q_type = "multiple_choice"
            else:
                q_type = "single_choice"

            points = float(raw_q.get("points", 1.0))
            explanation = str(raw_q.get("explanation") or "").strip()

            normalized_questions.append(
                {
                    "id": q_id,
                    "question": q_text,
                    "question_type": q_type,
                    "points": max(1.0, points),
                    "explanation": explanation,
                    "options": normalized_options,
                    "correct_option_ids": correct_option_ids,
                }
            )

        return {
            "title": title,
            "description": description,
            "passing_score": max(0.0, min(100.0, passing_score)),
            "questions": normalized_questions,
        }

    # ---------------- Course Operations ----------------

    @classmethod
    def create_course(cls, actor_user: User, community: Community, data: dict[str, Any]) -> Course:
        cls.check_manager_permission(actor_user, community)

        title = data.get('title', '').strip()
        slug = data.get('slug') or slugify(title)
        if not slug:
            slug = f"course-{Course.objects.filter(community=community).count() + 1}"

        if Course.objects.filter(community=community, slug=slug).exists():
            raise ValidationError(f"Un cours avec le slug '{slug}' existe déjà dans cette communauté.")

        with transaction.atomic():
            course = Course.objects.create(
                community=community,
                author=actor_user,
                title=title,
                slug=slug,
                description=data.get('description', ''),
                level=data.get('level', 'all_levels'),
                thumbnail_url=data.get('thumbnail_url', ''),
                is_published=data.get('is_published', False),
                is_sequential=data.get('is_sequential', True),
                order=data.get('order', 0),
            )
            cls._notify_course_published(course, actor_user)
            return course

    @classmethod
    def update_course(cls, actor_user: User, course: Course, data: dict[str, Any]) -> Course:
        cls.check_manager_permission(actor_user, course.community)

        fields = ['updated_at']
        if 'title' in data:
            course.title = data['title'].strip()
            fields.append('title')
        if 'slug' in data and data['slug']:
            new_slug = slugify(data['slug'])
            if new_slug != course.slug and Course.objects.filter(community=course.community, slug=new_slug).exists():
                raise ValidationError("Ce slug est déjà utilisé par un autre cours.")
            course.slug = new_slug
            fields.append('slug')
        if 'description' in data:
            course.description = data['description']
            fields.append('description')
        if 'level' in data:
            course.level = data['level']
            fields.append('level')
        if 'thumbnail_url' in data:
            course.thumbnail_url = data['thumbnail_url']
            fields.append('thumbnail_url')
        if 'is_published' in data:
            course.is_published = data['is_published']
            fields.append('is_published')
        if 'is_sequential' in data:
            course.is_sequential = data['is_sequential']
            fields.append('is_sequential')
        if 'order' in data:
            course.order = data['order']
            fields.append('order')

        course.save(update_fields=fields)
        cls._notify_course_published(course, actor_user)
        return course

    @classmethod
    def delete_course(cls, actor_user: User, course: Course) -> None:
        cls.check_manager_permission(actor_user, course.community)
        course.delete()

    # ---------------- Module Operations ----------------

    @classmethod
    def create_module(cls, actor_user: User, course: Course, data: dict[str, Any]) -> CourseModule:
        cls.check_manager_permission(actor_user, course.community)

        with transaction.atomic():
            module = CourseModule.objects.create(
                course=course,
                title=data.get('title', '').strip(),
                description=data.get('description', ''),
                order=data.get('order', course.modules.count()),
            )
            Course.objects.filter(id=course.id).update(modules_count=F('modules_count') + 1)
            return module

    @classmethod
    def update_module(cls, actor_user: User, module: CourseModule, data: dict[str, Any]) -> CourseModule:
        cls.check_manager_permission(actor_user, module.course.community)

        fields = ['updated_at']
        if 'title' in data:
            module.title = data['title'].strip()
            fields.append('title')
        if 'description' in data:
            module.description = data['description']
            fields.append('description')
        if 'order' in data:
            module.order = data['order']
            fields.append('order')

        module.save(update_fields=fields)
        return module

    @classmethod
    def delete_module(cls, actor_user: User, module: CourseModule) -> None:
        cls.check_manager_permission(actor_user, module.course.community)
        course = module.course
        with transaction.atomic():
            module_lessons_count = module.lessons.count()
            module_duration = sum(module.lessons.values_list('duration_seconds', flat=True))

            module.delete()

            Course.objects.filter(id=course.id).update(
                modules_count=models.Case(
                    models.When(modules_count__gt=0, then=F('modules_count') - 1),
                    default=0
                ),
                lessons_count=models.Case(
                    models.When(lessons_count__gte=module_lessons_count, then=F('lessons_count') - module_lessons_count),
                    default=0
                ),
                duration_seconds=models.Case(
                    models.When(duration_seconds__gte=module_duration, then=F('duration_seconds') - module_duration),
                    default=0
                )
            )

    # ---------------- Lesson Operations ----------------

    @classmethod
    def create_lesson(cls, actor_user: User, module: CourseModule, data: dict[str, Any]) -> Lesson:
        cls.check_manager_permission(actor_user, module.course.community)

        title = data.get('title', '').strip()
        slug = data.get('slug') or slugify(title)
        if not slug:
            slug = f"lesson-{module.lessons.count() + 1}"

        if Lesson.objects.filter(module=module, slug=slug).exists():
            raise ValidationError(f"Une leçon avec le slug '{slug}' existe déjà dans ce module.")

        video_asset = None
        video_asset_id = data.get('video_asset_id')
        if video_asset_id:
            try:
                video_asset = VideoAsset.objects.get(id=video_asset_id)
            except VideoAsset.DoesNotExist as err:
                raise NotFound("La vidéo spécifiée est introuvable.") from err

        raw_video_url = (data.get('video_url') or '').strip()
        normalized_video_url = ''
        video_provider = (data.get('video_provider') or '').strip()
        if raw_video_url:
            try:
                normalized_video_url, detected_provider, _ = parse_and_normalize_video_url(raw_video_url)
                video_provider = video_provider or detected_provider
            except ValueError as err:
                raise ValidationError({"video_url": str(err)}) from err
        elif video_asset:
            video_provider = video_asset.provider or VideoProvider.MUX

        code_blocks, code_snippet, code_language = cls.normalize_code_blocks(
            code_blocks=data.get('code_blocks', []),
            code_snippet=data.get('code_snippet', ''),
            code_language=data.get('code_language', ''),
        )

        raw_quiz_data = data.get('quiz_data')
        quiz_data = cls.validate_and_normalize_quiz_data(raw_quiz_data) if raw_quiz_data else {}
        lesson_type = data.get('lesson_type')
        if not lesson_type:
            if quiz_data and quiz_data.get('questions'):
                lesson_type = LessonType.QUIZ
            elif video_asset or normalized_video_url:
                lesson_type = LessonType.VIDEO
            elif code_blocks or code_snippet:
                lesson_type = LessonType.CODE_EXERCISE
            else:
                lesson_type = LessonType.TEXT

        if lesson_type == LessonType.QUIZ and raw_quiz_data is not None and not quiz_data.get('questions'):
            raise ValidationError({"quiz_data": "Un quiz doit contenir au moins une question valide."})

        duration = data.get('duration_seconds', 0)
        content = data.get('content', '')
        if not duration and video_asset and video_asset.duration:
            duration = int(video_asset.duration)
        elif not duration and content:
            word_count = len(content.split())
            duration = max(60, round(word_count / 3.3))

        with transaction.atomic():
            lesson = Lesson.objects.create(
                module=module,
                title=title,
                slug=slug,
                content=content,
                content_format=data.get('content_format', 'markdown'),
                cover_image_url=data.get('cover_image_url', ''),
                images=data.get('images', []),
                lesson_type=lesson_type,
                video_asset=video_asset,
                video_url=normalized_video_url,
                video_provider=video_provider,
                code_language=code_language,
                code_snippet=code_snippet,
                code_blocks=code_blocks,
                quiz_data=quiz_data,
                duration_seconds=duration,
                order=data.get('order', module.lessons.count()),
                is_free_preview=data.get('is_free_preview', False),
                attachments=data.get('attachments', []),
            )

            CourseModule.objects.filter(id=module.id).update(lessons_count=F('lessons_count') + 1)
            Course.objects.filter(id=module.course_id).update(
                lessons_count=F('lessons_count') + 1,
                duration_seconds=F('duration_seconds') + duration
            )
            return lesson

    @classmethod
    def update_lesson(cls, actor_user: User, lesson: Lesson, data: dict[str, Any]) -> Lesson:
        cls.check_manager_permission(actor_user, lesson.module.course.community)

        fields = ['updated_at']
        if 'title' in data:
            lesson.title = data['title'].strip()
            fields.append('title')
        if 'slug' in data and data['slug']:
            new_slug = slugify(data['slug'])
            if new_slug != lesson.slug and Lesson.objects.filter(module=lesson.module, slug=new_slug).exists():
                raise ValidationError("Ce slug est déjà utilisé par une autre leçon du module.")
            lesson.slug = new_slug
            fields.append('slug')
        if 'content' in data:
            lesson.content = data['content']
            fields.append('content')
        if 'content_format' in data:
            lesson.content_format = data['content_format']
            fields.append('content_format')
        if 'cover_image_url' in data:
            lesson.cover_image_url = data['cover_image_url']
            fields.append('cover_image_url')
        if 'images' in data:
            lesson.images = data['images']
            fields.append('images')
        if 'lesson_type' in data:
            lesson.lesson_type = data['lesson_type']
            fields.append('lesson_type')
        if 'video_asset_id' in data:
            vid_id = data['video_asset_id']
            if vid_id:
                try:
                    lesson.video_asset = VideoAsset.objects.get(id=vid_id)
                except VideoAsset.DoesNotExist as err:
                    raise NotFound("Vidéo introuvable.") from err
            else:
                lesson.video_asset = None
            fields.append('video_asset')

        if 'video_url' in data:
            raw_video_url = (data.get('video_url') or '').strip()
            if raw_video_url:
                try:
                    normalized_url, detected_provider, _ = parse_and_normalize_video_url(raw_video_url)
                except ValueError as err:
                    raise ValidationError({"video_url": str(err)}) from err
                lesson.video_url = normalized_url
                lesson.video_provider = data.get('video_provider') or detected_provider
            else:
                lesson.video_url = ''
                lesson.video_provider = ''
            fields.extend(['video_url', 'video_provider'])

        if any(k in data for k in ('code_blocks', 'code_snippet', 'code_language')):
            code_blocks, code_snippet, code_language = cls.normalize_code_blocks(
                code_blocks=data.get('code_blocks', lesson.code_blocks),
                code_snippet=data.get('code_snippet', lesson.code_snippet),
                code_language=data.get('code_language', lesson.code_language),
            )
            lesson.code_blocks = code_blocks
            lesson.code_snippet = code_snippet
            lesson.code_language = code_language
            fields.extend(['code_blocks', 'code_snippet', 'code_language'])

        if 'quiz_data' in data:
            raw_quiz = data['quiz_data']
            lesson.quiz_data = cls.validate_and_normalize_quiz_data(raw_quiz) if raw_quiz else {}
            fields.append('quiz_data')

        if 'duration_seconds' in data:
            diff = data['duration_seconds'] - lesson.duration_seconds
            lesson.duration_seconds = data['duration_seconds']
            fields.append('duration_seconds')
            if diff != 0:
                Course.objects.filter(id=lesson.module.course_id).update(
                    duration_seconds=models.Case(
                        models.When(duration_seconds__gte=-diff, then=F('duration_seconds') + diff),
                        default=0
                    )
                )

        if 'order' in data:
            lesson.order = data['order']
            fields.append('order')
        if 'is_free_preview' in data:
            lesson.is_free_preview = data['is_free_preview']
            fields.append('is_free_preview')
        if 'attachments' in data:
            lesson.attachments = data['attachments']
            fields.append('attachments')

        lesson.save(update_fields=list(dict.fromkeys(fields)))
        return lesson

    @classmethod
    def delete_lesson(cls, actor_user: User, lesson: Lesson) -> None:
        cls.check_manager_permission(actor_user, lesson.module.course.community)
        module = lesson.module
        duration = lesson.duration_seconds

        with transaction.atomic():
            lesson.delete()
            CourseModule.objects.filter(id=module.id).update(
                lessons_count=models.Case(
                    models.When(lessons_count__gt=0, then=F('lessons_count') - 1),
                    default=0
                )
            )
            Course.objects.filter(id=module.course_id).update(
                lessons_count=models.Case(
                    models.When(lessons_count__gt=0, then=F('lessons_count') - 1),
                    default=0
                ),
                duration_seconds=models.Case(
                    models.When(duration_seconds__gte=duration, then=F('duration_seconds') - duration),
                    default=0
                )
            )

    @classmethod
    def attach_video_to_lesson(
        cls,
        actor_user: User,
        lesson: Lesson,
        video_file=None,
        video_url: str = "",
        video_asset_id: str = "",
    ) -> Lesson:
        """
        Attaches a video to a lesson (`BE-08` & `BE-09`):
        - Supports direct `video_asset_id` (from presigned Mux or UploadThing upload).
        - Supports external platform URLs (`YouTube`, `Vimeo`, `Dailymotion`) without Mux transcoding.
        - Supports direct video file URLs (`.mp4`, `.webm`, `.m3u8`).
        - Supports streaming large `video_file` uploads (up to 500 MB) to UploadThing / local storage + Mux.
        """
        cls.check_manager_permission(actor_user, lesson.module.course.community)

        if video_asset_id:
            try:
                video_asset = VideoAsset.objects.get(id=video_asset_id)
            except (VideoAsset.DoesNotExist, ValueError) as err:
                raise NotFound("Asset vidéo introuvable.") from err
            lesson.video_asset = video_asset
            lesson.video_provider = video_asset.provider or VideoProvider.MUX
            if lesson.lesson_type == LessonType.TEXT:
                lesson.lesson_type = LessonType.VIDEO
            lesson.save(update_fields=['video_asset', 'video_provider', 'lesson_type', 'updated_at'])
            return lesson

        target_url = video_url.strip() if video_url else ""
        if target_url and not video_file:
            try:
                normalized_url, provider, _ = parse_and_normalize_video_url(target_url)
            except ValueError as err:
                raise ValidationError({"video_url": str(err)}) from err

            # External video platforms (YouTube, Vimeo, Dailymotion) are stored directly
            if provider in (VideoProvider.YOUTUBE, VideoProvider.VIMEO, VideoProvider.DAILYMOTION):
                lesson.video_url = normalized_url
                lesson.video_provider = provider
                lesson.video_asset = None
                if lesson.lesson_type == LessonType.TEXT:
                    lesson.lesson_type = LessonType.VIDEO
                lesson.save(
                    update_fields=['video_url', 'video_provider', 'video_asset', 'lesson_type', 'updated_at']
                )
                return lesson
            target_url = normalized_url

        if video_file:
            file_name = getattr(video_file, 'name', 'lesson_video.mp4') or 'lesson_video.mp4'
            mime_type = getattr(video_file, 'content_type', 'video/mp4') or 'video/mp4'
            res_ut = UploadThingService.upload_file_direct(
                user=actor_user,
                file_name=file_name,
                mime_type=mime_type,
                purpose='lesson_video',
                file_obj=video_file,
            )
            target_url = res_ut['file_url']

        if not target_url:
            raise ValidationError("Veuillez fournir un fichier vidéo ou une URL vidéo.")

        # Ingest direct video file URL into Mux (or local/UploadThing playback fallback if Mux keys are not set)
        video_asset = MuxVideoService.create_asset_from_url(
            user=actor_user,
            input_url=target_url,
            title=f"{lesson.title} (Vidéo)",
            description=f"Cours : {lesson.module.course.title} | Leçon : {lesson.title}",
        )
        # If Mux credentials are not configured, mark provider as uploadthing/direct so hls_url returns target_url directly
        if not MuxVideoService._get_auth():
            video_asset.provider = 'uploadthing'
            video_asset.status = VideoStatus.READY
            meta = dict(video_asset.metadata or {})
            meta['file_url'] = target_url
            meta['source_url'] = target_url
            video_asset.metadata = meta
            video_asset.save(update_fields=['provider', 'status', 'metadata', 'updated_at'])

        lesson.video_asset = video_asset
        lesson.video_url = target_url
        lesson.video_provider = video_asset.provider or VideoProvider.MUX
        if lesson.lesson_type == LessonType.TEXT:
            lesson.lesson_type = LessonType.VIDEO
        lesson.save(
            update_fields=['video_asset', 'video_url', 'video_provider', 'lesson_type', 'updated_at']
        )
        return lesson

    @classmethod
    def add_attachment_to_lesson(
        cls,
        actor_user: User,
        lesson: Lesson,
        attachment_file,
    ) -> dict[str, Any]:
        """
        Uploads a downloadable document / attachment to UploadThing and records it in lesson.attachments.
        """
        cls.check_manager_permission(actor_user, lesson.module.course.community)

        res_ut = UploadThingService.upload_file_direct(
            user=actor_user,
            file_name=getattr(attachment_file, 'name', 'attachment'),
            mime_type=getattr(attachment_file, 'content_type', 'application/octet-stream') or 'application/octet-stream',
            purpose='lesson_attachment',
            file_obj=attachment_file,
        )

        item = {
            'id': str(uuid.uuid4()),
            'name': getattr(attachment_file, 'name', 'attachment'),
            'url': res_ut['file_url'],
            'size': res_ut.get('file_size') or getattr(attachment_file, 'size', 0),
            'mime_type': getattr(attachment_file, 'content_type', 'application/octet-stream') or 'application/octet-stream',
            'uploaded_at': timezone.now().isoformat(),
        }

        current = list(lesson.attachments or [])
        current.append(item)
        lesson.attachments = current
        lesson.save(update_fields=['attachments', 'updated_at'])
        return item

    @classmethod
    def remove_attachment_from_lesson(
        cls,
        actor_user: User,
        lesson: Lesson,
        attachment_id_or_url: str,
    ) -> Lesson:
        """
        Removes an attachment from lesson.attachments matching the given ID or URL.
        """
        cls.check_manager_permission(actor_user, lesson.module.course.community)

        current = list(lesson.attachments or [])
        filtered = [
            att for att in current
            if att.get('id') != attachment_id_or_url and att.get('url') != attachment_id_or_url
        ]
        lesson.attachments = filtered
        lesson.save(update_fields=['attachments', 'updated_at'])
        return lesson
