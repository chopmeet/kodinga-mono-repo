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

__all__ = [
    'CommunityListCreateView',
    'CommunityDetailView',
    'MyCommunitiesListView',
    'CategoryListCreateView',
    'CategoryDetailView',
    'CommunitySettingsView',
    'CommunityRulesView',
    'CommunityRuleDetailView',
]

