from django.urls import path
from apps.profiles.views.profile import (
    MeProfileView,
    PublicProfileDetailView,
    PublicProfileListView,
)
from apps.profiles.views.sub_entities import (
    MeEducationDetailView,
    MeEducationView,
    MeExperienceDetailView,
    MeExperienceView,
    MePortfolioDetailView,
    MePortfolioView,
    MeSkillDetailView,
    MeSkillsView,
    TechnologyListView,
)

app_name = 'profiles'

urlpatterns = [
    # Authenticated User Profile Management
    path('profiles/me/', MeProfileView.as_view(), name='profile_me'),
    
    # Skills Management
    path('profiles/me/skills/', MeSkillsView.as_view(), name='me_skills'),
    path('profiles/me/skills/<uuid:skill_id>/', MeSkillDetailView.as_view(), name='me_skill_detail'),

    # Experiences Management
    path('profiles/me/experiences/', MeExperienceView.as_view(), name='me_experiences'),
    path('profiles/me/experiences/<uuid:experience_id>/', MeExperienceDetailView.as_view(), name='me_experience_detail'),

    # Educations Management
    path('profiles/me/educations/', MeEducationView.as_view(), name='me_educations'),
    path('profiles/me/educations/<uuid:education_id>/', MeEducationDetailView.as_view(), name='me_education_detail'),

    # Portfolio Projects Management
    path('profiles/me/portfolio/', MePortfolioView.as_view(), name='me_portfolio'),
    path('profiles/me/portfolio/<uuid:project_id>/', MePortfolioDetailView.as_view(), name='me_portfolio_detail'),

    # Technology Catalog & Autocomplete
    path('profiles/technologies/', TechnologyListView.as_view(), name='technologies_list'),

    # Public Developer Directory & Public Profile by username
    path('profiles/', PublicProfileListView.as_view(), name='public_profiles_list'),
    path('profiles/<str:username>/', PublicProfileDetailView.as_view(), name='public_profile_detail'),
]
