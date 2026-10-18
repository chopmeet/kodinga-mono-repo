from django.db.models import Prefetch, Q, QuerySet

from apps.accounts.models.user import User
from apps.profiles.models.education import DeveloperEducation
from apps.profiles.models.experience import DeveloperExperience
from apps.profiles.models.portfolio import DeveloperPortfolioProject
from apps.profiles.models.profile import DeveloperProfile
from apps.profiles.models.skill import DeveloperSkill
from apps.profiles.models.technology import Technology


class ProfileSelector:
    """
    Optimized database queries and prefetching for developer profiles and sub-entities.
    """

    @classmethod
    def get_full_profile_queryset(cls) -> QuerySet[DeveloperProfile]:
        skills_prefetch = Prefetch(
            'skills',
            queryset=DeveloperSkill.objects.select_related('technology').order_by('-is_highlighted', 'order', 'technology__name')
        )
        experiences_prefetch = Prefetch(
            'experiences',
            queryset=DeveloperExperience.objects.prefetch_related('technologies').order_by('-start_date')
        )
        educations_prefetch = Prefetch(
            'educations',
            queryset=DeveloperEducation.objects.order_by('-start_date')
        )
        portfolio_prefetch = Prefetch(
            'portfolio_projects',
            queryset=DeveloperPortfolioProject.objects.prefetch_related('technologies').order_by('-is_featured', 'order')
        )

        return DeveloperProfile.objects.select_related('user').prefetch_related(
            skills_prefetch,
            experiences_prefetch,
            educations_prefetch,
            portfolio_prefetch
        )

    @classmethod
    def get_profile_by_user(cls, user: User) -> DeveloperProfile:
        profile, _ = DeveloperProfile.objects.get_or_create(user=user)
        return cls.get_full_profile_queryset().get(id=profile.id)

    @classmethod
    def get_public_profile_by_username(cls, username: str) -> DeveloperProfile:
        return cls.get_full_profile_queryset().get(
            user__username__iexact=username,
            user__is_active=True,
            is_public=True
        )

    @classmethod
    def search_profiles(
        cls,
        search_query: str = None,
        technologies: list = None,
        location: str = None,
        availability: str = None,
        min_years_exp: int = None,
        is_mentor: bool = None,
        open_to_freelance: bool = None,
        open_to_remote: bool = None,
    ) -> QuerySet[DeveloperProfile]:
        qs = DeveloperProfile.objects.filter(is_public=True, user__is_active=True).select_related('user').prefetch_related(
            Prefetch('skills', queryset=DeveloperSkill.objects.select_related('technology'))
        )

        if search_query:
            qs = qs.filter(
                Q(headline__icontains=search_query) |
                Q(bio__icontains=search_query) |
                Q(user__username__icontains=search_query) |
                Q(user__first_name__icontains=search_query) |
                Q(user__last_name__icontains=search_query)
            )

        if location:
            qs = qs.filter(location__icontains=location)

        if availability:
            qs = qs.filter(availability_status=availability)

        if min_years_exp is not None:
            qs = qs.filter(years_of_experience__gte=min_years_exp)

        if is_mentor is not None:
            qs = qs.filter(is_mentor=is_mentor)

        if open_to_freelance is not None:
            qs = qs.filter(open_to_freelance=open_to_freelance)

        if open_to_remote is not None:
            qs = qs.filter(open_to_remote=open_to_remote)

        if technologies:
            qs = qs.filter(skills__technology__slug__in=technologies).distinct()

        return qs.order_by('-reputation_points', '-created_at')

    @classmethod
    def get_technologies(cls, search: str = None, category: str = None) -> QuerySet[Technology]:
        qs = Technology.objects.all()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(slug__icontains=search))
        if category:
            qs = qs.filter(category=category)
        return qs.order_by('-usage_count', 'name')
