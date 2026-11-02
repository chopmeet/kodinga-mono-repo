from apps.memberships.views.invitation import (
    AcceptInvitationTokenView,
    AcceptInvitationView,
    CommunityInvitationsView,
    CommunityShareableInviteLinkView,
    DeclineInvitationTokenView,
    DeclineInvitationView,
    MyReceivedInvitationsView,
    PublicInvitationDetailView,
    WorkspaceInvitationDetailView,
    WorkspaceInvitationResendView,
    WorkspaceInvitationsView,
)
from apps.memberships.views.member import (
    CommunityMemberDetailView,
    CommunityMemberListView,
    CommunityNotificationToggleView,
    JoinCommunityView,
    LeaveCommunityView,
    MemberSanctionsView,
    MyMembershipView,
    WorkspaceMemberDetailView,
    WorkspaceMembersListView,
)
from apps.memberships.views.rbac import CommunityRbacView
from django.urls import path

app_name = 'memberships'

urlpatterns = [
    # Workspaces / Invitations (Phase 2 Standard Endpoints)
    path('workspaces/<str:workspace_id>/invitations/', WorkspaceInvitationsView.as_view(), name='workspace_invitations'),
    path('workspaces/<str:workspace_id>/invitations/<uuid:invitation_id>/resend/', WorkspaceInvitationResendView.as_view(), name='workspace_invitation_resend'),
    path('workspaces/<str:workspace_id>/invitations/<uuid:invitation_id>/', WorkspaceInvitationDetailView.as_view(), name='workspace_invitation_detail'),

    # Legacy & Self-Service Invitation Routes
    path('invitations/my/', MyReceivedInvitationsView.as_view(), name='invitations_my'),
    path('invitations/accept/', AcceptInvitationView.as_view(), name='invitation_accept'),
    path('invitations/decline/', DeclineInvitationView.as_view(), name='invitation_decline'),

    # Invitation Token Public, Accept & Decline Endpoints
    path('invitations/<str:token>/accept/', AcceptInvitationTokenView.as_view(), name='invitation_token_accept'),
    path('invitations/<str:token>/decline/', DeclineInvitationTokenView.as_view(), name='invitation_token_decline'),
    path('communities/invitations/<str:token>/decline/', DeclineInvitationTokenView.as_view(), name='community_invitation_token_decline'),
    path('communities/invitations/<str:token>/accept/', AcceptInvitationTokenView.as_view(), name='community_invitation_token_accept'),
    path('invitations/<str:token>/', PublicInvitationDetailView.as_view(), name='public_invitation_detail'),

    # Workspaces / Members (Phase 2 Standard Endpoints)
    path('workspaces/<str:workspace_id>/members/', WorkspaceMembersListView.as_view(), name='workspace_members_list'),
    path('workspaces/<str:workspace_id>/members/<uuid:user_id>/', WorkspaceMemberDetailView.as_view(), name='workspace_member_detail'),

    # Legacy / Communities Routes (Fully Backward-Compatible)
    path('communities/<str:slug>/join/', JoinCommunityView.as_view(), name='community_join'),
    path('communities/<str:slug>/leave/', LeaveCommunityView.as_view(), name='community_leave'),
    path('communities/<str:slug>/rbac/', CommunityRbacView.as_view(), name='community_rbac'),
    path('communities/<str:slug>/members/me/', MyMembershipView.as_view(), name='community_my_membership'),
    path('communities/<str:slug>/my-membership/', MyMembershipView.as_view(), name='community_my_membership_alias'),
    path('communities/<str:slug>/members/', CommunityMemberListView.as_view(), name='community_members_list'),
    path('communities/<str:slug>/members/<uuid:member_id>/', CommunityMemberDetailView.as_view(), name='community_member_detail'),
    path('communities/<str:slug>/members/<uuid:member_id>/sanctions/', MemberSanctionsView.as_view(), name='community_member_sanction'),
    path('communities/<str:slug>/invitations/', CommunityInvitationsView.as_view(), name='community_invitations'),
    path('communities/<str:slug>/invitations/share-link/', CommunityShareableInviteLinkView.as_view(), name='community_shareable_invite_link'),

    # Notifications Bell
    path('communities/<str:slug>/notifications/toggle/', CommunityNotificationToggleView.as_view(), name='community_notifications_toggle'),
    path('communities/<str:slug>/notifications/', CommunityNotificationToggleView.as_view(), name='community_notifications'),
]
