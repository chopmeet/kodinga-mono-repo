import logging
from typing import Any, Optional

from django.db import transaction

from apps.accounts.models.user import User
from apps.ai.models.help_assistance import PostHelpAssistance
from apps.ai.router import ai_router
from apps.memberships.models.member import CommunityMember, MembershipStatus
from apps.notifications.services.notification_service import NotificationService
from apps.posts.models.post import Post

logger = logging.getLogger(__name__)


class HelpAssistanceService:
    """
    Facilitates peer-to-peer assistance for unanswered technical questions.
    Detects orphan questions, extracts technologies, suggests qualified mentors
    based on their actual profile skills, and drafts AI clarifying follow-up questions.
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
            # Extract technical skills via keywords and content analysis
            text_to_analyze = f"{post.title}\n{post.content}"
            extracted_skills = []

            tech_keywords = [
                "python",
                "django",
                "drf",
                "react",
                "typescript",
                "javascript",
                "nextjs",
                "docker",
                "postgres",
                "redis",
                "celery",
                "graphql",
                "tailwind",
                "git",
                "linux",
                "rest",
                "api",
                "jwt",
                "auth",
                "vue",
                "angular",
                "node",
                "express",
                "fastapi",
                "spring",
                "kubernetes",
                "aws",
                "gcp",
                "azure",
                "mongodb",
                "sqlite",
            ]
            for kw in tech_keywords:
                if kw in text_to_analyze.lower():
                    extracted_skills.append(kw.capitalize())

            if not extracted_skills:
                extracted_skills = ["Développement Web", "Architecture"]

            assistance.matching_skills = extracted_skills

            # Draft helpful prompt using AI Router
            system_prompt = (
                "Tu es un assistant pédagogique et technique pour une communauté de développeurs. "
                "Rédige un court commentaire constructif (1 à 2 phrases maximum) à destination de l'auteur "
                "d'une question pour lui demander avec bienveillance les précisions techniques manquantes indispensables "
                "(logs d'erreur précis, code minimal reproductible, versions des frameworks, ou environnement d'exécution)."
            )
            user_prompt = (
                f"Question posée :\nTitre : {post.title}\nDétails : {post.content}"
            )
            try:
                ai_draft = ai_router.generate_text(
                    prompt=user_prompt,
                    system_instruction=system_prompt,
                    community=post.community,
                    max_output_tokens=250,
                    temperature=0.3,
                ).strip()
            except Exception as exc:
                logger.warning(
                    f"[HelpAssistanceService] AI draft generation failed: {exc}"
                )
                ai_draft = (
                    f"Pour aider la communauté à vous débloquer rapidement : pouvez-vous préciser "
                    f"le message d'erreur exact ou la version de {extracted_skills[0]} utilisée ?"
                )

            assistance.ai_comment_draft = ai_draft
            assistance.save()

            # Find matching mentors in this community based on their actual profile skills
            active_members = (
                CommunityMember.objects.filter(
                    community=post.community,
                    status=MembershipStatus.ACTIVE,
                )
                .exclude(user=post.author)
                .select_related("user", "user__profile")
                .prefetch_related("user__profile__skills__technology")[:50]
            )

            scored_mentors = []
            lower_extracted = [s.lower() for s in extracted_skills]

            for m in active_members:
                u = m.user
                user_skills = []
                if hasattr(u, "profile") and u.profile:
                    user_skills = list(
                        u.profile.skills.values_list("technology__name", flat=True)
                    )
                matched = [s for s in user_skills if s.lower() in lower_extracted]
                if not matched:
                    continue
                rep = getattr(m, "reputation_score", 0) or 0
                score = len(matched) * 10 + rep / 100.0
                scored_mentors.append(
                    {
                        "user": u,
                        "matched_skills": matched,
                        "all_skills": user_skills,
                        "score": score,
                    }
                )

            scored_mentors.sort(key=lambda x: x["score"], reverse=True)
            selected_experts = [item["user"] for item in scored_mentors[:4]]
            assistance.suggested_experts.set(selected_experts)

        mentors_data = []
        lower_extracted = [s.lower() for s in (assistance.matching_skills or [])]

        expert_ids = list(assistance.suggested_experts.values_list("id", flat=True))
        member_rep_map = dict(
            CommunityMember.objects.filter(
                community=post.community,
                user_id__in=expert_ids,
            ).values_list("user_id", "reputation_score")
        )

        for expert in assistance.suggested_experts.all().prefetch_related(
            "profile__skills__technology"
        ):
            avatar_url = None
            expert_skills = []
            if hasattr(expert, "profile") and expert.profile:
                avatar_url = getattr(expert.profile, "avatar_url", None)
                expert_skills = list(
                    expert.profile.skills.values_list("technology__name", flat=True)
                )

            # Display only the mentor's actual matching skills
            matching = [s for s in expert_skills if s.lower() in lower_extracted]

            mentors_data.append(
                {
                    "user_id": str(expert.id),
                    "username": expert.username,
                    "first_name": expert.first_name,
                    "last_name": expert.last_name,
                    "avatar_url": avatar_url,
                    "matching_skills": matching,
                    "reputation_score": member_rep_map.get(expert.id, 0),
                }
            )

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
        Enforces that target mentors must be active members of the post's community.
        """
        assistance, _ = PostHelpAssistance.objects.get_or_create(post=post)

        # Strictly restrict to verified active members of the post's community (excluding the author)
        valid_mentor_user_ids = list(
            CommunityMember.objects.filter(
                community=post.community,
                user_id__in=mentor_ids,
                status=MembershipStatus.ACTIVE,
            )
            .exclude(user_id=author.id)
            .values_list("user_id", flat=True)
        )

        target_mentors = User.objects.filter(id__in=valid_mentor_user_ids)

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
                action_url=f"/communities/{post.community.slug}/posts/{post.id}",
                target_type="post",
                target_id=str(post.id),
            )
            notified_count += 1

        if notified_count > 0:
            assistance.status = "notified"
            assistance.save(update_fields=["status", "updated_at"])
        return notified_count
