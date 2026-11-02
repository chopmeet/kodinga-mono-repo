from typing import Optional

from common.permissions.base import is_superadmin_user
from django.db.models import Prefetch, Q, QuerySet
from rest_framework.exceptions import NotAuthenticated, NotFound, PermissionDenied

from apps.accounts.models.user import User
from apps.classroom.models.course import Course
from apps.classroom.models.lesson import Lesson
from apps.classroom.models.module import CourseModule
from apps.classroom.models.progress import CourseEnrollment, LessonProgress
from apps.classroom.services.progress_service import ProgressService
from apps.communities.models.community import Community
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)


class ClassroomSelector:
    """
    Optimized queries for reading courses, modules, lessons and user learning status.
    Strictly restricted to connected active members of the community.
    """

    @classmethod
    def check_active_member(cls, community: Community, user: Optional[User]) -> bool:
        if not user or not user.is_authenticated:
            raise NotAuthenticated("Connexion requise pour consulter les cours de cette communauté.")
        if is_superadmin_user(user) or community.owner_id == user.id:
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
        if is_superadmin_user(user) or community.owner_id == user.id:
            return True
        from apps.memberships.permissions import has_community_permission
        if CommunityMember.objects.filter(
            community=community,
            user=user,
            status=MembershipStatus.ACTIVE,
            role__in=[CommunityRole.OWNER, CommunityRole.ADMIN]
        ).exists():
            return True
        return has_community_permission(user, community, 'can_manage_courses')

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

        if user and user.is_authenticated:
            enrollments = {
                e.course_id: e
                for e in CourseEnrollment.objects.filter(course__in=qs, user=user)
            }
            courses = list(qs)
            for c in courses:
                enr = enrollments.get(c.id)
                c.user_progress_percent = enr.progress_percent if enr else 0.0
                c.user_is_enrolled = enr is not None
                c.user_completed_at = enr.completed_at if enr else None
                c.user_is_completed = bool(enr and (enr.completed_at or enr.progress_percent >= 100.0))
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

        progress_by_lesson_id = {}
        enrollment_percent = 0.0
        is_enrolled = False
        completed_at = None

        if user and user.is_authenticated:
            enrollment = CourseEnrollment.objects.filter(course=course, user=user).first()
            if enrollment:
                enrollment_percent = enrollment.progress_percent
                is_enrolled = True
                completed_at = enrollment.completed_at

            progress_by_lesson_id = {
                lp.lesson_id: lp
                for lp in LessonProgress.objects.filter(
                    lesson__module__course=course,
                    user=user,
                )
            }

        all_ordered_lessons = []
        for module in course.modules.all():
            for lesson in module.lessons.all():
                all_ordered_lessons.append(lesson)

        total_lessons = len(all_ordered_lessons)
        completed_lesson_ids = {
            lid for lid, lp in progress_by_lesson_id.items() if lp.is_completed
        }
        completed_count = len(completed_lesson_ids)

        if user and user.is_authenticated and total_lessons > 0:
            computed_pct = round(min(100.0, (completed_count / total_lessons) * 100.0), 1)
            if computed_pct != enrollment_percent and (is_enrolled or completed_count > 0):
                enrollment_percent = computed_pct

        course.user_progress_percent = enrollment_percent
        course.user_is_enrolled = is_enrolled or completed_count > 0
        course.user_completed_at = completed_at
        course.user_is_completed = bool(
            total_lessons > 0 and (completed_count >= total_lessons or completed_at is not None)
        )
        course.completed_lessons_count = completed_count
        course.total_lessons_count = total_lessons

        unlocked_so_far = True
        for idx, lesson in enumerate(all_ordered_lessons):
            lp = progress_by_lesson_id.get(lesson.id)
            lesson.is_completed = bool(lp and lp.is_completed)
            lesson.quiz_score = lp.quiz_score if lp else None
            lesson.quiz_passed = lp.quiz_passed if lp else False
            lesson.quiz_attempts_count = lp.quiz_attempts_count if lp else 0
            lesson.user_quiz_result = lp.quiz_last_submission if (lp and lp.quiz_last_submission) else None
            lesson._viewer_is_manager = is_mgr

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
        is_mgr = cls.is_manager(community, user)

        try:
            lesson = Lesson.objects.select_related(
                'module__course__community',
                'video_asset'
            ).get(
                id=lesson_id,
                module__course__community=community,
                module__course__slug=course_slug
            )
        except Lesson.DoesNotExist as err:
            raise NotFound("Leçon introuvable.") from err

        lesson.is_locked = ProgressService.is_lesson_locked(user, lesson)
        lesson._viewer_is_manager = is_mgr
        if user and user.is_authenticated:
            prog = LessonProgress.objects.filter(lesson=lesson, user=user).first()
            lesson.is_completed = prog.is_completed if prog else False
            lesson.quiz_score = prog.quiz_score if prog else None
            lesson.quiz_passed = prog.quiz_passed if prog else False
            lesson.quiz_attempts_count = prog.quiz_attempts_count if prog else 0
            lesson.user_quiz_result = prog.quiz_last_submission if (prog and prog.quiz_last_submission) else None
        else:
            lesson.is_completed = False
            lesson.quiz_score = None
            lesson.quiz_passed = False
            lesson.quiz_attempts_count = 0
            lesson.user_quiz_result = None

        return lesson

    @classmethod
    def list_course_modules(
        cls,
        community: Community,
        course_slug: str,
        user: Optional[User] = None
    ) -> list[CourseModule]:
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
        course = cls.get_course_by_slug(community, course_slug, user=user)
        for module in course.modules.all():
            if str(module.id) == str(module_id):
                return module
        raise NotFound("Module introuvable dans ce cours.")
