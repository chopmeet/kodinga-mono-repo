import pytest
from rest_framework import status
from rest_framework.test import APIClient
from apps.accounts.models.user import User
from apps.profiles.models.profile import DeveloperProfile, AvailabilityStatus
from apps.profiles.models.technology import Technology, TechnologyCategory
from apps.profiles.models.skill import DeveloperSkill, SkillLevel
from apps.profiles.models.experience import DeveloperExperience
from apps.profiles.models.education import DeveloperEducation
from apps.profiles.models.portfolio import DeveloperPortfolioProject


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user1(db):
    user = User.objects.create_user(
        email="dev1@kodinga.com",
        username="devone",
        password="SecurePassword123!",
        first_name="Alex",
        last_name="Dev"
    )
    return user


@pytest.fixture
def user2(db):
    user = User.objects.create_user(
        email="dev2@kodinga.com",
        username="devtwo",
        password="SecurePassword123!",
        first_name="Sam",
        last_name="Coder"
    )
    return user


@pytest.fixture
def tech_python(db):
    return Technology.objects.create(
        name="Python",
        slug="python",
        category=TechnologyCategory.BACKEND
    )


@pytest.fixture
def tech_react(db):
    return Technology.objects.create(
        name="React",
        slug="react",
        category=TechnologyCategory.FRONTEND
    )


@pytest.mark.django_db
class TestProfilesAPI:

    def test_get_my_profile_auto_created(self, api_client, user1):
        api_client.force_authenticate(user=user1)
        response = api_client.get('/api/v1/profiles/me/')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['success'] is True
        assert data['data']['user']['username'] == 'devone'
        assert data['data']['user']['email'] == 'dev1@kodinga.com'

    def test_update_my_profile(self, api_client, user1):
        api_client.force_authenticate(user=user1)
        payload = {
            "headline": "Lead Python & Django Architect",
            "bio": "Passionate backend engineer building scalable architectures.",
            "location": "Paris, France",
            "availability_status": AvailabilityStatus.OPEN_TO_OFFERS,
            "years_of_experience": 8,
            "is_mentor": True,
            "github_username": "alexdev",
            "custom_links": [{"title": "Blog", "url": "https://alex.dev"}]
        }
        response = api_client.patch('/api/v1/profiles/me/', payload, format='json')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()['data']
        assert data['headline'] == "Lead Python & Django Architect"
        assert data['location'] == "Paris, France"
        assert data['years_of_experience'] == 8
        assert data['is_mentor'] is True
        assert len(data['custom_links']) == 1

    def test_public_profile_view_and_view_count(self, api_client, user1, user2):
        # Update user1 profile
        user1.profile.headline = "Fullstack Wizard"
        user1.profile.is_public = True
        user1.profile.save()

        # View as user2
        api_client.force_authenticate(user=user2)
        response = api_client.get(f'/api/v1/profiles/@{user1.username}/')
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['data']['headline'] == "Fullstack Wizard"

        user1.profile.refresh_from_db()
        assert user1.profile.views_count == 1

    def test_add_and_delete_skill(self, api_client, user1, tech_python):
        api_client.force_authenticate(user=user1)
        payload = {
            "technology_id": str(tech_python.id),
            "level": SkillLevel.EXPERT,
            "years_of_experience": 5,
            "is_highlighted": True
        }
        res = api_client.post('/api/v1/profiles/me/skills/', payload, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        skill_id = res.json()['data']['id']

        # Verify skill in profile
        profile_res = api_client.get('/api/v1/profiles/me/')
        assert len(profile_res.json()['data']['skills']) == 1

        # Delete skill
        del_res = api_client.delete(f'/api/v1/profiles/me/skills/{skill_id}/')
        assert del_res.status_code == status.HTTP_200_OK

        profile_res2 = api_client.get('/api/v1/profiles/me/')
        assert len(profile_res2.json()['data']['skills']) == 0

    def test_experience_crud(self, api_client, user1, tech_python):
        api_client.force_authenticate(user=user1)
        payload = {
            "title": "Senior Backend Engineer",
            "company_name": "Tech Corp",
            "employment_type": "full_time",
            "start_date": "2022-01-01",
            "is_current": True,
            "technology_ids": [str(tech_python.id)]
        }
        create_res = api_client.post('/api/v1/profiles/me/experiences/', payload, format='json')
        assert create_res.status_code == status.HTTP_201_CREATED
        exp_id = create_res.json()['data']['id']
        assert create_res.json()['data']['company_name'] == "Tech Corp"

        # Update experience
        patch_res = api_client.patch(f'/api/v1/profiles/me/experiences/{exp_id}/', {"company_name": "Tech Corp Worldwide"}, format='json')
        assert patch_res.status_code == status.HTTP_200_OK
        assert patch_res.json()['data']['company_name'] == "Tech Corp Worldwide"

        # Delete experience
        del_res = api_client.delete(f'/api/v1/profiles/me/experiences/{exp_id}/')
        assert del_res.status_code == status.HTTP_200_OK

    def test_portfolio_project_crud(self, api_client, user1, tech_react):
        api_client.force_authenticate(user=user1)
        payload = {
            "title": "Kodinga Platform",
            "description": "Developer community SaaS platform",
            "project_url": "https://kodinga.com",
            "is_featured": True,
            "technology_ids": [str(tech_react.id)]
        }
        res = api_client.post('/api/v1/profiles/me/portfolio/', payload, format='json')
        assert res.status_code == status.HTTP_201_CREATED
        project_id = res.json()['data']['id']

        # List portfolio
        list_res = api_client.get('/api/v1/profiles/me/portfolio/')
        assert len(list_res.json()['data']) == 1

        # Delete portfolio
        del_res = api_client.delete(f'/api/v1/profiles/me/portfolio/{project_id}/')
        assert del_res.status_code == status.HTTP_200_OK

    def test_search_profiles(self, api_client, user1, tech_python):
        user1.profile.headline = "Kubernetes & Django Guru"
        user1.profile.location = "Berlin"
        user1.profile.is_public = True
        user1.profile.save()

        DeveloperSkill.objects.create(
            profile=user1.profile,
            technology=tech_python,
            level=SkillLevel.EXPERT
        )

        res = api_client.get('/api/v1/profiles/?q=Kubernetes&location=Berlin')
        assert res.status_code == status.HTTP_200_OK
        results = res.json()['results']
        assert len(results) >= 1
        assert results[0]['username'] == 'devone'
