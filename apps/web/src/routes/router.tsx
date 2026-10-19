import { Navigate, type RouteObject } from 'react-router-dom';

import AppLayout from '@/layouts/app-layout';
import DashboardLayout from '@/layouts/dashboard-layout';

import Home from '@/pages/public/home/home';
import CommunityDetails from '@/pages/public/community/community-details';
import PostDetails from '@/pages/public/community/post/post-details';
import CoursePlayerPage from '@/pages/public/community/course/course-player';
import HackathonPageView from '@/pages/public/community/hackathon/hackathon-page';
import Messages from '@/pages/public/messages/messages';
import ForgotPassword from '@/pages/auth/forgot-password';
import Login from '@/pages/auth/login';
import ResetPassword from '@/pages/auth/reset-password';
import OAuthCallback from '@/pages/auth/oauth-callback';
import Register from '@/pages/auth/register';
import CreateCommunity from '@/pages/public/create-community/create-community';
import AcceptInvitation from '@/pages/public/invitation/accept-invitation';
import PublicProfile from '@/pages/public/profile/public-profile';
import VerifyEmail from '@/pages/auth/verify-email';
import AdminCommunities from '@/pages/admin/communities/admin-communities';
import AdminCommunityDetails from '@/pages/admin/communities/community-details';
import CommunityMembersTab from '@/pages/admin/communities/tabs/members';
import CommunityPaymentsTab from '@/pages/admin/communities/tabs/payments';
import CommunityPostsTab from '@/pages/admin/communities/tabs/posts';
import CommunitySettingsTab from '@/pages/admin/communities/tabs/settings';
import AdminDashboard from '@/pages/admin/dashboard/admin-dashboard';
import CommunitySpaceLayout from '@/pages/community-space/community-space-layout';
import CommunityDashboardPage from '@/pages/community-space/dashboard/community-dashboard';
import CommunityMembers from '@/pages/community-space/members/community-members';
import MyCommunities from '@/pages/community-space/my-communities';
import CommunityPosts from '@/pages/community-space/posts/community-posts';
import CommunityEvents from '@/pages/community-space/events/community-events';
import EventDetails from '@/pages/community-space/events/event-details';
import CommunityHackathons from '@/pages/community-space/hackathons/community-hackathons';
import HackathonDetails from '@/pages/community-space/hackathons/hackathon-details';
import { EditHackathon, NewHackathon } from '@/pages/community-space/hackathons/hackathon-form';
import CommunityCourses from '@/pages/community-space/courses/community-courses';
import CourseBuilder from '@/pages/community-space/courses/course-builder';
import CommunityOpportunities from '@/pages/community-space/opportunities/community-opportunities';
import OpportunityDetails from '@/pages/community-space/opportunities/opportunity-details';
import CommunityLeaderboard from '@/pages/community-space/leaderboard/community-leaderboard';
import CommunityProjects from '@/pages/community-space/projects/community-projects';
import ProjectDetails from '@/pages/community-space/projects/project-details';
import CommunityPayments from '@/pages/community-space/payments/community-payments';
import PlansTab from '@/pages/community-space/payments/tabs/plans';
import SubscribersTab from '@/pages/community-space/payments/tabs/subscribers';
import TransactionsTab from '@/pages/community-space/payments/tabs/transactions';
import CommunitySettings from '@/pages/community-space/settings/community-settings';
import SpaceAccessTab from '@/pages/community-space/settings/tabs/access';
import SpaceDangerTab from '@/pages/community-space/settings/tabs/danger';
import SpaceGeneralTab from '@/pages/community-space/settings/tabs/general';
import SpaceRulesTab from '@/pages/community-space/settings/tabs/rules';
import SpaceAITab from '@/pages/community-space/settings/tabs/ai';
import SectionGuard from '@/pages/community-space/section-guard';
import AdminUsers from '@/pages/admin/users/admin-users';
import AdminSettings from '@/pages/admin/settings/admin-settings';
import AdministratorsSettingsTab from '@/pages/admin/settings/tabs/administrators';
import CategoriesSettingsTab from '@/pages/admin/settings/tabs/categories';
import GeneralSettingsTab from '@/pages/admin/settings/tabs/general';
import LegalPageTab from '@/pages/admin/settings/tabs/legal-page';
import MonetizationSettingsTab from '@/pages/admin/settings/tabs/monetization';
import NotFound from '@/pages/extra/not-found';

import { 
  IsAdminAllow, 
  RedirectAuthRoute 
} from './routerUtils';



export const AppRoutes: RouteObject[] = [
  {
    path: '/auth',
    children: [
      {
        index: true,
        element: <Navigate to="/auth/login" replace />,
      },
      {
        path: 'login',
        element: (
          <RedirectAuthRoute>
            <Login />
          </RedirectAuthRoute>
        ),
      },
      {
        path: 'forgot-password',
        element: (
          <RedirectAuthRoute>
            <ForgotPassword />
          </RedirectAuthRoute>
        ),
      },
      {
        path: 'reset-password',
        element: <ResetPassword />,
      },
      {
        path: 'register',
        element: (
          <RedirectAuthRoute>
            <Register />
          </RedirectAuthRoute>
        ),
      },
      {
        // Link of the registration email (FRONTEND_URL/auth/verify-email?token=...)
        path: 'verify-email',
        element: <VerifyEmail />,
      },
      {
        // Google / GitHub send the browser back here (?code=&state=)
        path: 'callback/:provider',
        element: <OAuthCallback />,
      },
    ],
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'communities/:slug',
        element: <CommunityDetails />,
      },
      {
        path: 'communities/:slug/courses/:courseSlug',
        element: <CoursePlayerPage />,
      },
      {
        path: 'communities/:slug/hackathons/:hackathonSlug',
        element: <HackathonPageView />,
      },
      {
        path: 'communities/:slug/posts/:postId',
        element: <PostDetails />,
      },
      {
        path: 'messages',
        element: <Messages />,
      },
      {
        path: 'messages/:conversationId',
        element: <Messages />,
      },
      {
        path: 'invitations/:code',
        element: <AcceptInvitation />,
      },
      {
        path: 'profiles/:username',
        element: <PublicProfile />,
      },
      {
        // Communities managed by the signed-in user (owner / admin / moderator)
        path: 'c',
        element: <MyCommunities />,
      },
    ],
  },
  {
    // Creation flow, full screen (open to visitors: the account is asked at the last step)
    path: '/create-community',
    element: <CreateCommunity />,
  },
  {
    // Community space: /c/<community slug>/..., menus depend on the role in that community
    path: '/c/:slug',
    element: <CommunitySpaceLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <CommunityDashboardPage /> },
      { path: 'members', element: <SectionGuard section="members"><CommunityMembers /></SectionGuard> },
      { path: 'posts', element: <SectionGuard section="posts"><CommunityPosts /></SectionGuard> },
      { path: 'events', element: <SectionGuard section="events"><CommunityEvents /></SectionGuard> },
      { path: 'events/:eventId', element: <SectionGuard section="events"><EventDetails /></SectionGuard> },
      { path: 'hackathons', element: <SectionGuard section="hackathons"><CommunityHackathons /></SectionGuard> },
      { path: 'hackathons/new', element: <SectionGuard section="hackathons"><NewHackathon /></SectionGuard> },
      { path: 'hackathons/:hackathonSlug', element: <SectionGuard section="hackathons"><HackathonDetails /></SectionGuard> },
      { path: 'hackathons/:hackathonSlug/edit', element: <SectionGuard section="hackathons"><EditHackathon /></SectionGuard> },
      { path: 'courses', element: <SectionGuard section="courses"><CommunityCourses /></SectionGuard> },
      { path: 'courses/:courseSlug', element: <SectionGuard section="courses"><CourseBuilder /></SectionGuard> },
      { path: 'opportunities', element: <SectionGuard section="opportunities"><CommunityOpportunities /></SectionGuard> },
      { path: 'opportunities/:opportunitySlug', element: <SectionGuard section="opportunities"><OpportunityDetails /></SectionGuard> },
      { path: 'leaderboard', element: <SectionGuard section="leaderboard"><CommunityLeaderboard /></SectionGuard> },
      { path: 'projects', element: <SectionGuard section="projects"><CommunityProjects /></SectionGuard> },
      { path: 'projects/:projectSlug', element: <SectionGuard section="projects"><ProjectDetails /></SectionGuard> },
      {
        path: 'payments',
        element: <SectionGuard section="payments"><CommunityPayments /></SectionGuard>,
        children: [
          { index: true, element: <Navigate to="plans" replace /> },
          { path: 'plans', element: <PlansTab /> },
          { path: 'subscribers', element: <SubscribersTab /> },
          { path: 'transactions', element: <TransactionsTab /> },
        ],
      },
      {
        path: 'settings',
        element: <SectionGuard section="settings"><CommunitySettings /></SectionGuard>,
        children: [
          { index: true, element: <Navigate to="general" replace /> },
          { path: 'general', element: <SpaceGeneralTab /> },
          { path: 'access', element: <SpaceAccessTab /> },
          { path: 'rules', element: <SpaceRulesTab /> },
          { path: 'ai', element: <SpaceAITab /> },
          { path: 'danger', element: <SectionGuard section="danger"><SpaceDangerTab /></SectionGuard> },
        ],
      },
      { path: '*', element: <Navigate to="dashboard" replace /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <IsAdminAllow>
        <DashboardLayout />
      </IsAdminAllow>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/admin/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <AdminDashboard />,
      },
      {
        path: 'communities',
        element: <AdminCommunities />,
      },
      {
        path: 'users',
        element: <AdminUsers />,
      },
      {
        path: 'settings',
        element: <AdminSettings />,
        children: [
          { index: true, element: <Navigate to="administrators" replace /> },
          { path: 'administrators', element: <AdministratorsSettingsTab /> },
          { path: 'general', element: <GeneralSettingsTab /> },
          { path: 'categories', element: <CategoriesSettingsTab /> },
          { path: 'monetization', element: <MonetizationSettingsTab /> },
          { path: 'terms', element: <LegalPageTab key="terms" pageId="terms" /> },
          { path: 'privacy', element: <LegalPageTab key="privacy" pageId="privacy" /> },
          { path: 'refund', element: <LegalPageTab key="refund" pageId="refund" /> },
        ],
      },
      {
        path: 'communities/:slug',
        element: <AdminCommunityDetails />,
        children: [
          {
            index: true,
            element: <Navigate to="members" replace />,
          },
          {
            path: 'members',
            element: <CommunityMembersTab />,
          },
          {
            path: 'posts',
            element: <CommunityPostsTab />,
          },
          {
            path: 'payments',
            element: <CommunityPaymentsTab />,
          },
          {
            path: 'settings',
            element: <CommunitySettingsTab />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
];
