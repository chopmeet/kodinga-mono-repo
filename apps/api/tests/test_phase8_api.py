from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.classroom.models.course import Course, CourseLevel
from apps.communities.models.community import Community, CommunityPrivacy
from apps.events.models.event import Event, EventFormat, EventStatus, EventType
from apps.gamification.models.badge import Badge, BadgeCategory, UserBadge
from apps.gamification.models.reputation import (
    ReputationAction,
    UserReputation,
)
from apps.gamification.services.gamification_service import GamificationService
from apps.notifications.models.notification import Notification, NotificationType
from apps.notifications.services.notification_service import NotificationService
from apps.posts.models.post import Post, PostType
from apps.profiles.models import (
    DeveloperProfile,
    DeveloperSkill,
    Technology,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_alpha(db):
    return User.objects.create_user(
        email="alpha@kodinga.com",
        username="alpha_dev",
        password="SecurePassword123!",
        first_name="Alpha",
        last_name="Diallo",
    )


@pytest.fixture
def user_beta(db):
    return User.objects.create_user(
        email="beta@kodinga.com",
        username="beta_dev",
        password="SecurePassword123!",
        first_name="Beta",
        last_name="Sow",
    )


@pytest.fixture
def community(user_alpha):
    return Community.objects.create(
        owner=user_alpha,
        name="Python Dakar Lab",
        slug="python-dakar-lab",
        description="Communauté Python et Django à Dakar",
        privacy_type=CommunityPrivacy.PUBLIC,
    )


@pytest.fixture
def badge(db):
    return Badge.objects.create(
        slug="mentor-gold",
        name="Mentor d'Or",
        description="Avoir aidé 50 développeurs",
        category=BadgeCategory.CONTRIBUTION,
        points_reward=100,
        is_active=True,
    )


# ==========================================
# 1. GAMIFICATION TESTS
# ==========================================


@pytest.mark.django_db
def test_gamification_profile_and_points(api_client, user_alpha, community):
    api_client.force_authenticate(user=user_alpha)

    # Initial profile
    res_me = api_client.get("/api/v1/gamification/reputation/me/")
    assert res_me.status_code == status.HTTP_200_OK
    assert res_me.data["data"]["level"] == 1
    assert res_me.data["data"]["total_points"] == 0
    assert res_me.data["data"]["rank_title"] == "Initié"

    # Award points: +60 points -> Level 2 ("Développeur")
    rep, tx = GamificationService.award_points(
        user=user_alpha,
        action=ReputationAction.ACCEPTED_ANSWER,
        points=60,
        community=community,
        description="Réponse acceptée en Python",
    )
    assert rep.total_points == 60
    assert rep.level == 2
    assert rep.rank_title == "Développeur"
    assert rep.current_streak_days == 1

    # Check updated profile API
    res_updated = api_client.get("/api/v1/gamification/reputation/me/")
    assert res_updated.status_code == status.HTTP_200_OK
    assert res_updated.data["data"]["total_points"] == 60
    assert res_updated.data["data"]["level"] == 2
    assert res_updated.data["data"]["rank_title"] == "Développeur"

    # History API
    res_hist = api_client.get("/api/v1/gamification/reputation/history/")
    assert res_hist.status_code == status.HTTP_200_OK
    assert len(res_hist.data["data"]) == 1
    assert res_hist.data["data"][0]["points"] == 60


@pytest.mark.django_db
def test_badges_catalogue_and_award(api_client, user_alpha, badge, community):
    api_client.force_authenticate(user=user_alpha)

    # Catalogue API
    res_badges = api_client.get("/api/v1/gamification/badges/")
    assert res_badges.status_code == status.HTTP_200_OK
    assert len(res_badges.data["data"]) == 1
    assert res_badges.data["data"][0]["slug"] == badge.slug

    # Award badge
    ub = GamificationService.award_badge(
        user=user_alpha, badge_slug=badge.slug, community=community
    )
    assert ub is not None
    assert UserBadge.objects.filter(user=user_alpha, badge=badge).exists()

    # Bonus points rewarded
    rep = UserReputation.objects.get(user=user_alpha)
    assert rep.total_points == badge.points_reward

    # User badges API
    res_my_badges = api_client.get("/api/v1/gamification/badges/my/")
    assert res_my_badges.status_code == status.HTTP_200_OK
    assert len(res_my_badges.data["data"]) == 1
    assert res_my_badges.data["data"][0]["badge"]["slug"] == badge.slug


@pytest.mark.django_db
def test_leaderboard(api_client, user_alpha, user_beta, community):
    GamificationService.award_points(
        user=user_alpha,
        action=ReputationAction.COURSE_COMPLETED,
        points=120,
        community=community,
    )
    GamificationService.award_points(
        user=user_beta,
        action=ReputationAction.POST_CREATED,
        points=50,
        community=community,
    )

    # Global leaderboard
    res_global = api_client.get("/api/v1/gamification/leaderboard/")
    assert res_global.status_code == status.HTTP_200_OK
    data = res_global.data["data"]
    assert len(data) >= 2
    assert data[0]["user"]["username"] == user_alpha.username
    assert data[0]["rank"] == 1
    assert data[0]["points"] == 120
    assert data[1]["user"]["username"] == user_beta.username
    assert data[1]["rank"] == 2

    # Community leaderboard
    res_comm = api_client.get(f"/api/v1/communities/{community.slug}/leaderboard/")
    assert res_comm.status_code == status.HTTP_200_OK
    comm_data = res_comm.data["data"]
    assert len(comm_data) == 2
    assert comm_data[0]["user"]["username"] == user_alpha.username


# ==========================================
# 2. NOTIFICATIONS TESTS
# ==========================================


@pytest.mark.django_db
def test_notifications_lifecycle(api_client, user_alpha, user_beta):
    # 1. Create notification
    notif = NotificationService.create_notification(
        recipient=user_alpha,
        actor=user_beta,
        title="Nouveau commentaire",
        body="Beta a commenté votre code",
        notification_type=NotificationType.POST_INTERACTION,
        action_url="/posts/123",
        target_type="post",
        target_id="123",
    )
    assert notif is not None
    assert notif.is_read is False

    # 2. Unread count API
    api_client.force_authenticate(user=user_alpha)
    res_count = api_client.get("/api/v1/notifications/unread-count/")
    assert res_count.status_code == status.HTTP_200_OK
    assert res_count.data["data"]["unread_count"] == 1

    # 3. List notifications API
    res_list = api_client.get("/api/v1/notifications/?all=true")
    assert res_list.status_code == status.HTTP_200_OK
    assert len(res_list.data["data"]) == 1
    assert res_list.data["data"][0]["id"] == str(notif.id)
    assert res_list.data["data"][0]["actor"]["username"] == user_beta.username

    # 4. Mark single as read
    res_read = api_client.post(f"/api/v1/notifications/{notif.id}/read/")
    assert res_read.status_code == status.HTTP_200_OK
    notif.refresh_from_db()
    assert notif.is_read is True
    assert notif.read_at is not None

    # Count is now 0
    res_count2 = api_client.get("/api/v1/notifications/unread-count/")
    assert res_count2.data["data"]["unread_count"] == 0

    # 5. Create 2 more unread notifications and mark all read
    NotificationService.create_notification(
        recipient=user_alpha, title="Event live", body="Le live commence"
    )
    NotificationService.create_notification(
        recipient=user_alpha, title="Badge reçu", body="Badge pionnier débloqué"
    )
    assert Notification.objects.filter(recipient=user_alpha, is_read=False).count() == 2

    res_all_read = api_client.post("/api/v1/notifications/read-all/")
    assert res_all_read.status_code == status.HTTP_200_OK
    assert res_all_read.data["data"]["marked_read_count"] == 2
    assert Notification.objects.filter(recipient=user_alpha, is_read=False).count() == 0

    # 6. Delete notification
    res_del = api_client.delete(f"/api/v1/notifications/{notif.id}/")
    assert res_del.status_code == status.HTTP_200_OK
    assert not Notification.objects.filter(id=notif.id).exists()

    # 7. Self notification is ignored
    self_notif = NotificationService.create_notification(
        recipient=user_alpha, actor=user_alpha, title="Self", body="Self"
    )
    assert self_notif is None


# ==========================================
# 3. DISCOVERY & SEARCH TESTS
# ==========================================


@pytest.mark.django_db
def test_discovery_search_and_trending(api_client, user_alpha, community):
    # Setup Course
    course = Course.objects.create(
        community=community,
        title="Django Masterclass 2026",
        slug="django-masterclass-2026",
        description="Maîtriser Django, DRF et PostgreSQL",
        level=CourseLevel.INTERMEDIATE,
        is_published=True,
        lessons_count=10,
    )

    # Setup Event
    now = timezone.now()
    event = Event.objects.create(
        community=community,
        host=user_alpha,
        title="Workshop Django & Celery",
        slug="workshop-django-celery",
        description="Atelier pratique sur les tâches de fond",
        event_type=EventType.WORKSHOP,
        format=EventFormat.LIVEKIT,
        status=EventStatus.SCHEDULED,
        start_time=now + timedelta(days=1),
        end_time=now + timedelta(days=1, hours=2),
        is_public=True,
        attendees_count=25,
    )

    # Setup Post
    Post.objects.create(
        community=community,
        author=user_alpha,
        title="Pourquoi Django bat FastAPI pour les monorepos",
        content="Comparatif architectural complet",
        post_type=PostType.DISCUSSION,
    )

    # Setup Profile Skill
    profile, _ = DeveloperProfile.objects.get_or_create(
        user=user_alpha,
        defaults={"headline": "Django & WebRTC Architect", "is_public": True},
    )
    profile.headline = "Django & WebRTC Architect"
    profile.is_public = True
    profile.save()

    tech, _ = Technology.objects.get_or_create(
        name="Django", defaults={"slug": "django"}
    )
    DeveloperSkill.objects.get_or_create(profile=profile, technology=tech)

    # 1. Global Search
    res_search = api_client.get("/api/v1/discovery/search/?q=Django")
    assert res_search.status_code == status.HTTP_200_OK
    results = res_search.data["data"]
    assert len(results["communities"]) >= 1
    assert results["communities"][0]["slug"] == community.slug
    assert len(results["courses"]) >= 1
    assert results["courses"][0]["slug"] == course.slug
    assert len(results["events"]) >= 1
    assert results["events"][0]["slug"] == event.slug
    assert len(results["posts"]) >= 1
    assert len(results["developers"]) >= 1

    # 2. Filtered search by type
    res_filtered = api_client.get("/api/v1/discovery/search/?q=Django&type=course")
    assert res_filtered.status_code == status.HTTP_200_OK
    f_results = res_filtered.data["data"]
    assert len(f_results["courses"]) >= 1
    assert len(f_results["communities"]) == 0
    assert len(f_results["events"]) == 0

    # 3. Trending
    res_trending = api_client.get("/api/v1/discovery/trending/")
    assert res_trending.status_code == status.HTTP_200_OK
    trend_data = res_trending.data["data"]
    assert len(trend_data["communities"]) >= 1
    assert len(trend_data["courses"]) >= 1
    assert len(trend_data["events"]) >= 1

    # 4. Recommendations for user with 'Django' skill
    api_client.force_authenticate(user=user_alpha)
    res_rec = api_client.get("/api/v1/discovery/recommendations/")
    assert res_rec.status_code == status.HTTP_200_OK
    rec_data = res_rec.data["data"]
    assert "Django" in rec_data["matched_technologies"]
    assert len(rec_data["recommended_communities"]) >= 1
    assert len(rec_data["recommended_courses"]) >= 1
