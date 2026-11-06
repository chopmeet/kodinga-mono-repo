import { LoaderCircle } from 'lucide-react';
import { type ReactElement, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useOauthStartMutation } from '@/utils/api/auth/auth.api';
import type { OAuthProvider } from '@/utils/api/auth/auth.type';
import { parseApiError } from '@/utils/api/errors';
import { leaveTo, oauthRedirectUri, saveOAuthState } from '../hooks/oauth-state';
import { FormAlert } from './form-alert';

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.52 11.52 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  );
}

function GithubLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 fill-slate-900" aria-hidden>
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57v-2.03c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.31-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.21.7.83.58A12 12 0 0 0 12 .3Z" />
    </svg>
  );
}

const providers: { id: OAuthProvider; label: string; logo: () => ReactElement }[] = [
  { id: 'google', label: 'Continuer avec Google', logo: GoogleLogo },
  { id: 'github', label: 'Continuer avec GitHub', logo: GithubLogo },
];

/** Asks the api for the provider url, keeps the state, then leaves for the provider */
export function OAuthButtons() {
  const [params] = useSearchParams();
  const [oauthStart] = useOauthStartMutation();
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (provider: OAuthProvider) => {
    setError(null);
    setPending(provider);
    try {
      const { url, state } = await oauthStart({ provider, redirect_uri: oauthRedirectUri(provider) }).unwrap();
      saveOAuthState(provider, state, params.get('next'));
      leaveTo(url);
    } catch (err) {
      setError(parseApiError(err).message);
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {error && <FormAlert>{error}</FormAlert>}
      {providers.map(({ id, label, logo: Logo }) => (
        <button
          key={id}
          type="button"
          onClick={() => start(id)}
          disabled={pending !== null}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-[15px] font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-brand/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending === id ? <LoaderCircle className="size-5 animate-spin" /> : <Logo />}
          {label}
        </button>
      ))}
    </div>
  );
}

/** Between the buttons of the providers and the form with an email */
export function EmailSeparator() {
  return (
    <div className="my-6 flex items-center gap-3 text-sm text-slate-400" role="separator">
      <span className="h-px flex-1 bg-slate-200" />
      ou avec votre email
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
