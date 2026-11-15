from unittest.mock import patch

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.ai.schemas import ModerationResult
from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.communities.models.settings import CommunitySettings
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.posts.models.category import PostCategory
from apps.posts.models.post import PostType
from apps.posts.models.reaction import ReactionType


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture(autouse=True)
def mock_ai_moderation_allow():
    with patch("apps.ai.router.ai_router.moderate_content") as mock_mod:
        mock_mod.return_value = ModerationResult(
            decision="allow",
            flagged=False,
            categories=[],
            confidence=1.0,
            provider="mock_test",
        )
        yield mock_mod


@pytest.fixture
def user_owner(db):
    return User.objects.create_user(
        email="owner@kodinga.com",
        username="ownerdev",
        password="SecurePassword123!",
        first_name="Ada",
        last_name="Lovelace",
    )


@pytest.fixture
def user_member(db):
    return User.objects.create_user(
        email="member@kodinga.com",
        username="memberdev",
        password="SecurePassword123!",
        first_name="Alan",
        last_name="Turing",
    )


@pytest.fixture
def user_stranger(db):
    return User.objects.create_user(
        email="stranger@kodinga.com",
        username="strangerdev",
        password="SecurePassword123!",
        first_name="Grace",
        last_name="Hopper",
    )


@pytest.fixture
def community(db, user_owner, user_member):
    cat = CommunityCategory.objects.create(name="Python", slug="python")
    comm = Community.objects.create(
        name="Django Masters",
        slug="django-masters",
        owner=user_owner,
        category=cat,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )
    CommunitySettings.objects.create(community=comm)
    # Register owner membership
    CommunityMember.objects.create(
        community=comm,
        user=user_owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    # Register regular member membership
    CommunityMember.objects.create(
        community=comm,
        user=user_member,
        role=CommunityRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.fixture
def post_category(db, community):
    return PostCategory.objects.create(
        community=community, name="Aide & Debugging", slug="help", icon="bug"
    )


@pytest.mark.django_db
class TestPostsAPI:
    def test_create_post_with_code_snippet(self, api_client, user_member, community):
        api_client.force_authenticate(user=user_member)
        url = f"/api/v1/communities/{community.slug}/feed/"
        payload = {
            "title": "Comment optimiser un Prefetch Django ?",
            "content": "Voici un extrait de mon selector :",
            "post_type": PostType.QUESTION,
            "code_snippet": "Comment.objects.prefetch_related('replies')",
            "code_language": "python",
        }
        response = api_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        data = response.data.get("data") or response.data
        assert data["title"] == payload["title"]
        assert data["post_type"] == PostType.QUESTION
        assert data["code_language"] == "python"
        assert data["author"]["username"] == "memberdev"

    def test_create_post_with_poll(self, api_client, user_member, community):
        api_client.force_authenticate(user=user_member)
        url = f"/api/v1/communities/{community.slug}/feed/"
        payload = {
            "title": "Quel framework Python préférez-vous en 2026 ?",
            "content": "Sondage communautaire annuel",
            "post_type": PostType.POLL,
            "poll": {
                "question": "Votre framework backend favori ?",
                "is_multiple_choice": False,
                "duration_days": 7,
                "options": ["Django REST Framework", "FastAPI", "Litestar"],
            },
        }
        response = api_client.post(url, payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        data = response.data.get("data") or response.data
        assert data["poll"] is not None
        assert len(data["poll"]["options"]) == 3
        assert data["poll"]["total_votes"] == 0

    def test_vote_on_poll(self, api_client, user_member, user_owner, community):
        # Create post with poll
        api_client.force_authenticate(user=user_owner)
        url = f"/api/v1/communities/{community.slug}/feed/"
        payload = {
            "title": "Sondage DB",
            "content": "Quelle DB ?",
            "poll": {
                "question": "Postgres ou SQLite ?",
                "is_multiple_choice": False,
                "options": ["PostgreSQL", "SQLite"],
            },
        }
        res = api_client.post(url, payload, format="json")
        post_data = res.data.get("data") or res.data
        post_id = post_data["id"]
        option_id = post_data["poll"]["options"][0]["id"]

        # Vote with member
        api_client.force_authenticate(user=user_member)
        vote_url = f"/api/v1/posts/{post_id}/vote/"
        vote_res = api_client.post(vote_url, {"option_ids": [option_id]}, format="json")
        assert vote_res.status_code == status.HTTP_200_OK
        poll_res = vote_res.data.get("data") or vote_res.data
        assert poll_res["total_votes"] == 1
        assert poll_res["user_has_voted"] is True
        assert poll_res["options"][0]["votes_count"] == 1
        assert poll_res["options"][0]["percentage"] == 100.0

    def test_feed_filtering_and_search(self, api_client, user_owner, community):
        api_client.force_authenticate(user=user_owner)
        url = f"/api/v1/communities/{community.slug}/feed/"

        # Create post 1
        api_client.post(
            url,
            {
                "title": "Architecture Microservices",
                "content": "Découvrez notre nouveau setup",
                "post_type": PostType.DISCUSSION,
            },
            format="json",
        )

        # Create post 2
        api_client.post(
            url,
            {
                "title": "Frontend React 19",
                "content": "Nouveautés de React",
                "post_type": PostType.PROJECT_SHOWCASE,
            },
            format="json",
        )

        # Query filter by type
        res = api_client.get(f"{url}?type=discussion")
        assert res.status_code == status.HTTP_200_OK
        results = res.data.get("results") if "results" in res.data else res.data
        assert len(results) == 1
        assert results[0]["title"] == "Architecture Microservices"

        # Query search keyword
        res_search = api_client.get(f"{url}?q=React")
        assert res_search.status_code == status.HTTP_200_OK
        search_results = (
            res_search.data.get("results")
            if "results" in res_search.data
            else res_search.data
        )
        assert len(search_results) == 1
        assert search_results[0]["title"] == "Frontend React 19"

    def test_toggle_post_reaction(self, api_client, user_member, user_owner, community):
        # Create post
        api_client.force_authenticate(user=user_owner)
        res = api_client.post(
            f"/api/v1/communities/{community.slug}/feed/",
            {"title": "Awesome Release", "content": "Check this out !"},
            format="json",
        )
        post_id = (res.data.get("data") or res.data)["id"]

        # React with rocket
        api_client.force_authenticate(user=user_member)
        react_url = f"/api/v1/posts/{post_id}/react/"
        react_res = api_client.post(
            react_url, {"reaction_type": ReactionType.ROCKET}, format="json"
        )
        assert react_res.status_code == status.HTTP_200_OK
        assert (react_res.data.get("data") or react_res.data)["reacted"] is True

        # Toggle off
        react_res2 = api_client.post(
            react_url, {"reaction_type": ReactionType.ROCKET}, format="json"
        )
        assert react_res2.status_code == status.HTTP_200_OK
        assert (react_res2.data.get("data") or react_res2.data)["reacted"] is False

    def test_post_pin_and_lock_by_moderator(
        self, api_client, user_owner, user_member, community
    ):
        # Create post by member
        api_client.force_authenticate(user=user_member)
        res = api_client.post(
            f"/api/v1/communities/{community.slug}/feed/",
            {
                "title": "Règlement communautaire",
                "content": "Veuillez respecter les consignes.",
            },
            format="json",
        )
        post_id = (res.data.get("data") or res.data)["id"]

        # Member tries to pin (forbidden)
        pin_url = f"/api/v1/posts/{post_id}/pin/"
        pin_fail = api_client.post(pin_url, format="json")
        assert pin_fail.status_code == status.HTTP_403_FORBIDDEN

        # Owner pins post
        api_client.force_authenticate(user=user_owner)
        pin_success = api_client.post(pin_url, format="json")
        assert pin_success.status_code == status.HTTP_200_OK
        assert (pin_success.data.get("data") or pin_success.data)["is_pinned"] is True

        # Owner locks post
        lock_url = f"/api/v1/posts/{post_id}/lock/"
        lock_success = api_client.post(lock_url, format="json")
        assert lock_success.status_code == status.HTTP_200_OK
        assert (lock_success.data.get("data") or lock_success.data)["is_locked"] is True

        # Member tries to comment on locked post
        api_client.force_authenticate(user=user_member)
        comment_url = f"/api/v1/posts/{post_id}/comments/"
        comment_fail = api_client.post(
            comment_url, {"content": "Mon avis"}, format="json"
        )
        assert comment_fail.status_code == status.HTTP_400_BAD_REQUEST

    def test_threaded_comments_and_accepted_answer(
        self, api_client, user_owner, user_member, community
    ):
        # Owner posts a question
        api_client.force_authenticate(user=user_owner)
        res = api_client.post(
            f"/api/v1/communities/{community.slug}/feed/",
            {
                "title": "Comment utiliser select_related vs prefetch_related ?",
                "content": "J'ai un doute sur les relations OneToMany.",
                "post_type": PostType.QUESTION,
            },
            format="json",
        )
        post_id = (res.data.get("data") or res.data)["id"]

        # Member posts an answer comment
        api_client.force_authenticate(user=user_member)
        comment_url = f"/api/v1/posts/{post_id}/comments/"
        c_res = api_client.post(
            comment_url,
            {
                "content": (
                    "Utilise select_related pour ForeignKey et OneToOne, et"
                    " prefetch_related pour ManyToMany et reverse ForeignKey !"
                )
            },
            format="json",
        )
        assert c_res.status_code == status.HTTP_201_CREATED
        comment_data = c_res.data.get("data") or c_res.data
        comment_id = comment_data["id"]

        # Owner posts a reply to member comment
        api_client.force_authenticate(user=user_owner)
        reply_res = api_client.post(
            comment_url,
            {"content": "Merci pour l'explication limpide !", "parent_id": comment_id},
            format="json",
        )
        assert reply_res.status_code == status.HTTP_201_CREATED

        # Fetch comments list
        list_res = api_client.get(comment_url)
        assert list_res.status_code == status.HTTP_200_OK
        comments_list = list_res.data.get("data") or list_res.data
        assert len(comments_list) == 1
        assert len(comments_list[0]["replies"]) == 1

        # Owner marks member comment as accepted answer
        accept_url = f"/api/v1/comments/{comment_id}/accept/"
        accept_res = api_client.post(accept_url, format="json")
        assert accept_res.status_code == status.HTTP_200_OK
        acc_data = accept_res.data.get("data") or accept_res.data
        assert acc_data["is_accepted_answer"] is True

        # Check reputation awarded to member (+15)
        member_record = CommunityMember.objects.get(
            community=community, user=user_member
        )
        assert member_record.reputation_score == 15

    def test_comments_ordered_newest_first(
        self, api_client, user_owner, user_member, community
    ):
        """
        Verify that newly posted comments and messages always appear at the top
        (most recent first) in the backend response.
        """
        api_client.force_authenticate(user=user_owner)
        res = api_client.post(
            f"/api/v1/communities/{community.slug}/feed/",
            {
                "title": "Post de test pour l'ordonnancement des commentaires",
                "content": "Contenu du post pour tester l'ordre des réponses.",
                "post_type": PostType.DISCUSSION,
            },
            format="json",
        )
        post_id = (res.data.get("data") or res.data)["id"]
        comment_url = f"/api/v1/posts/{post_id}/comments/"

        # Member posts first comment
        api_client.force_authenticate(user=user_member)
        api_client.post(
            comment_url,
            {"content": "Premier commentaire (ancien)"},
            format="json",
        )

        # Member posts second comment shortly after
        api_client.post(
            comment_url,
            {"content": "Deuxième commentaire (récent)"},
            format="json",
        )

        # Fetch comments list
        list_res = api_client.get(comment_url)
        assert list_res.status_code == status.HTTP_200_OK
        comments_list = list_res.data.get("data") or list_res.data
        assert len(comments_list) == 2
        # The most recent comment must always be at index 0 (at the top)
        assert comments_list[0]["content"] == "Deuxième commentaire (récent)"
        assert comments_list[1]["content"] == "Premier commentaire (ancien)"

    def test_post_video_uploadthing_128mb_limit_and_direct_playback(
        self, api_client, user_owner, community
    ):
        """
        Validates:
        1. 128 MB limit for post videos: rejection with 'uploader une video < 128Mo'.
        2. Acceptance of <= 128 MB video.
        3. Video attached directly via UploadThing (MediaAsset) without Mux processing delay,
           instantly returning 'READY' status and playback_url equal to the UploadThing file_url.
        """
        from rest_framework.exceptions import ValidationError
        from apps.media.models.media_asset import MediaAsset, MediaPurpose, MediaStatus
        from apps.media.services.uploadthing_service import UploadThingService

        # 1. Rejection over 128 MB (128 MB = 134,217,728 bytes)
        with pytest.raises(ValidationError) as exc_info:
            UploadThingService.validate_file_constraints(
                file_name="grand_tuto.mp4",
                file_size=129 * 1024 * 1024,
                mime_type="video/mp4",
                purpose="post_video",
            )
        assert "uploader une video < 128Mo" in str(exc_info.value)

        # 2. Acceptance at 128 MB or less
        UploadThingService.validate_file_constraints(
            file_name="tuto.mp4",
            file_size=120 * 1024 * 1024,
            mime_type="video/mp4",
            purpose="post_video",
        )

        # 3. Create MediaAsset on UploadThing (pure UploadThing, without Mux)
        video_asset = MediaAsset.objects.create(
            user=user_owner,
            file_name="demo_direct.mp4",
            file_key="kodinga/post_video/demo_123.mp4",
            file_url="https://utfs.io/f/demo_direct.mp4",
            file_size=50 * 1024 * 1024,
            mime_type="video/mp4",
            purpose=MediaPurpose.POST_VIDEO,
            status=MediaStatus.READY,
        )

        api_client.force_authenticate(user=user_owner)
        res = api_client.post(
            f"/api/v1/communities/{community.slug}/feed/",
            {
                "title": "Post avec vidéo UploadThing sans Mux",
                "content": "Voici ma vidéo lue directement depuis UploadThing !",
                "post_type": PostType.DISCUSSION,
                "media_ids": [str(video_asset.id)],
            },
            format="json",
        )
        assert res.status_code == status.HTTP_201_CREATED
        post_data = res.json()["data"]

        # Ensure video is instantly READY and has direct playback_url
        media_list = post_data["media"]
        assert len(media_list) == 1
        video_media = media_list[0]
        assert video_media["type"] == "VIDEO"
        assert video_media["status"] == "READY"
        assert video_media["url"] == "https://utfs.io/f/demo_direct.mp4"
        assert video_media["playback_url"] == "https://utfs.io/f/demo_direct.mp4"
        assert post_data["media_processing_status"] == "READY"


