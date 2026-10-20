import { type BaseQueryFn, type FetchArgs, fetchBaseQuery, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

import { onRefreshTokens, USER_STORAGE_KEY } from '@/redux/slice/User.slice';
import { ApiBaseUrl } from '@/utils/http';
import { isTokenExpired } from '@/utils/secure';
import { AppStorage } from '@/utils/storage';
import type { AuthState } from './user/user.type';

// Shared by every *Api: attaches the JWT stored by User.slice
export const prepareHeaders = (headers: Headers, { getState }: { getState: () => unknown }) => {
  const token = (getState() as { user: AuthState }).user.token ?? AppStorage.getItem<AuthState>(USER_STORAGE_KEY)?.token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
};

const rawBaseQuery = fetchBaseQuery({ baseUrl: ApiBaseUrl, prepareHeaders });

/** Calls that never trigger a refresh: they work without a session, or are the refresh itself */
const NO_REFRESH = ['auth/login/', 'auth/register/', 'auth/token/refresh/', 'auth/logout/'];
const urlOf = (args: string | FetchArgs) => (typeof args === 'string' ? args : args.url);
const isAuthCall = (args: string | FetchArgs) => NO_REFRESH.some((path) => urlOf(args).startsWith(path));

const tokensOf = (state: unknown): AuthState => (state as { user: AuthState }).user;

/**
 * One refresh at a time for the whole app: the api rotates the refresh token on each use
 * (ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION), so two parallel refreshes would invalidate
 * each other. Every request that needs one waits for the same promise.
 */
let pending: Promise<boolean> | null = null;

function refreshSession(api: Parameters<BaseQueryFn>[1], extra: object): Promise<boolean> {
  pending ??= (async () => {
    const refresh = tokensOf(api.getState()).refresh;
    if (!refresh || isTokenExpired(refresh)) return false;
    // POST auth/token/refresh/ (SimpleJWT, no envelope): { access, refresh }
    const result = await rawBaseQuery({ url: 'auth/token/refresh/', method: 'POST', body: { refresh } }, api, extra);
    const data = result.data as { access?: string; refresh?: string } | undefined;
    if (!data?.access) return false;
    api.dispatch(onRefreshTokens({ token: data.access, refresh: data.refresh }));
    return true;
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/**
 * fetchBaseQuery with a silent session renewal:
 * - before a request, an expired access token is renewed first (no wasted 401);
 * - a 401 renews the session once, then replays the request.
 * When the refresh fails the 401 goes through: the store middleware then ends the session.
 */
export const authBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extra) => {
  if (pending) await pending;

  const { token, refresh } = tokensOf(api.getState());
  if (!isAuthCall(args) && token && refresh && isTokenExpired(token)) await refreshSession(api, extra);

  const result = await rawBaseQuery(args, api, extra);
  if (result.error?.status !== 401 || isAuthCall(args) || !tokensOf(api.getState()).refresh) return result;

  return (await refreshSession(api, extra)) ? rawBaseQuery(args, api, extra) : result;
};
