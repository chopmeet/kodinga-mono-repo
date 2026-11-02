from apps.communities.views.category import (
    CategoryDetailView,
    CategoryListCreateView,
)
from apps.communities.views.community import (
    CommunityDetailView,
    CommunityListCreateView,
    MyCommunitiesListView,
)
from apps.communities.views.settings import (
    CommunityRuleDetailView,
    CommunityRulesView,
    CommunitySettingsView,
)
from django.urls import path

app_name = 'communities'

urlpatterns = [
    # Explore & Directory
    path('communities/', CommunityListCreateView.as_view(), name='community_list_create'),
    path('communities/my/', MyCommunitiesListView.as_view(), name='my_communities'),
    # Categories
    path('communities/categories/', CategoryListCreateView.as_view(), name='categories_list_create'),
    path('communities/categories/<str:slug>/', CategoryDetailView.as_view(), name='category_detail'),

    # Detail & Management (accepts both community slug and UUID id)
    path('communities/<str:slug>/', CommunityDetailView.as_view(), name='community_detail'),
    path('communities/<str:slug>/settings/', CommunitySettingsView.as_view(), name='community_settings'),
    path('communities/<str:slug>/rules/', CommunityRulesView.as_view(), name='community_rules'),
    path('communities/<str:slug>/rules/<uuid:rule_id>/', CommunityRuleDetailView.as_view(), name='community_rule_detail'),
]
