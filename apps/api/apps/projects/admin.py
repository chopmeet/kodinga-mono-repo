from django.contrib import admin

from apps.projects.models.comment import ProjectComment
from apps.projects.models.project import Project
from apps.projects.models.upvote import ProjectUpvote


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "slug", "owner", "community", "status", "upvotes_count", "views_count", "is_featured", "created_at"]
    list_filter = ["status", "is_featured"]
    search_fields = ["title", "owner__username"]
    prepopulated_fields = {"slug": ("title",)}


@admin.register(ProjectUpvote)
class ProjectUpvoteAdmin(admin.ModelAdmin):
    list_display = ["id", "project", "user", "created_at"]


@admin.register(ProjectComment)
class ProjectCommentAdmin(admin.ModelAdmin):
    list_display = ["id", "project", "author", "parent", "created_at"]
