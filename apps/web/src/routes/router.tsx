import { Navigate, type RouteObject } from 'react-router-dom';

import AppLayout from '@/layouts/app-layout';
import DashboardLayout from '@/layouts/dashboard-layout';

import Home from '@/pages/public/home/home';
import CommunityDetails from '@/pages/public/community/community-details';
import ForgotPassword from '@/pages/auth/forgot-password';
import Login from '@/pages/auth/login';
import ResetPassword from '@/pages/auth/reset-password';
import OAuthCallback from '@/pages/auth/oauth-callback';
import Register from '@/pages/auth/register';
import CreateCommunity from '@/pages/public/create-community/create-community';
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
        path: 'communities/:id',
        element: <CommunityDetails />,
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
