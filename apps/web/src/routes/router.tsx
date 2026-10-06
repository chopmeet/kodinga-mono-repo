import { Navigate, type RouteObject, useLocation } from 'react-router-dom';

import AppLayout from '@/layouts/app-layout';
import DashboardLayout from '@/layouts/dashboard-layout';

import Home from '@/pages/public/home/home';
import CommunityDetails from '@/pages/public/community/community-details';
import ForgotPassword from '@/pages/auth/forgot-password';
import Login from '@/pages/auth/login';
import ResetPassword from '@/pages/auth/reset-password';
import AdminDashboard from '@/pages/admin/dashboard/admin-dashboard';
import NotFound from '@/pages/extra/not-found';

import { IsAdminAllow, RedirectAuthRoute } from './routerUtils';

/** Old /login links keep working (query string such as ?next= is preserved) */
function LegacyLoginRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/auth/login${search}`} replace />;
}

export const AppRoutes: RouteObject[] = [
  {
    // Paths match the links the api emails (e.g. FRONTEND_URL/auth/reset-password?token=...)
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
        // Not guarded: a signed-in user may still open a reset link from their inbox
        path: 'reset-password',
        element: <ResetPassword />,
      },
    ],
  },
  {
    path: 'login',
    element: <LegacyLoginRedirect />,
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
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
];
