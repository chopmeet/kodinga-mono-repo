from typing import Optional
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from apps.accounts.models.user import User
from apps.classroom.models.course import Course
from apps.classroom.models.lesson import Lesson
from apps.classroom.models.progress import CourseEnrollment, LessonProgress
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus


class ProgressService:
    """
    Manages learner progress tracking, sequential lesson unlocking, and course completion metrics.
    """

    @classmethod
    def is_lesson_locked(cls, user: User, lesson: Lesson) -> bool:
        """
        Calculates whether a lesson is locked for a specific user under sequential learning rules.
        """
        # Free preview lessons are always unlocked
        if lesson.is_free_preview:
            return False

        if not user or not user.is_authenticated:
            return not lesson.is_free_preview

        # Superusers/superadmins and community managers (owner / admin) have bypass access
        course = lesson.module.course
        community = course.community
        from common.permissions.base import is_superadmin_user
        if is_superadmin_user(user) or community.owner_id == user.id:
            return False

        is_manager = CommunityMember.objects.filter(
            community=community,
            user=user,
            status=MembershipStatus.ACTIVE,
            role__in=[CommunityRole.OWNER, CommunityRole.ADMIN]
        ).exists()
        if is_manager:
            return False

        # Non-sequential courses do not lock lessons
        if not course.is_sequential:
            return False

        # Find preceding lessons in the course ordered by module order, then lesson order
        all_course_lessons = Lesson.objects.filter(
            module__course=course
        ).select_related('module').order_by('module__order', 'module__created_at', 'order', 'created_at')

        preceding_lesson_ids = []
        for l in all_course_lessons:
            if l.id == lesson.id:
                break
            preceding_lesson_ids.append(l.id)

        if not preceding_lesson_ids:
            return False  # First lesson is always unlocked

        # Check if all preceding lessons have been completed
        completed_preceding_count = LessonProgress.objects.filter(
            lesson_id__in=preceding_lesson_ids,
            user=user,
            is_completed=True
        ).count()

        return completed_preceding_count < len(preceding_lesson_ids)

    @classmethod
    def update_progress(
        cls,
        user: User,
        lesson: Lesson,
        is_completed: Optional[bool] = None,
        last_watched_second: Optional[int] = None,
        notes: Optional[str] = None
    ) -> LessonProgress:
        """
        Updates progress for a lesson, enforcing sequential unlocking and updating course enrollment.
        Only active connected members of the community can record progress.
        """
        course = lesson.module.course
        community = course.community

        if not user or not user.is_authenticated:
            raise PermissionDenied("Connexion requise pour enregistrer la progression.")

        from common.permissions.base import is_superadmin_user
        if not is_superadmin_user(user) and community.owner_id != user.id:
            is_active = CommunityMember.objects.filter(
                community=community,
                user=user,
                status=MembershipStatus.ACTIVE
            ).exists()
            if not is_active:
                raise PermissionDenied("Vous devez être membre actif de cette communauté pour enregistrer votre progression.")

        if cls.is_lesson_locked(user, lesson):
            raise PermissionDenied("Cette leçon est verrouillée. Vous devez valider les leçons précédentes.")

        with transaction.atomic():
            progress, _ = LessonProgress.objects.get_or_create(
                lesson=lesson,
                user=user
            )

            fields = ['updated_at']

            if is_completed is not None:
                if is_completed and not progress.is_completed:
                    progress.completed_at = timezone.now()
                    fields.append('completed_at')
                elif not is_completed:
                    progress.completed_at = None
                    fields.append('completed_at')
                progress.is_completed = is_completed
                fields.append('is_completed')

            if last_watched_second is not None:
                progress.last_watched_second = last_watched_second
                fields.append('last_watched_second')

            if notes is not None:
                progress.notes = notes
                fields.append('notes')

            progress.save(update_fields=fields)

            # Auto-enroll & update CourseEnrollment metrics
            enrollment, _ = CourseEnrollment.objects.get_or_create(
                course=course,
                user=user
            )

            total_lessons = course.lessons_count or Lesson.objects.filter(module__course=course).count()
            if total_lessons > 0:
                completed_count = LessonProgress.objects.filter(
                    lesson__module__course=course,
                    user=user,
                    is_completed=True
                ).count()
                progress_pct = round((completed_count / total_lessons) * 100.0, 1)
            else:
                progress_pct = 0.0

            enrollment.progress_percent = progress_pct
            if progress_pct >= 100.0 and not enrollment.completed_at:
                enrollment.completed_at = timezone.now()
            elif progress_pct < 100.0:
                enrollment.completed_at = None

            enrollment.save(update_fields=['progress_percent', 'completed_at', 'updated_at'])

            return progress

    @classmethod
    def enroll_user(cls, user: User, course: Course) -> CourseEnrollment:
        community = course.community
        if not user or not user.is_authenticated:
            raise PermissionDenied("Connexion requise pour s'inscrire à ce cours.")

        from common.permissions.base import is_superadmin_user
        if not is_superadmin_user(user) and community.owner_id != user.id:
            is_active = CommunityMember.objects.filter(
                community=community,
                user=user,
                status=MembershipStatus.ACTIVE
            ).exists()
            if not is_active:
                raise PermissionDenied("Vous devez être membre actif de cette communauté pour vous inscrire à ce cours.")

        enrollment, _ = CourseEnrollment.objects.get_or_create(
            course=course,
            user=user
        )
        return enrollment
