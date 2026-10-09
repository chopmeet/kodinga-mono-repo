import type { OAuthProvider } from '@/utils/api/auth/auth.type';

// The api does not check the OAuth "state": the front keeps it for the round trip and compares it
// on return (protects the callback against forged links). sessionStorage: this tab only.
const key = (provider: OAuthProvider) => `oauth_state_${provider}`;

export const oauthRedirectUri = (provider: OAuthProvider) => `${window.location.origin}/auth/callback/${provider}`;

export function saveOAuthState(provider: OAuthProvider, state: string) {
  try {
    sessionStorage.setItem(key(provider), state);
  } catch {
    // Storage blocked: the callback will refuse the return, the user can retry
  }
}

/** Reads then forgets the state (a callback link works once) */
export function takeOAuthState(provider: OAuthProvider): string | null {
  try {
    const state = sessionStorage.getItem(key(provider));
    sessionStorage.removeItem(key(provider));
    return state;
  } catch {
    return null;
  }
}

export const isOAuthProvider = (value: string | undefined): value is OAuthProvider => value === 'google' || value === 'github';

/** Full-page navigation to the provider (own function: tests replace it) */
export const leaveTo = (url: string) => window.location.assign(url);
