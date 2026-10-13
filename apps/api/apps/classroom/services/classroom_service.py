from typing import Any, Dict, Optional
from django.db import models, transaction
from django.db.models import F
from django.utils.text import slugify
from rest_framework.exceptions import PermissionDenied, ValidationError, NotFound
from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.classroom.models.course import Course
from apps.classroom.models.module import CourseModule
from apps.classroom.models.lesson import Lesson
from apps.media.models.video_asset import VideoAsset
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus


class ClassroomService:
    """
    Business service managing pedagogical courses, modules, lessons and video attachments.
    """

    @classmethod
    def check_manager_permission(cls, user: User, community: Community) -> None:
        """
        Enforces that only community owners or administrators can manage classroom content.
        """
        if user.is_superuser or community.owner_id == user.id:
            return

        is_manager = CommunityMember.objects.filter(
            community=community,
            user=user,
            status=MembershipStatus.ACTIVE,
            role__in=[CommunityRole.OWNER, CommunityRole.ADMIN]
        ).exists()

        if not is_manager:
            raise PermissionDenied("Seul le propriétaire ou un administrateur de la communauté peut gérer les cours.")

    # ---------------- Course Operations ----------------

    @classmethod
    def create_course(cls, actor_user: User, community: Community, data: Dict[str, Any]) -> Course:
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
            return course

    @classmethod
    def update_course(cls, actor_user: User, course: Course, data: Dict[str, Any]) -> Course:
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
        return course

    @classmethod
    def delete_course(cls, actor_user: User, course: Course) -> None:
        cls.check_manager_permission(actor_user, course.community)
        course.delete()

    # ---------------- Module Operations ----------------

    @classmethod
    def create_module(cls, actor_user: User, course: Course, data: Dict[str, Any]) -> CourseModule:
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
    def update_module(cls, actor_user: User, module: CourseModule, data: Dict[str, Any]) -> CourseModule:
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
    def create_lesson(cls, actor_user: User, module: CourseModule, data: Dict[str, Any]) -> Lesson:
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
            except VideoAsset.DoesNotExist:
                raise NotFound("La vidéo spécifiée est introuvable.")

        duration = data.get('duration_seconds', 0)
        content = data.get('content', '')
        if not duration and video_asset and video_asset.duration:
            duration = int(video_asset.duration)
        elif not duration and content:
            # Estimate reading time at ~200 wpm (3.3 words per second)
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
                lesson_type=data.get('lesson_type', 'text' if not video_asset else 'video'),
                video_asset=video_asset,
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
    def update_lesson(cls, actor_user: User, lesson: Lesson, data: Dict[str, Any]) -> Lesson:
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
                except VideoAsset.DoesNotExist:
                    raise NotFound("Vidéo introuvable.")
            else:
                lesson.video_asset = None
            fields.append('video_asset')

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

        lesson.save(update_fields=fields)
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
