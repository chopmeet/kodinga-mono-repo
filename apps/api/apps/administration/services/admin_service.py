import logging
import time
from typing import Any, Optional

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.utils import timezone

from apps.accounts.models.user import User
from apps.administration.models.audit import PlatformAuditLog
from apps.administration.models.setting import SystemSetting
from apps.analytics.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)


class AdministrationService:
    """
    Service handling platform-wide governance, system monitoring, audit logs, and user status toggling.
    """

    @classmethod
    def log_action(
        cls,
        action: str,
        actor: Optional[User] = None,
        target_type: str = "",
        target_id: str = "",
        details: Optional[dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: str = "",
    ) -> PlatformAuditLog:
        """
        Records a platform-level audit log entry.
        """
        return PlatformAuditLog.objects.create(
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent[:255] if user_agent else "",
        )

    @classmethod
    def check_system_health(cls) -> dict[str, Any]:
        """
        Verifies availability and latency of PostgreSQL, Redis cache, and storage subsystems.
        """
        now = timezone.now()
        health_report: dict[str, Any] = {
            "status": "healthy",
            "components": {},
            "checked_at": now.isoformat(),
        }

        # 1. Database check
        db_start = time.perf_counter()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()
            db_latency_ms = round((time.perf_counter() - db_start) * 1000, 2)
            health_report["components"]["database"] = {
                "status": "up",
                "latency_ms": db_latency_ms,
                "engine": connection.vendor,
            }
        except Exception as e:
            health_report["status"] = "degraded"
            health_report["components"]["database"] = {
                "status": "down",
                "error": str(e),
            }

        # 2. Redis / Cache check
        cache_start = time.perf_counter()
        try:
            test_key = "_admin_health_ping"
            cache.set(test_key, "pong", timeout=10)
            val = cache.get(test_key)
            cache_latency_ms = round((time.perf_counter() - cache_start) * 1000, 2)
            if val == "pong":
                health_report["components"]["cache"] = {
                    "status": "up",
                    "latency_ms": cache_latency_ms,
                }
            else:
                health_report["status"] = "degraded"
                health_report["components"]["cache"] = {
                    "status": "unresponsive",
                    "latency_ms": cache_latency_ms,
                }
        except Exception as e:
            health_report["status"] = "degraded"
            health_report["components"]["cache"] = {"status": "down", "error": str(e)}

        # 3. Media Storage check
        try:
            import os

            media_root = getattr(settings, "MEDIA_ROOT", "")
            storage_accessible = (
                os.path.exists(media_root) and os.access(media_root, os.W_OK)
                if media_root
                else True
            )
            health_report["components"]["storage"] = {
                "status": "up" if storage_accessible else "read_only",
                "media_root": str(media_root),
            }
        except Exception as e:
            health_report["components"]["storage"] = {
                "status": "error",
                "error": str(e),
            }

        return health_report

    @classmethod
    def toggle_user_status(
        cls,
        target_user: User,
        is_active: bool,
        actor: Optional[User] = None,
        reason: str = "",
        ip_address: Optional[str] = None,
    ) -> User:
        """
        Activates or suspends a platform user and logs the governance action.
        """
        prev_status = target_user.is_active
        target_user.is_active = is_active
        target_user.save(update_fields=["is_active"])

        action = "user.activate" if is_active else "user.suspend"
        cls.log_action(
            actor=actor,
            action=action,
            target_type="user",
            target_id=str(target_user.id),
            details={
                "prev_status": prev_status,
                "new_status": is_active,
                "reason": reason,
            },
            ip_address=ip_address,
        )
        return target_user

    @classmethod
    def toggle_superadmin(
        cls,
        target_user: User,
        is_superadmin: bool,
        actor: Optional[User] = None,
        ip_address: Optional[str] = None,
    ) -> User:
        """
        Promotes or demotes a superadmin account and logs the event.
        """
        prev_val = target_user.is_superadmin
        target_user.is_superadmin = is_superadmin
        if is_superadmin:
            target_user.is_superuser = True
            target_user.is_staff = True
            target_user.save(
                update_fields=["is_superadmin", "is_superuser", "is_staff"]
            )
        else:
            target_user.save(update_fields=["is_superadmin"])

        action = (
            "user.promote_superadmin" if is_superadmin else "user.demote_superadmin"
        )
        cls.log_action(
            actor=actor,
            action=action,
            target_type="user",
            target_id=str(target_user.id),
            details={
                "prev_is_superadmin": prev_val,
                "new_is_superadmin": is_superadmin,
            },
            ip_address=ip_address,
        )
        return target_user

    @classmethod
    def get_recent_platform_activities(cls, limit: int = 15) -> list[dict[str, Any]]:
        """
        Aggregates a unified multi-source feed of real recent platform activities:
        - New user signups (member)
        - New communities created (community)
        - Successful payments / subscriptions (payment)
        - New forum/community posts (post)
        - Platform governance & settings audit logs (admin / setting)
        """
        activities = []

        # 1. Recent user signups
        recent_users = User.objects.filter(is_active=True).order_by("-date_joined")[
            :limit
        ]
        for u in recent_users:
            uname = u.username or (
                u.email.split("@")[0] if u.email else "Nouveau membre"
            )
            joined_str = (
                u.date_joined.isoformat()
                if u.date_joined
                else timezone.now().isoformat()
            )
            activities.append(
                {
                    "id": f"user-{u.id}",
                    "type": "member",
                    "actor": uname,
                    "actor_username": uname,
                    "action": "s'est inscrit sur la plateforme",
                    "action_label": "s'est inscrit sur la plateforme",
                    "target": None,
                    "target_id": str(u.id),
                    "target_type": "user",
                    "created_at": joined_str,
                    "at": joined_str,
                }
            )

        # 2. Recent communities created
        try:
            from apps.communities.models.community import Community

            recent_communities = (
                Community.objects.filter(is_active=True)
                .select_related("owner")
                .order_by("-created_at")[:limit]
            )
            for c in recent_communities:
                c_actor = c.owner.username if c.owner else "Système"
                c_created = (
                    c.created_at.isoformat()
                    if c.created_at
                    else timezone.now().isoformat()
                )
                activities.append(
                    {
                        "id": f"comm-{c.id}",
                        "type": "community",
                        "actor": c_actor,
                        "actor_username": c_actor,
                        "action": f"a créé la communauté '{c.name}'",
                        "action_label": f"a créé la communauté '{c.name}'",
                        "target": c.name,
                        "target_id": str(c.id),
                        "target_type": "community",
                        "created_at": c_created,
                        "at": c_created,
                    }
                )
        except Exception as e:
            logger.warning("Error fetching recent communities for activity feed: %s", e)

        # 3. Recent successful payments
        try:
            from apps.billing.models.payment import Payment, PaymentStatus

            recent_payments = (
                Payment.objects.filter(status=PaymentStatus.PAID)
                .select_related("user", "plan", "plan__community")
                .order_by("-paid_at")[:limit]
            )
            for p in recent_payments:
                plan_name = p.plan.name if p.plan else "Formule"
                channel = (
                    f" ({p.payment_channel})"
                    if getattr(p, "payment_channel", None)
                    else ""
                )
                paid_time = p.paid_at or p.created_at or timezone.now()
                p_actor = p.user.username if p.user else "Membre"
                activities.append(
                    {
                        "id": f"pay-{p.id}",
                        "type": "payment",
                        "actor": p_actor,
                        "actor_username": p_actor,
                        "action": f"a souscrit à {plan_name}{channel}",
                        "action_label": f"a souscrit à {plan_name}{channel}",
                        "target": f"{int(p.amount)} {p.currency}",
                        "target_id": str(p.id),
                        "target_type": "payment",
                        "created_at": paid_time.isoformat(),
                        "at": paid_time.isoformat(),
                    }
                )
        except Exception as e:
            logger.warning("Error fetching recent payments for activity feed: %s", e)

        # 4. Recent posts
        try:
            from apps.posts.models.post import Post

            recent_posts = Post.objects.select_related("author", "community").order_by(
                "-created_at"
            )[:limit]
            for post in recent_posts:
                comm_name = post.community.name if post.community else "une communauté"
                p_author = post.author.username if post.author else "Membre"
                post_created = (
                    post.created_at.isoformat()
                    if post.created_at
                    else timezone.now().isoformat()
                )
                activities.append(
                    {
                        "id": f"post-{post.id}",
                        "type": "post",
                        "actor": p_author,
                        "actor_username": p_author,
                        "action": f"a publié dans {comm_name}",
                        "action_label": f"a publié dans {comm_name}",
                        "target": post.title[:40] if post.title else None,
                        "target_id": str(post.id),
                        "target_type": "post",
                        "created_at": post_created,
                        "at": post_created,
                    }
                )
        except Exception as e:
            logger.warning("Error fetching recent posts for activity feed: %s", e)

        # 5. Governance audit logs
        recent_logs = list(
            PlatformAuditLog.objects.select_related("actor").order_by("-created_at")[
                :limit
            ]
        )
        for log in recent_logs:
            act_type = (
                "admin"
                if any(k in log.action for k in ["admin", "suspend", "activate"])
                else "setting"
            )
            log_actor = log.actor.username if log.actor else "Système"
            log_created = (
                log.created_at.isoformat()
                if log.created_at
                else timezone.now().isoformat()
            )
            activities.append(
                {
                    "id": f"audit-{log.id}",
                    "type": act_type,
                    "actor": log_actor,
                    "actor_username": log_actor,
                    "action": log.action,
                    "action_label": log.action,
                    "target": log.target_id,
                    "target_id": log.target_id,
                    "target_type": log.target_type,
                    "created_at": log_created,
                    "at": log_created,
                }
            )

        # Sort combined activities by created_at descending and take top `limit`
        activities.sort(key=lambda x: x["created_at"], reverse=True)
        return activities[:limit]

    @classmethod
    def get_dashboard_summary(cls) -> dict[str, Any]:
        """
        Consolidates top metrics and recent platform activities for the superadmin dashboard.
        """
        overview = AnalyticsService.get_overview_metrics()
        recent_activities = cls.get_recent_platform_activities(limit=15)
        raw_audit_logs = [
            {
                "id": str(log.id),
                "action": log.action,
                "actor_username": log.actor.username if log.actor else "Système",
                "target_type": log.target_type,
                "target_id": log.target_id,
                "created_at": log.created_at.isoformat(),
            }
            for log in PlatformAuditLog.objects.select_related("actor").order_by(
                "-created_at"
            )[:10]
        ]

        return {
            "overview": overview,
            "recent_activities": recent_activities,
            "recent_audit_logs": recent_activities,
            "raw_audit_logs": raw_audit_logs,
        }

    @classmethod
    def get_setting(cls, key: str, default: Any = None) -> Any:
        try:
            setting = SystemSetting.objects.get(key=key)
            return setting.value
        except SystemSetting.DoesNotExist:
            return default

    @classmethod
    def set_setting(
        cls,
        key: str,
        value: Any,
        description: str = "",
        is_public: bool = False,
        actor: Optional[User] = None,
    ) -> SystemSetting:
        setting, _ = SystemSetting.objects.update_or_create(
            key=key,
            defaults={
                "value": value,
                "description": description,
                "is_public": is_public,
                "updated_by": actor,
            },
        )
        cls.log_action(
            actor=actor,
            action="system.update_setting",
            target_type="setting",
            target_id=key,
            details={"value": value},
        )
        return setting
