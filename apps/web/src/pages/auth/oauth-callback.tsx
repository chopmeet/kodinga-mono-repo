import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader } from '@kodinga-mono-repo/ui';

import { useAppDispatch } from '@/redux/hook';
import { onSetUserToken } from '@/redux/slice/User.slice';
import { useOauthCallbackMutation } from '@/utils/api/auth/auth.api';
import { parseApiError } from '@/utils/api/errors';
import AuthWrapper from './auth-wrapper';
import { FormAlert } from './components/form-alert';
import { isOAuthProvider, oauthRedirectUri, takeOAuthNext, takeOAuthState } from './hooks/oauth-state';

const linkClassName = 'font-semibold text-brand hover:text-brand-hover hover:underline';

/** /auth/callback/:provider — where Google / GitHub send the browser back (?code=&state=) */
function OAuthCallback() {
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
      setError('Ce mode de connexion n’est pas disponible.');
      return;
    }
    const expectedState = takeOAuthState(provider);
    const next = takeOAuthNext(provider);
    if (next !== '/') setLoginUrl(`/auth/login?next=${encodeURIComponent(next)}`);
    const code = params.get('code');
    const state = params.get('state') ?? '';
    if (params.get('error')) {
      setError('La connexion a été annulée.');
      return;
    }
    if (!code || !expectedState || state !== expectedState) {
      setError('Ce lien de connexion est invalide ou a expiré. Recommencez depuis Kodinga.');
      return;
    }

    oauthCallback({ provider, code, state, redirect_uri: oauthRedirectUri(provider) })
      .unwrap()
      .then((result) => {
        dispatch(onSetUserToken({ user: result.user, token: result.access, refresh: result.refresh }));
        navigate(next, { replace: true });
      })
      .catch((err) => setError(parseApiError(err).message));
  }, [provider, params, oauthCallback, dispatch, navigate]);

  if (error) {
    return (
      <AuthWrapper
        title="Connexion impossible"
        footer={
          <Link to={loginUrl} className={linkClassName}>
            Retour à la connexion
          </Link>
        }
      >
        <div className="flex flex-col gap-5">
          <FormAlert>{error}</FormAlert>
          <p className="text-[15px] text-slate-600">
            Vous pouvez réessayer ou{' '}
            <Link to="/auth/register" className={linkClassName}>
              créer un compte avec votre email
            </Link>
            .
          </p>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper title="Connexion en cours…">
      <Loader inline size="sm" className="py-6" message="Nous finalisons votre connexion." />
    </AuthWrapper>
  );
}

export default OAuthCallback;
