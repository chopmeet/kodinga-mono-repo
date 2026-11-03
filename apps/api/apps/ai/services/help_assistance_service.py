import logging
from typing import Any, Optional

from django.db import transaction

from apps.accounts.models.user import User
from apps.ai.models.help_assistance import PostHelpAssistance
from apps.memberships.models.member import CommunityMember, MembershipStatus
from apps.notifications.services.notification_service import NotificationService
from apps.posts.models.post import Post

logger = logging.getLogger(__name__)


class HelpAssistanceService:
    """
    Facilitates peer-to-peer assistance for unanswered technical questions.
    Detects orphan questions, extracts technologies, suggests qualified mentors,
    and drafts clarifying follow-up questions.
    """

    @classmethod
    def get_or_create_assistance(
        cls,
        post: Post,
    ) -> dict[str, Any]:
        """
        Retrieves or generates mentor suggestions and AI clarification draft for a post.
        """
        assistance, created = PostHelpAssistance.objects.get_or_create(post=post)

        if created or not assistance.matching_skills:
            # Extract technical skills via AI or heuristics
            text_to_analyze = f"{post.title}\n{post.content}"
            extracted_skills = []

            # Common tech keywords fast detection
            tech_keywords = [
                "python", "django", "drf", "react", "typescript", "javascript",
                "nextjs", "docker", "postgres", "redis", "celery", "graphql",
                "tailwind", "git", "linux", "rest", "api", "jwt", "auth",
            ]
            for kw in tech_keywords:
                if kw in text_to_analyze.lower():
                    extracted_skills.append(kw.capitalize())

            if not extracted_skills:
                extracted_skills = ["Développement Web", "Architecture"]

            assistance.matching_skills = extracted_skills

            # Draft helpful prompt
            assistance.ai_comment_draft = (
                f"Pour aider la communauté à vous débloquer rapidement : pouvez-vous préciser "
                f"le message d'erreur exact ou la version de {extracted_skills[0]} utilisée ?"
            )
            assistance.save()

            # Find matching mentors in this community
            members = (
                CommunityMember.objects.filter(
                    community=post.community,
                    status=MembershipStatus.ACTIVE,
                )
                .exclude(user=post.author)
                .select_related("user", "user__profile")[:20]
            )

            potential_mentors = [m.user for m in members]
            if potential_mentors:
                assistance.suggested_experts.set(potential_mentors[:4])

        mentors_data = []
        for expert in assistance.suggested_experts.all():
            avatar_url = None
            if hasattr(expert, "profile") and expert.profile:
                avatar_url = getattr(expert.profile, "avatar_url", None)

            mentors_data.append({
                "user_id": str(expert.id),
                "username": expert.username,
                "first_name": expert.first_name,
                "last_name": expert.last_name,
                "avatar_url": avatar_url,
                "matching_skills": assistance.matching_skills[:3],
                "reputation_score": getattr(expert, "reputation_score", 100),
            })

        return {
            "post_id": str(post.id),
            "matching_skills": assistance.matching_skills,
            "ai_comment_draft": assistance.ai_comment_draft,
            "suggested_mentors": mentors_data,
            "status": assistance.status,
        }

    @classmethod
    @transaction.atomic
    def ping_mentors(
        cls,
        author: User,
        post: Post,
        mentor_ids: list[str],
        custom_message: Optional[str] = None,
    ) -> int:
        """
        Notifies selected mentors that their expertise is requested on a question.
        """
        assistance, _ = PostHelpAssistance.objects.get_or_create(post=post)
        target_mentors = User.objects.filter(id__in=mentor_ids)

        notified_count = 0
        for mentor in target_mentors:
            NotificationService.create_notification(
                recipient=mentor,
                actor=author,
                notification_type="peer_help_requested",
                title=f"Demande d'aide sur : {post.title[:60]}",
                body=(
                    custom_message
                    or f"{author.username} a sollicité votre expertise technique sur la question '{post.title}'."
                ),
                action_url=f"/c/{post.community.slug}/posts/{post.id}",
                target_type="post",
                target_id=str(post.id),
            )
            notified_count += 1

        assistance.status = "notified"
        assistance.save(update_fields=["status", "updated_at"])
        return notified_count
