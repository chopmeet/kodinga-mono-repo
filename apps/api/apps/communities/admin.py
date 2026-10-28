from django import forms
from django.contrib import admin, messages
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from apps.communities.models.category import CommunityCategory
from apps.communities.models.community import Community
from apps.communities.models.rule import CommunityRule
from apps.communities.models.settings import CommunitySettings
from apps.media.services.uploadthing_service import UploadThingService
from apps.memberships.models.member import CommunityMember


class CommunityMemberInline(admin.TabularInline):
    model = CommunityMember
    extra = 0
    fields = ['user', 'role', 'status', 'custom_title', 'reputation_score', 'joined_at']
    readonly_fields = ['joined_at']
    autocomplete_fields = ['user']
    show_change_link = True
    verbose_name = "Membre"
    verbose_name_plural = "Membres de cet espace"


class CommunityRuleInline(admin.TabularInline):
    model = CommunityRule
    extra = 1


class CommunitySettingsInline(admin.StackedInline):
    model = CommunitySettings
    can_delete = False


class CommunityAdminForm(forms.ModelForm):
    avatar_file = forms.FileField(
        required=False,
        label="Uploader un Logo / Avatar (UploadThing)",
        help_text="Sélectionnez un fichier image (JPG, PNG, WebP, GIF - max 1 Mo) pour l'héberger directement sur UploadThing.",
    )
    banner_file = forms.FileField(
        required=False,
        label="Uploader une Bannière (UploadThing)",
        help_text="Sélectionnez une image de bannière (JPG, PNG, WebP - max 5 Mo) pour l'héberger directement sur UploadThing.",
    )

    def clean_avatar_file(self):
        file = self.cleaned_data.get('avatar_file')
        if file and file.size > 1 * 1024 * 1024:
            raise forms.ValidationError("Le fichier du logo ne doit pas dépasser 1 Mo.")
        return file

    def clean_banner_file(self):
        file = self.cleaned_data.get('banner_file')
        if file and file.size > 5 * 1024 * 1024:
            raise forms.ValidationError("Le fichier de bannière ne doit pas dépasser 5 Mo.")
        return file

    class Meta:
        model = Community
        fields = '__all__'


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    form = CommunityAdminForm
    list_display = [
        'avatar_thumbnail',
        'name',
        'slug',
        'owner',
        'category',
        'privacy_type',
        'pricing_type',
        'members_count_link',
        'is_verified',
        'is_featured',
        'is_active',
        'created_at',
    ]
    list_filter = ['privacy_type', 'pricing_type', 'is_verified', 'is_featured', 'is_active', 'category']
    search_fields = ['name', 'slug', 'tagline', 'owner__username', 'owner__email']
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = ['avatar_preview', 'banner_preview', 'created_at', 'updated_at']
    inlines = [CommunitySettingsInline, CommunityRuleInline, CommunityMemberInline]

    @admin.display(description="Membres", ordering="members_count")
    def members_count_link(self, obj):
        url = reverse('admin:memberships_communitymember_changelist') + f'?community__id__exact={obj.id}'
        return format_html(
            '<a href="{}" style="font-weight: 600; color: #2563eb; text-decoration: none;" title="Voir et filtrer les membres de cet espace">'
            '👥 {} membre(s)'
            '</a>',
            url, obj.members_count
        )

    fieldsets = (
        ('Informations Générales', {
            'fields': ('name', 'slug', 'owner', 'category', 'tagline', 'description')
        }),
        ('Accès & Visibilité', {
            'fields': ('privacy_type', 'pricing_type', 'brand_color')
        }),
        ('Logo & Identité Visuelle (UploadThing)', {
            'description': "Vous pouvez soit téléverser un fichier image local (qui sera stocké directement sur UploadThing), soit coller une URL externe.",
            'fields': ('avatar_file', 'avatar_url', 'avatar_preview')
        }),
        ('Image de Bannière (UploadThing)', {
            'description': "Vous pouvez soit téléverser une bannière (stockée directement sur UploadThing), soit coller une URL externe.",
            'fields': ('banner_file', 'banner_url', 'banner_preview')
        }),
        ('Réseaux Sociaux', {
            'classes': ('collapse',),
            'fields': ('website_url', 'github_url', 'discord_url', 'twitter_url', 'whatsapp_url', 'telegram_url')
        }),
        ('Modération & Badges', {
            'fields': ('is_verified', 'is_featured', 'is_active')
        }),
        ('Compteurs', {
            'classes': ('collapse',),
            'fields': ('members_count', 'posts_count', 'courses_count', 'events_count', 'created_at', 'updated_at')
        }),
    )

    def avatar_thumbnail(self, obj):
        if obj and obj.avatar_url:
            return mark_safe(f'<img src="{obj.avatar_url}" style="width: 28px; height: 28px; object-fit: cover; border-radius: 50%;" />')
        return mark_safe('<span style="color: #999;">—</span>')
    avatar_thumbnail.short_description = "Logo"

    def avatar_preview(self, obj):
        if obj and obj.avatar_url:
            return mark_safe(
                f'<div style="margin-top: 5px;">'
                f'<a href="{obj.avatar_url}" target="_blank" rel="noopener noreferrer">'
                f'<img src="{obj.avatar_url}" style="max-height: 90px; max-width: 90px; border-radius: 12px; border: 1px solid #ddd; object-fit: cover; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" />'
                f'</a>'
                f'<br><small style="color: #666;">Cliquer pour ouvrir en grand</small>'
                f'</div>'
            )
        return "Aucun logo défini actuellement."
    avatar_preview.short_description = "Aperçu du Logo"

    def banner_preview(self, obj):
        if obj and obj.banner_url:
            return mark_safe(
                f'<div style="margin-top: 5px;">'
                f'<a href="{obj.banner_url}" target="_blank" rel="noopener noreferrer">'
                f'<img src="{obj.banner_url}" style="max-height: 120px; max-width: 320px; border-radius: 8px; border: 1px solid #ddd; object-fit: cover; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" />'
                f'</a>'
                f'<br><small style="color: #666;">Cliquer pour ouvrir en grand</small>'
                f'</div>'
            )
        return "Aucune bannière définie actuellement."
    banner_preview.short_description = "Aperçu de la Bannière"

    def save_model(self, request, obj, form, change):
        avatar_file = form.cleaned_data.get('avatar_file')
        if avatar_file:
            try:
                res = UploadThingService.upload_file_direct(
                    user=request.user,
                    file_name=avatar_file.name,
                    file_bytes=avatar_file.read(),
                    mime_type=getattr(avatar_file, 'content_type', 'image/png') or 'image/png',
                    purpose='avatar',
                )
                obj.avatar_url = res['file_url']
                self.message_user(request, f"Logo téléversé sur UploadThing avec succès : {res['file_url']}", messages.SUCCESS)
            except Exception as e:
                self.message_user(request, f"Échec du téléversement du logo sur UploadThing : {e}", messages.ERROR)

        banner_file = form.cleaned_data.get('banner_file')
        if banner_file:
            try:
                res = UploadThingService.upload_file_direct(
                    user=request.user,
                    file_name=banner_file.name,
                    file_bytes=banner_file.read(),
                    mime_type=getattr(banner_file, 'content_type', 'image/png') or 'image/png',
                    purpose='banner',
                )
                obj.banner_url = res['file_url']
                self.message_user(request, f"Bannière téléversée sur UploadThing avec succès : {res['file_url']}", messages.SUCCESS)
            except Exception as e:
                self.message_user(request, f"Échec du téléversement de la bannière sur UploadThing : {e}", messages.ERROR)

        super().save_model(request, obj, form, change)


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
