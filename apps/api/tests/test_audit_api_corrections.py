from datetime import timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
import pytest
from django.conf import settings
from django.utils import timezone
from rest_framework import status

from apps.accounts.models.session import UserSession
from apps.accounts.models.user import User
from apps.billing.models.affiliate import Affiliate, AffiliateCommission, CommissionStatus
from apps.billing.models.payment import Payment, PaymentStatus
from apps.billing.models.plan import BillingInterval, Plan
from apps.billing.models.subscription import Subscription, SubscriptionStatus
from apps.billing.models.wallet import CommunityPayout, CommunityWallet, PayoutStatus
from apps.billing.selectors.billing_selector import BillingSelector
from apps.billing.services.affiliate_service import AffiliateService
from apps.billing.services.payout_service import PayoutService
from apps.billing.tasks import send_subscription_expiry_reminders
from apps.classroom.models.course import Course, CourseLevel
from apps.classroom.models.lesson import Lesson, LessonType
from apps.classroom.models.module import CourseModule
from apps.classroom.models.progress import CourseEnrollment, LessonProgress
from apps.classroom.services.progress_service import ProgressService
from apps.communities.models.community import Community, CommunityPrivacy
from apps.events.models.attendee import AttendeeStatus, EventAttendee
from apps.events.models.event import Event, EventFormat, EventStatus
from apps.events.tasks import send_event_reminders_task
from apps.hackathons.models.hackathon import Hackathon
from apps.hackathons.models.team import HackathonTeam, HackathonTeamMember
from apps.hackathons.serializers.team import HackathonTeamMemberSerializer
from apps.memberships.models.invitation import CommunityInvitation
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus
from apps.memberships.models.sanction import MemberSanction, SanctionType
from apps.memberships.serializers.invitation import WorkspaceInvitationSerializer
from apps.notifications.models.notification import Notification
from apps.posts.models.post import Post, PostType
from apps.posts.selectors.post_selector import PostSelector
from apps.profiles.models.follow import UserFollow
from apps.projects.models.project import Project, ProjectStatus
from apps.projects.services.project_service import ProjectService


@pytest.fixture
def user_a(db):
    return User.objects.create_user(
        email="user_a@kodinga.com",
        username="user_a",
        password="Password123!",
    )


@pytest.fixture
def user_b(db):
    return User.objects.create_user(
        email="user_b@kodinga.com",
        username="user_b",
        password="Password123!",
    )


@pytest.fixture
def community(db, user_a):
    comm = Community.objects.create(
        name="Tech Senegal",
        slug="tech-senegal",
        owner=user_a,
        privacy_type=CommunityPrivacy.PUBLIC,
    )
    CommunityMember.objects.create(
        community=comm,
        user=user_a,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.mark.django_db
class TestBillingAndWalletAuditCorrections:
    """Tests for B1, B2, B3, B4, B5, H1, H2"""

    def test_b1_affiliate_commission_strictly_pro_plans(self, user_a, user_b, community):
        # 1. Setup affiliate user
        affiliate = Affiliate.objects.create(
            user=user_a,
            referral_code="REFA123",
            commission_rate=Decimal("0.50"),
            is_active=True,
        )

        # 2. Payment on a community plan -> Should NOT award affiliate commission (Option A)
        comm_plan = Plan.objects.create(
            community=community,
            name="Community Pass",
            slug="comm-pass",
            price=Decimal("10000.00"),
            currency="XOF",
            billing_interval=BillingInterval.MONTH,
            is_active=True,
        )
        comm_payment = Payment.objects.create(
            user=user_b,
            plan=comm_plan,
            amount=comm_plan.price,
            currency="XOF",
            status=PaymentStatus.PAID,
            paid_at=timezone.now(),
        )
        comm_commission = AffiliateService.process_first_subscription_commission(
            comm_payment, referral_code="REFA123"
        )
        assert comm_commission is None
        assert AffiliateCommission.objects.filter(payment=comm_payment).count() == 0

        # 3. Payment on a Platform Pro plan (no community) by a fresh user -> Awards 50% commission
        user_c = User.objects.create_user(
            email="user_c@kodinga.com",
            username="user_c",
            password="Password123!",
        )
        pro_plan = Plan.objects.create(
            community=None,
            name="Kodinga Pro",
            slug="kodinga-pro-monthly",
            price=Decimal("5000.00"),
            currency="XOF",
            billing_interval=BillingInterval.MONTH,
            is_active=True,
        )
        pro_payment = Payment.objects.create(
            user=user_c,
            plan=pro_plan,
            amount=pro_plan.price,
            currency="XOF",
            status=PaymentStatus.PAID,
            paid_at=timezone.now(),
        )
        pro_commission = AffiliateService.process_first_subscription_commission(
            pro_payment, referral_code="REFA123"
        )
        assert pro_commission is not None
        assert pro_commission.amount == Decimal("2500.00")
        assert pro_commission.status == CommissionStatus.APPROVED

    def test_b2_disciplinary_suspended_member_cannot_pay_and_remains_suspended(self, user_a, user_b, community):
        from apps.billing.services.billing_service import BillingService
        from rest_framework.exceptions import ValidationError

        member = CommunityMember.objects.create(
            community=community,
            user=user_b,
            role=CommunityRole.MEMBER,
            status=MembershipStatus.SUSPENDED,
        )
        # Add active disciplinary sanction
        MemberSanction.objects.create(
            member=member,
            community=community,
            sanction_type=SanctionType.SUSPENSION,
            is_active=True,
            reason="Violation de la charte",
        )

        plan = Plan.objects.create(
            community=community,
            name="VIP",
            slug="vip",
            price=Decimal("2000.00"),
            currency="XOF",
            billing_interval=BillingInterval.MONTH,
            is_active=True,
        )

        with pytest.raises(ValidationError) as exc:
            BillingService.create_checkout_session(user=user_b, plan_id=str(plan.id))
            BillingService.initiate_subscription_payment(user=user_b, plan_id=plan.id)
        assert "suspension disciplinaire" in str(exc.value).lower()

    def test_b3_subscription_expiry_reminders_and_idempotence(self, user_a, user_b, community):
        plan = Plan.objects.create(
            community=community,
            name="Pro Member",
            slug="pro-member",
            price=Decimal("2000.00"),
            currency="XOF",
            billing_interval=BillingInterval.MONTH,
        )
        now = timezone.now()
        sub = Subscription.objects.create(
            user=user_b,
            community=community,
            plan=plan,
            status=SubscriptionStatus.ACTIVE,
            current_period_end=now + timedelta(days=3, hours=12),
        )

        # Run periodic reminder task
        res1 = send_subscription_expiry_reminders()
        assert res1["reminded_count"] == 1

        notif = Notification.objects.filter(recipient=user_b, target_type="subscription").first()
        assert notif is not None
        assert "expire" in notif.title.lower()

        # Idempotence: running a second time within same window should not re-dispatch
        res2 = send_subscription_expiry_reminders()
        assert res2["reminded_count"] == 0
        assert Notification.objects.filter(recipient=user_b, target_type="subscription").count() == 1

    def test_b4_payout_lifecycle_and_rejection_recredits_wallet(self, user_a, community):
        wallet = CommunityWallet.objects.create(
            community=community,
            total_net=Decimal("100000.00"),
            available_balance=Decimal("50000.00"),
            withdrawn_amount=Decimal("0.00"),
            currency="XOF",
        )

        # Simulate withdrawal request (50,000 deducted from available_balance -> 0)
        wallet.available_balance -= Decimal("50000.00")
        wallet.save(update_fields=["available_balance"])
        payout = CommunityPayout.objects.create(
            community=community,
            requested_by=user_a,
            amount=Decimal("50000.00"),
            currency="XOF",
            status=PayoutStatus.PENDING,
            payment_method="wave",
            account_identifier="221770000000",
        )

        # 1. Approve
        payout = PayoutService.approve_payout(payout, admin_user=user_a)
        assert payout.status == PayoutStatus.APPROVED

        # 2. Reject -> Atomically refunds wallet available_balance
        payout = PayoutService.reject_payout(payout, rejection_reason="Numéro Wave erroné", admin_user=user_a)
        assert payout.status == PayoutStatus.REJECTED
        wallet.refresh_from_db()
        assert wallet.available_balance == Decimal("50000.00")

    def test_h1_revenue_overview_selector_is_read_only(self, community):
        assert CommunityWallet.objects.filter(community=community).count() == 0
        overview = BillingSelector.get_community_revenue_overview(community)
        assert overview["total_gross"] == Decimal("0.00")
        assert overview["available_balance"] == Decimal("0.00")
        # Ensure zero side effects in database
        assert CommunityWallet.objects.filter(community=community).count() == 0


@pytest.mark.django_db
class TestClassroomAndEventsAuditCorrections:
    """Tests for D1, D2, D3, D4, G1, G2"""

    def test_d1_d2_d3_d4_classroom_completion_xp_and_quiz(self, user_a, user_b, community):
        member_student = CommunityMember.objects.create(
            community=community,
            user=user_b,
            role=CommunityRole.MEMBER,
            status=MembershipStatus.ACTIVE,
        )
        course = Course.objects.create(
            community=community,
            title="FastAPI Masterclass",
            slug="fastapi-masterclass",
            is_published=True,
            is_sequential=False,
        )
        module = CourseModule.objects.create(course=course, title="Module 1", order=0)

        lesson1 = Lesson.objects.create(
            module=module,
            title="Lesson 1",
            slug="lesson-1",
            lesson_type=LessonType.ARTICLE,
            code_blocks=[
                {"id": "starter", "type": "starter", "code": "def hello(): pass"},
                {"id": "solution", "type": "solution", "code": "def hello(): return 42"},
            ],
            order=0,
        )
        lesson2 = Lesson.objects.create(
            module=module,
            title="Lesson 2 Quiz",
            slug="lesson-2-quiz",
            lesson_type=LessonType.QUIZ,
            quiz_data={
                "passing_score": 100.0,
                "questions": [
                    {
                        "id": "q1",
                        "question": "What is 2+2?",
                        "options": [
                            {"id": "opt1", "text": "3", "is_correct": False},
                            {"id": "opt2", "text": "4", "is_correct": True},
                        ],
                        "explanation": "2+2 equals 4.",
                    }
                ],
            },
            order=1,
        )

        # D4: Test solution code block is hidden from non-manager learner
        from apps.classroom.serializers.lesson import LessonDetailSerializer
        serializer_data = LessonDetailSerializer(
            lesson1, context={"request": type("Req", (), {"user": user_b})()}
        ).data
        blocks = serializer_data["code_blocks"]
        assert len(blocks) == 1
        assert blocks[0]["id"] == "starter"

        # D3 & D4: Submit failed quiz -> hides correct answer and explanation, xp_awarded is 0
        quiz_fail_res = ProgressService.submit_quiz(
            user=user_b,
            lesson=lesson2,
            submitted_answers={"q1": ["opt1"]},
        )
        assert quiz_fail_res["passed"] is False
        assert quiz_fail_res["xp_awarded"] == 0
        assert quiz_fail_res["question_results"][0]["correct_option_ids"] == []
        assert quiz_fail_res["question_results"][0]["explanation"] == ""

        # Submit passed quiz
        quiz_pass_res = ProgressService.submit_quiz(
            user=user_b,
            lesson=lesson2,
            submitted_answers={"q1": ["opt2"]},
        )
        assert quiz_pass_res["passed"] is True
        assert quiz_pass_res["question_results"][0]["correct_option_ids"] == ["opt2"]
        assert quiz_pass_res["question_results"][0]["explanation"] == "2+2 equals 4."

        # D1 & D2: Complete lesson 1 -> course reaches 100%
        prog1 = ProgressService.update_progress(user=user_b, lesson=lesson1, is_completed=True)
        enrollment = CourseEnrollment.objects.get(course=course, user=user_b)
        assert enrollment.first_completed_at is not None
        assert enrollment.completed_at is not None

        # Uncheck lesson 1 -> completed_at is None, but first_completed_at remains set
        ProgressService.update_progress(user=user_b, lesson=lesson1, is_completed=False)
        enrollment.refresh_from_db()
        assert enrollment.completed_at is None
        assert enrollment.first_completed_at is not None

        # Re-check lesson 1 -> Does not re-trigger completion notification or duplicate course points
        notif_count_before = Notification.objects.filter(recipient=user_b, target_type="course_completion").count()
        ProgressService.update_progress(user=user_b, lesson=lesson1, is_completed=True)
        notif_count_after = Notification.objects.filter(recipient=user_b, target_type="course_completion").count()
        assert notif_count_after == notif_count_before

    def test_g1_g2_event_reminder_task_timezone_and_link(self, user_a, user_b, community):
        now = timezone.now()
        event = Event.objects.create(
            community=community,
            host=user_a,
            title="Dakar AI Meetup",
            slug="dakar-ai-meetup",
            start_time=now + timedelta(minutes=25),
            end_time=now + timedelta(hours=2),
            timezone="Africa/Dakar",
            status=EventStatus.SCHEDULED,
            format=EventFormat.IN_PERSON,
        )
        EventAttendee.objects.create(
            event=event,
            user=user_b,
            status=AttendeeStatus.ATTENDING,
            reminder_sent=False,
        )

        total_sent = send_event_reminders_task()
        assert total_sent == 1

        notif = Notification.objects.filter(recipient=user_b, target_type="event").first()
        assert notif is not None
        assert notif.action_url == f"/c/{community.slug}?tab=events"
        assert "Africa/Dakar" in notif.body


@pytest.mark.django_db
class TestFrontendMissingEndpointsAuditCorrections:
    """Tests for I1, I2, I3, I4, I5, F1, F3"""

    def test_f1_hackathon_team_member_serializer_fields(self, user_a, user_b, community):
        now = timezone.now()
        hackathon = Hackathon.objects.create(
            community=community,
            organizer=user_a,
            title="Hackathon FinTech 2026",
            slug="hackathon-fintech-2026",
            registration_start=now - timedelta(days=1),
            registration_end=now + timedelta(days=1),
            start_time=now,
            submission_deadline=now + timedelta(days=2),
            judging_end=now + timedelta(days=3),
        )
        team = HackathonTeam.objects.create(
            hackathon=hackathon,
            leader=user_a,
            name="Alpha Team",
            slug="alpha-team",
        )
        member = HackathonTeamMember.objects.create(
            team=team,
            user=user_b,
            role="Dev",
            status="accepted",
        )
        data = HackathonTeamMemberSerializer(member).data
        assert data["hackathon_title"] == "Hackathon FinTech 2026"
        assert data["leader"]["id"] == str(user_a.id)

    def test_f3_workspace_invitation_serializer_fields(self, user_a, community):
        invite = CommunityInvitation.objects.create(
            community=community,
            invited_by=user_a,
            email="test@kodinga.com",
            role="member",
            token_hash="hash123",
            max_uses=5,
            uses_count=2,
            expires_at=timezone.now() + timedelta(days=7),
        )
        data = WorkspaceInvitationSerializer(invite).data
        assert data["max_uses"] == 5
        assert data["uses_count"] == 2

    def test_i1_community_member_is_online_and_filtering(self, user_a, user_b, community):
        from apps.memberships.serializers.member import CommunityMemberSerializer

        member_b = CommunityMember.objects.create(
            community=community,
            user=user_b,
            role=CommunityRole.MEMBER,
            status=MembershipStatus.ACTIVE,
        )
        # Without session -> is_online is False
        assert CommunityMemberSerializer(member_b).data["is_online"] is False

        # Create active recent session
        UserSession.objects.create(
            user=user_b,
            session_identifier="sess_123",
            refresh_token_identifier="tok_123",
            expires_at=timezone.now() + timedelta(days=1),
        )
        assert CommunityMemberSerializer(member_b).data["is_online"] is True

    def test_i2_post_locked_filtering(self, user_a, community):
        Post.objects.create(
            community=community,
            author=user_a,
            title="Locked Discussion",
            content="Content",
            is_locked=True,
            post_type=PostType.DISCUSSION,
        )
        Post.objects.create(
            community=community,
            author=user_a,
            title="Open Discussion",
            content="Content",
            is_locked=False,
            post_type=PostType.DISCUSSION,
        )

        locked_posts = list(PostSelector.get_community_feed(community=community, is_locked=True))
        assert len(locked_posts) == 1
        assert locked_posts[0].title == "Locked Discussion"

        unlocked_posts = list(PostSelector.get_community_feed(community=community, is_locked=False))
        assert len(unlocked_posts) == 1
        assert unlocked_posts[0].title == "Open Discussion"

    def test_i3_i4_user_follow_and_activity_heatmap(self, user_a, user_b, community):
        from rest_framework.test import APIClient
        client = APIClient()

        # Follow user_b as user_a
        client.force_authenticate(user=user_a)
        res_follow = client.post(f"/api/v1/profiles/{user_b.username}/follow/")
        assert res_follow.status_code == status.HTTP_200_OK
        assert res_follow.json()["data"]["is_following"] is True
        assert res_follow.json()["data"]["followers_count"] == 1

        # Check followers list of user_b
        res_followers = client.get(f"/api/v1/profiles/{user_b.username}/followers/")
        assert res_followers.status_code == status.HTTP_200_OK
        res_json = res_followers.json()
        items = res_json.get("results") or res_json.get("data", {}).get("results") or []
        assert len(items) >= 1
        assert items[0]["username"] == user_a.username

        # Activity heatmap for user_a
        Post.objects.create(
            community=community,
            author=user_a,
            title="Activity Test Post",
            content="Post for heatmap",
            post_type=PostType.DISCUSSION,
        )
        res_act = client.get(f"/api/v1/profiles/{user_a.username}/activity/")
        assert res_act.status_code == status.HTTP_200_OK
        act_data = res_act.json()["data"]
        assert act_data["year"] == timezone.now().year
        assert act_data["total_contributions"] >= 1
        today_key = timezone.now().strftime("%Y-%m-%d")
        assert act_data["counts"][today_key] >= 1

    def test_i5_community_owner_can_dissociate_project_from_community(self, user_a, user_b, community):
        project = Project.objects.create(
            owner=user_b,
            community=community,
            title="Awesome SaaS",
            slug="awesome-saas",
            description="A great project",
            status=ProjectStatus.PUBLISHED,
        )
        assert project.community_id == community.id

        # user_a is community owner, not project owner. They dissociate the project from their community.
        updated = ProjectService.update_project(
            project=project,
            user=user_a,
            validated_data={"community": None},
        )
        assert updated.community is None
        project.refresh_from_db()
        assert project.community is None
