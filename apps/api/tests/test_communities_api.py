import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models.user import User
from apps.communities.models.category import CommunityCategory
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
def category_python(db):
    return CommunityCategory.objects.create(
        name="Python & Backend",
        slug="python-backend",
        description="Python, Django, FastAPI and distributed systems",
    )


@pytest.mark.django_db
class TestCommunitiesAPI:
    def test_create_community_success(self, api_client, user_owner, category_python):
        api_client.force_authenticate(user=user_owner)
        payload = {
            "name": "Django Architects",
            "slug": "django-architects",
            "tagline": "Advanced Django & REST Architecture",
            "description": (
                "A high-level developer space for building scalable Django backends."
            ),
            "category_id": str(category_python.id),
            "privacy_type": CommunityPrivacy.PUBLIC,
            "pricing_type": CommunityPricing.FREE,
            "brand_color": "#092E20",
            "rules": [
                {
                    "title": "Be respectful",
                    "description": "Constructive code reviews only.",
                    "order": 0,
                },
                {
                    "title": "Share reproducible examples",
                    "description": "Include code snippets.",
                    "order": 1,
                },
            ],
            "settings": {
                "allow_member_invites": True,
                "require_approval_to_join": False,
            },
        }
        res = api_client.post("/api/v1/communities/", payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()["data"]
        assert data["name"] == "Django Architects"
        assert data["slug"] == "django-architects"
        assert data["owner"]["username"] == "ownerdev"
        assert len(data["rules"]) == 2
        assert data["settings"]["allow_member_invites"] is True

        # Check membership automatically assigned to creator as OWNER
        member = CommunityMember.objects.get(
            community__slug="django-architects", user=user_owner
        )
        assert member.role == CommunityRole.OWNER
        assert member.status == MembershipStatus.ACTIVE

    def test_create_community_with_empty_and_custom_social_urls(
        self, api_client, user_owner, category_python
    ):
        api_client.force_authenticate(user=user_owner)
        payload = {
            "name": "Vue Africa",
            "slug": "vue-africa",
            "category_id": str(category_python.id),
            "avatar_url": "",
            "banner_url": None,
            "website_url": "",
            "github_url": "",
            "discord_url": "",
            "twitter_url": "",
            "whatsapp_url": "https://chat.whatsapp.com/sampleinvite",
            "telegram_url": "https://t.me/vue_africa",
        }
        res = api_client.post("/api/v1/communities/", payload, format="json")
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()["data"]
        assert data["whatsapp_url"] == "https://chat.whatsapp.com/sampleinvite"
        assert data["telegram_url"] == "https://t.me/vue_africa"
        assert data["avatar_url"] == ""
        assert data["website_url"] == ""

    def test_create_community_invalid_url_format_fails(
        self, api_client, user_owner, category_python
    ):
        api_client.force_authenticate(user=user_owner)
        payload = {
            "name": "Invalid URLs Community",
            "slug": "invalid-urls-community",
            "category_id": str(category_python.id),
            "whatsapp_url": "not-a-valid-url",
        }
        res = api_client.post("/api/v1/communities/", payload, format="json")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        errors = res.json()
        assert "whatsapp_url" in errors.get("details", errors)

    def test_get_community_detail_by_slug(
        self, api_client, user_owner, category_python
    ):
        api_client.force_authenticate(user=user_owner)
        community = Community.objects.create(
            name="FastAPI Masters",
            slug="fastapi-masters",
            owner=user_owner,
            category=category_python,
            privacy_type=CommunityPrivacy.PUBLIC,
        )
        # 1. Fetch by slug
        res_slug = api_client.get("/api/v1/communities/fastapi-masters/")
        assert res_slug.status_code == status.HTTP_200_OK
        assert res_slug.json()["data"]["slug"] == "fastapi-masters"

        # 2. Fetch by UUID id
        res_id = api_client.get(f"/api/v1/communities/{community.id}/")
        assert res_id.status_code == status.HTTP_200_OK
        assert res_id.json()["data"]["id"] == str(community.id)
        assert res_id.json()["data"]["name"] == "FastAPI Masters"

    def test_update_community_settings(self, api_client, user_owner, category_python):
        api_client.force_authenticate(user=user_owner)
        community = Community.objects.create(
            name="DevOps Clan",
            slug="devops-clan",
            owner=user_owner,
            category=category_python,
        )
        CommunityMember.objects.create(
            community=community,
            user=user_owner,
            role=CommunityRole.OWNER,
            status=MembershipStatus.ACTIVE,
        )

        patch_res = api_client.patch(
            f"/api/v1/communities/{community.slug}/settings/",
            {"require_approval_to_join": True, "welcome_message": "Welcome to DevOps!"},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_200_OK
        assert patch_res.json()["data"]["require_approval_to_join"] is True
        assert patch_res.json()["data"]["welcome_message"] == "Welcome to DevOps!"

    def test_search_communities_filter(self, api_client, user_owner, category_python):
        Community.objects.create(
            name="Rust Enthusiasts",
            slug="rust-enthusiasts",
            owner=user_owner,
            is_featured=True,
            privacy_type=CommunityPrivacy.PUBLIC,
        )
        Community.objects.create(
            name="Secret Society",
            slug="secret-society",
            owner=user_owner,
            privacy_type=CommunityPrivacy.SECRET,
        )

        res = api_client.get("/api/v1/communities/?q=Rust")
        assert res.status_code == status.HTTP_200_OK
        results = res.json()["results"]
        assert len(results) == 1
        assert results[0]["name"] == "Rust Enthusiasts"

        # Secret community not in directory
        res_all = api_client.get("/api/v1/communities/")
        slugs = [c["slug"] for c in res_all.json()["results"]]
        assert "secret-society" not in slugs

    def test_communities_infinite_scroll_pagination(self, api_client, user_owner):
        # Create 11 communities
        for i in range(11):
            Community.objects.create(
                name=f"Community {i}",
                slug=f"community-{i}",
                owner=user_owner,
                privacy_type=CommunityPrivacy.PUBLIC,
            )

        # Page 1 -> 9 items default
        res_page1 = api_client.get("/api/v1/communities/")
        assert res_page1.status_code == status.HTTP_200_OK
        data1 = res_page1.json()
        assert len(data1["results"]) == 9
        assert data1["pagination"]["count"] == 11
        assert data1["pagination"]["total_pages"] == 2
        assert data1["pagination"]["current_page"] == 1
        assert data1["pagination"]["has_next"] is True
        assert data1["pagination"]["has_previous"] is False
        assert data1["pagination"]["page_size"] == 9
        assert "is_member" in data1["results"][0]

        # Page 2 -> 2 remaining items
        res_page2 = api_client.get("/api/v1/communities/?page=2")
        assert res_page2.status_code == status.HTTP_200_OK
        data2 = res_page2.json()
        assert len(data2["results"]) == 2
        assert data2["pagination"]["current_page"] == 2
        assert data2["pagination"]["has_next"] is False
        assert data2["pagination"]["has_previous"] is True


@pytest.mark.django_db
class TestCategoryAPI:
    def test_list_and_create_category(self, api_client, user_owner):
        # 1. Unauthenticated list
        res = api_client.get("/api/v1/communities/categories/")
        assert res.status_code == status.HTTP_200_OK
        initial_count = len(res.json()["data"])

        # 2. Authenticated create
        api_client.force_authenticate(user=user_owner)
        payload = {
            "name": "DevOps & Cloud",
            "slug": "devops-cloud",
            "description": "CI/CD, Kubernetes, Terraform and AWS",
            "icon_url": "https://cdn.kodinga.com/icons/cloud.svg",
            "order": 1,
        }
        create_res = api_client.post(
            "/api/v1/communities/categories/", payload, format="json"
        )
        assert create_res.status_code == status.HTTP_201_CREATED
        cat_data = create_res.json()["data"]
        assert cat_data["name"] == "DevOps & Cloud"
        assert cat_data["slug"] == "devops-cloud"

        # 3. List contains newly created category
        res_after = api_client.get("/api/v1/communities/categories/")
        assert len(res_after.json()["data"]) == initial_count + 1

    def test_get_update_and_delete_category(
        self, api_client, user_owner, category_python
    ):
        # 1. Get by slug and by UUID id
        res = api_client.get(f"/api/v1/communities/categories/{category_python.slug}/")
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["data"]["slug"] == category_python.slug

        res_id = api_client.get(f"/api/v1/communities/categories/{category_python.id}/")
        assert res_id.status_code == status.HTTP_200_OK
        assert res_id.json()["data"]["id"] == str(category_python.id)

        # 2. Update category
        api_client.force_authenticate(user=user_owner)
        patch_res = api_client.patch(
            f"/api/v1/communities/categories/{category_python.slug}/",
            {"description": "Updated Python & Backend ecosystem description"},
            format="json",
        )
        assert patch_res.status_code == status.HTTP_200_OK
        assert (
            patch_res.json()["data"]["description"]
            == "Updated Python & Backend ecosystem description"
        )

        # 3. Deactivate category
        del_res = api_client.delete(
            f"/api/v1/communities/categories/{category_python.slug}/"
        )
        assert del_res.status_code == status.HTTP_200_OK
        category_python.refresh_from_db()
        assert category_python.is_active is False
