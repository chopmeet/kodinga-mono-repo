from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.classroom.models.course import Course, CourseLevel
from apps.classroom.models.lesson import Lesson
from apps.classroom.models.module import CourseModule
from apps.classroom.models.progress import CourseEnrollment, LessonProgress
from apps.communities.models.community import Community
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.models.event import Event, EventFormat, EventStatus, EventType
from apps.hackathons.models.application import (
    ApplicationStatus as HackathonAppStatus,
)
from apps.hackathons.models.application import (
    HackathonApplication,
    ParticipationMode,
)
from apps.hackathons.models.hackathon import Hackathon, HackathonStatus
from apps.hackathons.models.prize import HackathonPrize
from apps.hackathons.models.submission import HackathonSubmission, SubmissionStatus
from apps.opportunities.models.application import (
    ApplicationStatus as OppAppStatus,
)
from apps.opportunities.models.application import (
    OpportunityApplication,
)
from apps.opportunities.models.opportunity import (
    ExperienceLevel,
    Opportunity,
    OpportunityStatus,
    OpportunityType,
    WorkplaceType,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def member_user(db):
    return User.objects.create_user(
        email="developer_member@kodinga.com",
        username="dev_member",
        password="SecurePassword123!",
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        email="organizer@kodinga.com",
        username="organizer_boss",
        password="SecurePassword123!",
    )


@pytest.fixture
def community(db, other_user):
    return Community.objects.create(
        name="Python Dakar Community",
        slug="python-dakar",
        description="Communauté de développeurs Python",
        owner=other_user,
    )


@pytest.mark.django_db
class TestMemberActivityEndpoints:
    """
    Test suite for member activity, KPIs, hackathons, events, opportunities,
    and classroom course module-by-module progression.
    """

    def test_unauthenticated_access_returns_401(self, api_client):
        endpoints = [
            "/api/v1/analytics/member/dashboard/",
            "/api/v1/analytics/member/hackathons/",
            "/api/v1/analytics/member/events/",
            "/api/v1/analytics/member/opportunities/",
            "/api/v1/analytics/member/courses/",
            "/api/v1/users/me/dashboard/",
            "/api/v1/users/me/hackathons/",
            "/api/v1/users/me/events/",
            "/api/v1/users/me/opportunities/",
            "/api/v1/users/me/courses/",
        ]
        for url in endpoints:
            response = api_client.get(url)
            assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_empty_member_activity_kpis(self, api_client, member_user):
        api_client.force_authenticate(user=member_user)
        response = api_client.get("/api/v1/analytics/member/dashboard/")

        assert response.status_code == status.HTTP_200_OK
        data = response.data["data"]
        assert "kpis" in data
        assert "highlights" in data

        kpis = data["kpis"]
        assert kpis["hackathons"]["total_participated"] == 0
        assert kpis["events"]["total_registered"] == 0
        assert kpis["opportunities"]["total_applied"] == 0
        assert kpis["courses"]["total_enrolled"] == 0

    def test_member_hackathons_kpi_and_results(
        self, api_client, member_user, other_user, community
    ):
        api_client.force_authenticate(user=member_user)
        now = timezone.now()

        # Hackathon 1: Won a prize (podium / winner)
        h1 = Hackathon.objects.create(
            community=community,
            organizer=other_user,
            title="AI Hackathon 2026",
            slug="ai-hackathon-2026",
            status=HackathonStatus.COMPLETED,
            registration_start=now - timedelta(days=20),
            registration_end=now - timedelta(days=11),
            start_time=now - timedelta(days=10),
            submission_deadline=now - timedelta(days=5),
            judging_end=now - timedelta(days=4),
        )
        HackathonApplication.objects.create(
            hackathon=h1,
            applicant=member_user,
            status=HackathonAppStatus.ACCEPTED,
            participation_mode=ParticipationMode.INDIVIDUAL,
        )
        sub1 = HackathonSubmission.objects.create(
            hackathon=h1,
            applicant=member_user,
            title="AI Voice Assistant",
            slug="ai-voice-assistant",
            description="Autonomous Voice Assistant",
            status=SubmissionStatus.SUBMITTED,
            is_final=True,
            submitted_at=now - timedelta(days=6),
            rank=1,
            total_score=Decimal("94.50"),
        )
        HackathonPrize.objects.create(
            hackathon=h1,
            title="1er Prix - Vainqueur",
            rank=1,
            reward_amount=Decimal("1000000.00"),
            reward_currency="XOF",
            winner_submission=sub1,
        )

        # Hackathon 2: Submitted successfully, unranked
        h2 = Hackathon.objects.create(
            community=community,
            organizer=other_user,
            title="Fintech Hackathon Dakar",
            slug="fintech-hackathon-dakar",
            status=HackathonStatus.COMPLETED,
            registration_start=now - timedelta(days=30),
            registration_end=now - timedelta(days=21),
            start_time=now - timedelta(days=20),
            submission_deadline=now - timedelta(days=15),
            judging_end=now - timedelta(days=14),
        )
        HackathonApplication.objects.create(
            hackathon=h2,
            applicant=member_user,
            status=HackathonAppStatus.ACCEPTED,
        )
        HackathonSubmission.objects.create(
            hackathon=h2,
            applicant=member_user,
            title="Micro Lending Platform",
            slug="micro-lending-platform",
            description="Credit scoring bot",
            status=SubmissionStatus.SUBMITTED,
            is_final=True,
            submitted_at=now - timedelta(days=16),
            total_score=Decimal("78.00"),
        )

        # Hackathon 3: Application Rejected (failed)
        h3 = Hackathon.objects.create(
            community=community,
            organizer=other_user,
            title="Web3 Security Challenge",
            slug="web3-security-challenge",
            status=HackathonStatus.COMPLETED,
            registration_start=now - timedelta(days=50),
            registration_end=now - timedelta(days=41),
            start_time=now - timedelta(days=40),
            submission_deadline=now - timedelta(days=35),
            judging_end=now - timedelta(days=34),
        )
        HackathonApplication.objects.create(
            hackathon=h3,
            applicant=member_user,
            status=HackathonAppStatus.REJECTED,
        )

        response = api_client.get("/api/v1/analytics/member/hackathons/")
        assert response.status_code == status.HTTP_200_OK

        payload = response.data["data"]
        kpis = payload["kpis"]
        hackathons = payload["hackathons"]

        assert kpis["total_participated"] == 3
        assert kpis["successful_count"] == 2
        assert kpis["failed_count"] == 1
        assert kpis["prizes_won_count"] == 1
        assert kpis["submissions_count"] == 2
        assert kpis["success_rate"] == 66.7

        # Check winner details
        h1_item = next(h for h in hackathons if h["id"] == str(h1.id))
        assert h1_item["member_result"] == "won"
        assert h1_item["is_winner"] is True
        assert h1_item["is_podium"] is True
        assert h1_item["submission"]["rank"] == 1
        assert len(h1_item["submission"]["prizes_won"]) == 1

        # Check rejected details
        h3_item = next(h for h in hackathons if h["id"] == str(h3.id))
        assert h3_item["member_result"] == "rejected"

    def test_member_events_kpi_and_attendance(
        self, api_client, member_user, other_user, community
    ):
        api_client.force_authenticate(user=member_user)
        now = timezone.now()

        # Event 1: Upcoming event registered
        ev1 = Event.objects.create(
            community=community,
            host=other_user,
            title="Django 5 Masterclass",
            slug="django-5-masterclass",
            event_type=EventType.WORKSHOP,
            format=EventFormat.LIVEKIT,
            status=EventStatus.SCHEDULED,
            start_time=now + timedelta(days=3),
            end_time=now + timedelta(days=3, hours=2),
        )
        EventAttendee.objects.create(
            event=ev1,
            user=member_user,
            status=AttendeeStatus.ATTENDING,
        )

        # Event 2: Completed event with check-in (attended)
        ev2 = Event.objects.create(
            community=community,
            host=other_user,
            title="Next.js Live Coding",
            slug="nextjs-live-coding",
            event_type=EventType.LIVE_STREAM,
            format=EventFormat.LIVEKIT,
            status=EventStatus.COMPLETED,
            start_time=now - timedelta(days=2),
            end_time=now - timedelta(days=2, hours=-2),
        )
        EventAttendee.objects.create(
            event=ev2,
            user=member_user,
            status=AttendeeStatus.ATTENDING,
            checked_in_at=now - timedelta(days=2, minutes=5),
        )

        # Event 3: Completed event where user declined (missed)
        ev3 = Event.objects.create(
            community=community,
            host=other_user,
            title="Kubernetes Docker Meetup",
            slug="kubernetes-docker-meetup",
            event_type=EventType.MEETUP,
            format=EventFormat.IN_PERSON,
            status=EventStatus.COMPLETED,
            start_time=now - timedelta(days=5),
            end_time=now - timedelta(days=5, hours=-2),
        )
        EventAttendee.objects.create(
            event=ev3,
            user=member_user,
            status=AttendeeStatus.DECLINED,
        )

        response = api_client.get("/api/v1/analytics/member/events/")
        assert response.status_code == status.HTTP_200_OK

        payload = response.data["data"]
        kpis = payload["kpis"]
        events = payload["events"]

        assert kpis["total_registered"] == 3
        assert kpis["attended_count"] == 1
        assert kpis["upcoming_count"] == 1
        assert kpis["completed_count"] == 2
        assert kpis["missed_count"] == 1
        assert kpis["attendance_rate"] == 50.0

        ev2_item = next(e for e in events if e["id"] == str(ev2.id))
        assert ev2_item["is_checked_in"] is True
        assert ev2_item["checked_in_at"] is not None

        ev1_item = next(e for e in events if e["id"] == str(ev1.id))
        assert ev1_item["is_upcoming"] is True
        assert ev1_item["is_checked_in"] is False

    def test_member_opportunities_kpis(
        self, api_client, member_user, other_user, community
    ):
        api_client.force_authenticate(user=member_user)

        # Opportunity 1: Accepted (successful)
        opp1 = Opportunity.objects.create(
            poster=other_user,
            community=community,
            title="Senior Backend Python Engineer",
            slug="senior-backend-python",
            company_name="Fintech Corp",
            opportunity_type=OpportunityType.FULL_TIME,
            workplace_type=WorkplaceType.REMOTE,
            experience_level=ExperienceLevel.SENIOR,
            status=OpportunityStatus.OPEN,
            salary_min=Decimal("2000000.00"),
            salary_max=Decimal("2500000.00"),
            currency="XOF",
        )
        OpportunityApplication.objects.create(
            opportunity=opp1,
            applicant=member_user,
            status=OppAppStatus.ACCEPTED,
        )

        # Opportunity 2: Rejected (failed)
        opp2 = Opportunity.objects.create(
            poster=other_user,
            community=community,
            title="Frontend React Lead",
            slug="frontend-react-lead",
            company_name="Design Hub",
            opportunity_type=OpportunityType.CONTRACT,
            workplace_type=WorkplaceType.REMOTE,
            experience_level=ExperienceLevel.LEAD,
            status=OpportunityStatus.OPEN,
        )
        OpportunityApplication.objects.create(
            opportunity=opp2,
            applicant=member_user,
            status=OppAppStatus.REJECTED,
        )

        # Opportunity 3: In review (reviewing)
        opp3 = Opportunity.objects.create(
            poster=other_user,
            community=community,
            title="DevOps Cloud Architect",
            slug="devops-cloud-architect",
            company_name="Cloud West Africa",
            opportunity_type=OpportunityType.FREELANCE,
            workplace_type=WorkplaceType.HYBRID,
            experience_level=ExperienceLevel.MID,
            status=OpportunityStatus.OPEN,
        )
        OpportunityApplication.objects.create(
            opportunity=opp3,
            applicant=member_user,
            status=OppAppStatus.REVIEWING,
        )

        response = api_client.get("/api/v1/analytics/member/opportunities/")
        assert response.status_code == status.HTTP_200_OK

        payload = response.data["data"]
        kpis = payload["kpis"]
        applications = payload["applications"]

        assert kpis["total_applied"] == 3
        assert kpis["accepted_count"] == 1
        assert kpis["rejected_count"] == 1
        assert kpis["in_review_count"] == 1
        assert kpis["success_rate"] == 50.0

        app1_item = next(a for a in applications if a["opportunity"]["id"] == str(opp1.id))
        assert app1_item["is_successful"] is True
        assert app1_item["is_failed"] is False

    def test_member_courses_level_and_module_percentage(
        self, api_client, member_user, other_user, community
    ):
        api_client.force_authenticate(user=member_user)

        # Course with level INTERMEDIATE
        course = Course.objects.create(
            community=community,
            author=other_user,
            title="Architecture Microservices & Event-Driven",
            slug="microservices-event-driven",
            level=CourseLevel.INTERMEDIATE,
            is_published=True,
            duration_seconds=7200,
        )

        # Module 1: 4 lessons, 3 completed -> 75%
        mod1 = CourseModule.objects.create(
            course=course,
            title="Module 1: Fondations DDD & Event Sourcing",
            order=1,
            lessons_count=4,
        )
        l1_1 = Lesson.objects.create(module=mod1, title="Lesson 1.1", slug="l1-1", order=1)
        l1_2 = Lesson.objects.create(module=mod1, title="Lesson 1.2", slug="l1-2", order=2)
        l1_3 = Lesson.objects.create(module=mod1, title="Lesson 1.3", slug="l1-3", order=3)
        Lesson.objects.create(module=mod1, title="Lesson 1.4", slug="l1-4", order=4)

        LessonProgress.objects.create(lesson=l1_1, user=member_user, is_completed=True)
        LessonProgress.objects.create(lesson=l1_2, user=member_user, is_completed=True)
        LessonProgress.objects.create(lesson=l1_3, user=member_user, is_completed=True)

        # Module 2: 2 lessons, 2 completed -> 100%
        mod2 = CourseModule.objects.create(
            course=course,
            title="Module 2: Apache Kafka & CQRS",
            order=2,
            lessons_count=2,
        )
        l2_1 = Lesson.objects.create(module=mod2, title="Lesson 2.1", slug="l2-1", order=1)
        l2_2 = Lesson.objects.create(module=mod2, title="Lesson 2.2", slug="l2-2", order=2)

        LessonProgress.objects.create(lesson=l2_1, user=member_user, is_completed=True)
        LessonProgress.objects.create(lesson=l2_2, user=member_user, is_completed=True)

        # Enrollment
        CourseEnrollment.objects.create(
            course=course,
            user=member_user,
            progress_percent=83.3,
        )

        response = api_client.get("/api/v1/analytics/member/courses/")
        assert response.status_code == status.HTTP_200_OK

        payload = response.data["data"]
        kpis = payload["kpis"]
        courses = payload["courses"]

        assert kpis["total_enrolled"] == 1
        assert kpis["completed_count"] == 0
        assert kpis["in_progress_count"] == 1
        assert kpis["total_lessons_completed"] == 5
        assert kpis["average_progress_percent"] == 83.3

        c_item = courses[0]
        assert c_item["title"] == "Architecture Microservices & Event-Driven"
        assert c_item["level"] == "intermediate"
        assert c_item["level_display"] == "Intermédiaire"
        assert c_item["overall_progress_percent"] == 83.3
        assert c_item["total_lessons"] == 6
        assert c_item["completed_lessons"] == 5
        assert c_item["total_modules"] == 2
        assert c_item["completed_modules"] == 1

        # Check module-by-module breakdown and percentage
        modules = c_item["modules_progress"]
        assert len(modules) == 2

        # Module 1: 3/4 = 75.0%
        m1 = next(m for m in modules if m["module_id"] == str(mod1.id))
        assert m1["total_lessons"] == 4
        assert m1["completed_lessons"] == 3
        assert m1["progress_percent"] == 75.0
        assert m1["is_completed"] is False

        # Module 2: 2/2 = 100.0%
        m2 = next(m for m in modules if m["module_id"] == str(mod2.id))
        assert m2["total_lessons"] == 2
        assert m2["completed_lessons"] == 2
        assert m2["progress_percent"] == 100.0
        assert m2["is_completed"] is True

    def test_user_me_aliases_match_analytics_endpoints(
        self, api_client, member_user
    ):
        api_client.force_authenticate(user=member_user)

        # Dashboard alias
        resp_analytics = api_client.get("/api/v1/analytics/member/dashboard/")
        resp_user_me = api_client.get("/api/v1/users/me/dashboard/")
        assert resp_analytics.status_code == status.HTTP_200_OK
        assert resp_user_me.status_code == status.HTTP_200_OK
        assert resp_analytics.data["data"]["kpis"] == resp_user_me.data["data"]["kpis"]

        # Courses alias
        resp_c1 = api_client.get("/api/v1/analytics/member/courses/")
        resp_c2 = api_client.get("/api/v1/users/me/courses/")
        assert resp_c1.status_code == status.HTTP_200_OK
        assert resp_c2.status_code == status.HTTP_200_OK
        assert resp_c1.data["data"] == resp_c2.data["data"]


    def test_community_scoped_member_kpis(
        self, api_client, member_user, other_user, community
    ):
        api_client.force_authenticate(user=member_user)
        now = timezone.now()

        other_community = Community.objects.create(
            name="Rust Abidjan Community",
            slug="rust-abidjan",
            description="Communauté Rust",
            owner=other_user,
        )

        # Event in `python-dakar`
        ev_dakar = Event.objects.create(
            community=community,
            host=other_user,
            title="Python Meetup Dakar",
            slug="python-meetup-dakar",
            event_type=EventType.MEETUP,
            format=EventFormat.IN_PERSON,
            status=EventStatus.COMPLETED,
            start_time=now - timedelta(days=2),
            end_time=now - timedelta(days=2, hours=-2),
        )
        EventAttendee.objects.create(
            event=ev_dakar,
            user=member_user,
            status=AttendeeStatus.ATTENDING,
            checked_in_at=now - timedelta(days=2),
        )

        # Event in `rust-abidjan`
        ev_abidjan = Event.objects.create(
            community=other_community,
            host=other_user,
            title="Rust Meetup Abidjan",
            slug="rust-meetup-abidjan",
            event_type=EventType.MEETUP,
            format=EventFormat.IN_PERSON,
            status=EventStatus.COMPLETED,
            start_time=now - timedelta(days=1),
            end_time=now - timedelta(days=1, hours=-2),
        )
        EventAttendee.objects.create(
            event=ev_abidjan,
            user=member_user,
            status=AttendeeStatus.ATTENDING,
            checked_in_at=now - timedelta(days=1),
        )

        # Global query -> 2 events
        resp_global = api_client.get("/api/v1/analytics/member/events/")
        assert resp_global.status_code == status.HTTP_200_OK
        assert resp_global.data["data"]["kpis"]["total_registered"] == 2

        # Filtered by ?community=python-dakar -> 1 event
        resp_dakar = api_client.get(
            "/api/v1/analytics/member/events/?community=python-dakar"
        )
        assert resp_dakar.status_code == status.HTTP_200_OK
        assert resp_dakar.data["data"]["kpis"]["total_registered"] == 1
        assert resp_dakar.data["data"]["events"][0]["slug"] == "python-meetup-dakar"

        # Community-scoped dedicated URL /api/v1/communities/rust-abidjan/me/dashboard/
        resp_abidjan_dash = api_client.get(
            "/api/v1/communities/rust-abidjan/me/dashboard/"
        )
        assert resp_abidjan_dash.status_code == status.HTTP_200_OK
        assert (
            resp_abidjan_dash.data["data"]["kpis"]["events"]["total_registered"]
            == 1
        )
        assert (
            resp_abidjan_dash.data["data"]["highlights"][
                "upcoming_or_recent_events"
            ][0]["slug"]
            == "rust-meetup-abidjan"
        )

    def test_my_opportunity_applications_api(
        self, api_client, member_user, community
    ):
        api_client.force_authenticate(user=member_user)
        opp = Opportunity.objects.create(
            title="Tech Développeur Fullstack",
            slug="tech-developpeur-fullstack",
            company_name="Dakar AI Labs",
            opportunity_type=OpportunityType.FULL_TIME,
            community=community,
            poster=member_user,
            status=OpportunityStatus.OPEN,
        )
        app = OpportunityApplication.objects.create(
            opportunity=opp,
            applicant=member_user,
            resume_url="https://example.com/cv.pdf",
            cover_letter="Candidature test",
            portfolio_url="https://github.com/test",
            status=OppAppStatus.PENDING,
        )

        resp = api_client.get("/api/v1/opportunities/my-applications/")
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["success"] is True
        assert len(resp.data["data"]) == 1
        assert resp.data["data"][0]["id"] == str(app.id)
        assert (
            resp.data["data"][0]["opportunity"]["slug"]
            == "tech-developpeur-fullstack"
        )
