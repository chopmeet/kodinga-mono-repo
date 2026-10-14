import logging
import time
from typing import Any, Dict, List, Optional
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
        target_type: str = '',
        target_id: str = '',
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: str = ''
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
            user_agent=user_agent[:255] if user_agent else ''
        )

    @classmethod
    def check_system_health(cls) -> Dict[str, Any]:
        """
        Verifies availability and latency of PostgreSQL, Redis cache, and storage subsystems.
        """
        now = timezone.now()
        health_report: Dict[str, Any] = {
            'status': 'healthy',
            'components': {},
            'checked_at': now.isoformat()
        }

        # 1. Database check
        db_start = time.perf_counter()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()
            db_latency_ms = round((time.perf_counter() - db_start) * 1000, 2)
            health_report['components']['database'] = {
                'status': 'up',
                'latency_ms': db_latency_ms,
                'engine': connection.vendor
            }
        except Exception as e:
            health_report['status'] = 'degraded'
            health_report['components']['database'] = {
                'status': 'down',
                'error': str(e)
            }

        # 2. Redis / Cache check
        cache_start = time.perf_counter()
        try:
            test_key = '_admin_health_ping'
            cache.set(test_key, 'pong', timeout=10)
            val = cache.get(test_key)
            cache_latency_ms = round((time.perf_counter() - cache_start) * 1000, 2)
            if val == 'pong':
                health_report['components']['cache'] = {
                    'status': 'up',
                    'latency_ms': cache_latency_ms
                }
            else:
                health_report['status'] = 'degraded'
                health_report['components']['cache'] = {
                    'status': 'unresponsive',
                    'latency_ms': cache_latency_ms
                }
        except Exception as e:
            health_report['status'] = 'degraded'
            health_report['components']['cache'] = {
                'status': 'down',
                'error': str(e)
            }

        # 3. Media Storage check
        try:
            import os
            media_root = getattr(settings, 'MEDIA_ROOT', '')
            storage_accessible = os.path.exists(media_root) and os.access(media_root, os.W_OK) if media_root else True
            health_report['components']['storage'] = {
                'status': 'up' if storage_accessible else 'read_only',
                'media_root': str(media_root)
            }
        except Exception as e:
            health_report['components']['storage'] = {
                'status': 'error',
                'error': str(e)
            }

        return health_report

    @classmethod
    def toggle_user_status(
        cls,
        target_user: User,
        is_active: bool,
        actor: Optional[User] = None,
        reason: str = '',
        ip_address: Optional[str] = None
    ) -> User:
        """
        Activates or suspends a platform user and logs the governance action.
        """
        prev_status = target_user.is_active
        target_user.is_active = is_active
        target_user.save(update_fields=['is_active'])

        action = 'user.activate' if is_active else 'user.suspend'
        cls.log_action(
            actor=actor,
            action=action,
            target_type='user',
            target_id=str(target_user.id),
            details={'prev_status': prev_status, 'new_status': is_active, 'reason': reason},
            ip_address=ip_address
        )
        return target_user

    @classmethod
    def toggle_superadmin(
        cls,
        target_user: User,
        is_superadmin: bool,
        actor: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> User:
        """
        Promotes or demotes a superadmin account and logs the event.
        """
        prev_val = target_user.is_superadmin
        target_user.is_superadmin = is_superadmin
        target_user.save(update_fields=['is_superadmin'])

        action = 'user.promote_superadmin' if is_superadmin else 'user.demote_superadmin'
        cls.log_action(
            actor=actor,
            action=action,
            target_type='user',
            target_id=str(target_user.id),
            details={'prev_is_superadmin': prev_val, 'new_is_superadmin': is_superadmin},
            ip_address=ip_address
        )
        return target_user

    @classmethod
    def get_dashboard_summary(cls) -> Dict[str, Any]:
        """
        Consolidates top metrics and recent platform audit logs for the superadmin dashboard.
        """
        overview = AnalyticsService.get_overview_metrics()
        recent_logs = list(
            PlatformAuditLog.objects.select_related('actor')
            .order_by('-created_at')[:10]
        )

        return {
            'overview': overview,
            'recent_audit_logs': [
                {
                    'id': str(log.id),
                    'action': log.action,
                    'actor_username': log.actor.username if log.actor else 'Système',
                    'target_type': log.target_type,
                    'target_id': log.target_id,
                    'created_at': log.created_at.isoformat(),
                }
                for log in recent_logs
            ]
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
        description: str = '',
        is_public: bool = False,
        actor: Optional[User] = None
    ) -> SystemSetting:
        setting, _ = SystemSetting.objects.update_or_create(
            key=key,
            defaults={
                'value': value,
                'description': description,
                'is_public': is_public,
                'updated_by': actor
            }
        )
        cls.log_action(
            actor=actor,
            action='system.update_setting',
            target_type='setting',
            target_id=key,
            details={'value': value}
        )
        return setting
