import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.ai.models.embedding import ContentEmbedding
from apps.ai.services.platform_knowledge_service import (
    PlatformDocumentationRAGService,
)
from apps.ai.tasks import index_content_embedding_task
from apps.classroom.models.course import Course
from apps.classroom.models.lesson import Lesson
from apps.communities.models.community import Community
from apps.posts.models.post import Post

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Post)
def on_post_saved(sender, instance: Post, created: bool, **kwargs):
    """
    Automatically indexes or re-indexes post embeddings asynchronously upon creation or update.
    """
    if not instance.community_id:
        return

    try:
        url = (
            f"/communities/{instance.community.slug}/posts/{instance.id}"
            if instance.community
            else ""
        )
        index_content_embedding_task.delay(
            content_type="post",
            object_id=str(instance.id),
            community_id=str(instance.community_id),
            title=instance.title or "",
            text=instance.content or "",
            metadata={
                "url": url,
                "author_id": str(instance.author_id),
                "post_type": getattr(instance, "post_type", "discussion"),
            },
        )
    except Exception as exc:
        logger.warning(
            f"[on_post_saved] Could not trigger indexing task for post {instance.id}: {exc}"
        )


@receiver(post_delete, sender=Post)
def on_post_deleted(sender, instance: Post, **kwargs):
    """
    Removes post embeddings when a post is deleted.
    """
    try:
        ContentEmbedding.objects.filter(
            content_type="post", object_id=str(instance.id)
        ).delete()
    except Exception as exc:
        logger.warning(
            f"[on_post_deleted] Error cleaning embedding for post {instance.id}: {exc}"
        )


@receiver(post_save, sender=Lesson)
def on_lesson_saved(sender, instance: Lesson, created: bool, **kwargs):
    """
    Automatically indexes lesson embeddings asynchronously upon creation or update.
    Excludes unpublished courses from being indexed.
    """
    module = getattr(instance, "module", None)
    course = getattr(module, "course", None) if module else None
    if not course or not course.community_id:
        return

    if not course.is_published:
        # Unpublished course lessons must not be indexed
        ContentEmbedding.objects.filter(
            content_type="lesson", object_id=str(instance.id)
        ).delete()
        return

    try:
        url = f"/communities/{course.community.slug}/courses/{course.slug}?lesson={instance.id}"
        index_content_embedding_task.delay(
            content_type="lesson",
            object_id=str(instance.id),
            community_id=str(course.community_id),
            title=instance.title or "",
            text=instance.content or "",
            metadata={
                "url": url,
                "course_id": str(course.id),
                "course_title": course.title,
            },
        )
    except Exception as exc:
        logger.warning(
            f"[on_lesson_saved] Could not trigger indexing task for lesson {instance.id}: {exc}"
        )


@receiver(post_delete, sender=Lesson)
def on_lesson_deleted(sender, instance: Lesson, **kwargs):
    """
    Removes lesson embeddings when a lesson is deleted.
    """
    try:
        ContentEmbedding.objects.filter(
            content_type="lesson", object_id=str(instance.id)
        ).delete()
    except Exception as exc:
        logger.warning(
            f"[on_lesson_deleted] Error cleaning embedding for lesson {instance.id}: {exc}"
        )


@receiver(post_save, sender=Course)
def on_course_saved(sender, instance: Course, created: bool, **kwargs):
    """
    Synchronizes lesson embeddings when course publication status changes.
    """
    if not instance.community_id:
        return

    try:
        lessons = Lesson.objects.filter(module__course=instance).select_related(
            "module__course__community"
        )
        if not instance.is_published:
            # Course was unpublished: delete all its lesson embeddings
            lesson_ids = [str(les.id) for les in lessons]
            ContentEmbedding.objects.filter(
                content_type="lesson", object_id__in=lesson_ids
            ).delete()
        else:
            # Course is published: trigger indexing for all lessons
            for lesson in lessons:
                on_lesson_saved(Lesson, lesson, created=False)
    except Exception as exc:
        logger.warning(
            f"[on_course_saved] Error syncing lesson embeddings for course {instance.id}: {exc}"
        )


@receiver(post_save, sender=Community)
def on_community_saved(sender, instance: Community, created: bool, **kwargs):
    """
    Automatically updates the AI assistant's knowledge base whenever a Community
    is created or modified (name, tagline, description, category, privacy, pricing, active state).
    """
    try:
        PlatformDocumentationRAGService.sync_community_knowledge(instance)
    except Exception as exc:
        logger.warning(
            f"[on_community_saved] Error syncing AI knowledge for community {instance.slug}: {exc}"
        )


@receiver(post_delete, sender=Community)
def on_community_deleted(sender, instance: Community, **kwargs):
    """
    Removes the community from the AI assistant's knowledge base when deleted.
    """
    try:
        PlatformDocumentationRAGService.remove_community_knowledge(instance.slug)
    except Exception as exc:
        logger.warning(
            f"[on_community_deleted] Error cleaning AI knowledge for community {instance.slug}: {exc}"
        )
