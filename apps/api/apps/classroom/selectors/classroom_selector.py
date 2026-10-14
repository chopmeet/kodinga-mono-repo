from typing import Optional
from django.db.models import Prefetch, Q, QuerySet
from rest_framework.exceptions import NotAuthenticated, NotFound, PermissionDenied
from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.classroom.models.course import Course
from apps.classroom.models.module import CourseModule
from apps.classroom.models.lesson import Lesson
from apps.classroom.models.progress import CourseEnrollment, LessonProgress
from apps.classroom.services.progress_service import ProgressService
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus


class ClassroomSelector:
    """
    Optimized queries for reading courses, modules, lessons and user learning status.
    Strictly restricted to connected active members of the community.
    """

    @classmethod
    def check_active_member(cls, community: Community, user: Optional[User]) -> bool:
        if not user or not user.is_authenticated:
            raise NotAuthenticated("Connexion requise pour consulter les cours de cette communauté.")
        if user.is_superuser or community.owner_id == user.id:
            return True
        is_active = CommunityMember.objects.filter(
            community=community,
            user=user,
            status=MembershipStatus.ACTIVE
        ).exists()
        if not is_active:
            raise PermissionDenied("Vous devez être membre actif de cette communauté pour accéder aux cours et à la progression.")
        return True

    @classmethod
    def is_manager(cls, community: Community, user: Optional[User]) -> bool:
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or community.owner_id == user.id:
            return True
        return CommunityMember.objects.filter(
            community=community,
            user=user,
            status=MembershipStatus.ACTIVE,
            role__in=[CommunityRole.OWNER, CommunityRole.ADMIN]
        ).exists()

    @classmethod
    def list_community_courses(
        cls,
        community: Community,
        user: Optional[User] = None,
        is_published: Optional[bool] = None,
        level: Optional[str] = None,
        search: Optional[str] = None
    ) -> QuerySet[Course]:
        cls.check_active_member(community, user)

        qs = Course.objects.filter(community=community)

        is_mgr = cls.is_manager(community, user)
        if not is_mgr:
            qs = qs.filter(is_published=True)
        elif is_published is not None:
            qs = qs.filter(is_published=is_published)

        if level:
            qs = qs.filter(level=level)

        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))

        qs = qs.select_related('community', 'author').order_by('order', '-created_at')

        # Attach enrollment progress to course objects if user is logged in
        if user and user.is_authenticated:
            enrollments = {
                e.course_id: e.progress_percent
                for e in CourseEnrollment.objects.filter(course__in=qs, user=user)
            }
            courses = list(qs)
            for c in courses:
                c.user_progress_percent = enrollments.get(c.id, 0.0)
                c.user_is_enrolled = c.id in enrollments
            return courses

        return qs

    @classmethod
    def get_course_by_slug(
        cls,
        community: Community,
        slug: str,
        user: Optional[User] = None
    ) -> Course:
        cls.check_active_member(community, user)

        is_mgr = cls.is_manager(community, user)

        qs = Course.objects.filter(community=community, slug=slug)
        if not is_mgr:
            qs = qs.filter(is_published=True)

        # Prefetch modules with ordered lessons and related video asset
        lessons_prefetch = Prefetch(
            'lessons',
            queryset=Lesson.objects.select_related('video_asset').order_by('order', 'created_at')
        )
        modules_prefetch = Prefetch(
            'modules',
            queryset=CourseModule.objects.prefetch_related(lessons_prefetch).order_by('order', 'created_at')
        )

        course = qs.select_related('community', 'author').prefetch_related(modules_prefetch).first()
        if not course:
            raise NotFound("Cours introuvable.")

        # Compute progress and lock state per lesson for the current user
        completed_lesson_ids = set()
        enrollment_percent = 0.0
        is_enrolled = False

        if user and user.is_authenticated:
            enrollment = CourseEnrollment.objects.filter(course=course, user=user).first()
            if enrollment:
                enrollment_percent = enrollment.progress_percent
                is_enrolled = True

            completed_lesson_ids = set(
                LessonProgress.objects.filter(
                    lesson__module__course=course,
                    user=user,
                    is_completed=True
                ).values_list('lesson_id', flat=True)
            )

        course.user_progress_percent = enrollment_percent
        course.user_is_enrolled = is_enrolled

        # Iterate modules and lessons to annotate is_completed and is_locked
        all_ordered_lessons = []
        for module in course.modules.all():
            for lesson in module.lessons.all():
                all_ordered_lessons.append(lesson)

        unlocked_so_far = True
        for idx, lesson in enumerate(all_ordered_lessons):
            lesson.is_completed = lesson.id in completed_lesson_ids

            if lesson.is_free_preview or is_mgr or not course.is_sequential:
                lesson.is_locked = False
            elif idx == 0:
                lesson.is_locked = False
                if not lesson.is_completed:
                    unlocked_so_far = False
            else:
                lesson.is_locked = not unlocked_so_far
                if not lesson.is_completed:
                    unlocked_so_far = False

        return course

    @classmethod
    def get_lesson_by_id(
        cls,
        community: Community,
        course_slug: str,
        lesson_id: str,
        user: Optional[User] = None
    ) -> Lesson:
        cls.check_active_member(community, user)

        try:
            lesson = Lesson.objects.select_related(
                'module__course__community',
                'video_asset'
            ).get(
                id=lesson_id,
                module__course__community=community,
                module__course__slug=course_slug
            )
        except Lesson.DoesNotExist:
            raise NotFound("Leçon introuvable.")

        lesson.is_locked = ProgressService.is_lesson_locked(user, lesson)
        if user and user.is_authenticated:
            prog = LessonProgress.objects.filter(lesson=lesson, user=user).first()
            lesson.is_completed = prog.is_completed if prog else False
        else:
            lesson.is_completed = False

        return lesson

    @classmethod
    def list_course_modules(
        cls,
        community: Community,
        course_slug: str,
        user: Optional[User] = None
    ) -> list[CourseModule]:
        """
        List all modules for a given course with preloaded lessons and student lock/progress state.
        """
        course = cls.get_course_by_slug(community, course_slug, user=user)
        return list(course.modules.all())

    @classmethod
    def get_module_by_id(
        cls,
        community: Community,
        course_slug: str,
        module_id: str,
        user: Optional[User] = None
    ) -> CourseModule:
        """
        Retrieve a single module by ID within a course with lessons and lock/progress state.
        """
        course = cls.get_course_by_slug(community, course_slug, user=user)
        for module in course.modules.all():
            if str(module.id) == str(module_id):
                return module
        raise NotFound("Module introuvable dans ce cours.")

