from django.contrib import admin, messages
from django.utils import timezone
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from apps.accounts.models.consent import UserConsent
from apps.accounts.models.oauth import OAuthIdentity
from apps.accounts.models.security import SecurityEvent
from apps.accounts.models.session import UserSession
from apps.accounts.models.token import AuthToken
from apps.accounts.models.user import User
from apps.accounts.services.password import PasswordResetService
from apps.accounts.services.session import SessionService
from apps.accounts.services.verification import EmailVerificationService


class UserSessionInline(admin.TabularInline):
    model = UserSession
    extra = 0
    readonly_fields = ['id', 'session_identifier', 'refresh_token_identifier', 'device_name', 'ip_address', 'last_seen_at', 'expires_at', 'revoked_at', 'is_active_badge']
    fields = ['device_name', 'ip_address', 'last_seen_at', 'expires_at', 'revoked_at', 'is_active_badge']
    can_delete = True
    show_change_link = True

    def is_active_badge(self, obj):
        if not obj or not obj.id:
            return mark_safe('<span style="color: gray;">-</span>')
        if obj.is_active:
            return mark_safe('<span style="color: green; font-weight: bold;">● Active</span>')
        return mark_safe('<span style="color: red; font-weight: bold;">○ Revoked / Expired</span>')
    is_active_badge.short_description = "Status"


class AuthTokenInline(admin.TabularInline):
    model = AuthToken
    extra = 0
    readonly_fields = ['id', 'purpose', 'token_hash', 'expires_at', 'consumed_at', 'is_valid_badge', 'created_at']
    fields = ['purpose', 'token_hash', 'expires_at', 'consumed_at', 'is_valid_badge', 'created_at']
    can_delete = True
    show_change_link = True

    def is_valid_badge(self, obj):
        if not obj or not obj.id:
            return mark_safe('<span style="color: gray;">-</span>')
        if obj.is_valid:
            return mark_safe('<span style="color: green; font-weight: bold;">✓ Valid</span>')
        return mark_safe('<span style="color: gray;">✕ Consumed/Expired</span>')
    is_valid_badge.short_description = "Validity"


class OAuthIdentityInline(admin.TabularInline):
    model = OAuthIdentity
    extra = 0
    readonly_fields = ['provider', 'provider_user_id', 'provider_email', 'created_at']
    fields = ['provider', 'provider_user_id', 'provider_email', 'created_at']
    can_delete = True


class UserConsentInline(admin.TabularInline):
    model = UserConsent
    extra = 0
    readonly_fields = ['consent_type', 'policy_version', 'granted', 'recorded_at']
    fields = ['consent_type', 'policy_version', 'granted', 'recorded_at']
    can_delete = False


class SecurityEventInline(admin.TabularInline):
    model = SecurityEvent
    extra = 0
    readonly_fields = ['event_type', 'ip_address', 'user_agent', 'created_at']
    fields = ['event_type', 'ip_address', 'user_agent', 'created_at']
    can_delete = False
    ordering = ['-created_at']


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = [
        'username',
        'email',
        'first_name',
        'last_name',
        'is_active_badge',
        'email_verified_badge',
        'is_staff',
        'is_superuser',
        'is_superadmin',
        'date_joined',
    ]
    list_filter = [
        'is_active',
        'is_staff',
        'is_superuser',
        'is_superadmin',
        'preferred_language',
        'timezone',
        'date_joined',
    ]
    search_fields = ['username', 'email', 'first_name', 'last_name']
    ordering = ['-date_joined']
    readonly_fields = ['id', 'date_joined', 'last_login', 'created_at', 'updated_at']
    filter_horizontal = ('groups', 'user_permissions')
    inlines = [UserSessionInline, AuthTokenInline, OAuthIdentityInline, UserConsentInline, SecurityEventInline]

    fieldsets = (
        ('Authentication & Credentials', {
            'fields': ('username', 'email', 'password')
        }),
        ('Personal Information', {
            'fields': ('first_name', 'last_name', 'preferred_language', 'timezone')
        }),
        ('Status & Verification', {
            'fields': ('is_active', 'email_verified_at', 'is_staff', 'is_superuser', 'is_superadmin')
        }),
        ('Permissions & Groups', {
            'classes': ('collapse',),
            'fields': ('groups', 'user_permissions')
        }),
        ('Audit Timestamps', {
            'classes': ('collapse',),
            'fields': ('id', 'date_joined', 'last_login', 'created_at', 'updated_at')
        }),
    )

    actions = [
        'mark_email_verified_action',
        'mark_email_unverified_action',
        'activate_users_action',
        'deactivate_users_action',
        'promote_to_superadmin_action',
        'demote_from_superadmin_action',
        'force_revoke_all_sessions_action',
        'send_password_reset_email_action',
        'send_verification_email_action',
    ]

    def is_active_badge(self, obj):
        if obj.is_active:
            return mark_safe('<span style="color: green; font-weight: 600;">✓ Active</span>')
        return mark_safe('<span style="color: red; font-weight: 600;">✕ Inactive</span>')
    is_active_badge.short_description = "Account Active"

    def email_verified_badge(self, obj):
        if obj.is_email_verified:
            return mark_safe('<span style="color: green; font-weight: 600;">✓ Verified</span>')
        return mark_safe('<span style="color: orange; font-weight: 600;">○ Unverified</span>')
    email_verified_badge.short_description = "Email Status"

    @admin.action(description="Mark selected users as email verified")
    def mark_email_verified_action(self, request, queryset):
        updated = queryset.update(email_verified_at=timezone.now())
        self.message_user(request, f"{updated} user(s) successfully marked as verified.", messages.SUCCESS)

    @admin.action(description="Clear email verification for selected users")
    def mark_email_unverified_action(self, request, queryset):
        updated = queryset.update(email_verified_at=None)
        self.message_user(request, f"{updated} user(s) marked as unverified.", messages.WARNING)

    @admin.action(description="Activate selected user accounts")
    def activate_users_action(self, request, queryset):
        updated = queryset.update(is_active=True)
        self.message_user(request, f"{updated} user account(s) activated.", messages.SUCCESS)

    @admin.action(description="Deactivate selected accounts and revoke all sessions")
    def deactivate_users_action(self, request, queryset):
        count = 0
        for user in queryset:
            user.is_active = False
            user.save(update_fields=['is_active', 'updated_at'])
            SessionService.revoke_all_sessions(user)
            count += 1
        self.message_user(request, f"{count} account(s) deactivated and all active sessions revoked.", messages.SUCCESS)

    @admin.action(description="Promote selected users to platform superadmin")
    def promote_to_superadmin_action(self, request, queryset):
        updated = queryset.update(is_superadmin=True)
        self.message_user(request, f"{updated} user(s) promoted to platform superadmin.", messages.SUCCESS)

    @admin.action(description="Demote selected users from platform superadmin")
    def demote_from_superadmin_action(self, request, queryset):
        updated = queryset.update(is_superadmin=False)
        self.message_user(request, f"{updated} user(s) demoted from platform superadmin.", messages.WARNING)

    @admin.action(description="Force revoke all active sessions for selected users")
    def force_revoke_all_sessions_action(self, request, queryset):
        total_revoked = 0
        for user in queryset:
            total_revoked += SessionService.revoke_all_sessions(user)
        self.message_user(request, f"{total_revoked} session(s) revoked across selected user(s).", messages.SUCCESS)

    @admin.action(description="Send password reset email to selected users")
    def send_password_reset_email_action(self, request, queryset):
        count = 0
        for user in queryset:
            if user.is_active and user.email:
                PasswordResetService.request_password_reset(user.email, request=request)
                count += 1
        self.message_user(request, f"Password reset email dispatched to {count} user(s).", messages.INFO)

    @admin.action(description="Send verification email to selected unverified users")
    def send_verification_email_action(self, request, queryset):
        count = 0
        for user in queryset:
            if not user.is_email_verified and user.email:
                EmailVerificationService.resend_verification_email(user.email, request=request)
                count += 1
        self.message_user(request, f"Verification link dispatched to {count} unverified user(s).", messages.INFO)


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'device_name', 'ip_address', 'last_seen_at', 'expires_at', 'status_badge']
    list_filter = ['revoked_at', 'created_at']
    search_fields = ['user__username', 'user__email', 'device_name', 'ip_address', 'session_identifier']
    readonly_fields = ['id', 'user', 'session_identifier', 'refresh_token_identifier', 'device_name', 'user_agent', 'ip_address', 'last_seen_at', 'expires_at', 'revoked_at', 'created_at', 'updated_at']
    actions = ['revoke_selected_sessions_action']

    def status_badge(self, obj):
        if obj.is_active:
            return mark_safe('<span style="color: green; font-weight: bold;">● Active</span>')
        return mark_safe('<span style="color: red; font-weight: bold;">○ Revoked / Expired</span>')
    status_badge.short_description = "Status"

    @admin.action(description="Revoke selected sessions")
    def revoke_selected_sessions_action(self, request, queryset):
        count = 0
        now = timezone.now()
        for session in queryset.filter(revoked_at__isnull=True):
            session.revoked_at = now
            session.save(update_fields=['revoked_at', 'updated_at'])
            count += 1
        self.message_user(request, f"{count} session(s) successfully revoked.", messages.SUCCESS)


@admin.register(AuthToken)
class AuthTokenAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'purpose', 'token_hash_preview', 'expires_at', 'consumed_at', 'validity_badge']
    list_filter = ['purpose', 'consumed_at', 'created_at']
    search_fields = ['user__username', 'user__email', 'token_hash']
    readonly_fields = ['id', 'user', 'purpose', 'token_hash', 'expires_at', 'consumed_at', 'created_at', 'updated_at']
    actions = ['consume_tokens_action', 'invalidate_tokens_action']

    def token_hash_preview(self, obj):
        return f"{obj.token_hash[:16]}..." if obj.token_hash else ""
    token_hash_preview.short_description = "Hash"

    def validity_badge(self, obj):
        if obj.is_valid:
            return mark_safe('<span style="color: green; font-weight: bold;">✓ Valid</span>')
        return mark_safe('<span style="color: gray;">✕ Inactive</span>')
    validity_badge.short_description = "Status"

    @admin.action(description="Mark selected tokens as consumed")
    def consume_tokens_action(self, request, queryset):
        updated = queryset.filter(consumed_at__isnull=True).update(consumed_at=timezone.now())
        self.message_user(request, f"{updated} token(s) marked as consumed.", messages.SUCCESS)

    @admin.action(description="Force invalidate / expire selected tokens")
    def invalidate_tokens_action(self, request, queryset):
        updated = queryset.update(expires_at=timezone.now() - timezone.timedelta(seconds=1))
        self.message_user(request, f"{updated} token(s) invalidated.", messages.WARNING)


@admin.register(OAuthIdentity)
class OAuthIdentityAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'provider_badge', 'provider_user_id', 'provider_email', 'created_at']
    list_filter = ['provider', 'created_at']
    search_fields = ['user__username', 'user__email', 'provider_email', 'provider_user_id']
    readonly_fields = ['id', 'created_at', 'updated_at']

    def provider_badge(self, obj):
        color = "#ea4335" if obj.provider == "google" else "#24292e"
        return format_html('<span style="background-color: {}; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;">{}</span>', color, obj.provider.title())
    provider_badge.short_description = "Provider"


@admin.register(UserConsent)
class UserConsentAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'consent_type', 'policy_version', 'granted_badge', 'recorded_at']
    list_filter = ['consent_type', 'granted', 'recorded_at']
    search_fields = ['user__username', 'user__email', 'consent_type']
    readonly_fields = ['id', 'recorded_at', 'created_at', 'updated_at']

    def granted_badge(self, obj):
        if obj.granted:
            return mark_safe('<span style="color: green; font-weight: bold;">✓ Granted</span>')
        return mark_safe('<span style="color: red; font-weight: bold;">✕ Revoked</span>')
    granted_badge.short_description = "Consent Status"


@admin.register(SecurityEvent)
class SecurityEventAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'event_type', 'ip_address', 'created_at']
    list_filter = ['event_type', 'created_at']
    search_fields = ['user__username', 'user__email', 'event_type', 'ip_address']
    readonly_fields = ['id', 'user', 'event_type', 'ip_address', 'user_agent', 'metadata', 'created_at', 'updated_at']
    ordering = ['-created_at']
