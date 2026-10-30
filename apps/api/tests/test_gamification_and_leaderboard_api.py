from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.classroom.models.course import Course, CourseLevel
from apps.classroom.models.lesson import Lesson
from apps.classroom.models.module import CourseModule
from apps.classroom.services.progress_service import ProgressService
from apps.communities.models.community import Community
from apps.events.models.event import Event, EventFormat, EventStatus, EventType
from apps.events.services.event_service import EventService
from apps.gamification.models.reputation import (
    CommunityPointRuleAuditLog,
    ReputationAction,
    ReputationTransaction,
    TransactionSource,
)
from apps.gamification.services.gamification_service import GamificationService
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.posts.services.post_service import PostService


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def owner_user(db):
    return User.objects.create_user(
        email="owner_gamif@kodinga.com",
        username="owner_gamif",
        password="Password123!",
        first_name="Amadou",
        last_name="Diallo",
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin_gamif@kodinga.com",
        username="admin_gamif",
        password="Password123!",
    )


@pytest.fixture
def member_alice(db):
    return User.objects.create_user(
        email="alice_gamif@kodinga.com",
        username="alice_dev",
        password="Password123!",
        first_name="Alice",
        last_name="Ndiaye",
    )


@pytest.fixture
def member_bob(db):
    return User.objects.create_user(
        email="bob_gamif@kodinga.com",
        username="bob_dev",
        password="Password123!",
        first_name="Bob",
        last_name="Sow",
    )


@pytest.fixture
def member_charlie(db):
    return User.objects.create_user(
        email="charlie_gamif@kodinga.com",
        username="charlie_dev",
        password="Password123!",
        first_name="Charlie",
        last_name="Ba",
    )


@pytest.fixture
def community_alpha(db, owner_user, admin_user, member_alice, member_bob, member_charlie):
    comm = Community.objects.create(
        name="Python Senegal",
        slug="python-senegal",
        description="Communauté Python au Sénégal",
        owner=owner_user,
    )
    CommunityMember.objects.create(
        community=comm,
        user=owner_user,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=admin_user,
        role=CommunityRole.ADMIN,
        status=MembershipStatus.ACTIVE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=member_alice,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=member_bob,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=member_charlie,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.fixture
def community_beta(db, owner_user, member_alice):
    comm = Community.objects.create(
        name="Rust Côte d'Ivoire",
        slug="rust-ci",
        description="Communauté Rust en Côte d'Ivoire",
        owner=owner_user,
    )
    CommunityMember.objects.create(
        community=comm,
        user=owner_user,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=member_alice,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.mark.django_db
class TestGamificationAndLeaderboardSystem:
    """
    Comprehensive test suite covering:
    1. Automatic point attribution on course completion (50), event attendance (30), and post creation (10)
    2. Idempotence and double-attribution prevention
    3. Per-community configurable point scale (barème) & non-retroactivity
    4. Multi-tenant community isolation
    5. Manual point adjustments with mandatory reason & audit trail
    6. Community leaderboard, Top N, pagination, tie-breaking, and current user position
    7. RBAC permissions and unauthorized access rejection
    """

    def test_automatic_points_course_event_and_post_plus_idempotence(
        self, api_client, owner_user, member_alice, community_alpha, monkeypatch
    ):
        # Bypass AI pre-publication moderation external calls if any
        from apps.ai.services.moderation_service import ModerationService

        monkeypatch.setattr(
            ModerationService,
            "enforce_pre_publication",
            classmethod(lambda cls, *args, **kwargs: None),
        )

        # ---------------------------------------------------------------------
        # A. COURSE COMPLETION (+50 pts only when 100% completed, once)
        # ---------------------------------------------------------------------
        course = Course.objects.create(
            community=community_alpha,
            author=owner_user,
            title="Django Clean Architecture",
            slug="django-clean-arch",
            level=CourseLevel.INTERMEDIATE,
            is_published=True,
            lessons_count=2,
        )
        module = CourseModule.objects.create(
            course=course, title="Module 1", order=1, lessons_count=2
        )
        lesson1 = Lesson.objects.create(
            module=module, title="Leçon 1", slug="lecon-1", order=1
        )
        lesson2 = Lesson.objects.create(
            module=module, title="Leçon 2", slug="lecon-2", order=2
        )

        # 1. Enrolling alone does NOT award points
        ProgressService.enroll_user(user=member_alice, course=course)
        assert (
            ReputationTransaction.objects.filter(
                user=member_alice,
                community=community_alpha,
                action=ReputationAction.COURSE_COMPLETED,
            ).count()
            == 0
        )

        # 2. Completing lesson 1/2 (50% progress) does NOT award course completion points
        ProgressService.update_progress(
            user=member_alice, lesson=lesson1, is_completed=True
        )
        assert (
            ReputationTransaction.objects.filter(
                user=member_alice,
                community=community_alpha,
                action=ReputationAction.COURSE_COMPLETED,
            ).count()
            == 0
        )

        # 3. Completing lesson 2/2 (100% progress) awards +50 points
        ProgressService.update_progress(
            user=member_alice, lesson=lesson2, is_completed=True
        )
        course_txs = ReputationTransaction.objects.filter(
            user=member_alice,
            community=community_alpha,
            action=ReputationAction.COURSE_COMPLETED,
        )
        assert course_txs.count() == 1
        assert course_txs.first().points == 50
        assert course_txs.first().reference_type == "course"
        assert course_txs.first().reference_id == str(course.id)
        assert course_txs.first().source == TransactionSource.AUTOMATIC

        # 4. Idempotence: re-submitting progress on lesson 2 does NOT award 50 points again
        ProgressService.update_progress(
            user=member_alice, lesson=lesson2, is_completed=True
        )
        assert (
            ReputationTransaction.objects.filter(
                user=member_alice,
                community=community_alpha,
                action=ReputationAction.COURSE_COMPLETED,
            ).count()
            == 1
        )

        # ---------------------------------------------------------------------
        # B. EVENT ATTENDANCE (+30 pts only when attendance confirmed, once)
        # ---------------------------------------------------------------------
        now = timezone.now()
        event = Event.objects.create(
            community=community_alpha,
            host=owner_user,
            title="Live Architecture Hexagonale",
            slug="live-arch-hexagonale",
            event_type=EventType.WORKSHOP,
            format=EventFormat.LIVEKIT,
            status=EventStatus.LIVE,
            start_time=now - timedelta(minutes=15),
            end_time=now + timedelta(hours=1),
        )

        # 1. Simple RSVP registration does NOT award points
        EventService.rsvp_event(user=member_alice, event=event)
        assert (
            ReputationTransaction.objects.filter(
                user=member_alice,
                community=community_alpha,
                action=ReputationAction.EVENT_ATTENDED,
            ).count()
            == 0
        )

        # 2. Confirming effective attendance awards +30 points
        EventService.confirm_attendance(
            user=member_alice, event=event, actor_user=owner_user
        )
        event_txs = ReputationTransaction.objects.filter(
            user=member_alice,
            community=community_alpha,
            action=ReputationAction.EVENT_ATTENDED,
        )
        assert event_txs.count() == 1
        assert event_txs.first().points == 30
        assert event_txs.first().reference_type == "event"
        assert event_txs.first().reference_id == str(event.id)

        # 3. Idempotence: confirming attendance a second time does NOT duplicate points
        EventService.confirm_attendance(
            user=member_alice, event=event, actor_user=owner_user
        )
        assert (
            ReputationTransaction.objects.filter(
                user=member_alice,
                community=community_alpha,
                action=ReputationAction.EVENT_ATTENDED,
            ).count()
            == 1
        )

        # ---------------------------------------------------------------------
        # C. FEED POST PUBLISHED (+10 pts per distinct valid post, idempotent per post)
        # ---------------------------------------------------------------------
        post1 = PostService.create_post(
            author=member_alice,
            community=community_alpha,
            data={
                "title": "Astuce optimisation ORM Django",
                "content": "Utilisez select_related et prefetch_related !",
            },
        )
        post_txs = ReputationTransaction.objects.filter(
            user=member_alice,
            community=community_alpha,
            action=ReputationAction.POST_CREATED,
        )
        assert post_txs.count() == 1
        assert post_txs.first().points == 10
        assert post_txs.first().reference_id == str(post1.id)

        # Calling award_post_created again on the exact same post1 is idempotent
        GamificationService.award_post_created(user=member_alice, post=post1)
        assert (
            ReputationTransaction.objects.filter(
                user=member_alice,
                community=community_alpha,
                action=ReputationAction.POST_CREATED,
            ).count()
            == 1
        )

        # Verify total points for Alice in community_alpha = 50 + 30 + 10 = 90 pts
        api_client.force_authenticate(user=member_alice)
        res_me = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/gamification/points/me/"
        )
        assert res_me.status_code == status.HTTP_200_OK
        assert res_me.data["data"]["total_points"] == 90
        assert res_me.data["data"]["transactions_count"] == 3

        member_record = CommunityMember.objects.get(
            community=community_alpha, user=member_alice
        )
        assert member_record.reputation_score == 90

    def test_community_rule_configuration_and_non_retroactivity(
        self, api_client, owner_user, member_alice, community_alpha, monkeypatch
    ):
        from apps.ai.services.moderation_service import ModerationService

        monkeypatch.setattr(
            ModerationService,
            "enforce_pre_publication",
            classmethod(lambda cls, *args, **kwargs: None),
        )

        # 1. Alice publishes a post under default rule (10 points)
        PostService.create_post(
            author=member_alice,
            community=community_alpha,
            data={"title": "Post 1", "content": "Contenu 1"},
        )
        assert (
            GamificationService.ensure_reputation(member_alice).total_points == 10
        )

        # 2. Owner fetches the community's point scale (barème)
        api_client.force_authenticate(user=owner_user)
        rules_url = f"/api/v1/communities/{community_alpha.slug}/gamification/rules/"
        res_rules = api_client.get(rules_url)
        assert res_rules.status_code == status.HTTP_200_OK
        rules_by_action = {r["action"]: r for r in res_rules.data["data"]}
        assert rules_by_action[ReputationAction.COURSE_COMPLETED]["points"] == 50
        assert rules_by_action[ReputationAction.EVENT_ATTENDED]["points"] == 30
        assert rules_by_action[ReputationAction.POST_CREATED]["points"] == 10

        # 3. Owner modifies `post_created` from 10 to 25 points
        patch_res = api_client.patch(
            f"/api/v1/communities/{community_alpha.slug}/gamification/rules/{ReputationAction.POST_CREATED}/",
            {"points": 25, "note": "Boost engagement sur le feed"},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_200_OK
        assert patch_res.data["data"]["points"] == 25

        # 4. Non-retroactivity: Alice's previously earned 10 points are NOT changed
        tx_first = ReputationTransaction.objects.filter(
            user=member_alice, community=community_alpha
        ).first()
        assert tx_first.points == 10

        # 5. Alice publishes a second post -> earns 25 points (total = 10 + 25 = 35)
        PostService.create_post(
            author=member_alice,
            community=community_alpha,
            data={"title": "Post 2", "content": "Contenu 2"},
        )
        res_points = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/gamification/members/{member_alice.id}/points/"
        )
        assert res_points.status_code == status.HTTP_200_OK
        assert res_points.data["data"]["total_points"] == 35

        # 6. Owner disables `post_created` rule (`is_active: false`)
        disable_res = api_client.patch(
            f"/api/v1/communities/{community_alpha.slug}/gamification/rules/{ReputationAction.POST_CREATED}/",
            {"is_active": False, "note": "Pause temporaire"},
            format="json",
        )
        assert disable_res.status_code == status.HTTP_200_OK
        assert disable_res.data["data"]["is_active"] is False

        # 7. Alice publishes a third post -> earns 0 points because rule is inactive (total stays 35)
        PostService.create_post(
            author=member_alice,
            community=community_alpha,
            data={"title": "Post 3", "content": "Contenu 3"},
        )
        res_points_after = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/gamification/members/{member_alice.id}/points/"
        )
        assert res_points_after.data["data"]["total_points"] == 35

        # 8. Owner checks the audit history of rule changes
        hist_res = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/gamification/rules/history/"
        )
        assert hist_res.status_code == status.HTTP_200_OK
        logs = hist_res.data["data"]
        assert len(logs) == 2
        assert logs[0]["previous_is_active"] is True
        assert logs[0]["new_is_active"] is False
        assert logs[1]["previous_points"] == 10
        assert logs[1]["new_points"] == 25
        assert CommunityPointRuleAuditLog.objects.filter(
            community=community_alpha
        ).count() == 2

    def test_multi_tenant_isolation_between_communities(
        self, api_client, owner_user, member_alice, community_alpha, community_beta
    ):
        # Award 100 points to Alice in community_alpha and 30 points in community_beta
        GamificationService.award_points(
            user=member_alice,
            action=ReputationAction.COURSE_COMPLETED,
            points=100,
            community=community_alpha,
            reference_type="course",
            reference_id="course-alpha-1",
        )
        GamificationService.award_points(
            user=member_alice,
            action=ReputationAction.EVENT_ATTENDED,
            points=30,
            community=community_beta,
            reference_type="event",
            reference_id="event-beta-1",
        )

        api_client.force_authenticate(user=member_alice)

        # Check community_alpha points & leaderboard
        res_alpha = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/gamification/points/me/"
        )
        assert res_alpha.status_code == status.HTTP_200_OK
        assert res_alpha.data["data"]["total_points"] == 100

        lb_alpha = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/leaderboard/"
        )
        assert lb_alpha.data["data"][0]["points"] == 100

        # Check community_beta points & leaderboard (strictly isolated: 30 pts, not 130!)
        res_beta = api_client.get(
            f"/api/v1/communities/{community_beta.slug}/gamification/points/me/"
        )
        assert res_beta.status_code == status.HTTP_200_OK
        assert res_beta.data["data"]["total_points"] == 30

        lb_beta = api_client.get(
            f"/api/v1/communities/{community_beta.slug}/leaderboard/"
        )
        assert lb_beta.data["data"][0]["points"] == 30

    def test_manual_point_adjustments_and_audit_trail(
        self, api_client, owner_user, member_alice, community_alpha
    ):
        api_client.force_authenticate(user=owner_user)
        adjust_url = f"/api/v1/communities/{community_alpha.slug}/gamification/points/adjust/"

        # 1. Missing or empty reason is rejected with 400
        bad_res = api_client.post(
            adjust_url,
            {"user_id": str(member_alice.id), "points": 40, "reason": "   "},
            format="json",
        )
        assert bad_res.status_code == status.HTTP_400_BAD_REQUEST

        # 2. Zero points is rejected with 400
        zero_res = api_client.post(
            adjust_url,
            {"user_id": str(member_alice.id), "points": 0, "reason": "Test zero"},
            format="json",
        )
        assert zero_res.status_code == status.HTTP_400_BAD_REQUEST

        # 3. Valid positive manual adjustment (+40 pts)
        add_res = api_client.post(
            adjust_url,
            {
                "user_id": str(member_alice.id),
                "points": 40,
                "reason": "Organisation bénévole du workshop Python",
            },
            format="json",
        )
        assert add_res.status_code == status.HTTP_201_CREATED
        assert add_res.data["data"]["points"] == 40
        assert add_res.data["data"]["source"] == TransactionSource.MANUAL_ADJUSTMENT
        assert add_res.data["data"]["awarded_by"]["username"] == owner_user.username
        assert (
            add_res.data["data"]["description"]
            == "Organisation bénévole du workshop Python"
        )

        # 4. Valid negative manual adjustment (-15 pts)
        sub_res = api_client.post(
            adjust_url,
            {
                "user_id": str(member_alice.id),
                "points": -15,
                "reason": "Correction d'attribution erronée",
            },
            format="json",
        )
        assert sub_res.status_code == status.HTTP_201_CREATED
        assert sub_res.data["data"]["points"] == -15

        # 5. Both transactions are preserved in history; net total is 40 - 15 = 25 pts
        tx_list_res = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/gamification/transactions/?source=manual_adjustment"
        )
        assert tx_list_res.status_code == status.HTTP_200_OK
        assert len(tx_list_res.data["data"]) == 2

        pts_res = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/gamification/members/{member_alice.id}/points/"
        )
        assert pts_res.data["data"]["total_points"] == 25

    def test_leaderboard_ranking_ties_top_n_pagination_and_my_position(
        self,
        api_client,
        owner_user,
        member_alice,
        member_bob,
        member_charlie,
        community_alpha,
    ):
        # Alice: 80 points
        GamificationService.award_points(
            user=member_alice,
            action=ReputationAction.COURSE_COMPLETED,
            points=80,
            community=community_alpha,
            reference_type="course",
            reference_id="c-1",
        )
        # Bob: 80 points (TIED with Alice at 80 points!)
        GamificationService.award_points(
            user=member_bob,
            action=ReputationAction.COURSE_COMPLETED,
            points=80,
            community=community_alpha,
            reference_type="course",
            reference_id="c-1",
        )
        # Charlie: 30 points
        GamificationService.award_points(
            user=member_charlie,
            action=ReputationAction.EVENT_ATTENDED,
            points=30,
            community=community_alpha,
            reference_type="event",
            reference_id="ev-1",
        )
        # Owner: 10 points
        GamificationService.award_points(
            user=owner_user,
            action=ReputationAction.POST_CREATED,
            points=10,
            community=community_alpha,
            reference_type="post",
            reference_id="p-1",
        )

        api_client.force_authenticate(user=member_charlie)

        # 1. Full community leaderboard & tie handling
        lb_res = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/leaderboard/"
        )
        assert lb_res.status_code == status.HTTP_200_OK
        entries = lb_res.data["data"]
        assert len(entries) == 4

        # Alice and Bob both have 80 pts -> both have rank == 1 and is_tied == True!
        assert entries[0]["points"] == 80
        assert entries[0]["rank"] == 1
        assert entries[0]["position"] == 1
        assert entries[0]["is_tied"] is True

        assert entries[1]["points"] == 80
        assert entries[1]["rank"] == 1
        assert entries[1]["position"] == 2
        assert entries[1]["is_tied"] is True

        # Charlie has 30 pts -> standard competition rank is 3 (after two rank 1s), position is 3!
        assert entries[2]["user"]["username"] == member_charlie.username
        assert entries[2]["points"] == 30
        assert entries[2]["rank"] == 3
        assert entries[2]["position"] == 3
        assert entries[2]["is_tied"] is False

        # Owner has 10 pts -> rank 4, position 4
        assert entries[3]["user"]["username"] == owner_user.username
        assert entries[3]["rank"] == 4
        assert entries[3]["position"] == 4

        # 2. Top 3 filter (?top=3)
        top3_res = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/leaderboard/?top=3"
        )
        assert top3_res.status_code == status.HTTP_200_OK
        assert len(top3_res.data["data"]) == 3
        assert top3_res.data["meta"]["top"] == 3

        # 3. Pagination (?page=2&page_size=2)
        page2_res = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/leaderboard/?page=2&page_size=2"
        )
        assert page2_res.status_code == status.HTTP_200_OK
        assert len(page2_res.data["data"]) == 2
        assert page2_res.data["data"][0]["user"]["username"] == member_charlie.username
        assert page2_res.data["meta"]["page"] == 2
        assert page2_res.data["meta"]["total_pages"] == 2

        # 4. Authenticated member's own position (/leaderboard/me/)
        me_pos_res = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/leaderboard/me/"
        )
        assert me_pos_res.status_code == status.HTTP_200_OK
        me_pos = me_pos_res.data["data"]
        assert me_pos["rank"] == 3
        assert me_pos["position"] == 3
        assert me_pos["points"] == 30
        assert me_pos["points_to_next_rank"] == 51  # 80 - 30 + 1 = 51 pts to overtake 80

        # 5. Global community gamification stats (/gamification/stats/)
        stats_res = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/gamification/stats/"
        )
        assert stats_res.status_code == status.HTTP_200_OK
        stats = stats_res.data["data"]
        assert stats["total_points_awarded"] == 200  # 80 + 80 + 30 + 10
        assert stats["active_rewarded_members_count"] == 4
        assert len(stats["top_3_members"]) == 3

    def test_permissions_and_unauthorized_access_blocked(
        self, api_client, owner_user, admin_user, member_alice, community_alpha
    ):
        # 1. Regular member Alice CANNOT modify community rules (403)
        api_client.force_authenticate(user=member_alice)
        res_patch_rule = api_client.patch(
            f"/api/v1/communities/{community_alpha.slug}/gamification/rules/{ReputationAction.POST_CREATED}/",
            {"points": 500},
            format="json",
        )
        assert res_patch_rule.status_code == status.HTTP_403_FORBIDDEN

        # 2. Regular member Alice CANNOT adjust points manually (403)
        res_adjust = api_client.post(
            f"/api/v1/communities/{community_alpha.slug}/gamification/points/adjust/",
            {
                "user_id": str(member_alice.id),
                "points": 1000,
                "reason": "Tentative d'auto-attribution non autorisée",
            },
            format="json",
        )
        assert res_adjust.status_code == status.HTTP_403_FORBIDDEN

        # 3. Regular member Alice CANNOT view rule audit logs or admin transactions log (403)
        res_rule_hist = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/gamification/rules/history/"
        )
        assert res_rule_hist.status_code == status.HTTP_403_FORBIDDEN

        res_admin_tx = api_client.get(
            f"/api/v1/communities/{community_alpha.slug}/gamification/transactions/"
        )
        assert res_admin_tx.status_code == status.HTTP_403_FORBIDDEN

        # 4. Authorized Community Admin CAN modify rules and adjust points (200 / 201)
        api_client.force_authenticate(user=admin_user)
        admin_patch = api_client.patch(
            f"/api/v1/communities/{community_alpha.slug}/gamification/rules/{ReputationAction.EVENT_ATTENDED}/",
            {"points": 40, "note": "Mis à jour par l'admin"},
            format="json",
        )
        assert admin_patch.status_code == status.HTTP_200_OK
        assert admin_patch.data["data"]["points"] == 40

