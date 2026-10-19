import { act } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { AuthApi } from './auth/auth.api';
import { CommunityApi } from './community/community.api';
import { UserApi } from './user/user.api';
import type { User } from './user/user.type';

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
/** Fake JWT expiring in `seconds` (negative: already expired) */
const jwt = (name: string, seconds: number) => `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + seconds, n: name })}.sig`;

const OLD_ACCESS = jwt('old-access', 3600);
const EXPIRED_ACCESS = jwt('expired-access', -60);
const NEW_ACCESS = jwt('new-access', 3600);
const OLD_REFRESH = jwt('old-refresh', 86_400);
const NEW_REFRESH = jwt('new-refresh', 86_400);

type Seen = { path: string; auth: string | null; body: Record<string, unknown> | null };

/**
 * Api where only NEW_ACCESS is accepted; the refresh endpoint rotates the refresh token
 * (or refuses it when `refreshOk` is false), like SimpleJWT.
 */
function stubAuthApi({ refreshOk = true } = {}) {
  const seen: Seen[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    seen.push({ path: url.pathname, auth: request.headers.get('Authorization'), body: text ? JSON.parse(text) : null });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    if (url.pathname.endsWith('/auth/token/refresh/')) {
      // A small delay: parallel 401s must find the refresh in flight
      await new Promise((r) => setTimeout(r, 20));
      return refreshOk ? json({ access: NEW_ACCESS, refresh: NEW_REFRESH }) : json({ detail: 'Token is invalid or expired', code: 'token_not_valid' }, 401);
    }
    if (url.pathname.endsWith('/auth/login/')) return json({ success: false, code: 'invalid_credentials', message: 'Identifiants invalides.' }, 401);
    if (request.headers.get('Authorization') !== `Bearer ${NEW_ACCESS}`) return json({ detail: 'Token expired', code: 'token_not_valid' }, 401);
    if (url.pathname.endsWith('/users/me/')) return json({ success: true, data: { id: 'u1', username: 'fatou' } });
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return seen;
}

const signIn = (token: string, refresh: string | null = OLD_REFRESH) =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1' } as User, token, refresh }));
  });

const refreshCalls = (seen: Seen[]) => seen.filter((s) => s.path.endsWith('/auth/token/refresh/'));

afterEach(() => {
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(UserApi.util.resetApiState());
    store.dispatch(CommunityApi.util.resetApiState());
    store.dispatch(AuthApi.util.resetApiState());
  });
});

describe('Session refresh (authBaseQuery)', () => {
  it('renews the session on a 401 and replays the request with the new token', async () => {
    signIn(OLD_ACCESS);
    const seen = stubAuthApi();
    const result = await store.dispatch(UserApi.endpoints.meAccount.initiate());
    expect(result.data).toMatchObject({ id: 'u1' });

    expect(refreshCalls(seen)).toHaveLength(1);
    expect(refreshCalls(seen)[0].body).toEqual({ refresh: OLD_REFRESH });
    const me = seen.filter((s) => s.path.endsWith('/users/me/'));
    expect(me.map((s) => s.auth)).toEqual([`Bearer ${OLD_ACCESS}`, `Bearer ${NEW_ACCESS}`]);
    // The rotated refresh token replaces the old one (the api blacklisted it)
    expect(store.getState().user).toMatchObject({ token: NEW_ACCESS, refresh: NEW_REFRESH });
  });

  it('shares one refresh between parallel requests (the refresh token is single use)', async () => {
    signIn(OLD_ACCESS);
    const seen = stubAuthApi();
    const results = await Promise.all([
      store.dispatch(UserApi.endpoints.meAccount.initiate()),
      store.dispatch(CommunityApi.endpoints.getCommunityFeed.initiate({ slug: 'a', page: 1, page_size: 1 })),
      store.dispatch(CommunityApi.endpoints.getConversations.initiate()),
    ]);
    expect(results.every((r) => !r.error)).toBe(true);
    expect(refreshCalls(seen)).toHaveLength(1);
  });

  it('renews an expired access token before sending, without a wasted 401', async () => {
    signIn(EXPIRED_ACCESS);
    const seen = stubAuthApi();
    await store.dispatch(UserApi.endpoints.meAccount.initiate());
    expect(seen.map((s) => s.path.replace(/^.*\/api\/v1/, ''))).toEqual(['/auth/token/refresh/', '/users/me/']);
    expect(seen[1].auth).toBe(`Bearer ${NEW_ACCESS}`);
  });

  it('ends the session when the refresh token is refused', async () => {
    signIn(OLD_ACCESS);
    const seen = stubAuthApi({ refreshOk: false });
    const result = await store.dispatch(UserApi.endpoints.meAccount.initiate());
    expect(result.error).toMatchObject({ status: 401 });
    expect(refreshCalls(seen)).toHaveLength(1);
    expect(store.getState().user).toMatchObject({ token: null, refresh: null });
  });

  it('never refreshes for a failed login', async () => {
    signIn(OLD_ACCESS);
    const seen = stubAuthApi();
    await store.dispatch(AuthApi.endpoints.loginUser.initiate({ email: 'a@b.c', password: 'nope' }));
    expect(refreshCalls(seen)).toHaveLength(0);
  });
});
