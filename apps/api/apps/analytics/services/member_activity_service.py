import uuid
from decimal import Decimal
from typing import Any

from apps.accounts.models.user import User
from apps.classroom.models.module import CourseModule
from apps.classroom.models.progress import CourseEnrollment, LessonProgress
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.models.event import EventStatus
from apps.hackathons.models.application import (
    ApplicationStatus as HackathonApplicationStatus,
)
from apps.hackathons.models.application import (
    HackathonApplication,
)
from apps.hackathons.models.hackathon import Hackathon, HackathonStatus
from apps.hackathons.models.prize import HackathonPrize
from apps.hackathons.models.submission import HackathonSubmission, SubmissionStatus
from apps.hackathons.models.team import HackathonTeamMember, TeamInvitationStatus
from apps.opportunities.models.application import (
    ApplicationStatus as OpportunityApplicationStatus,
)
from apps.opportunities.models.application import (
    OpportunityApplication,
)
from django.db.models import Prefetch, Q
from django.utils import timezone


class MemberActivityService:
    """
    Centralized service to compute a member's KPIs and detailed activity across:
    1. Hackathons (participations, teams, submissions, wins/podiums, success vs failure)
    2. Events (registrations, check-in attendance, upcoming vs completed)
    3. Opportunities (applications, accepted/success, rejected/failure, in-review)
    4. Classroom Courses (enrollments, course level, overall % and module-by-module %)

    All methods accept an optional `community` parameter (community slug or UUID)
    to scope KPIs and activity items to a specific community.
    """

    @staticmethod
    def _build_community_q(prefix: str, community: str | None) -> Q:
        """
        Builds a Q filter matching either a community's slug or UUID.
        """
        if not community:
            return Q()
        community_str = str(community).strip()
        if not community_str:
            return Q()
        try:
            community_uuid = uuid.UUID(community_str)
            return Q(**{f"{prefix}__id": community_uuid}) | Q(
                **{f"{prefix}__slug": community_str}
            )
        except (ValueError, TypeError):
            return Q(**{f"{prefix}__slug": community_str})

    # =========================================================================
    # 1. HACKATHONS
    # =========================================================================
    @staticmethod
    def get_member_hackathons(
        user: User, community: str | None = None
    ) -> dict[str, Any]:
        """
        Returns all hackathons the user has participated in (via direct application,
        active team membership, or submission) along with summary KPIs.
        Optionally filtered by `community` (slug or UUID).
        """
        # 1. Direct applications
        applications_qs = HackathonApplication.objects.filter(
            applicant=user
        ).select_related("hackathon", "hackathon__community")
        if community:
            applications_qs = applications_qs.filter(
                MemberActivityService._build_community_q(
                    "hackathon__community", community
                )
            )
        applications_by_hackathon: dict[Any, HackathonApplication] = {
            app.hackathon_id: app for app in applications_qs
        }

        # 2. Active team memberships
        team_memberships_qs = (
            HackathonTeamMember.objects.filter(
                user=user, status=TeamInvitationStatus.ACCEPTED
            )
            .select_related(
                "team",
                "team__hackathon",
                "team__hackathon__community",
                "team__leader",
            )
        )
        if community:
            team_memberships_qs = team_memberships_qs.filter(
                MemberActivityService._build_community_q(
                    "team__hackathon__community", community
                )
            )
        teams_by_hackathon: dict[Any, HackathonTeamMember] = {
            tm.team.hackathon_id: tm for tm in team_memberships_qs
        }

        # 3. Submissions (either individual or via user's teams)
        team_ids = [tm.team_id for tm in team_memberships_qs]
        submissions_qs = (
            HackathonSubmission.objects.filter(
                Q(applicant=user) | Q(team_id__in=team_ids)
            )
            .select_related("hackathon", "hackathon__community", "team")
            .prefetch_related(
                Prefetch(
                    "won_prizes",
                    queryset=HackathonPrize.objects.order_by("rank"),
                )
            )
        )
        if community:
            submissions_qs = submissions_qs.filter(
                MemberActivityService._build_community_q(
                    "hackathon__community", community
                )
            )
        submissions_by_hackathon: dict[Any, HackathonSubmission] = {
            sub.hackathon_id: sub for sub in submissions_qs
        }

        # Collect all distinct hackathon IDs
        hackathon_ids = (
            set(applications_by_hackathon.keys())
            | set(teams_by_hackathon.keys())
            | set(submissions_by_hackathon.keys())
        )

        hackathons_qs = (
            Hackathon.objects.filter(id__in=hackathon_ids)
            .select_related("community")
            .order_by("-start_time", "-created_at")
        )

        items: list[dict[str, Any]] = []
        successful_count = 0
        failed_count = 0
        in_progress_count = 0
        prizes_won_count = 0
        submissions_count = 0

        active_hackathon_statuses = {
            HackathonStatus.PUBLISHED,
            HackathonStatus.REGISTRATION_OPEN,
            HackathonStatus.IN_PROGRESS,
            HackathonStatus.JUDGING,
        }

        for hackathon in hackathons_qs:
            h_id = hackathon.id
            app = applications_by_hackathon.get(h_id)
            tm = teams_by_hackathon.get(h_id)
            sub = submissions_by_hackathon.get(h_id)

            # Determine participation mode
            if tm is not None or (sub is not None and sub.team_id is not None):
                participation_mode = "team"
            elif app is not None:
                participation_mode = app.participation_mode
            else:
                participation_mode = "individual"

            # Serialize application info
            application_data = None
            if app is not None:
                application_data = {
                    "id": str(app.id),
                    "status": app.status,
                    "status_display": app.get_status_display(),
                    "participation_mode": app.participation_mode,
                    "applied_at": app.created_at,
                    "created_at": app.created_at,
                    "reviewed_at": app.reviewed_at,
                }

            # Serialize team info
            team_data = None
            if tm is not None:
                team_data = {
                    "id": str(tm.team.id),
                    "name": tm.team.name,
                    "slug": getattr(tm.team, "slug", ""),
                    "role": tm.role,
                    "is_leader": tm.team.leader_id == user.id,
                    "avatar_url": getattr(tm.team, "avatar_url", ""),
                }
            elif sub is not None and sub.team is not None:
                team_data = {
                    "id": str(sub.team.id),
                    "name": sub.team.name,
                    "slug": getattr(sub.team, "slug", ""),
                    "role": "leader" if sub.team.leader_id == user.id else "member",
                    "is_leader": sub.team.leader_id == user.id,
                    "avatar_url": getattr(sub.team, "avatar_url", ""),
                }

            # Serialize submission & prizes info
            submission_data = None
            won_prizes_list: list[dict[str, Any]] = []
            is_winner = False
            is_podium = False

            if sub is not None:
                if sub.is_final or sub.status == SubmissionStatus.SUBMITTED:
                    submissions_count += 1

                for prize in sub.won_prizes.all():
                    prizes_won_count += 1
                    won_prizes_list.append(
                        {
                            "id": str(prize.id),
                            "title": prize.title,
                            "rank": prize.rank,
                            "reward_amount": prize.reward_amount,
                            "reward_currency": prize.reward_currency,
                            "reward_description": prize.reward_description,
                            "non_cash_reward": prize.reward_description,
                        }
                    )

                if won_prizes_list or sub.rank == 1:
                    is_winner = True
                if won_prizes_list or (sub.rank is not None and sub.rank <= 3):
                    is_podium = True

                submission_data = {
                    "id": str(sub.id),
                    "title": sub.title,
                    "slug": sub.slug,
                    "tagline": sub.tagline,
                    "status": sub.status,
                    "status_display": sub.get_status_display(),
                    "is_final": sub.is_final,
                    "submitted_at": sub.submitted_at,
                    "total_score": sub.total_score,
                    "rank": sub.rank,
                    "demo_url": sub.demo_url,
                    "repository_url": sub.repository_url,
                    "prizes_won": won_prizes_list,
                }

            # Determine overall member_result & KPI bucket
            if app and app.status == HackathonApplicationStatus.REJECTED:
                member_result = "rejected"
                failed_count += 1
            elif app and app.status == HackathonApplicationStatus.WITHDRAWN:
                member_result = "withdrawn"
                failed_count += 1
            elif is_winner:
                member_result = "won"
                successful_count += 1
            elif is_podium:
                member_result = "podium"
                successful_count += 1
            elif sub and (sub.is_final or sub.status == SubmissionStatus.SUBMITTED):
                member_result = "submitted"
                successful_count += 1
            elif hackathon.status in active_hackathon_statuses:
                if app and app.status in {
                    HackathonApplicationStatus.PENDING,
                    HackathonApplicationStatus.WAITLISTED,
                }:
                    member_result = "pending"
                else:
                    member_result = "in_progress"
                in_progress_count += 1
            else:
                # Hackathon completed or cancelled without a final submission
                member_result = "failed"
                failed_count += 1

            community_summary = None
            if hackathon.community:
                community_summary = {
                    "id": str(hackathon.community.id),
                    "name": hackathon.community.name,
                    "slug": hackathon.community.slug,
                    "logo_url": hackathon.community.avatar_url,
                    "avatar_url": hackathon.community.avatar_url,
                }

            items.append(
                {
                    "id": str(hackathon.id),
                    "title": hackathon.title,
                    "slug": hackathon.slug,
                    "tagline": hackathon.tagline,
                    "short_description": hackathon.tagline,
                    "cover_image_url": hackathon.cover_image_url,
                    "banner_url": hackathon.cover_image_url,
                    "status": hackathon.status,
                    "status_display": hackathon.get_status_display(),
                    "format": hackathon.format,
                    "start_time": hackathon.start_time,
                    "end_time": hackathon.judging_end,
                    "submission_deadline": hackathon.submission_deadline,
                    "community": community_summary,
                    "participation_mode": participation_mode,
                    "application": application_data,
                    "team": team_data,
                    "submission": submission_data,
                    "member_result": member_result,
                    "is_winner": is_winner,
                    "is_podium": is_podium,
                }
            )

        total_participated = len(items)
        resolved_total = successful_count + failed_count
        success_rate = (
            round((successful_count / resolved_total) * 100.0, 1)
            if resolved_total > 0
            else 0.0
        )

        return {
            "kpis": {
                "total_participated": total_participated,
                "successful_count": successful_count,
                "failed_count": failed_count,
                "in_progress_count": in_progress_count,
                "prizes_won_count": prizes_won_count,
                "submissions_count": submissions_count,
                "success_rate": success_rate,
            },
            "hackathons": items,
        }

    # =========================================================================
    # 2. EVENTS
    # =========================================================================
    @staticmethod
    def get_member_events(
        user: User, community: str | None = None
    ) -> dict[str, Any]:
        """
        Returns all events the user has interacted with / registered for,
        along with attendance and participation KPIs.
        Optionally filtered by `community` (slug or UUID).
        """
        now = timezone.now()
        attendances = (
            EventAttendee.objects.filter(user=user)
            .select_related("event", "event__community")
            .order_by("-event__start_time")
        )
        if community:
            attendances = attendances.filter(
                MemberActivityService._build_community_q(
                    "event__community", community
                )
            )

        items: list[dict[str, Any]] = []
        total_registered = 0
        attended_count = 0
        upcoming_count = 0
        completed_count = 0
        missed_count = 0

        for att in attendances:
            event = att.event
            is_checked_in = att.checked_in_at is not None
            is_completed = (
                event.status == EventStatus.COMPLETED or event.end_time < now
            )
            is_in_progress = (
                event.status == EventStatus.LIVE
                or (
                    event.status == EventStatus.SCHEDULED
                    and event.start_time <= now <= event.end_time
                )
            )
            is_upcoming = (
                not is_completed
                and not is_in_progress
                and event.status != EventStatus.CANCELLED
            )

            # Count registrations (attending or maybe or checked-in or declined)
            if att.status in {AttendeeStatus.ATTENDING, AttendeeStatus.MAYBE} or is_checked_in or att.status == AttendeeStatus.DECLINED:
                total_registered += 1

            if is_upcoming or is_in_progress:
                if att.status != AttendeeStatus.DECLINED:
                    upcoming_count += 1
            elif is_completed and event.status != EventStatus.CANCELLED:
                completed_count += 1
                if is_checked_in or att.status == AttendeeStatus.ATTENDING:
                    if is_checked_in:
                        attended_count += 1
                    else:
                        attended_count += 1
                else:
                    missed_count += 1

            community_summary = None
            if event.community:
                community_summary = {
                    "id": str(event.community.id),
                    "name": event.community.name,
                    "slug": event.community.slug,
                    "logo_url": event.community.avatar_url,
                    "avatar_url": event.community.avatar_url,
                }

            items.append(
                {
                    "id": str(event.id),
                    "title": event.title,
                    "slug": event.slug,
                    "description": event.description,
                    "cover_image_url": event.cover_image_url,
                    "event_type": event.event_type,
                    "event_type_display": event.get_event_type_display(),
                    "format": event.format,
                    "format_display": event.get_format_display(),
                    "status": event.status,
                    "status_display": event.get_status_display(),
                    "start_time": event.start_time,
                    "end_time": event.end_time,
                    "timezone": event.timezone,
                    "venue_name": event.venue_name,
                    "location_address": event.location_address,
                    "location_city": event.location_city,
                    "location_country": event.location_country,
                    "location_url": event.location_url,
                    "live_room_name": event.live_room_name,
                    "is_public": event.is_public,
                    "community": community_summary,
                    "rsvp_status": att.status,
                    "rsvp_status_display": att.get_status_display(),
                    "registered_at": att.created_at,
                    "checked_in_at": att.checked_in_at,
                    "is_checked_in": is_checked_in,
                    "is_upcoming": is_upcoming,
                    "is_in_progress": is_in_progress,
                    "is_completed": is_completed,
                }
            )

        attendance_rate = (
            round((attended_count / completed_count) * 100.0, 1)
            if completed_count > 0
            else 0.0
        )

        return {
            "kpis": {
                "total_registered": total_registered,
                "attended_count": attended_count,
                "upcoming_count": upcoming_count,
                "completed_count": completed_count,
                "missed_count": missed_count,
                "attendance_rate": attendance_rate,
            },
            "events": items,
        }

    # =========================================================================
    # 3. OPPORTUNITIES
    # =========================================================================
    @staticmethod
    def get_member_opportunities(
        user: User, community: str | None = None
    ) -> dict[str, Any]:
        """
        Returns all opportunity applications submitted by the user,
        along with success (accepted), failure (rejected), and in-review KPIs.
        Optionally filtered by `community` (slug or UUID).
        """
        applications = (
            OpportunityApplication.objects.filter(applicant=user)
            .select_related("opportunity", "opportunity__community")
            .order_by("-created_at")
        )
        if community:
            applications = applications.filter(
                MemberActivityService._build_community_q(
                    "opportunity__community", community
                )
            )

        items: list[dict[str, Any]] = []
        accepted_count = 0
        rejected_count = 0
        in_review_count = 0

        for app in applications:
            opp = app.opportunity
            is_successful = app.status == OpportunityApplicationStatus.ACCEPTED
            is_failed = app.status == OpportunityApplicationStatus.REJECTED
            is_in_review = app.status in {
                OpportunityApplicationStatus.PENDING,
                OpportunityApplicationStatus.REVIEWING,
                OpportunityApplicationStatus.SHORTLISTED,
            }

            if is_successful:
                accepted_count += 1
            elif is_failed:
                rejected_count += 1
            else:
                in_review_count += 1

            community_summary = None
            if opp.community:
                community_summary = {
                    "id": str(opp.community.id),
                    "name": opp.community.name,
                    "slug": opp.community.slug,
                    "logo_url": opp.community.avatar_url,
                    "avatar_url": opp.community.avatar_url,
                }

            items.append(
                {
                    "id": str(app.id),
                    "status": app.status,
                    "status_display": app.get_status_display(),
                    "is_successful": is_successful,
                    "is_failed": is_failed,
                    "is_in_review": is_in_review,
                    "applied_at": app.created_at,
                    "updated_at": app.updated_at,
                    "resume_url": app.resume_url,
                    "cv_url": app.resume_url,
                    "portfolio_url": app.portfolio_url,
                    "cover_letter": app.cover_letter,
                    "opportunity": {
                        "id": str(opp.id),
                        "title": opp.title,
                        "slug": opp.slug,
                        "company_name": opp.company_name,
                        "company_logo_url": opp.company_logo_url,
                        "opportunity_type": opp.opportunity_type,
                        "opportunity_type_display": opp.get_opportunity_type_display(),
                        "workplace_type": opp.workplace_type,
                        "workplace_type_display": opp.get_workplace_type_display(),
                        "experience_level": opp.experience_level,
                        "experience_level_display": opp.get_experience_level_display(),
                        "location": opp.location,
                        "salary_min": opp.salary_min,
                        "salary_max": opp.salary_max,
                        "currency": opp.currency,
                        "status": opp.status,
                        "expires_at": opp.expires_at,
                        "deadline": opp.expires_at,
                        "community": community_summary,
                    },
                }
            )

        total_applied = len(items)
        decided_count = accepted_count + rejected_count
        success_rate = (
            round((accepted_count / decided_count) * 100.0, 1)
            if decided_count > 0
            else 0.0
        )

        return {
            "kpis": {
                "total_applied": total_applied,
                "accepted_count": accepted_count,
                "rejected_count": rejected_count,
                "in_review_count": in_review_count,
                "success_rate": success_rate,
            },
            "applications": items,
        }

    # =========================================================================
    # 4. CLASSROOM COURSES & MODULE PROGRESSION
    # =========================================================================
    @staticmethod
    def get_member_courses(
        user: User, community: str | None = None
    ) -> dict[str, Any]:
        """
        Returns all courses the user is enrolled in, including:
        - Course level (beginner, intermediate, advanced, all_levels)
        - Overall course completion percentage
        - Module-by-module completion percentage and completed/total lessons
        Optionally filtered by `community` (slug or UUID).
        """
        enrollments = (
            CourseEnrollment.objects.filter(user=user)
            .select_related("course", "course__community")
            .prefetch_related(
                Prefetch(
                    "course__modules",
                    queryset=CourseModule.objects.prefetch_related("lessons").order_by(
                        "order", "created_at"
                    ),
                )
            )
            .order_by("-enrolled_at")
        )
        if community:
            enrollments = enrollments.filter(
                MemberActivityService._build_community_q(
                    "course__community", community
                )
            )

        # Fetch all completed lesson IDs for this user in one query
        completed_lesson_ids = set(
            LessonProgress.objects.filter(
                user=user, is_completed=True
            ).values_list("lesson_id", flat=True)
        )

        items: list[dict[str, Any]] = []
        completed_courses_count = 0
        in_progress_courses_count = 0
        total_lessons_completed_global = 0
        progress_sum = 0.0

        for enrollment in enrollments:
            course = enrollment.course
            modules = list(course.modules.all())

            modules_progress_data: list[dict[str, Any]] = []
            course_total_lessons = 0
            course_completed_lessons = 0
            completed_modules_count = 0

            for module in modules:
                lessons = list(module.lessons.all())
                mod_total = len(lessons)
                mod_completed = sum(
                    1 for lesson in lessons if lesson.id in completed_lesson_ids
                )

                course_total_lessons += mod_total
                course_completed_lessons += mod_completed

                if mod_total > 0:
                    mod_percent = round((mod_completed / mod_total) * 100.0, 1)
                    mod_is_completed = mod_completed == mod_total
                else:
                    mod_percent = 0.0
                    mod_is_completed = False

                if mod_is_completed:
                    completed_modules_count += 1

                modules_progress_data.append(
                    {
                        "module_id": str(module.id),
                        "title": module.title,
                        "description": module.description,
                        "order": module.order,
                        "total_lessons": mod_total,
                        "completed_lessons": mod_completed,
                        "progress_percent": mod_percent,
                        "is_completed": mod_is_completed,
                    }
                )

            total_lessons_completed_global += course_completed_lessons

            # Compute exact overall progress from actual lessons if lessons exist,
            # falling back to enrollment.progress_percent
            if course_total_lessons > 0:
                overall_progress_percent = round(
                    (course_completed_lessons / course_total_lessons) * 100.0, 1
                )
            else:
                overall_progress_percent = round(
                    float(enrollment.progress_percent or Decimal("0.00")), 1
                )

            is_course_completed = (
                enrollment.completed_at is not None
                or overall_progress_percent >= 100.0
            )
            if is_course_completed:
                completed_courses_count += 1
            else:
                in_progress_courses_count += 1

            progress_sum += overall_progress_percent

            community_summary = None
            if course.community:
                community_summary = {
                    "id": str(course.community.id),
                    "name": course.community.name,
                    "slug": course.community.slug,
                    "logo_url": course.community.avatar_url,
                    "avatar_url": course.community.avatar_url,
                }

            items.append(
                {
                    "id": str(course.id),
                    "course_id": str(course.id),
                    "title": course.title,
                    "slug": course.slug,
                    "description": course.description,
                    "thumbnail_url": course.thumbnail_url,
                    "level": course.level,
                    "level_display": course.get_level_display(),
                    "duration_seconds": course.duration_seconds,
                    "duration_minutes": course.duration_minutes,
                    "community": community_summary,
                    "enrolled_at": enrollment.enrolled_at,
                    "completed_at": enrollment.completed_at,
                    "last_accessed_at": enrollment.updated_at,
                    "is_completed": is_course_completed,
                    "overall_progress_percent": overall_progress_percent,
                    "total_lessons": course_total_lessons,
                    "completed_lessons": course_completed_lessons,
                    "total_modules": len(modules),
                    "completed_modules": completed_modules_count,
                    "modules_progress": modules_progress_data,
                }
            )

        total_enrolled = len(items)
        average_progress_percent = (
            round(progress_sum / total_enrolled, 1) if total_enrolled > 0 else 0.0
        )

        return {
            "kpis": {
                "total_enrolled": total_enrolled,
                "completed_count": completed_courses_count,
                "in_progress_count": in_progress_courses_count,
                "total_lessons_completed": total_lessons_completed_global,
                "average_progress_percent": average_progress_percent,
            },
            "courses": items,
        }

    # =========================================================================
    # 5. UNIFIED MEMBER DASHBOARD
    # =========================================================================
    @staticmethod
    def get_member_dashboard(
        user: User, community: str | None = None
    ) -> dict[str, Any]:
        """
        Aggregates all member KPIs and recent highlights into a single payload
        for the member's overview dashboard (global or scoped to a community).
        """
        hackathons_data = MemberActivityService.get_member_hackathons(
            user, community=community
        )
        events_data = MemberActivityService.get_member_events(
            user, community=community
        )
        opportunities_data = MemberActivityService.get_member_opportunities(
            user, community=community
        )
        courses_data = MemberActivityService.get_member_courses(
            user, community=community
        )

        return {
            "kpis": {
                "hackathons": hackathons_data["kpis"],
                "events": events_data["kpis"],
                "opportunities": opportunities_data["kpis"],
                "courses": courses_data["kpis"],
            },
            "highlights": {
                "recent_hackathons": hackathons_data["hackathons"][:3],
                "recent_events": events_data["events"][:3],
                "upcoming_or_recent_events": events_data["events"][:3],
                "recent_opportunities": opportunities_data["applications"][:3],
                "recent_opportunity_applications": opportunities_data["applications"][:3],
                "recent_courses": courses_data["courses"][:3],
                "active_courses": courses_data["courses"][:3],
            },
        }
