import { Navigate, type RouteObject } from 'react-router-dom';

import AppLayout from '@/layouts/app-layout';
import DashboardLayout from '@/layouts/dashboard-layout';

import Home from '@/pages/public/home/home';
import Blog from '@/pages/public/blog/blog';
import Login from '@/pages/auth/login';
import AdminDashboard from '@/pages/admin/dashboard/admin-dashboard';
import NotFound from '@/pages/extra/not-found';

import { IsAdminAllow, RedirectAuthRoute } from './routerUtils';

export const AppRoutes: RouteObject[] = [
  {
    path: 'login',
    element: (
      <RedirectAuthRoute>
        <Login />
      </RedirectAuthRoute>
    ),
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
        path: 'blog',
        element: <Blog />,
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
