from django.contrib import admin
from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import Community
from apps.communities.models.rule import CommunityRule
from apps.communities.models.settings import CommunitySettings


class CommunityRuleInline(admin.TabularInline):
    model = CommunityRule
    extra = 1


class CommunitySettingsInline(admin.StackedInline):
    model = CommunitySettings
    can_delete = False


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    list_display = [
        'name',
        'slug',
        'owner',
        'category',
        'privacy_type',
        'pricing_type',
        'members_count',
        'is_verified',
        'is_featured',
        'is_active',
        'created_at',
    ]
    list_filter = ['privacy_type', 'pricing_type', 'is_verified', 'is_featured', 'is_active', 'category']
    search_fields = ['name', 'slug', 'tagline', 'owner__username', 'owner__email']
    prepopulated_fields = {'slug': ('name',)}
    inlines = [CommunitySettingsInline, CommunityRuleInline]


@admin.register(CommunityCategory)
class CommunityCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'is_active', 'order', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(CommunityRule)
class CommunityRuleAdmin(admin.ModelAdmin):
    list_display = ['title', 'community', 'order', 'created_at']
    search_fields = ['title', 'community__name']
