import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAppSelector } from '@/redux/hook';
import { isAdmin } from '@/utils/Utils';

/** Login & co: already-authenticated users are sent to their home. */
export const RedirectAuthRoute = ({ children }: { children: ReactElement }) => {
  const { token, user } = useAppSelector((state) => state.user);

  if (!token) return children;
  return <Navigate to={isAdmin(user) ? '/admin/dashboard' : '/'} replace />;
};

/** Admin area: requires a token and an admin user, otherwise go to login. */
export const IsAdminAllow = ({ children }: { children: ReactElement }) => {
  const { token, user } = useAppSelector((state) => state.user);
  const { pathname } = useLocation();

  if (!token) {
    return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  }
  if (!isAdmin(user)) return <Navigate to="/" replace />;
  return children;
};
