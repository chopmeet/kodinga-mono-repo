import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.ai.models.embedding import ContentEmbedding
from apps.ai.tasks import index_content_embedding_task
from apps.classroom.models.lesson import Lesson
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
        url = f"/c/{instance.community.slug}/posts/{instance.id}" if instance.community else ""
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
        logger.warning(f"[on_post_saved] Could not trigger indexing task for post {instance.id}: {exc}")


@receiver(post_delete, sender=Post)
def on_post_deleted(sender, instance: Post, **kwargs):
    """
    Removes post embeddings when a post is deleted.
    """
    try:
        ContentEmbedding.objects.filter(content_type="post", object_id=str(instance.id)).delete()
    except Exception as exc:
        logger.warning(f"[on_post_deleted] Error cleaning embedding for post {instance.id}: {exc}")


@receiver(post_save, sender=Lesson)
def on_lesson_saved(sender, instance: Lesson, created: bool, **kwargs):
    """
    Automatically indexes lesson embeddings asynchronously upon creation or update.
    """
    module = getattr(instance, "module", None)
    course = getattr(module, "course", None) if module else None
    if not course or not course.community_id:
        return

    try:
        url = f"/c/{course.community.slug}/courses/{course.slug}/lessons/{instance.id}"
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
        logger.warning(f"[on_lesson_saved] Could not trigger indexing task for lesson {instance.id}: {exc}")


@receiver(post_delete, sender=Lesson)
def on_lesson_deleted(sender, instance: Lesson, **kwargs):
    """
    Removes lesson embeddings when a lesson is deleted.
    """
    try:
        ContentEmbedding.objects.filter(content_type="lesson", object_id=str(instance.id)).delete()
    except Exception as exc:
        logger.warning(f"[on_lesson_deleted] Error cleaning embedding for lesson {instance.id}: {exc}")

