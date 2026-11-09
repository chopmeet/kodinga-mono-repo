import { Fragment, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useRoutes } from 'react-router-dom';

import { Toaster } from '@kodinga/ui';

import { useLogout } from '@/pages/auth/hooks/useLogout';
import { useAppDispatch, useAppSelector } from '@/redux/hook';
import { onSetUser } from '@/redux/slice/User.slice';
import { AppRoutes } from '@/routes/router';
import { useMeAccountQuery } from '@/utils/api/user/user.api';
import { useRealtimeSync } from '@/utils/realtime/use-realtime';
import { rememberReferral } from '@/utils/referral';
import { isTokenExpired } from '@/utils/secure';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Affiliate link (?ref=CODE): the code is kept for the next checkout */
function ReferralCapture() {
  const { search } = useLocation();
  useEffect(() => rememberReferral(search), [search]);
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

/** WebSocket of the realtime api for the signed-in user (notifications, messages, feeds) */
function RealtimeSync() {
  useRealtimeSync();
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
  const { token, refresh } = useAppSelector((s) => s.user);
  // An expired access token is renewed by authBaseQuery: the session only ends without a valid refresh token
  const expired = !!token && isTokenExpired(token) && (!refresh || isTokenExpired(refresh));
  const routes = useRoutes(AppRoutes);
  // A new language mounts the pages again: every text and date format follows it
  const { i18n } = useTranslation();

  return (
    <>
      <ScrollToTop />
      <ReferralCapture />
      {token && (expired ? <ExpiredSession /> : <FetchUser />)}
      {token && !expired && <RealtimeSync />}
      <Fragment key={i18n.resolvedLanguage}>{routes}</Fragment>
      {/* Renders the customToast notifications of the ui lib */}
      <Toaster richColors closeButton />
    </>
  );
}

export default App;
