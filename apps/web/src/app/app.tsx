import { useEffect } from 'react';
import { useLocation, useRoutes } from 'react-router-dom';

import { Toaster } from '@kodinga-mono-repo/ui';

import { useLogout } from '@/pages/auth/hooks/useLogout';
import { useAppDispatch, useAppSelector } from '@/redux/hook';
import { onSetUser } from '@/redux/slice/User.slice';
import { AppRoutes } from '@/routes/router';
import { useMeAccountQuery } from '@/utils/api/user/user.api';
import { isTokenExpired } from '@/utils/secure';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}


function FetchUser() {
  const { data, isSuccess, isError } = useMeAccountQuery();
  const dispatch = useAppDispatch();
  const { logout } = useLogout();

  useEffect(() => {
    if (isSuccess) dispatch(onSetUser(data));
    if (isError) logout();
    
  }, [isSuccess, isError, data, dispatch, logout]);

  return null;
}

function ExpiredSession() {
  const { logout } = useLogout();
  useEffect(() => {
    logout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function App() {
  const token = useAppSelector((s) => s.user.token);
  const expired = !!token && isTokenExpired(token);
  const routes = useRoutes(AppRoutes);

  return (
    <>
      <ScrollToTop />
      {token && (expired ? <ExpiredSession /> : <FetchUser />)}
      {routes}
      {/* Renders the customToast notifications of the ui lib */}
      <Toaster richColors closeButton />
    </>
  );
}

export default App;
