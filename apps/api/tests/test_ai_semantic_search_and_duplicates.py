import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.ai.models.embedding import ContentEmbedding
from apps.ai.services.semantic_search_service import SemanticSearchService
from apps.ai.tasks import index_content_embedding_task
from apps.communities.models.community import (
    Community,
    CommunityPricing,
    CommunityPrivacy,
)
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.posts.models.post import Post, PostType


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def owner(db):
    return User.objects.create_user(
        email="owner_search@kodinga.com",
        username="owner_search",
        password="SecurePassword123!",
    )


@pytest.fixture
def community(db, owner):
    comm = Community.objects.create(
        name="Python Experts",
        slug="python-experts",
        owner=owner,
        privacy_type=CommunityPrivacy.PUBLIC,
        pricing_type=CommunityPricing.FREE,
    )
    CommunityMember.objects.create(
        community=comm,
        user=owner,
        role=CommunityRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    return comm


@pytest.mark.django_db
def test_cosine_similarity_math():
    v1 = [1.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    assert pytest.approx(SemanticSearchService.compute_cosine_similarity(v1, v2)) == 1.0

    v3 = [0.0, 1.0, 0.0]
    assert pytest.approx(SemanticSearchService.compute_cosine_similarity(v1, v3)) == 0.0

    empty = []
    assert SemanticSearchService.compute_cosine_similarity(empty, v1) == 0.0


@pytest.mark.django_db
def test_content_indexing_and_task(community, owner):
    post = Post.objects.create(
        community=community,
        author=owner,
        title="Comment gérer les fuites de mémoire en Python",
        content="Les fuites de mémoire surviennent souvent avec les références cycliques dans garbage collector.",
        post_type=PostType.QUESTION,
    )

    index_content_embedding_task(
        content_type="post",
        object_id=str(post.id),
        community_id=str(community.id),
        title=post.title,
        text=post.content,
    )

    emb = ContentEmbedding.objects.filter(object_id=str(post.id)).first()
    assert emb is not None
    assert emb.community == community
    assert len(emb.embedding) > 0


@pytest.mark.django_db
def test_check_duplicate_posts_api(api_client, community, owner):
    # Index an existing question
    post = Post.objects.create(
        community=community,
        author=owner,
        title="Comment résoudre une erreur django database connection closed",
        content="Mon serveur Django lance InterfaceError connection already closed avec Neon postgres.",
        post_type=PostType.QUESTION,
    )
    SemanticSearchService.index_content(
        content_type="post",
        object_id=str(post.id),
        community=community,
        title=post.title,
        text=post.content,
    )

    api_client.force_authenticate(user=owner)
    url = f"/api/v1/communities/{community.slug}/ai/check-duplicates/"

    # 1. Close match
    payload_duplicate = {
        "title": "Erreur Django connection database closed Neon",
        "content": "J'ai une erreur InterfaceError connection closed",
        "threshold": 0.50,
    }
    res = api_client.post(url, payload_duplicate, format="json")
    assert res.status_code == status.HTTP_200_OK
    assert res.data["has_potential_duplicates"] is True
    assert res.data["duplicates_count"] >= 1
    assert res.data["duplicates"][0]["id"] == str(post.id)

    # 2. Distinct topic
    payload_distinct = {
        "title": "Installation de React Native avec Expo",
        "content": "Comment démarrer un projet mobile sur Android avec Expo CLI.",
        "threshold": 0.85,
    }
    res_distinct = api_client.post(url, payload_distinct, format="json")
    assert res_distinct.status_code == status.HTTP_200_OK
    assert res_distinct.data["has_potential_duplicates"] is False


@pytest.mark.django_db
def test_semantic_search_api(api_client, community, owner):
    post = Post.objects.create(
        community=community,
        author=owner,
        title="Déploiement Docker pour applications FastAPI",
        content="Guide pas à pas pour conteneuriser une application Python FastAPI avec Uvicorn.",
        post_type=PostType.DISCUSSION,
    )
    SemanticSearchService.index_content(
        content_type="post",
        object_id=str(post.id),
        community=community,
        title=post.title,
        text=post.content,
    )

    api_client.force_authenticate(user=owner)
    url = f"/api/v1/communities/{community.slug}/ai/semantic-search/"

    res = api_client.post(url, {"query": "Déploiement Docker FastAPI", "limit": 5}, format="json")
    assert res.status_code == status.HTTP_200_OK
    assert res.data["count"] >= 1
    assert res.data["results"][0]["id"] == str(post.id)


@pytest.mark.django_db
def test_auto_indexing_post_signal_and_deletion(community, owner, settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    post = Post.objects.create(
        community=community,
        author=owner,
        title="Architecture CQRS et Event Sourcing",
        content="Comprendre la séparation des commandes et des requêtes.",
        post_type=PostType.DISCUSSION,
    )
    # The signal automatically invokes index_content_embedding_task
    emb = ContentEmbedding.objects.filter(content_type="post", object_id=str(post.id)).first()
    assert emb is not None
    assert emb.title == "Architecture CQRS et Event Sourcing"

    # Deleting post removes embedding
    post_id = str(post.id)
    post.delete()
    assert not ContentEmbedding.objects.filter(content_type="post", object_id=post_id).exists()
