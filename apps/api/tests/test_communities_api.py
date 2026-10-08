import pytest
from rest_framework import status
from rest_framework.test import APIClient
from apps.accounts.models.user import User
from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import Community, CommunityPrivacy, CommunityPricing
from apps.memberships.models.member import CommunityMember, CommunityRole, MembershipStatus


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user_owner(db):
    return User.objects.create_user(
        email="owner@kodinga.com",
        username="ownerdev",
        password="SecurePassword123!",
        first_name="Ada",
        last_name="Lovelace"
    )


@pytest.fixture
def user_member(db):
    return User.objects.create_user(
        email="member@kodinga.com",
        username="memberdev",
        password="SecurePassword123!",
        first_name="Alan",
        last_name="Turing"
    )


@pytest.fixture
def category_python(db):
    return CommunityCategory.objects.create(
        name="Python & Backend",
        slug="python-backend",
        description="Python, Django, FastAPI and distributed systems"
    )


@pytest.mark.django_db
class TestCommunitiesAPI:

    def test_create_community_success(self, api_client, user_owner, category_python):
        api_client.force_authenticate(user=user_owner)
        payload = {
            "name": "Django Architects",
            "slug": "django-architects",
            "tagline": "Advanced Django & REST Architecture",
            "description": "A high-level developer space for building scalable Django backends.",
            "category_id": str(category_python.id),
            "privacy_type": CommunityPrivacy.PUBLIC,
            "pricing_type": CommunityPricing.FREE,
            "brand_color": "#092E20",
            "rules": [
                {"title": "Be respectful", "description": "Constructive code reviews only.", "order": 0},
                {"title": "Share reproducible examples", "description": "Include code snippets.", "order": 1}
            ],
            "settings": {
                "allow_member_invites": True,
                "require_approval_to_join": False
            }
        }
        res = api_client.post('/api/v1/communities/', payload, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()['data']
        assert data['name'] == "Django Architects"
        assert data['slug'] == "django-architects"
        assert data['owner']['username'] == "ownerdev"
        assert len(data['rules']) == 2
        assert data['settings']['allow_member_invites'] is True

        # Check membership automatically assigned to creator as OWNER
        member = CommunityMember.objects.get(community__slug="django-architects", user=user_owner)
        assert member.role == CommunityRole.OWNER
        assert member.status == MembershipStatus.ACTIVE

    def test_get_community_detail_by_slug(self, api_client, user_owner, category_python):
        api_client.force_authenticate(user=user_owner)
        community = Community.objects.create(
            name="FastAPI Masters",
            slug="fastapi-masters",
            owner=user_owner,
            category=category_python,
            privacy_type=CommunityPrivacy.PUBLIC
        )
        res = api_client.get('/api/v1/communities/fastapi-masters/')
        assert res.status_code == status.HTTP_200_OK
        data = res.json()['data']
        assert data['name'] == "FastAPI Masters"
        assert data['user_membership']['is_member'] is False

    def test_update_community_settings(self, api_client, user_owner, category_python):
        api_client.force_authenticate(user=user_owner)
        community = Community.objects.create(
            name="DevOps Clan",
            slug="devops-clan",
            owner=user_owner,
            category=category_python
        )
        CommunityMember.objects.create(
            community=community,
            user=user_owner,
            role=CommunityRole.OWNER,
            status=MembershipStatus.ACTIVE
        )

        patch_res = api_client.patch(
            f'/api/v1/communities/{community.slug}/settings/',
            {"require_approval_to_join": True, "welcome_message": "Welcome to DevOps!"},
            format='json'
        )
        assert patch_res.status_code == status.HTTP_200_OK
        assert patch_res.json()['data']['require_approval_to_join'] is True
        assert patch_res.json()['data']['welcome_message'] == "Welcome to DevOps!"

    def test_search_communities_filter(self, api_client, user_owner, category_python):
        Community.objects.create(
            name="Rust Enthusiasts",
            slug="rust-enthusiasts",
            owner=user_owner,
            is_featured=True,
            privacy_type=CommunityPrivacy.PUBLIC
        )
        Community.objects.create(
            name="Secret Society",
            slug="secret-society",
            owner=user_owner,
            privacy_type=CommunityPrivacy.SECRET
        )

        res = api_client.get('/api/v1/communities/?q=Rust')
        assert res.status_code == status.HTTP_200_OK
        results = res.json()['results']
        assert len(results) == 1
        assert results[0]['name'] == "Rust Enthusiasts"

        # Secret community not in directory
        res_all = api_client.get('/api/v1/communities/')
        slugs = [c['slug'] for c in res_all.json()['results']]
        assert 'secret-society' not in slugs
