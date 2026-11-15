from typing import Any, Optional

from django.db.models import F, Prefetch, Q, QuerySet

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.memberships.permissions import check_community_read_permission
from apps.posts.models.category import PostCategory
from apps.posts.models.comment import Comment
from apps.posts.models.poll import PollOption
from apps.posts.models.post import Post


class PostSelector:
    """
    Optimized data queries and prefetching for community posts, threaded comments, and polls.
    """

    @classmethod
    def get_base_post_queryset(cls) -> QuerySet[Post]:
        poll_prefetch = Prefetch(
            "poll__options", queryset=PollOption.objects.order_by("order", "created_at")
        )
        return Post.objects.select_related(
            "author", "author__profile", "category", "community", "poll"
        ).prefetch_related(
            "media_attachments",
            "video_attachments",
            "reactions",
            "bookmarks",
            poll_prefetch,
        )

    @classmethod
    def get_community_feed(
        cls,
        community: Community,
        category_slug: Optional[str] = None,
        post_type: Optional[str] = None,
        search: Optional[str] = None,
        is_pinned: Optional[bool] = None,
        user: Optional[User] = None,
        since: Optional[Any] = None,
        sort: Optional[str] = None,
        ordering: Optional[str] = None,
        bookmarked: Optional[bool] = None,
        author: Optional[str] = None,
        tag: Optional[str] = None,
        is_locked: Optional[bool] = None,
    ) -> QuerySet[Post]:
        if user is not None:
            check_community_read_permission(user, community)
        qs = cls.get_base_post_queryset().filter(community=community)

        if category_slug:
            qs = qs.filter(category__slug=category_slug)

        if post_type:
            qs = qs.filter(post_type=post_type)

        if is_pinned is not None:
            qs = qs.filter(is_pinned=is_pinned)

        if is_locked is not None:
            qs = qs.filter(is_locked=is_locked)

        if since is not None:
            qs = qs.filter(updated_at__gt=since)

        if bookmarked and user and user.is_authenticated:
            qs = qs.filter(bookmarks__user=user)

        if author:
            qs = qs.filter(Q(author__username=author) | Q(author_id=author))

        if tag:
            clean_tag = tag.lstrip("#")
            qs = qs.filter(
                Q(content__icontains=f"#{clean_tag}")
                | Q(title__icontains=f"#{clean_tag}")
            )

        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(content__icontains=search)
                | Q(code_snippet__icontains=search)
                | Q(author__username__icontains=search)
            )

        sort_choice = (sort or ordering or "").lower()
        if sort_choice in ("popular", "populaires", "-popularity", "top"):
            qs = qs.annotate(popularity=F("reactions_count") + F("comments_count"))
            return qs.order_by("-is_pinned", "-popularity", "-created_at")
        elif sort_choice in ("oldest", "asc"):
            return qs.order_by("-is_pinned", "created_at")
        elif sort_choice in ("views", "-views"):
            return qs.order_by("-is_pinned", "-views_count", "-created_at")
        elif sort_choice in ("recent", "latest", "-created_at"):
            return qs.order_by("-created_at")

        return qs.order_by("-is_pinned", "-created_at")

    @classmethod
    def get_bookmarked_posts(
        cls, user: User, community: Optional[Community] = None
    ) -> QuerySet[Post]:
        qs = cls.get_base_post_queryset().filter(bookmarks__user=user)
        if community:
            qs = qs.filter(community=community)
        return qs.order_by("-created_at")

    @classmethod
    def get_post_by_id(cls, post_id: str, user: Optional[User] = None) -> Post:
        return cls.get_base_post_queryset().get(id=post_id)

    @classmethod
    def get_post_comments(
        cls, post: Post, user: Optional[User] = None, since: Optional[Any] = None
    ) -> QuerySet[Comment]:
        replies_prefetch = Prefetch(
            "replies",
            queryset=Comment.objects.select_related("author", "author__profile")
            .prefetch_related("media_attachments", "reactions")
            .order_by("-created_at"),
        )
        qs = (
            Comment.objects.filter(post=post, parent__isnull=True)
            .select_related("author", "author__profile")
            .prefetch_related("media_attachments", "reactions", replies_prefetch)
        )
        if since is not None:
            qs = qs.filter(updated_at__gt=since)
        return qs.order_by("-is_accepted_answer", "-created_at")

    @classmethod
    def get_categories(cls, community: Community) -> QuerySet[PostCategory]:
        return PostCategory.objects.filter(community=community).order_by(
            "order", "name"
        )
