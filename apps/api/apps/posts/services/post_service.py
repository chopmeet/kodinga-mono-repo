from datetime import timedelta
from typing import Any, Optional

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.accounts.models.user import User
from apps.communities.models.community import Community
from apps.communities.models.settings import PostPermissionType
from apps.memberships.models.member import (
    CommunityMember,
    MembershipStatus,
)
from apps.memberships.permissions import (
    check_community_membership,
)
from apps.posts.models.category import PostCategory
from apps.posts.models.comment import Comment
from apps.posts.models.poll import Poll, PollOption, PollVote
from apps.posts.models.post import Post, PostType
from apps.posts.models.reaction import (
    CommentReaction,
    PostReaction,
    ReactionType,
)
from common.permissions.base import is_superadmin_user


class PostService:
    """
    Handles lifecycle and interaction logic for community posts, polls, comments, and reactions.
    """

    @classmethod
    def _verify_post_permission(cls, user: User, community: Community, category: Optional[PostCategory] = None) -> Optional[CommunityMember]:
        if is_superadmin_user(user):
            return None

        check_community_membership(user, community, "publier dans cette communauté")

        membership = CommunityMember.objects.filter(
            community=community,
            user=user,
            status=MembershipStatus.ACTIVE
        ).first()

        # Check read-only mode: only owner and moderators/admins can post
        settings = getattr(community, 'settings', None)
        if settings and settings.is_read_only:
            is_owner = (community.owner_id == user.id)
            is_moderator = membership and membership.is_moderator
            if not (is_owner or is_moderator):
                raise PermissionDenied("Cette communauté est en mode lecture seule. Seuls les administrateurs peuvent publier.")

        # Check community-wide posting permission
        if settings:
            if settings.default_post_permission == PostPermissionType.ADMINS_ONLY and not membership.is_admin:
                raise PermissionDenied("Seuls les administrateurs peuvent publier dans cette communauté.")
            if settings.default_post_permission == PostPermissionType.MODERATORS_ONLY and not membership.is_moderator:
                raise PermissionDenied("Seuls les modérateurs peuvent publier dans cette communauté.")

        # Check restricted category / channel
        if category and category.is_restricted and not membership.is_moderator:
            raise PermissionDenied(f"Le canal #{category.slug} est réservé aux modérateurs.")

        return membership

    @classmethod
    def create_post(
        cls,
        author: User,
        community: Community,
        data: dict[str, Any],
        poll_data: Optional[dict[str, Any]] = None,
        media_ids: Optional[list[str]] = None,
    ) -> Post:
        category = None
        category_id = data.pop('category_id', None)
        if category_id:
            try:
                category = PostCategory.objects.get(id=category_id, community=community)
                data['category'] = category
            except PostCategory.DoesNotExist as err:
                raise ValidationError({'category_id': "Catégorie / Canal introuvable."}) from err

        cls._verify_post_permission(author, community, category)

        # Mandatory pre-publication content moderation
        from apps.ai.services.moderation_service import ModerationService
        text_to_moderate = f"{data.get('title', '')}\n{data.get('content', '')}".strip()
        ModerationService.enforce_pre_publication(text_to_moderate, community=community, author=author)

        with transaction.atomic():
            post = Post.objects.create(
                author=author,
                community=community,
                **data
            )

            if media_ids:
                post.media_attachments.set(media_ids)

            # Create embedded poll if specified
            if poll_data:
                options = poll_data.get('options', [])
                if len(options) < 2:
                    raise ValidationError({'poll': "Un sondage doit comporter au moins 2 options."})

                duration_days = poll_data.get('duration_days', 7)
                expires_at = timezone.now() + timedelta(days=duration_days) if duration_days else None

                poll = Poll.objects.create(
                    post=post,
                    question=poll_data.get('question', post.title or "Sondage"),
                    is_multiple_choice=poll_data.get('is_multiple_choice', False),
                    expires_at=expires_at
                )

                for idx, opt_text in enumerate(options):
                    PollOption.objects.create(
                        poll=poll,
                        text=opt_text.strip(),
                        order=idx
                    )

                post.post_type = PostType.POLL
                post.save(update_fields=['post_type', 'updated_at'])

            Community.objects.filter(id=community.id).update(posts_count=F('posts_count') + 1)
            from realtime.broadcast import broadcast_post_created

            broadcast_post_created(post)
            return post

    @classmethod
    def update_post(
        cls,
        user: User,
        post: Post,
        data: dict[str, Any],
        media_ids: Optional[list[str]] = None
    ) -> Post:
        if not is_superadmin_user(user) and post.author_id != user.id:
            raise PermissionDenied("Vous n'êtes pas l'auteur de cette publication.")

        category_id = data.pop('category_id', None)
        if category_id is not None:
            if category_id:
                try:
                    data['category'] = PostCategory.objects.get(id=category_id, community=post.community)
                except PostCategory.DoesNotExist as err:
                    raise ValidationError({'category_id': "Catégorie introuvable."}) from err
            else:
                data['category'] = None

        with transaction.atomic():
            for key, value in data.items():
                setattr(post, key, value)
            post.save()

            if media_ids is not None:
                post.media_attachments.set(media_ids)

            from realtime.broadcast import broadcast_post_updated

            broadcast_post_updated(post)
            return post

    @classmethod
    def delete_post(cls, user: User, post: Post) -> None:
        if not is_superadmin_user(user) and post.author_id != user.id:
            membership = CommunityMember.objects.filter(
                community=post.community,
                user=user,
                status=MembershipStatus.ACTIVE
            ).first()
            if not membership or not membership.is_moderator:
                raise PermissionDenied("Droits de modération requis pour supprimer ce post.")

        with transaction.atomic():
            community_id = post.community_id
            post_id = post.id
            post.delete()
            Community.objects.filter(id=community_id, posts_count__gt=0).update(posts_count=F('posts_count') - 1)
            from realtime.broadcast import broadcast_post_deleted

            broadcast_post_deleted(community_id, post_id)

    @classmethod
    def toggle_post_pin(cls, user: User, post: Post) -> bool:
        if not is_superadmin_user(user) and post.community.owner_id != user.id:
            membership = CommunityMember.objects.filter(
                community=post.community,
                user=user,
                status=MembershipStatus.ACTIVE
            ).first()
            if not membership or not membership.is_moderator:
                raise PermissionDenied("Seul le propriétaire ou un modérateur peut épingler une publication.")

        post.is_pinned = not post.is_pinned
        post.save(update_fields=['is_pinned', 'updated_at'])
        from realtime.broadcast import broadcast_post_pinned

        broadcast_post_pinned(post.community_id, post.id, post.is_pinned)
        return post.is_pinned

    @classmethod
    def toggle_post_lock(cls, user: User, post: Post) -> bool:
        if not is_superadmin_user(user) and post.community.owner_id != user.id:
            membership = CommunityMember.objects.filter(
                community=post.community,
                user=user,
                status=MembershipStatus.ACTIVE
            ).first()
            if not membership or not membership.is_moderator:
                raise PermissionDenied("Droits de modération requis.")

        post.is_locked = not post.is_locked
        post.save(update_fields=['is_locked', 'updated_at'])
        from realtime.broadcast import broadcast_post_locked

        broadcast_post_locked(post.community_id, post.id, post.is_locked)
        return post.is_locked

    # --- Comments ---

    @classmethod
    def create_comment(
        cls,
        author: User,
        post: Post,
        content: str,
        parent_id: Optional[str] = None,
        media_ids: Optional[list[str]] = None,
    ) -> Comment:
        if post.is_locked and not is_superadmin_user(author):
            raise ValidationError("Les commentaires sont verrouillés sur cette publication.")

        if not is_superadmin_user(author):
            check_community_membership(author, post.community, "commenter cette publication")

            membership = CommunityMember.objects.filter(
                community=post.community,
                user=author,
                status=MembershipStatus.ACTIVE
            ).first()

            settings = getattr(post.community, 'settings', None)
            if settings and settings.is_read_only:
                is_owner = (post.community.owner_id == author.id)
                is_moderator = membership.is_moderator if membership else False
                if not (is_owner or is_moderator):
                    raise PermissionDenied("Cette communauté est en mode lecture seule. Seul le propriétaire ou un modérateur peut commenter.")

        parent = None
        if parent_id:
            try:
                parent = Comment.objects.get(id=parent_id, post=post)
            except Comment.DoesNotExist as err:
                raise ValidationError({'parent_id': "Commentaire parent introuvable."}) from err

        # Mandatory pre-publication content moderation
        from apps.ai.services.moderation_service import ModerationService
        ModerationService.enforce_pre_publication(content, community=post.community, author=author)

        with transaction.atomic():
            comment = Comment.objects.create(
                post=post,
                author=author,
                content=content,
                parent=parent
            )
            if media_ids:
                comment.media_attachments.set(media_ids)

            Post.objects.filter(id=post.id).update(comments_count=F('comments_count') + 1)
            post.refresh_from_db(fields=['comments_count'])
            comment.post = post

            from realtime.broadcast import broadcast_comment_created

            broadcast_comment_created(comment)
            return comment

    @classmethod
    def delete_comment(cls, user: User, comment: Comment) -> None:
        if not is_superadmin_user(user) and comment.author_id != user.id:
            membership = CommunityMember.objects.filter(
                community=comment.post.community,
                user=user,
                status=MembershipStatus.ACTIVE
            ).first()
            if not membership or not membership.is_moderator:
                raise PermissionDenied("Droits de modération requis.")

        with transaction.atomic():
            post_id = comment.post_id
            comment_id = comment.id
            community_id = (
                comment.post.community_id
                if getattr(comment, 'post', None)
                else None
            )
            comment.delete()
            Post.objects.filter(id=post_id, comments_count__gt=0).update(comments_count=F('comments_count') - 1)
            updated_post = Post.objects.filter(id=post_id).first()
            new_count = updated_post.comments_count if updated_post else 0

            from realtime.broadcast import broadcast_comment_deleted

            broadcast_comment_deleted(
                post_id,
                comment_id,
                community_id=community_id,
                new_comments_count=new_count,
            )

    @classmethod
    def mark_accepted_answer(cls, user: User, comment: Comment) -> Comment:
        post = comment.post
        if not is_superadmin_user(user) and post.author_id != user.id:
            raise PermissionDenied("Seul l'auteur de la question peut valider la réponse acceptée.")

        with transaction.atomic():
            # Unmark any previous accepted answers
            Comment.objects.filter(post=post, is_accepted_answer=True).update(is_accepted_answer=False)
            comment.is_accepted_answer = True
            comment.save(update_fields=['is_accepted_answer', 'updated_at'])

            post.is_resolved = True
            post.save(update_fields=['is_resolved', 'updated_at'])

            # Reward points to answer author
            CommunityMember.objects.filter(
                community=post.community,
                user=comment.author
            ).update(reputation_score=F('reputation_score') + 15)

            from realtime.broadcast import broadcast_comment_accepted

            broadcast_comment_accepted(post.id, comment.id, True)
            return comment

    # --- Reactions ---

    @classmethod
    def toggle_post_reaction(cls, user: User, post: Post, reaction_type: str) -> bool:
        check_community_membership(user, post.community, "réagir à cette publication")

        if reaction_type not in dict(ReactionType.choices):
            raise ValidationError("Type de réaction invalide.")

        with transaction.atomic():
            existing = PostReaction.objects.filter(post=post, user=user, reaction_type=reaction_type).first()
            from realtime.broadcast import broadcast_post_reaction

            if existing:
                existing.delete()
                Post.objects.filter(id=post.id, reactions_count__gt=0).update(reactions_count=F('reactions_count') - 1)
                post.refresh_from_db(fields=['reactions_count'])
                broadcast_post_reaction(
                    post.community_id,
                    post.id,
                    reaction_type,
                    post.reactions_count,
                    user.id,
                    "removed",
                )
                return False
            else:
                PostReaction.objects.create(post=post, user=user, reaction_type=reaction_type)
                Post.objects.filter(id=post.id).update(reactions_count=F('reactions_count') + 1)
                post.refresh_from_db(fields=['reactions_count'])
                broadcast_post_reaction(
                    post.community_id,
                    post.id,
                    reaction_type,
                    post.reactions_count,
                    user.id,
                    "added",
                )
                return True

    @classmethod
    def toggle_comment_reaction(cls, user: User, comment: Comment, reaction_type: str) -> bool:
        check_community_membership(user, comment.post.community, "réagir à ce commentaire")

        if reaction_type not in dict(ReactionType.choices):
            raise ValidationError("Type de réaction invalide.")

        with transaction.atomic():
            existing = CommentReaction.objects.filter(comment=comment, user=user, reaction_type=reaction_type).first()
            from realtime.broadcast import broadcast_comment_reaction

            if existing:
                existing.delete()
                Comment.objects.filter(id=comment.id, reactions_count__gt=0).update(reactions_count=F('reactions_count') - 1)
                comment.refresh_from_db(fields=['reactions_count'])
                broadcast_comment_reaction(
                    comment.post_id,
                    comment.id,
                    reaction_type,
                    comment.reactions_count,
                    user.id,
                    "removed",
                )
                return False
            else:
                CommentReaction.objects.create(comment=comment, user=user, reaction_type=reaction_type)
                Comment.objects.filter(id=comment.id).update(reactions_count=F('reactions_count') + 1)
                comment.refresh_from_db(fields=['reactions_count'])
                broadcast_comment_reaction(
                    comment.post_id,
                    comment.id,
                    reaction_type,
                    comment.reactions_count,
                    user.id,
                    "added",
                )
                return True

    # --- Polls ---

    @classmethod
    def vote_poll(cls, user: User, poll: Poll, option_ids: list[str]) -> Poll:
        check_community_membership(user, poll.post.community, "voter dans ce sondage")

        if poll.is_expired:
            raise ValidationError("Ce sondage est clôturé.")

        if not poll.is_multiple_choice and len(option_ids) > 1:
            raise ValidationError("Ce sondage n'autorise qu'un seul choix.")

        with transaction.atomic():
            # Delete previous votes by this user on this poll
            previous_votes = PollVote.objects.filter(option__poll=poll, user=user)
            for prev_vote in previous_votes:
                PollOption.objects.filter(id=prev_vote.option_id, votes_count__gt=0).update(votes_count=F('votes_count') - 1)
                Poll.objects.filter(id=poll.id, total_votes__gt=0).update(total_votes=F('total_votes') - 1)
            previous_votes.delete()

            # Record new votes
            for opt_id in option_ids:
                try:
                    option = PollOption.objects.get(id=opt_id, poll=poll)
                    PollVote.objects.create(option=option, user=user)
                    PollOption.objects.filter(id=option.id).update(votes_count=F('votes_count') + 1)
                    Poll.objects.filter(id=poll.id).update(total_votes=F('total_votes') + 1)
                except PollOption.DoesNotExist as err:
                    raise NotFound("Option de sondage introuvable.") from err

            poll.refresh_from_db()
            return poll
