from datetime import timedelta

from django.conf import settings
from django.contrib import admin, messages
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html

from apps.memberships.models.invitation import CommunityInvitation, InvitationStatus
from apps.memberships.models.member import (
    CommunityMember,
    CommunityRole,
    MembershipStatus,
)
from apps.memberships.models.sanction import MemberSanction
from apps.memberships.services.invitation_service import InvitationService
from common.services.email_service import EmailService
from common.utils.tokens import generate_secure_token, hash_token


@admin.action(description="✉️ Renvoyer l'e-mail d'invitation aux destinataires sélectionnés")
def resend_invitation_action(modeladmin, request, queryset):
    resent_count = 0
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')

    for invitation in queryset:
        if invitation.status != InvitationStatus.PENDING:
            continue

        raw_token = generate_secure_token(32)
        invitation.token_hash = hash_token(raw_token)
        invitation.expires_at = timezone.now() + timedelta(days=7)
        invitation.save(update_fields=['token_hash', 'expires_at', 'updated_at'])

        invite_url = f"{frontend_url}/invite/{raw_token}"
        email_context = {
            'inviter_name': invitation.invited_by.get_full_name() or invitation.invited_by.username if invitation.invited_by else 'L\'administrateur',
            'workspace_name': invitation.community.name,
            'role_display': InvitationService.get_role_display(invitation.role),
            'invite_url': invite_url,
            'expires_at_formatted': invitation.expires_at.strftime('%d/%m/%Y à %H:%M UTC'),
            'expires_in_days': 7,
        }

        try:
            EmailService.send_mail(
                to_email=invitation.email,
                subject=f"Invitation à rejoindre l'espace {invitation.community.name} - {getattr(settings, 'APP_NAME', 'Kodinga')}",
                template_name='workspace_invitation',
                context=email_context,
                fail_silently=False
            )
            resent_count += 1
        except Exception as exc:
            messages.error(request, f"Échec de l'envoi pour {invitation.email} : {exc}")

    if resent_count:
        messages.success(request, f"✅ {resent_count} e-mail(s) d'invitation renvoyé(s) avec succès !")


@admin.register(CommunityMember)
class CommunityMemberAdmin(admin.ModelAdmin):
    list_display = [
        'user_card',
        'community_link',
        'role_badge',
        'status_badge',
        'custom_title',
        'reputation_score',
        'joined_at_formatted',
    ]
    list_filter = [
        ('community', admin.RelatedOnlyFieldListFilter),
        'role',
        'status',
        ('joined_at', admin.DateFieldListFilter),
    ]
    search_fields = [
        'user__first_name',
        'user__last_name',
        'user__username',
        'user__email',
        'community__name',
        'community__slug',
        'custom_title',
    ]
    search_help_text = "Rechercher par prénom, nom, pseudo, email ou nom de communauté..."
    list_select_related = ['user', 'community']
    autocomplete_fields = ['community', 'user']
    readonly_fields = ['joined_at', 'created_at', 'updated_at']
    list_per_page = 25

    @admin.display(description="Collaborateur / Utilisateur", ordering="user__username")
    def user_card(self, obj):
        full_name = f"{obj.user.first_name} {obj.user.last_name}".strip()
        user_url = reverse('admin:accounts_user_change', args=[obj.user.id])
        if full_name:
            return format_html(
                '<div>'
                '  <a href="{}" style="font-weight: 600; color: #1e293b; text-decoration: none;">{}</a>'
                '  <span style="color: #64748b; font-size: 0.85em;"> (@{})</span><br>'
                '  <span style="color: #64748b; font-size: 0.85em;">{}</span>'
                '</div>',
                user_url, full_name, obj.user.username, obj.user.email
            )
        return format_html(
            '<div>'
            '  <a href="{}" style="font-weight: 600; color: #1e293b; text-decoration: none;">@{}</a><br>'
            '  <span style="color: #64748b; font-size: 0.85em;">{}</span>'
            '</div>',
            user_url, obj.user.username, obj.user.email
        )

    @admin.display(description="Communauté / Espace", ordering="community__name")
    def community_link(self, obj):
        comm_url = reverse('admin:communities_community_change', args=[obj.community.id])
        filter_url = reverse('admin:memberships_communitymember_changelist') + f'?community__id__exact={obj.community.id}'
        return format_html(
            '<div>'
            '  <a href="{}" style="font-weight: 600; color: #0284c7;">{}</a> '
            '  <a href="{}" title="Filtrer uniquement cet espace" style="text-decoration:none; font-size:0.85em;">🔍</a><br>'
            '  <span style="color: #94a3b8; font-size: 0.8em;">slug: {}</span>'
            '</div>',
            comm_url, obj.community.name, filter_url, obj.community.slug
        )

    @admin.display(description="Rôle", ordering="role")
    def role_badge(self, obj):
        colors = {
            CommunityRole.OWNER: ('#fef3c7', '#92400e', '👑 Propriétaire'),
            CommunityRole.ADMIN: ('#dbeafe', '#1e40af', '🛡️ Admin'),
            CommunityRole.MODERATOR: ('#dcfce7', '#166534', '⚖️ Modérateur'),
            CommunityRole.MEMBER: ('#f1f5f9', '#475569', '👤 Membre'),
        }
        bg, fg, label = colors.get(obj.role, ('#f1f5f9', '#475569', obj.get_role_display()))
        return format_html(
            '<span style="background-color: {}; color: {}; padding: 3px 8px; border-radius: 6px; font-weight: 600; font-size: 0.85em; display: inline-block;">{}</span>',
            bg, fg, label
        )

    @admin.display(description="Statut", ordering="status")
    def status_badge(self, obj):
        colors = {
            MembershipStatus.ACTIVE: ('#dcfce7', '#166534', 'Actif'),
            MembershipStatus.PENDING: ('#fef3c7', '#92400e', 'En attente'),
            MembershipStatus.SUSPENDED: ('#ffedd5', '#9a3412', 'Suspendu'),
            MembershipStatus.BANNED: ('#fee2e2', '#991b1b', 'Banni'),
            MembershipStatus.LEFT: ('#f1f5f9', '#64748b', 'A quitté'),
            MembershipStatus.REJECTED: ('#fee2e2', '#991b1b', 'Refusé'),
        }
        bg, fg, label = colors.get(obj.status, ('#f1f5f9', '#64748b', obj.get_status_display()))
        return format_html(
            '<span style="background-color: {}; color: {}; padding: 3px 8px; border-radius: 6px; font-weight: 500; font-size: 0.85em; display: inline-block;">{}</span>',
            bg, fg, label
        )

    @admin.display(description="Date d'adhésion", ordering="joined_at")
    def joined_at_formatted(self, obj):
        return obj.joined_at.strftime("%d/%m/%Y à %H:%M") if obj.joined_at else "-"


@admin.register(CommunityInvitation)
class CommunityInvitationAdmin(admin.ModelAdmin):
    list_display = ['community', 'email', 'role', 'status', 'invited_by', 'expires_at', 'accepted_at', 'created_at']
    list_filter = ['status', 'role', 'community']
    search_fields = ['email', 'token_hash', 'community__name', 'invited_by__username']
    readonly_fields = ['token_hash', 'accepted_at', 'created_at', 'updated_at']
    fields = ['community', 'email', 'role', 'status', 'expires_at', 'token_hash', 'accepted_at', 'invited_by', 'max_uses', 'uses_count']
    actions = [resend_invitation_action]

    def save_model(self, request, obj, form, change):
        if not change and not obj.token_hash:
            # Auto-generate secure token and hash when created via Django Admin
            raw_token = generate_secure_token(32)
            obj.token_hash = hash_token(raw_token)
            if not obj.expires_at:
                obj.expires_at = timezone.now() + timedelta(days=7)
            if not obj.invited_by:
                obj.invited_by = request.user
            if not obj.status:
                obj.status = InvitationStatus.PENDING

            super().save_model(request, obj, form, change)

            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
            invite_url = f"{frontend_url}/invite/{raw_token}"

            email_context = {
                'inviter_name': request.user.get_full_name() or request.user.username,
                'workspace_name': obj.community.name,
                'role_display': InvitationService.get_role_display(obj.role),
                'invite_url': invite_url,
                'expires_at_formatted': obj.expires_at.strftime('%d/%m/%Y à %H:%M UTC'),
                'expires_in_days': 7,
            }

            try:
                EmailService.send_mail(
                    to_email=obj.email,
                    subject=f"Invitation à rejoindre l'espace {obj.community.name} - {getattr(settings, 'APP_NAME', 'Kodinga')}",
                    template_name='workspace_invitation',
                    context=email_context,
                    fail_silently=False
                )
                messages.success(
                    request,
                    f"✅ Invitation créée avec succès et e-mail envoyé à {obj.email} ! "
                    f"Lien d'acceptation direct : {invite_url}"
                )
            except Exception as exc:
                messages.warning(
                    request,
                    f"⚠️ Invitation créée en base, mais l'envoi de l'e-mail a échoué ({exc}). "
                    f"Lien d'acceptation direct à copier : {invite_url}"
                )
        else:
            super().save_model(request, obj, form, change)


@admin.register(MemberSanction)
class MemberSanctionAdmin(admin.ModelAdmin):
    list_display = ['member', 'community', 'sanction_type', 'issued_by', 'is_active', 'expires_at', 'created_at']
    list_filter = ['sanction_type', 'is_active', 'community']
    search_fields = ['member__user__username', 'community__name', 'reason']
