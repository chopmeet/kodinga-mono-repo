from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.classroom.models.course import Course
from apps.classroom.models.lesson import Lesson, LessonType
from apps.classroom.models.module import CourseModule
from apps.communities.models.community import Community, CommunityPrivacy
from apps.communities.models.settings import CommunitySettings
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.models.event import Event, EventStatus
from apps.events.tasks import send_event_reminders_task
from apps.hackathons.models.hackathon import Hackathon, HackathonStatus
from apps.hackathons.models.team import (
    HackathonTeam,
    HackathonTeamMember,
    TeamInvitationStatus,
)
from apps.hackathons.services.application_service import HackathonApplicationService
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.memberships.services.invitation_service import InvitationService
from apps.notifications.models.notification import Notification, NotificationType


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def owner_user(db):
    return User.objects.create_user(
        email="owner_be@kodinga.com",
        username="owner_be",
        password="SecurePassword123!",
    )


@pytest.fixture
def member_user(db):
    return User.objects.create_user(
        email="member_be@kodinga.com",
        username="member_be",
        password="SecurePassword123!",
    )


@pytest.fixture
def reviewer_user(db):
    return User.objects.create_user(
        email="reviewer_be@kodinga.com",
        username="reviewer_be",
        password="SecurePassword123!",
    )


@pytest.fixture
def outsider_user(db):
    return User.objects.create_user(
        email="outsider_be@kodinga.com",
        username="outsider_be",
        password="SecurePassword123!",
    )


@pytest.fixture
def community(db, owner_user, member_user, reviewer_user):
    comm = Community.objects.create(
        name="Backend Engineering Community",
        slug="backend-community",
        owner=owner_user,
        privacy_type=CommunityPrivacy.PUBLIC,
    )
    CommunitySettings.objects.create(community=comm)
    CommunityMember.objects.create(
        community=comm,
        user=owner_user,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=member_user,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=reviewer_user,
        role=CommunityRole.ADMIN,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.mark.django_db
class TestBackendBacklogFeatures:
    """
    Validation tests for BE-01 through BE-15.
    """

    # -------------------------------------------------------------------------
    # BE-01: Invitations (Decline, Anti-duplicate, Notifications)
    # -------------------------------------------------------------------------
    def test_be01_community_invitation_decline_and_anti_duplicate(
        self, api_client, owner_user, outsider_user, community
    ):
        invitation, raw_token = InvitationService.create_invitation(
            actor_user=owner_user,
            workspace=community,
            email=outsider_user.email,
            role="member",
        )
        assert invitation.status == "pending"

        # Anti-duplicate: trying to create another pending invitation raises error
        with pytest.raises(Exception) as exc_info:
            InvitationService.create_invitation(
                actor_user=owner_user,
                workspace=community,
                email=outsider_user.email,
                role="member",
            )
        assert "attente" in str(exc_info.value).lower()

        # Decline invitation via API token endpoint
        api_client.force_authenticate(user=outsider_user)
        res = api_client.post(f"/api/v1/communities/invitations/{raw_token}/decline/")
        assert res.status_code == status.HTTP_200_OK
        invitation.refresh_from_db()
        assert invitation.status == "declined"
        assert invitation.declined_at is not None

    def test_be01_hackathon_team_invitation_decline(
        self, api_client, owner_user, member_user, community
    ):
        hackathon = Hackathon.objects.create(
            community=community,
            organizer=owner_user,
            title="Spring Hack",
            slug="spring-hack",
            status=HackathonStatus.PUBLISHED,
            registration_start=timezone.now() - timedelta(days=1),
            registration_end=timezone.now() + timedelta(days=5),
            start_time=timezone.now() + timedelta(days=6),
            submission_deadline=timezone.now() + timedelta(days=7),
            judging_end=timezone.now() + timedelta(days=8),
        )
        team = HackathonTeam.objects.create(
            hackathon=hackathon,
            name="Alpha Team",
            leader=owner_user,
        )
        invitation = HackathonTeamMember.objects.create(
            team=team,
            user=member_user,
            status=TeamInvitationStatus.INVITED,
        )

        api_client.force_authenticate(user=member_user)
        res = api_client.post(
            "/api/v1/hackathons/teams/respond-invite/",
            {
                "team_id": str(team.id),
                "invitation_id": str(invitation.id),
                "accept": False,
            },
            format="json",
        )
        assert res.status_code == status.HTTP_200_OK
        invitation.refresh_from_db()
        assert invitation.status == TeamInvitationStatus.DECLINED

    # -------------------------------------------------------------------------
    # BE-02: Join Request Notifications
    # -------------------------------------------------------------------------
    def test_be02_join_request_notifications_sent_to_managers(
        self, api_client, outsider_user, community, owner_user
    ):
        community.privacy_type = CommunityPrivacy.PRIVATE
        community.save()

        api_client.force_authenticate(user=outsider_user)
        res = api_client.post(f"/api/v1/communities/{community.slug}/join/")
        assert res.status_code == status.HTTP_200_OK

        owner_notif = Notification.objects.filter(
            recipient=owner_user,
            notification_type=NotificationType.JOIN_REQUEST,
        ).first()
        assert owner_notif is not None
        assert "adhésion" in owner_notif.title.lower() or "rejoindre" in owner_notif.body.lower()

    # -------------------------------------------------------------------------
    # BE-04: Event reminders (30 minutes prior)
    # -------------------------------------------------------------------------
    def test_be04_event_reminder_celery_task(self, community, owner_user, member_user):
        event = Event.objects.create(
            community=community,
            host=owner_user,
            title="Django Live Coding",
            slug="django-live-coding",
            start_time=timezone.now() + timedelta(minutes=25),
            end_time=timezone.now() + timedelta(hours=2),
            status=EventStatus.SCHEDULED,
        )
        EventAttendee.objects.create(
            event=event,
            user=member_user,
            status=AttendeeStatus.ATTENDING,
        )

        notified_count = send_event_reminders_task()
        assert notified_count >= 1

        reminder = Notification.objects.filter(
            recipient=member_user,
            notification_type=NotificationType.EVENT_REMINDER,
        ).first()
        assert reminder is not None
        assert "Django Live Coding" in reminder.title

    # -------------------------------------------------------------------------
    # BE-06: Hackathon application period constraints
    # -------------------------------------------------------------------------
    def test_be06_hackathon_registration_closed(self, community, owner_user, member_user):
        hackathon = Hackathon.objects.create(
            community=community,
            organizer=owner_user,
            title="Closed Hackathon",
            slug="closed-hackathon",
            status=HackathonStatus.PUBLISHED,
            registration_start=timezone.now() - timedelta(days=10),
            registration_end=timezone.now() - timedelta(days=2),
            start_time=timezone.now() + timedelta(days=1),
            submission_deadline=timezone.now() + timedelta(days=2),
            judging_end=timezone.now() + timedelta(days=3),
        )
        assert hackathon.is_registration_open is False

        with pytest.raises(Exception) as exc:
            HackathonApplicationService.apply(
                applicant=member_user,
                hackathon=hackathon,
            )
        assert "closes" in str(exc.value).lower() or "fermé" in str(exc.value).lower() or "dépassée" in str(exc.value).lower()

    # -------------------------------------------------------------------------
    # BE-07: Member Directory & Access Control
    # -------------------------------------------------------------------------
    def test_be07_active_member_can_view_directory(
        self, api_client, member_user, outsider_user, community
    ):
        api_client.force_authenticate(user=outsider_user)
        res_outsider = api_client.get(f"/api/v1/communities/{community.slug}/members/")
        assert res_outsider.status_code == status.HTTP_403_FORBIDDEN

        api_client.force_authenticate(user=member_user)
        res_member = api_client.get(f"/api/v1/communities/{community.slug}/members/")
        assert res_member.status_code == status.HTTP_200_OK

    # -------------------------------------------------------------------------
    # BE-09: External video embedding (YouTube normalization)
    # -------------------------------------------------------------------------
    def test_be09_video_url_normalization(self, community, owner_user):
        course = Course.objects.create(
            community=community,
            author=owner_user,
            title="Web Dev",
            slug="web-dev",
        )
        module = CourseModule.objects.create(course=course, title="Module 1", order=0)
        lesson = Lesson.objects.create(
            module=module,
            title="CSS Grid",
            slug="css-grid",
            lesson_type=LessonType.VIDEO,
            video_url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            order=0,
        )
        assert lesson.video_provider == "youtube"
        assert lesson.video_embed_url == "https://www.youtube.com/embed/dQw4w9WgXcQ"

    # -------------------------------------------------------------------------
    # BE-10 & BE-11: Interactive Quiz and Multi-language Code Blocks
    # -------------------------------------------------------------------------
    def test_be10_and_be11_quiz_submission_and_code_blocks(
        self, api_client, member_user, owner_user, community
    ):
        course = Course.objects.create(
            community=community,
            author=owner_user,
            title="Architecture",
            slug="architecture",
            is_published=True,
        )
        module = CourseModule.objects.create(course=course, title="Module 1", order=0)
        lesson = Lesson.objects.create(
            module=module,
            title="REST vs GraphQL",
            slug="rest-vs-graphql",
            lesson_type=LessonType.TEXT,
            code_blocks=[
                {"language": "python", "title": "app.py", "code": "def run():\n    pass"}
            ],
            quiz_data={
                "passing_score": 50,
                "questions": [
                    {
                        "id": "q1",
                        "question": "What is REST?",
                        "options": [
                            {"id": "opt1", "text": "Architectural style", "is_correct": True},
                            {"id": "opt2", "text": "Database engine", "is_correct": False},
                        ],
                    }
                ],
            },
            order=0,
        )

        api_client.force_authenticate(user=member_user)
        res_submit = api_client.post(
            f"/api/v1/communities/{community.slug}/courses/{course.slug}/lessons/{lesson.id}/quiz/submit/",
            {"answers": {"q1": ["opt1"]}},
            format="json",
        )
        assert res_submit.status_code == status.HTTP_200_OK
        data = res_submit.json()["data"]
        assert data["passed"] is True
        assert data["score_percent"] == 100.0

    # -------------------------------------------------------------------------
    # BE-14: Workspace endpoint and auto-healing
    # -------------------------------------------------------------------------
    def test_be14_workspace_access_and_can_manage(
        self, api_client, owner_user, community
    ):
        api_client.force_authenticate(user=owner_user)
        res_ws = api_client.get("/api/v1/users/me/workspace/")
        assert res_ws.status_code == status.HTTP_200_OK
        data = res_ws.json()["data"]
        assert data["can_open_workspace"] is True
        assert len(data["workspaces"]) >= 1

        res_detail = api_client.get(f"/api/v1/communities/{community.slug}/")
        assert res_detail.status_code == status.HTTP_200_OK
        detail_data = res_detail.json()["data"]
        assert detail_data["user_membership"]["can_manage"] is True
        assert detail_data["user_membership"]["role"] == "owner"
