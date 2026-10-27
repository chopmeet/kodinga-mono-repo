import { Navigate, useLocation } from 'react-router-dom';

import DashboardLayout from '@/layouts/dashboard-layout';
import { useAppSelector } from '@/redux/hook';

/**
 * /dashboard — the space of the signed-in user: overview, communities, billing and profile (the
 * sections are in the sidebar, see dashboard-sidebar). Each community keeps its own space, /c/:slug
 */
function Dashboard() {
  const signedIn = !!useAppSelector((s) => s.user.token);
  const { pathname, search } = useLocation();
  if (!signedIn) return <Navigate to={`/auth/login?next=${encodeURIComponent(pathname + search)}`} replace />;

  return <DashboardLayout />;
}

/** Old addresses of the user's space: /account/<section> and /c */
const legacy: Record<string, string> = {
  billing: '/dashboard/billing',
  profile: '/dashboard/profile/general',
  skills: '/dashboard/profile/skills',
  career: '/dashboard/profile/career',
  portfolio: '/dashboard/profile/portfolio',
  security: '/dashboard/profile/security',
};

export function LegacyAccountRedirect() {
  const { pathname } = useLocation();
  return <Navigate to={legacy[pathname.split('/')[2] ?? ''] ?? '/dashboard/profile'} replace />;
}

/** /c: the list of communities is now in the dashboard (the Pro payment return lands on billing) */
export function LegacyCommunitiesRedirect() {
  const { search, state } = useLocation();
  const payment = new URLSearchParams(search).get('payment');
  return <Navigate to={payment ? `/dashboard/billing${search}` : '/dashboard/communities'} replace state={state} />;
}

export default Dashboard;
