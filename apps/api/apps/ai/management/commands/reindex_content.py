import logging

from django.core.management.base import BaseCommand

from apps.ai.tasks import index_content_embedding_task
from apps.classroom.models.lesson import Lesson
from apps.posts.models.post import Post

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Re-indexes vector embeddings for all existing published posts and lessons."

    def add_arguments(self, parser):
        parser.add_argument(
            "--community-id",
            type=str,
            default=None,
            help="Filter re-indexing to a specific community UUID.",
        )
        parser.add_argument(
            "--sync",
            action="store_true",
            default=False,
            help="Execute synchronously without Celery tasks.",
        )

    def handle(self, *args, **options):
        community_id = options.get("community_id")
        sync_mode = options.get("sync")

        self.stdout.write("Starting content re-indexing...")

        # 1. Reindex Posts
        posts_qs = Post.objects.select_related("community")
        if community_id:
            posts_qs = posts_qs.filter(community_id=community_id)

        post_count = 0
        for post in posts_qs:
            if not post.community:
                continue
            url = f"/communities/{post.community.slug}/posts/{post.id}"
            task_args = {
                "content_type": "post",
                "object_id": str(post.id),
                "community_id": str(post.community_id),
                "title": post.title or "",
                "text": post.content or "",
                "metadata": {
                    "url": url,
                    "author_id": str(post.author_id),
                    "post_type": getattr(post, "post_type", "discussion"),
                },
            }
            if sync_mode:
                index_content_embedding_task(**task_args)
            else:
                index_content_embedding_task.delay(**task_args)
            post_count += 1

        self.stdout.write(self.style.SUCCESS(f"Queued re-indexing for {post_count} posts."))

        # 2. Reindex Lessons (only for published courses)
        lessons_qs = Lesson.objects.filter(
            module__course__is_published=True
        ).select_related("module__course__community")
        if community_id:
            lessons_qs = lessons_qs.filter(module__course__community_id=community_id)

        lesson_count = 0
        for lesson in lessons_qs:
            course = lesson.module.course if lesson.module else None
            if not course or not course.community:
                continue
            url = f"/communities/{course.community.slug}/courses/{course.slug}?lesson={lesson.id}"
            task_args = {
                "content_type": "lesson",
                "object_id": str(lesson.id),
                "community_id": str(course.community_id),
                "title": lesson.title or "",
                "text": lesson.content or "",
                "metadata": {
                    "url": url,
                    "course_id": str(course.id),
                    "course_title": course.title,
                },
            }
            if sync_mode:
                index_content_embedding_task(**task_args)
            else:
                index_content_embedding_task.delay(**task_args)
            lesson_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully triggered re-indexing for {post_count} posts and {lesson_count} lessons."
            )
        )

