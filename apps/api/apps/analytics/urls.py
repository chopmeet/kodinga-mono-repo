from django.urls import path

from apps.analytics.views.analytics import (
    AnalyticsEngagementView,
    AnalyticsFinancialView,
    AnalyticsMetricsListView,
    AnalyticsOverviewView,
)

app_name = 'analytics'

urlpatterns = [
    path('analytics/overview/', AnalyticsOverviewView.as_view(), name='analytics_overview'),
    path('analytics/financial/', AnalyticsFinancialView.as_view(), name='analytics_financial'),
    path('analytics/engagement/', AnalyticsEngagementView.as_view(), name='analytics_engagement'),
    path('analytics/metrics/', AnalyticsMetricsListView.as_view(), name='analytics_metrics_list'),
]
