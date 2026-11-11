import logging
from datetime import timedelta
from typing import Any, Optional

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.ai.models.churn import ChurnRiskLevel, MemberChurnRisk
from apps.ai.router import ai_router
from apps.communities.models.community import Community
from apps.memberships.models.member import CommunityMember, MembershipStatus
from apps.posts.models.comment import Comment
from apps.posts.models.post import Post

logger = logging.getLogger(__name__)
User = get_user_model()


class ChurnPredictionService:
    """
    Predictive churn risk evaluation and smart nudge generation for creators.
    Identifies disengaging members early and suggests personalized re-engagement messages.
    """

    @classmethod
    def evaluate_member_churn_risk(
        cls,
        member: CommunityMember,
        force_refresh: bool = False,
        generate_ai_nudge: bool = False,
    ) -> MemberChurnRisk:
        """
        Calculates churn risk metrics and creates or updates a MemberChurnRisk record.
        """
        existing = MemberChurnRisk.objects.filter(member=member).first()
        if (
            existing
            and not force_refresh
            and (timezone.now() - existing.last_evaluated_at).total_seconds() < 86400
        ):
            return existing

        now = timezone.now()
        fourteen_days_ago = now - timedelta(days=14)
        thirty_days_ago = now - timedelta(days=30)

        # 1. Measure activity signals
        latest_post = (
            Post.objects.filter(community=member.community, author=member.user)
            .order_by("-created_at")
            .first()
        )
        latest_comment = (
            Comment.objects.filter(post__community=member.community, author=member.user)
            .order_by("-created_at")
            .first()
        )

        activity_dates = [member.joined_at]
        if member.user.last_login:
            activity_dates.append(member.user.last_login)
        if latest_post:
            activity_dates.append(latest_post.created_at)
        if latest_comment:
            activity_dates.append(latest_comment.created_at)

        latest_activity = max(activity_dates)
        days_inactive = (now - latest_activity).days

        recent_posts_count = Post.objects.filter(
            community=member.community,
            author=member.user,
            created_at__gte=fourteen_days_ago,
        ).count()
        recent_comments_count = Comment.objects.filter(
            post__community=member.community,
            author=member.user,
            created_at__gte=fourteen_days_ago,
        ).count()
        total_recent_interactions = recent_posts_count + recent_comments_count

        older_interactions = (
            Post.objects.filter(
                community=member.community,
                author=member.user,
                created_at__gte=thirty_days_ago,
                created_at__lt=fourteen_days_ago,
            ).count()
            + Comment.objects.filter(
                post__community=member.community,
                author=member.user,
                created_at__gte=thirty_days_ago,
                created_at__lt=fourteen_days_ago,
            ).count()
        )

        # 2. Risk scoring formula
        score = 0.0

        if days_inactive >= 30:
            score += 45.0
        elif days_inactive >= 14:
            score += 30.0
        elif days_inactive >= 7:
            score += 15.0

        if total_recent_interactions == 0:
            score += 25.0
        elif total_recent_interactions < older_interactions:
            score += 15.0

        days_since_joined = (now - member.joined_at).days
        if days_since_joined > 14 and member.reputation_score < 10:
            score += 15.0

        if member.status != MembershipStatus.ACTIVE:
            score += 20.0

        final_score = float(min(100.0, max(0.0, score)))

        if final_score >= 75.0:
            risk_level = ChurnRiskLevel.CRITICAL
        elif final_score >= 50.0:
            risk_level = ChurnRiskLevel.HIGH
        elif final_score >= 25.0:
            risk_level = ChurnRiskLevel.MEDIUM
        else:
            risk_level = ChurnRiskLevel.LOW

        signals: dict[str, Any] = {
            "days_inactive": days_inactive,
            "days_since_joined": days_since_joined,
            "recent_posts_14d": recent_posts_count,
            "recent_comments_14d": recent_comments_count,
            "total_recent_interactions": total_recent_interactions,
            "activity_trend": "declining"
            if total_recent_interactions < older_interactions
            else "stable",
            "reputation_score": member.reputation_score,
            "membership_status": member.status,
        }

        with transaction.atomic():
            churn_risk, _ = MemberChurnRisk.objects.update_or_create(
                member=member,
                defaults={
                    "risk_level": risk_level,
                    "risk_score": final_score,
                    "signals": signals,
                    "last_evaluated_at": now,
                },
            )

            # Generate smart nudge suggestion if at risk and not yet present
            if risk_level in [
                ChurnRiskLevel.MEDIUM,
                ChurnRiskLevel.HIGH,
                ChurnRiskLevel.CRITICAL,
            ] and (not churn_risk.suggested_nudge or force_refresh):
                if generate_ai_nudge:
                    nudge = cls.generate_smart_nudge(churn_risk)
                else:
                    nudge = cls.get_default_nudge_template(churn_risk)
                churn_risk.suggested_nudge = nudge
                churn_risk.save(update_fields=["suggested_nudge"])

        return churn_risk

    @classmethod
    def get_default_nudge_template(
        cls,
        churn_risk: MemberChurnRisk,
    ) -> str:
        member = churn_risk.member
        community_name = member.community.name
        username = member.user.username
        return (
            f"Bonjour {username} ! On a remarqué que tu n'étais pas passé sur {community_name} ces derniers temps. "
            f"Est-ce que tu avances bien sur tes projets en cours, ou as-tu un point bloquant où la communauté "
            f"pourrait t'aider ? N'hésite pas à partager tes questions, on est là pour s'entraider !"
        )

    @classmethod
    def generate_smart_nudge(
        cls,
        churn_risk: MemberChurnRisk,
        custom_tone: str = "chaleureux et bienveillant",
    ) -> str:
        """
        Uses AI router to draft a personalized, helpful re-engagement message
        from the community creator to the inactive member.
        """
        member = churn_risk.member
        community_name = member.community.name
        username = member.user.username
        days_inactive = churn_risk.signals.get("days_inactive", 14)

        prompt = (
            f"Rédige un message court (maximum 80 mots), {custom_tone}, envoyé par l'administrateur de la "
            f"communauté '{community_name}' au membre '{username}'.\n"
            f"Le membre n'a pas été actif depuis {days_inactive} jours. "
            f"Le but est de prendre des nouvelles de manière non-intrusive, de lui demander s'il bloque sur un projet "
            f"ou un concept technique, et de lui rappeler qu'il est toujours le bienvenu.\n"
            f"Ne mets aucun placeholder comme [Nom], utilise '{username}' et '{community_name}' directement."
        )

        try:
            response = ai_router.generate_text(
                prompt=prompt,
                community=member.community,
                system_instruction="Tu es un community manager senior bienveillant spécialisé dans l'engagement des développeurs.",
                max_tokens=250,
                temperature=0.7,
            )
            nudge = (
                response.strip()
                if isinstance(response, str)
                else getattr(response, "content", "").strip()
            )
            if nudge:
                return nudge
        except Exception as exc:
            logger.warning("AI generation failed for smart nudge: %s", exc)

        # Fallback template
        return (
            f"Bonjour {username} ! On a remarqué que tu n'étais pas passé sur {community_name} ces derniers temps. "
            f"Est-ce que tu avances bien sur tes projets en cours, ou as-tu un point bloquant où la communauté "
            f"pourrait t'aider ? N'hésite pas à partager tes questions, on est là pour s'entraider !"
        )

    @classmethod
    def send_smart_nudge(
        cls,
        churn_risk_id: str,
        custom_message: Optional[str] = None,
        sender: Optional[User] = None,
    ) -> MemberChurnRisk:
        """
        Marks nudge as sent, records the message, and dispatches in-app notification.
        """
        churn_risk = MemberChurnRisk.objects.select_related(
            "member__user", "member__community"
        ).get(id=churn_risk_id)
        if custom_message:
            churn_risk.suggested_nudge = custom_message

        churn_risk.nudge_sent_at = timezone.now()
        churn_risk.status = "nudge_sent"
        churn_risk.save(update_fields=["suggested_nudge", "nudge_sent_at", "status"])

        # Dispatch real notification to the inactive member
        actor = sender or churn_risk.member.community.owner
        message_body = (
            custom_message
            or churn_risk.suggested_nudge
            or "Votre communauté prend de vos nouvelles !"
        )
        try:
            from apps.notifications.models.notification import NotificationType
            from apps.notifications.services.notification_service import (
                NotificationService,
            )

            NotificationService.create_notification(
                recipient=churn_risk.member.user,
                actor=actor,
                title=f"Message de votre communauté {churn_risk.member.community.name}",
                body=message_body[:280],
                notification_type=NotificationType.SYSTEM,
                action_url=f"/communities/{churn_risk.member.community.slug}",
                target_type="community",
                target_id=str(churn_risk.member.community_id),
                metadata={
                    "type": "smart_nudge",
                    "churn_risk_id": str(churn_risk.id),
                    "community_slug": churn_risk.member.community.slug,
                },
            )
        except Exception as exc:
            logger.warning(
                "Failed to dispatch in-app notification for smart nudge: %s", exc
            )

        logger.info(
            "Smart nudge sent to user %s in community %s",
            churn_risk.member.user.username,
            churn_risk.member.community.slug,
        )
        return churn_risk

    @classmethod
    def generate_or_refresh_nudge(cls, churn_risk_id: str) -> str:
        """
        Generates or refreshes a personalized AI nudge on-demand for a specific at-risk member.
        """
        churn_risk = MemberChurnRisk.objects.select_related(
            "member__user", "member__community"
        ).get(id=churn_risk_id)
        nudge = cls.generate_smart_nudge(churn_risk.member)
        churn_risk.suggested_nudge = nudge
        churn_risk.save(update_fields=["suggested_nudge", "updated_at"])
        return nudge

    @classmethod
    def evaluate_community_churn(
        cls,
        community: Community,
        limit: int = 50,
    ) -> list[MemberChurnRisk]:
        """
        Scans community members and returns the highest churn risks.
        Prioritizes inactive members and those without recent logins.
        """
        from django.db.models import F

        members = (
            CommunityMember.objects.filter(
                community=community,
                status=MembershipStatus.ACTIVE,
            )
            .select_related("user", "community")
            .order_by(
                F("user__last_login").asc(nulls_first=True),
                "-joined_at",
            )[:limit]
        )

        results = []
        for m in members:
            risk = cls.evaluate_member_churn_risk(m, generate_ai_nudge=False)
            results.append(risk)

        results.sort(key=lambda x: x.risk_score, reverse=True)
        return results


churn_prediction_service = ChurnPredictionService()
