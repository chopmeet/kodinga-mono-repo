import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

const URL_PATH = '/invitations/CODE-123?community=abidjan-react';

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** Public detail of the community + POST invitations/accept/ */
function stubInvitationApi({ isMember = false, role = 'member', status = 'pending' } = {}) {
  const calls: Call[] = [];
  let currentIsMember = isMember;
  let currentRole = isMember ? 'member' : null;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

    if (url.pathname.endsWith('/communities/abidjan-react/')) {
      return json({
        success: true,
        data: {
          id: 'c1',
          name: 'Abidjan React',
          slug: 'abidjan-react',
          tagline: 'Les devs React de Côte d’Ivoire',
          avatar_url: '',
          brand_color: '#1D4ED8',
          members_count: 240,
          posts_count: 12,
          courses_count: 0,
          events_count: 0,
          privacy_type: 'public',
          pricing_type: 'free',
          banner_url: '',
          category: null,
          owner: { id: 'u-owner', username: 'yao', first_name: 'Yao', last_name: 'Kouassi' },
          user_membership: {
            is_member: currentIsMember,
            role: currentIsMember ? currentRole : null,
            status: currentIsMember ? 'active' : null,
          },
        },
      });
    }
    // Public details of an invitation sent by email (PublicInvitationDetailSerializer)
    if (url.pathname.endsWith('/invitations/TOKEN-MAIL/')) {
      return json({ success: true, data: { workspace_id: 'c1', workspace_name: 'Abidjan React', workspace_slug: 'abidjan-react', workspace_avatar_url: '', role: 'member', role_display: 'Membre', masked_email: 'a***@example.com', status, expires_at: '2026-11-30T10:00:00Z', is_valid: status === 'pending' } });
    }
    if (url.pathname.endsWith('/invitations/accept/')) {
      currentIsMember = true;
      currentRole = role;
      return json({ success: true, data: { id: 'm1', role, status: 'active' } });
    }
    if (url.pathname.endsWith('/users/me/')) return json({ success: true, data: { id: 'u1', username: 'awa' } });
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const signIn = () =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'awa' } as User, token: `${b64({ alg: 'HS256' })}.${b64({ exp: 4102444800 })}.sig`, refresh: 'r' }));
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Invitation link', () => {
  it('shows the community and asks a guest to sign in first, coming back here', async () => {
    stubInvitationApi();
    renderAppAt(URL_PATH);
    expect(await screen.findByRole('heading', { name: 'Abidjan React' }, SLOW)).toBeTruthy();
    expect(screen.getByText('240 membres')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Se connecter pour rejoindre' }).getAttribute('href')).toBe(`/auth/login?next=${encodeURIComponent(URL_PATH)}`);
  });

  it('joins the community with the code, then opens it', async () => {
    signIn();
    const calls = stubInvitationApi();
    const { where } = renderAppAt(URL_PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Rejoindre Abidjan React' }, SLOW));
    await waitFor(() => expect(where()).toBe('/communities/abidjan-react'), SLOW);
    expect(calls.find((c) => c.url.pathname.endsWith('/invitations/accept/'))?.body).toEqual({ invite_code: 'CODE-123' });
  });

  it('sends an invited moderator to the community space', async () => {
    signIn();
    stubInvitationApi({ role: 'moderator' });
    const { where } = renderAppAt(URL_PATH);
    fireEvent.click(await screen.findByRole('button', { name: 'Rejoindre Abidjan React' }, SLOW));
    await waitFor(() => expect(where()).toMatch(/^\/c\/abidjan-react/), SLOW);
  });

  it('tells a member they are already in', async () => {
    signIn();
    stubInvitationApi({ isMember: true });
    renderAppAt(URL_PATH);
    expect(await screen.findByText('Vous faites déjà partie de cette communauté.', {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Rejoindre/ })).toBeNull();
  });

  it('opens the link sent by email (/invite/), without the community in the url', async () => {
    signIn();
    const calls = stubInvitationApi();
    const { where } = renderAppAt('/invite/TOKEN-MAIL');
    expect(await screen.findByRole('heading', { name: 'Abidjan React' }, SLOW)).toBeTruthy();
    expect(screen.getByText('Invitation adressée à a***@example.com')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Rejoindre Abidjan React' }, SLOW));
    await waitFor(() => expect(where()).toBe('/communities/abidjan-react'), SLOW);
    expect(calls.find((c) => c.url.pathname.endsWith('/invitations/accept/'))?.body).toEqual({ invite_code: 'TOKEN-MAIL' });
  });

  it('says when an invitation was revoked', async () => {
    signIn();
    stubInvitationApi({ status: 'revoked' });
    renderAppAt('/invite/TOKEN-MAIL');
    expect((await screen.findByRole('alert', {}, SLOW)).textContent).toBe('Cette invitation a été révoquée par la communauté.');
    expect(screen.queryByRole('button', { name: /Rejoindre/ })).toBeNull();
  });
});
