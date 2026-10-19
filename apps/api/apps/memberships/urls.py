from django.urls import path

from apps.memberships.views.invitation import (
    AcceptInvitationTokenView,
    AcceptInvitationView,
    CommunityInvitationsView,
    PublicInvitationDetailView,
    WorkspaceInvitationDetailView,
    WorkspaceInvitationResendView,
    WorkspaceInvitationsView,
)
from apps.memberships.views.member import (
    CommunityMemberDetailView,
    CommunityMemberListView,
    JoinCommunityView,
    LeaveCommunityView,
    MemberSanctionsView,
    MyMembershipView,
    WorkspaceMemberDetailView,
    WorkspaceMembersListView,
)

app_name = 'memberships'

urlpatterns = [
    # Workspaces / Invitations (Phase 2 Standard Endpoints)
    path('workspaces/<str:workspace_id>/invitations/', WorkspaceInvitationsView.as_view(), name='workspace_invitations'),
    path('workspaces/<str:workspace_id>/invitations/<uuid:invitation_id>/resend/', WorkspaceInvitationResendView.as_view(), name='workspace_invitation_resend'),
    path('workspaces/<str:workspace_id>/invitations/<uuid:invitation_id>/', WorkspaceInvitationDetailView.as_view(), name='workspace_invitation_detail'),

    # Legacy / Communities Routes (Fully Backward-Compatible)
    path('invitations/accept/', AcceptInvitationView.as_view(), name='invitation_accept'),

    # Invitation Token Public & Accept Endpoints
    path('invitations/<str:token>/accept/', AcceptInvitationTokenView.as_view(), name='invitation_token_accept'),
    path('invitations/<str:token>/', PublicInvitationDetailView.as_view(), name='public_invitation_detail'),

    # Workspaces / Members (Phase 2 Standard Endpoints)
    path('workspaces/<str:workspace_id>/members/', WorkspaceMembersListView.as_view(), name='workspace_members_list'),
    path('workspaces/<str:workspace_id>/members/<uuid:user_id>/', WorkspaceMemberDetailView.as_view(), name='workspace_member_detail'),

    # Legacy / Communities Routes (Fully Backward-Compatible)
    path('communities/<str:slug>/join/', JoinCommunityView.as_view(), name='community_join'),
    path('communities/<str:slug>/leave/', LeaveCommunityView.as_view(), name='community_leave'),
    path('communities/<str:slug>/members/me/', MyMembershipView.as_view(), name='community_my_membership'),
    path('communities/<str:slug>/members/', CommunityMemberListView.as_view(), name='community_members_list'),
    path('communities/<str:slug>/members/<uuid:member_id>/', CommunityMemberDetailView.as_view(), name='community_member_detail'),
    path('communities/<str:slug>/members/<uuid:member_id>/sanctions/', MemberSanctionsView.as_view(), name='community_member_sanction'),
    path('communities/<str:slug>/invitations/', CommunityInvitationsView.as_view(), name='community_invitations'),
]

