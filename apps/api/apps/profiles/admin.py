from django.contrib import admin

from apps.profiles.models.education import DeveloperEducation
from apps.profiles.models.experience import DeveloperExperience
from apps.profiles.models.portfolio import DeveloperPortfolioProject
from apps.profiles.models.profile import DeveloperProfile
from apps.profiles.models.skill import DeveloperSkill
from apps.profiles.models.technology import Technology


class DeveloperSkillInline(admin.TabularInline):
    model = DeveloperSkill
    extra = 1
    autocomplete_fields = ['technology']


class DeveloperExperienceInline(admin.StackedInline):
    model = DeveloperExperience
    extra = 0


class DeveloperEducationInline(admin.StackedInline):
    model = DeveloperEducation
    extra = 0


class DeveloperPortfolioProjectInline(admin.StackedInline):
    model = DeveloperPortfolioProject
    extra = 0


@admin.register(DeveloperProfile)
class DeveloperProfileAdmin(admin.ModelAdmin):
    list_display = [
        'user',
        'headline',
        'location',
        'availability_status',
        'years_of_experience',
        'is_public',
        'is_mentor',
        'reputation_points',
        'views_count',
        'created_at',
    ]
    list_filter = [
        'is_public',
        'is_mentor',
        'availability_status',
        'open_to_freelance',
        'open_to_remote',
    ]
    search_fields = [
        'user__username',
        'user__email',
        'headline',
        'location',
        'bio',
    ]
    inlines = [
        DeveloperSkillInline,
        DeveloperExperienceInline,
        DeveloperEducationInline,
        DeveloperPortfolioProjectInline,
    ]


@admin.register(Technology)
class TechnologyAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'category', 'is_verified', 'usage_count', 'created_at']
    list_filter = ['category', 'is_verified']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}
