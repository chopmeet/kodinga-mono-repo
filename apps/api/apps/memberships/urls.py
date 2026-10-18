from django.urls import path

from apps.memberships.views.invitation import (
    AcceptInvitationView,
    CommunityInvitationsView,
)
from apps.memberships.views.member import (
    CommunityMemberDetailView,
    CommunityMemberListView,
    JoinCommunityView,
    LeaveCommunityView,
    MemberSanctionsView,
    MyMembershipView,
)

app_name = 'memberships'

urlpatterns = [
    # Join / Leave
    path('communities/<str:slug>/join/', JoinCommunityView.as_view(), name='community_join'),
    path('communities/<str:slug>/leave/', LeaveCommunityView.as_view(), name='community_leave'),
    path('communities/<str:slug>/members/me/', MyMembershipView.as_view(), name='community_my_membership'),

    # Members list & management
    path('communities/<str:slug>/members/', CommunityMemberListView.as_view(), name='community_members_list'),
    path('communities/<str:slug>/members/<uuid:member_id>/', CommunityMemberDetailView.as_view(), name='community_member_detail'),
    path('communities/<str:slug>/members/<uuid:member_id>/sanctions/', MemberSanctionsView.as_view(), name='community_member_sanction'),

    # Invitations
    path('communities/<str:slug>/invitations/', CommunityInvitationsView.as_view(), name='community_invitations'),
    path('invitations/accept/', AcceptInvitationView.as_view(), name='invitation_accept'),
]
