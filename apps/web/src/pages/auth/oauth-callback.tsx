import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader } from '@kodinga/ui';

import { useAppDispatch } from '@/redux/hook';
import { onSetUserToken } from '@/redux/slice/User.slice';
import { useOauthCallbackMutation } from '@/utils/api/auth/auth.api';
import { parseApiError } from '@/utils/api/errors';
import AuthWrapper from './auth-wrapper';
import { FormAlert } from './components/form-alert';
import { isOAuthProvider, oauthRedirectUri, takeOAuthNext, takeOAuthState } from './hooks/oauth-state';

const linkClassName = 'font-semibold text-brand hover:text-brand-hover hover:underline';

function OAuthCallback() {
  const { t } = useTranslation();
  const { provider } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [oauthCallback] = useOauthCallbackMutation();
  const [error, setError] = useState<string | null>(null);
  const [loginUrl, setLoginUrl] = useState('/auth/login');
  // StrictMode runs effects twice in dev: a code can only be exchanged once
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!isOAuthProvider(provider)) {
      setError(t('auth.callback.unavailable'));
      return;
    }
    const expectedState = takeOAuthState(provider);
    const next = takeOAuthNext(provider);
    if (next !== '/') setLoginUrl(`/auth/login?next=${encodeURIComponent(next)}`);
    const code = params.get('code');
    const state = params.get('state') ?? '';
    // The provider sends back an error: refused by the user, or anything else on its side
    const providerError = params.get('error');
    if (providerError) {
      const name = provider === 'google' ? 'Google' : 'GitHub';
      setError(providerError === 'access_denied' ? t('auth.callback.cancelled') : t('auth.callback.providerFailed', { provider: name }));
      return;
    }
    if (!code || !expectedState || state !== expectedState) {
      setError(t('auth.callback.expired'));
      return;
    }

    oauthCallback({ provider, code, state, redirect_uri: oauthRedirectUri(provider) })
      .unwrap()
      .then((result) => {
        dispatch(onSetUserToken({ user: result.user, token: result.access, refresh: result.refresh }));
        navigate(next, { replace: true });
      })
      .catch((err) => setError(parseApiError(err).message));
  }, [provider, params, oauthCallback, dispatch, navigate, t]);

  if (error) {
    return (
      <AuthWrapper
        title={t('auth.callback.title')}
        footer={
          <Link to={loginUrl} className={linkClassName}>
            {t('auth.common.backToLogin')}
          </Link>
        }
      >
        <div className="flex flex-col gap-5">
          <FormAlert>{error}</FormAlert>
          <p className="text-[15px] text-slate-600">
            {t('auth.callback.retryBefore')}{' '}
            <Link to="/auth/register" className={linkClassName}>
              {t('auth.callback.registerWithEmail')}
            </Link>
            .
          </p>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper title={t('auth.callback.pendingTitle')}>
      <Loader inline size="sm" className="py-6" message={t('auth.callback.pending')} />
    </AuthWrapper>
  );
}

export default OAuthCallback;
