import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

type Call = { method: string; path: string; body: Record<string, unknown> | null };

const invitation = (id: string, community_name: string, is_valid = true) => ({
  id,
  community_id: 'c1',
  community_name,
  community_slug: community_name.toLowerCase().replace(' ', '-'),
  community_avatar_url: '',
  email: 'awa@example.com',
  role: 'moderator',
  status: 'pending',
  expires_at: '2026-11-30T10:00:00Z',
  accepted_at: null,
  is_valid,
  invited_by: { id: 'u2', username: 'yao', first_name: 'Yao', last_name: 'Kouassi' },
  created_at: '2026-11-01T10:00:00Z',
});

function stubApi() {
  const calls: Call[] = [];
  let received = [invitation('i1', 'Abidjan React'), invitation('i2', 'Dakar DevOps'), invitation('i3', 'Vieille Invitation', false)];
  let teams = [{ id: 't1', team_id: 'team-1', team_name: 'Les Baobabs', hackathon_title: 'DevFest Abidjan', leader: { id: 'u9', username: 'yao', first_name: 'Yao', last_name: 'Kouassi' }, hackathon_slug: 'devfest', community_slug: 'abidjan-react', invited_at: '2026-11-01T10:00:00Z' }];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, path, body });
    const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (path.endsWith('/invitations/my/')) return json({ success: true, pagination: { count: received.length }, results: received });
    if (path.endsWith('/hackathons/teams/my-invitations/')) return json({ success: true, data: teams });
    if (path.endsWith('/invitations/i1/accept/') || path.endsWith('/invitations/i2/decline/')) {
      received = received.filter((i) => !path.includes(`/${i.id}/`));
      return json({ success: true, data: { id: 'm1', role: 'moderator', status: 'active' } });
    }
    if (path.endsWith('/hackathons/teams/respond-invite/')) {
      teams = [];
      return json({ success: true, data: {} });
    }
    if (path.endsWith('/users/me/')) return json({ success: true, data: { id: 'u1', username: 'awa' } });
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

describe('My invitations', () => {
  it('lists what waits for an answer, without the outdated ones', async () => {
    signIn();
    stubApi();
    renderAppAt('/dashboard/communities');
    const list = await screen.findByRole('list', { name: 'Mes invitations' }, SLOW);
    await within(list).findByText('Les Baobabs', {}, SLOW);
    expect(within(list).getByText(/DevFest Abidjan/)).toBeTruthy();
    expect(within(list).getByText('Invitation de Yao Kouassi')).toBeTruthy();
    expect(within(list).getByRole('link', { name: 'Abidjan React' }).getAttribute('href')).toBe('/invite/i1');
    expect(within(list).getAllByText(/Modérateur · invité par Yao Kouassi/)).toHaveLength(2);
    expect(within(list).getByRole('link', { name: 'Voir le hackathon' }).getAttribute('href')).toBe('/communities/abidjan-react/hackathons/devfest');
    expect(within(list).queryByText('Vieille Invitation')).toBeNull();
  });

  it('accepts or declines a community, by the id of the invitation', async () => {
    signIn();
    const calls = stubApi();
    renderAppAt('/notifications');
    fireEvent.click(await screen.findByRole('button', { name: 'Rejoindre Abidjan React' }, SLOW));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Rejoindre Abidjan React' })).toBeNull(), SLOW);
    expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/invitations/i1/accept/'))).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Refuser l’invitation de Dakar DevOps' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Rejoindre Dakar DevOps' })).toBeNull(), SLOW);
    expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/invitations/i2/decline/'))).toBe(true);
  });

  it('answers a team, then the section goes away with nothing left', async () => {
    signIn();
    const calls = stubApi();
    renderAppAt('/notifications');
    fireEvent.click(await screen.findByRole('button', { name: 'Rejoindre l’équipe Les Baobabs' }, SLOW));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/hackathons/teams/respond-invite/'))?.body).toEqual({ invitation_id: 't1', accept: true }), SLOW);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Rejoindre l’équipe Les Baobabs' })).toBeNull(), SLOW);
  });
});
