from django.contrib import admin
from apps.memberships.models.invitation import CommunityInvitation
from apps.memberships.models.member import CommunityMember
from apps.memberships.models.sanction import MemberSanction


@admin.register(CommunityMember)
class CommunityMemberAdmin(admin.ModelAdmin):
    list_display = ['user', 'community', 'role', 'status', 'custom_title', 'reputation_score', 'joined_at']
    list_filter = ['role', 'status', 'community']
    search_fields = ['user__username', 'user__email', 'community__name', 'custom_title']


@admin.register(CommunityInvitation)
class CommunityInvitationAdmin(admin.ModelAdmin):
    list_display = ['community', 'invited_by', 'email', 'role', 'uses_count', 'max_uses', 'expires_at', 'is_revoked']
    list_filter = ['role', 'is_revoked', 'community']
    search_fields = ['email', 'invite_code', 'community__name', 'invited_by__username']


@admin.register(MemberSanction)
class MemberSanctionAdmin(admin.ModelAdmin):
    list_display = ['member', 'community', 'sanction_type', 'issued_by', 'is_active', 'expires_at', 'created_at']
    list_filter = ['sanction_type', 'is_active', 'community']
    search_fields = ['member__user__username', 'community__name', 'reason']
