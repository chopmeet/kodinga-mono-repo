from typing import Any, Optional

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.classroom.models.course import Course
from apps.classroom.models.lesson import Lesson
from apps.classroom.models.progress import CourseEnrollment, LessonProgress
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.memberships.permissions import check_community_membership
from apps.notifications.models.notification import NotificationType
from apps.notifications.services.notification_service import NotificationService


class ProgressService:
    """
    Manages learner progress tracking, sequential lesson unlocking, quiz grading (BE-10),
    and course completion metrics & congratulations screen payload (BE-12).
    """

    @classmethod
    def is_lesson_locked(cls, user: User, lesson: Lesson) -> bool:
        """
        Calculates whether a lesson is locked for a specific user under sequential learning rules.
        """
        if lesson.is_free_preview:
            return False

        if not user or not user.is_authenticated:
            return not lesson.is_free_preview

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

        if not course.is_sequential:
            return False

        all_course_lessons = Lesson.objects.filter(
            module__course=course
        ).select_related('module').order_by('module__order', 'module__created_at', 'order', 'created_at')

        preceding_lesson_ids = []
        for les in all_course_lessons:
            if les.id == lesson.id:
                break
            preceding_lesson_ids.append(les.id)

        if not preceding_lesson_ids:
            return False

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
        Attaches consolidated course completion & congratulations screen metadata (`BE-12`).
        """
        course = lesson.module.course
        community = course.community

        if not user or not user.is_authenticated:
            raise PermissionDenied("Connexion requise pour enregistrer la progression.")

        check_community_membership(user, community, "enregistrer votre progression")

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

            enrollment, _ = CourseEnrollment.objects.get_or_create(
                course=course,
                user=user
            )

            ordered_lessons = list(
                Lesson.objects.filter(module__course=course)
                .select_related('module')
                .order_by('module__order', 'module__created_at', 'order', 'created_at')
            )
            total_lessons = len(ordered_lessons)
            if course.lessons_count != total_lessons:
                Course.objects.filter(id=course.id).update(lessons_count=total_lessons)
                course.lessons_count = total_lessons

            completed_lesson_ids = set(
                LessonProgress.objects.filter(
                    lesson__module__course=course,
                    user=user,
                    is_completed=True
                ).values_list('lesson_id', flat=True)
            )
            completed_count = len(completed_lesson_ids)

            if total_lessons > 0:
                progress_pct = round(min(100.0, (completed_count / total_lessons) * 100.0), 1)
            else:
                progress_pct = 0.0

            now = timezone.now()
            is_course_completed = total_lessons > 0 and completed_count >= total_lessons
            is_first_time_course_completed = is_course_completed and (enrollment.first_completed_at is None)
            just_completed_course = is_first_time_course_completed

            enrollment.progress_percent = progress_pct
            if is_course_completed and not enrollment.completed_at:
                enrollment.completed_at = now
            elif not is_course_completed:
                enrollment.completed_at = None

            if is_first_time_course_completed:
                enrollment.first_completed_at = now

            enrollment.save(update_fields=['progress_percent', 'completed_at', 'first_completed_at', 'updated_at'])

            xp_awarded = 0
            if is_completed:
                from apps.gamification.models.reputation import (
                    ReputationAction,
                    ReputationTransaction,
                )
                from apps.gamification.services.gamification_service import (
                    GamificationService,
                )

                has_prior_lesson_tx = ReputationTransaction.objects.filter(
                    user=user,
                    community=community,
                    action=ReputationAction.LESSON_COMPLETED,
                    reference_id=str(lesson.id),
                ).exists()

                _rep, lesson_tx = GamificationService.award_lesson_completed(user=user, lesson=lesson)
                if lesson_tx and not has_prior_lesson_tx:
                    xp_awarded += lesson_tx.points

            if is_first_time_course_completed:
                from apps.gamification.models.reputation import (
                    ReputationAction,
                    ReputationTransaction,
                )
                from apps.gamification.services.gamification_service import (
                    GamificationService,
                )

                has_prior_course_tx = ReputationTransaction.objects.filter(
                    user=user,
                    community=community,
                    action=ReputationAction.COURSE_COMPLETED,
                    reference_id=str(course.id),
                ).exists()

                _rep, course_tx = GamificationService.award_course_completed(user=user, course=course)
                if course_tx and not has_prior_course_tx:
                    xp_awarded += course_tx.points

                NotificationService.create_notification(
                    recipient=user,
                    actor=None,
                    title=f"Formation terminée : {course.title} 🎉",
                    body=(
                        f"Félicitations ! Vous avez terminé 100% de la formation « {course.title} » "
                        f"dans la communauté {community.name}."
                    ),
                    notification_type=NotificationType.SYSTEM,
                    action_url=f"/communities/{community.slug}/classroom/{course.slug}",
                    target_type="course_completion",
                    target_id=f"{course.id}:{user.id}",
                    metadata={
                        "course_id": str(course.id),
                        "course_slug": course.slug,
                        "course_title": course.title,
                        "community_slug": community.slug,
                        "completed_at": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
                        "xp_awarded": xp_awarded,
                    },
                )

            next_lesson = None
            for les in ordered_lessons:
                if les.id not in completed_lesson_ids:
                    next_lesson = les
                    break

            progress.course_id = str(course.id)
            progress.course_slug = course.slug
            progress.course_title = course.title
            progress.course_progress_percent = enrollment.progress_percent
            progress.completed_lessons_count = completed_count
            progress.total_lessons_count = total_lessons
            progress.is_course_completed = is_course_completed
            progress.just_completed_course = just_completed_course
            progress.course_completed_at = enrollment.completed_at
            progress.next_lesson_id = str(next_lesson.id) if next_lesson else None
            progress.next_lesson_slug = next_lesson.slug if next_lesson else None
            progress.next_lesson_title = next_lesson.title if next_lesson else None
            progress.xp_awarded = xp_awarded
            progress.congratulations = (
                {
                    "show_congratulations": is_course_completed,
                    "just_completed": just_completed_course,
                    "title": f"Félicitations ! Vous avez terminé la formation « {course.title} » 🎉",
                    "course_id": str(course.id),
                    "course_slug": course.slug,
                    "course_title": course.title,
                    "community_name": community.name,
                    "community_slug": community.slug,
                    "completed_at": (
                        enrollment.completed_at.isoformat()
                        if enrollment.completed_at
                        else None
                    ),
                    "completed_lessons_count": completed_count,
                    "total_lessons_count": total_lessons,
                    "xp_awarded": xp_awarded,
                }
                if is_course_completed
                else None
            )

            return progress

    @classmethod
    def submit_quiz(
        cls,
        user: User,
        lesson: Lesson,
        submitted_answers: Any,
    ) -> dict[str, Any]:
        """
        Grades a learner's quiz submission (`BE-10`), supporting single-choice and
        multiple-choice questions, persists the attempt and score on `LessonProgress`,
        and automatically marks the lesson completed if `score_percent >= passing_score`.
        """
        course = lesson.module.course
        community = course.community

        if not user or not user.is_authenticated:
            raise PermissionDenied("Connexion requise pour soumettre un quiz.")

        check_community_membership(user, community, "participer à ce quiz")

        if cls.is_lesson_locked(user, lesson):
            raise PermissionDenied("Cette leçon est verrouillée. Vous devez valider les leçons précédentes.")

        quiz_data = lesson.quiz_data if isinstance(lesson.quiz_data, dict) else {}
        questions = quiz_data.get("questions", [])
        if not questions:
            raise ValidationError({"quiz": "Cette leçon ne contient aucun quiz configuré."})

        passing_score = float(quiz_data.get("passing_score", 50.0))

        # Normalize submitted_answers into a lookup map: question_id_or_index -> list of selected values
        answers_map: dict[str, list[str]] = {}
        if isinstance(submitted_answers, dict):
            for k, v in submitted_answers.items():
                if isinstance(v, list):
                    answers_map[str(k)] = [str(item).strip() for item in v if item is not None]
                elif v is not None and str(v).strip() != "":
                    answers_map[str(k)] = [str(v).strip()]
                else:
                    answers_map[str(k)] = []
        elif isinstance(submitted_answers, list):
            for idx, item in enumerate(submitted_answers):
                if isinstance(item, dict) and ("question_id" in item or "id" in item):
                    qid = str(item.get("question_id") or item.get("id"))
                    sel = item.get("selected_options")
                    if sel is None:
                        sel = item.get("selected_option", item.get("answer", item.get("answers")))
                    if isinstance(sel, list):
                        answers_map[qid] = [str(x).strip() for x in sel if x is not None]
                    elif sel is not None and str(sel).strip() != "":
                        answers_map[qid] = [str(sel).strip()]
                    else:
                        answers_map[qid] = []
                else:
                    if isinstance(item, list):
                        answers_map[str(idx)] = [str(x).strip() for x in item if x is not None]
                    elif item is not None and str(item).strip() != "":
                        answers_map[str(idx)] = [str(item).strip()]
                    else:
                        answers_map[str(idx)] = []
        else:
            raise ValidationError({"answers": "Format de réponses invalide."})

        total_points = 0.0
        earned_points = 0.0
        correct_questions_count = 0
        question_results: list[dict[str, Any]] = []

        for idx, q in enumerate(questions):
            q_id = str(q.get("id") or f"q_{idx + 1}")
            q_points = float(q.get("points", 1.0))
            total_points += q_points

            options = q.get("options", [])
            correct_ids: set[str] = set()
            option_lookup: dict[str, str] = {}

            for opt_idx, opt in enumerate(options):
                if isinstance(opt, dict):
                    oid = str(opt.get("id") or f"opt_{opt_idx}")
                    otext = str(opt.get("text") or "").strip()
                    if opt.get("is_correct"):
                        correct_ids.add(oid)
                else:
                    oid = f"opt_{opt_idx}"
                    otext = str(opt).strip()
                option_lookup[oid] = oid
                option_lookup[str(opt_idx)] = oid
                if otext:
                    option_lookup[otext] = oid

            q_correct_sources = []
            for field in ("correct_option_ids", "correct_answers", "correct_answer"):
                val = q.get(field)
                if isinstance(val, list):
                    q_correct_sources.extend(val)
                elif val is not None:
                    q_correct_sources.append(val)

            for cid in q_correct_sources:
                cid_str = str(cid)
                if cid_str in option_lookup:
                    correct_ids.add(option_lookup[cid_str])

            raw_selected = (
                answers_map.get(q_id)
                if q_id in answers_map
                else answers_map.get(str(idx), [])
            )
            selected_option_ids: set[str] = set()
            for sel_val in raw_selected:
                mapped = option_lookup.get(sel_val)
                if mapped:
                    selected_option_ids.add(mapped)

            is_correct = bool(correct_ids) and (selected_option_ids == correct_ids)
            if is_correct:
                earned_points += q_points
                correct_questions_count += 1

            question_results.append(
                {
                    "question_id": q_id,
                    "question": q.get("question", ""),
                    "question_type": q.get("question_type", "single_choice"),
                    "selected_option_ids": sorted(selected_option_ids),
                    "correct_option_ids": sorted(correct_ids),
                    "is_correct": is_correct,
                    "points_earned": q_points if is_correct else 0.0,
                    "points_possible": q_points,
                    "explanation": q.get("explanation", ""),
                }
            )

        score_percent = round((earned_points / total_points) * 100.0, 1) if total_points > 0 else 0.0
        passed = score_percent >= passing_score
        submitted_at = timezone.now()

        # D4: Hide solution and explanations from learners until they pass the quiz
        final_question_results = []
        for qr in question_results:
            item = dict(qr)
            if not passed:
                item["correct_option_ids"] = []
                item["explanation"] = ""
            final_question_results.append(item)

        with transaction.atomic():
            progress, _ = LessonProgress.objects.get_or_create(lesson=lesson, user=user)
            progress.quiz_attempts_count = (progress.quiz_attempts_count or 0) + 1
            progress.quiz_score = score_percent
            progress.quiz_passed = bool(progress.quiz_passed or passed)

            submission_summary = {
                "lesson_id": str(lesson.id),
                "course_id": str(course.id),
                "user_id": str(user.id),
                "score_percent": score_percent,
                "passing_score": passing_score,
                "passed": passed,
                "earned_points": earned_points,
                "total_points": total_points,
                "correct_questions_count": correct_questions_count,
                "total_questions_count": len(questions),
                "attempt_number": progress.quiz_attempts_count,
                "submitted_at": submitted_at.isoformat(),
                "question_results": final_question_results,
            }
            progress.quiz_last_submission = submission_summary
            progress.save(
                update_fields=[
                    "quiz_attempts_count",
                    "quiz_score",
                    "quiz_passed",
                    "quiz_last_submission",
                    "updated_at",
                ]
            )

            # If passed, mark the lesson completed and update course progress
            updated_progress = cls.update_progress(
                user=user,
                lesson=lesson,
                is_completed=bool(passed or progress.is_completed),
            )

        return {
            **submission_summary,
            "is_lesson_completed": updated_progress.is_completed,
            "xp_awarded": getattr(updated_progress, "xp_awarded", 0),
            "course_progress_percent": getattr(updated_progress, "course_progress_percent", 0.0),
            "completed_lessons_count": getattr(updated_progress, "completed_lessons_count", 0),
            "total_lessons_count": getattr(updated_progress, "total_lessons_count", 0),
            "is_course_completed": getattr(updated_progress, "is_course_completed", False),
            "just_completed_course": getattr(updated_progress, "just_completed_course", False),
            "course_completed_at": (
                updated_progress.course_completed_at.isoformat()
                if getattr(updated_progress, "course_completed_at", None)
                else None
            ),
            "congratulations": getattr(updated_progress, "congratulations", None),
        }

    @classmethod
    def enroll_user(cls, user: User, course: Course) -> CourseEnrollment:
        community = course.community
        if not user or not user.is_authenticated:
            raise PermissionDenied("Connexion requise pour s'inscrire à ce cours.")

        check_community_membership(user, community, "vous inscrire à ce cours")

        enrollment, _ = CourseEnrollment.objects.get_or_create(
            course=course,
            user=user
        )
        return enrollment
