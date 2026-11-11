from django.contrib import admin

from apps.ai.models.documentation import PlatformDocumentation


@admin.register(PlatformDocumentation)
class PlatformDocumentationAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "slug",
        "category",
        "version",
        "is_active",
        "updated_at",
    )
    list_filter = ("is_active", "category", "version")
    search_fields = ("title", "slug", "summary", "content")
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("id", "created_at", "updated_at")
