import logging
from datetime import timedelta
from decimal import Decimal
from typing import Any, Optional

from django.core.cache import cache
from django.db.models import Count, Sum
from django.utils import timezone

from apps.accounts.models.user import User
from apps.analytics.models.metric import MetricType, PlatformMetric
from apps.billing.models.payment import Payment, PaymentStatus
from apps.billing.models.subscription import Subscription, SubscriptionStatus
from apps.classroom.models.course import Course
from apps.classroom.models.progress import LessonProgress
from apps.communities.models.community import Community
from apps.posts.models.comment import Comment
from apps.posts.models.post import Post

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 300  # 5 minutes


class AnalyticsService:
    """
    Central service for computing, recording, and retrieving platform KPIs and metrics.
    Employs Redis caching for high performance on administrative dashboards.
    """

    @classmethod
    def get_overview_metrics(cls, force_refresh: bool = False) -> dict[str, Any]:
        """
        Retrieves global platform statistics (users, communities, posts, courses, revenue).
        Cached in Redis with a 5-minute TTL.
        """
        cache_key = "analytics:overview"
        if not force_refresh:
            try:
                cached = cache.get(cache_key)
                if cached is not None:
                    return cached
            except Exception as e:
                logger.warning("Cache get error for key %s: %s", cache_key, e)

        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)
        seven_days_ago = now - timedelta(days=7)
        one_day_ago = now - timedelta(days=1)

        # Users counts
        total_users = User.objects.count()
        active_users_30d = User.objects.filter(last_login__gte=thirty_days_ago).count()
        active_users_24h = User.objects.filter(last_login__gte=one_day_ago).count()
        new_users_7d = User.objects.filter(date_joined__gte=seven_days_ago).count()

        # Communities & Content
        total_communities = Community.objects.count()
        total_posts = Post.objects.count()
        total_comments = Comment.objects.count()

        # Classroom
        total_courses = Course.objects.count()
        total_lessons_completed = LessonProgress.objects.filter(is_completed=True).count()

        # Optional apps: Events, Projects, Opportunities
        total_events = 0
        try:
            from apps.events.models.event import Event
            total_events = Event.objects.count()
        except Exception:
            pass

        total_projects = 0
        try:
            from apps.projects.models.project import Project
            total_projects = Project.objects.count()
        except Exception:
            pass

        total_opportunities = 0
        try:
            from apps.opportunities.models.opportunity import Opportunity
            total_opportunities = Opportunity.objects.count()
        except Exception:
            pass

        # Financials
        paid_payments_agg = Payment.objects.filter(status=PaymentStatus.PAID).aggregate(
            total_revenue=Sum('amount'),
            total_count=Count('id')
        )
        total_revenue = float(paid_payments_agg['total_revenue'] or 0.0)
        total_paid_transactions = paid_payments_agg['total_count'] or 0
        active_subscriptions = Subscription.objects.filter(status=SubscriptionStatus.ACTIVE).count()

        data = {
            'users': {
                'total': total_users,
                'active_30d': active_users_30d,
                'active_24h': active_users_24h,
                'new_7d': new_users_7d,
            },
            'communities': {
                'total': total_communities,
            },
            'content': {
                'total_posts': total_posts,
                'total_comments': total_comments,
            },
            'learning': {
                'total_courses': total_courses,
                'lessons_completed': total_lessons_completed,
            },
            'ecosystem': {
                'total_events': total_events,
                'total_projects': total_projects,
                'total_opportunities': total_opportunities,
            },
            'financial': {
                'total_revenue': total_revenue,
                'total_paid_transactions': total_paid_transactions,
                'active_subscriptions': active_subscriptions,
            },
            'generated_at': now.isoformat(),
        }

        try:
            cache.set(cache_key, data, timeout=CACHE_TTL_SECONDS)
        except Exception as e:
            logger.warning("Failed to store overview metrics in cache: %s", e)

        return data

    @classmethod
    def get_financial_metrics(cls, force_refresh: bool = False) -> dict[str, Any]:
        """
        Detailed financial metrics: revenue breakdown, transactions, subscriptions.
        """
        cache_key = "analytics:financial"
        if not force_refresh:
            try:
                cached = cache.get(cache_key)
                if cached is not None:
                    return cached
            except Exception as e:
                logger.warning("Cache get error for key %s: %s", cache_key, e)

        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        # Revenue by currency
        revenue_by_currency = list(
            Payment.objects.filter(status=PaymentStatus.PAID)
            .values('currency')
            .annotate(total=Sum('amount'), count=Count('id'))
        )

        # Recent 30 days revenue
        recent_revenue_agg = Payment.objects.filter(
            status=PaymentStatus.PAID,
            paid_at__gte=thirty_days_ago
        ).aggregate(sum=Sum('amount'), count=Count('id'))

        # Subscriptions by status
        subscriptions_by_status = list(
            Subscription.objects.values('status').annotate(count=Count('id'))
        )

        # Recent transactions
        recent_payments = list(
            Payment.objects.filter(status=PaymentStatus.PAID)
            .order_by('-paid_at')[:10]
            .values('id', 'amount', 'currency', 'status', 'created_at', 'paid_at')
        )

        data = {
            'revenue_by_currency': revenue_by_currency,
            'recent_30d_revenue': float(recent_revenue_agg['sum'] or 0.0),
            'recent_30d_transactions': recent_revenue_agg['count'] or 0,
            'subscriptions_distribution': subscriptions_by_status,
            'recent_transactions': [
                {
                    'id': str(p['id']),
                    'amount': float(p['amount']),
                    'currency': p['currency'],
                    'status': p['status'],
                    'paid_at': p['paid_at'].isoformat() if p['paid_at'] else None,
                }
                for p in recent_payments
            ],
            'generated_at': now.isoformat(),
        }

        try:
            cache.set(cache_key, data, timeout=CACHE_TTL_SECONDS)
        except Exception as e:
            logger.warning("Failed to cache financial metrics: %s", e)

        return data

    @classmethod
    def get_engagement_metrics(cls, force_refresh: bool = False) -> dict[str, Any]:
        """
        Engagement metrics: DAU, WAU, posts per week, active learners.
        """
        cache_key = "analytics:engagement"
        if not force_refresh:
            try:
                cached = cache.get(cache_key)
                if cached is not None:
                    return cached
            except Exception as e:
                logger.warning("Cache get error for key %s: %s", cache_key, e)

        now = timezone.now()
        one_day_ago = now - timedelta(days=1)
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)

        dau = User.objects.filter(last_login__gte=one_day_ago).count()
        wau = User.objects.filter(last_login__gte=seven_days_ago).count()
        mau = User.objects.filter(last_login__gte=thirty_days_ago).count()

        posts_7d = Post.objects.filter(created_at__gte=seven_days_ago).count()
        comments_7d = Comment.objects.filter(created_at__gte=seven_days_ago).count()

        active_learners_30d = LessonProgress.objects.filter(
            updated_at__gte=thirty_days_ago
        ).values('user').distinct().count()

        data = {
            'dau': dau,
            'wau': wau,
            'mau': mau,
            'dau_mau_ratio': round((dau / mau) if mau > 0 else 0.0, 4),
            'posts_last_7d': posts_7d,
            'comments_last_7d': comments_7d,
            'active_learners_30d': active_learners_30d,
            'generated_at': now.isoformat(),
        }

        try:
            cache.set(cache_key, data, timeout=CACHE_TTL_SECONDS)
        except Exception as e:
            logger.warning("Failed to cache engagement metrics: %s", e)

        return data

    @classmethod
    def record_metric(
        cls,
        metric_name: str,
        value: Decimal | float | int,
        metric_type: str = MetricType.COUNTER,
        dimensions: Optional[dict[str, Any]] = None,
        period_start=None,
        period_end=None
    ) -> PlatformMetric:
        """
        Persists a metric snapshot for historical analytics reporting.
        """
        return PlatformMetric.objects.create(
            metric_name=metric_name,
            metric_type=metric_type,
            value=Decimal(str(value)),
            dimensions=dimensions or {},
            period_start=period_start,
            period_end=period_end,
        )

    @classmethod
    def invalidate_cache(cls) -> None:
        """
        Invalidates cached analytics views.
        """
        try:
            cache.delete_many(
                ["analytics:overview", "analytics:financial", "analytics:engagement"]
            )
        except Exception as e:
            logger.warning("Failed to invalidate analytics cache: %s", e)
