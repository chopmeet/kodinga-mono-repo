from django.urls import path
from apps.communities.views.community import (
    CategoryListView,
    CommunityDetailView,
    CommunityListCreateView,
    MyCommunitiesListView,
)
from apps.communities.views.settings import (
    CommunityRuleDetailView,
    CommunityRulesView,
    CommunitySettingsView,
)

app_name = 'communities'

urlpatterns = [
    # Explore & Directory
    path('communities/', CommunityListCreateView.as_view(), name='community_list_create'),
    path('communities/my/', MyCommunitiesListView.as_view(), name='my_communities'),
    path('communities/categories/', CategoryListView.as_view(), name='categories_list'),

    # Detail & Management
    path('communities/<slug:slug>/', CommunityDetailView.as_view(), name='community_detail'),
    path('communities/<slug:slug>/settings/', CommunitySettingsView.as_view(), name='community_settings'),
    path('communities/<slug:slug>/rules/', CommunityRulesView.as_view(), name='community_rules'),
    path('communities/<slug:slug>/rules/<uuid:rule_id>/', CommunityRuleDetailView.as_view(), name='community_rule_detail'),
]
