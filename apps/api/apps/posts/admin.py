from django.contrib import admin
from apps.posts.models.category import PostCategory
from apps.posts.models.comment import Comment
from apps.posts.models.poll import Poll, PollOption, PollVote
from apps.posts.models.post import Post
from apps.posts.models.reaction import CommentReaction, PostReaction


@admin.register(PostCategory)
class PostCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'community', 'icon', 'is_restricted', 'order')
    list_filter = ('community', 'is_restricted')
    search_fields = ('name', 'slug', 'community__name')


class PollOptionInline(admin.TabularInline):
    model = PollOption
    extra = 2


@admin.register(Poll)
class PollAdmin(admin.ModelAdmin):
    list_display = ('question', 'post', 'is_multiple_choice', 'total_votes', 'expires_at')
    inlines = [PollOptionInline]


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ('title', 'post_type', 'community', 'author', 'category', 'is_pinned', 'is_locked', 'is_resolved', 'created_at')
    list_filter = ('post_type', 'is_pinned', 'is_locked', 'is_resolved', 'created_at', 'community')
    search_fields = ('title', 'content', 'author__username', 'community__name')


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('author', 'post', 'parent', 'is_accepted_answer', 'reactions_count', 'created_at')
    list_filter = ('is_accepted_answer', 'created_at')
    search_fields = ('content', 'author__username', 'post__title')


@admin.register(PostReaction)
class PostReactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'post', 'reaction_type', 'created_at')
    list_filter = ('reaction_type', 'created_at')


@admin.register(CommentReaction)
class CommentReactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'comment', 'reaction_type', 'created_at')
    list_filter = ('reaction_type', 'created_at')
