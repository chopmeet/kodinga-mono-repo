import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Toaster } from '@kodinga-mono-repo/ui';
import { adminCommunities } from '@/data/admin-communities.data';
import store from '@/redux/store';
import { must } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import CommunityDetails from './community-details';
import CommunityMembersTab from './tabs/members';
import CommunityPaymentsTab from './tabs/payments';
import CommunityPostsTab from './tabs/posts';
import CommunitySettingsTab from './tabs/settings';

// Network stubs + Radix menus: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });
const SLOW = { timeout: 3000 };

const renderAt = (path: string) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/communities/:slug" element={<CommunityDetails />}>
            <Route index element={<Navigate to="members" replace />} />
            <Route path="members" element={<CommunityMembersTab />} />
            <Route path="posts" element={<CommunityPostsTab />} />
            <Route path="payments" element={<CommunityPaymentsTab />} />
            <Route path="settings" element={<CommunitySettingsTab />} />
          </Route>
          <Route path="/admin/communities" element={<p>Liste</p>} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </Provider>
  );

const community = must(adminCommunities.find((c) => c.pricing_type === 'paid'));
const user = (id: string, first: string, last: string) => ({
  id,
  username: `${first}${last}`.toLowerCase(),
  first_name: first,
  last_name: last,
  full_name: `${first} ${last}`,
  email: `${first}@example.com`.toLowerCase(),
});
const member = (id: string, role: string, status: string, u: ReturnType<typeof user>) => ({
  id,
  user: u,
  role,
  status,
  custom_title: '',
  joined_at: '2026-05-01T10:00:00Z',
  reputation_score: 12,
  created_at: '2026-05-01T10:00:00Z',
});
const members = [
  member('m1', 'owner', 'active', user('u1', 'Chidi', 'Okafor')),
  member('m2', 'member', 'pending', user('u2', 'Awa', 'Ndiaye')),
  member('m3', 'member', 'active', user('u3', 'Kofi', 'Mensah')),
];
const posts = [
  {
    id: 'p1',
    community_id: community.id,
    author: user('u3', 'Kofi', 'Mensah'),
    title: 'Retour sur notre migration Kubernetes',
    content: '',
    post_type: 'discussion',
    is_pinned: false,
    is_locked: false,
    is_resolved: false,
    views_count: 40,
    reactions_count: 12,
    comments_count: 4,
    created_at: '2026-10-01T10:00:00Z',
  },
];
const detail = {
  ...community,
  description: '',
  user_membership: { is_member: false, role: null, status: null },
  settings: { allow_member_invites: true, require_approval_to_join: true, welcome_message: 'Bienvenue !', default_post_permission: 'all_members' },
  rules: [{ id: 'r1', title: 'Bienveillance avant tout', description: 'Respect des membres.', order: 0 }],
};

type Call = { method: string; url: URL; body: unknown };

/** Fake api of the page: routes on path, method and filters */
function stubCommunityApi() {
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    calls.push({ method: request.method, url, body: text ? JSON.parse(text) : null });
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    const page = (results: unknown[]) => json({ success: true, pagination: { count: results.length, page_size: 10 }, results });
    const path = url.pathname;

    if (path.endsWith(`/communities/${community.slug}/members/`)) {
      const status = url.searchParams.get('status');
      return page(members.filter((m) => !status || m.status === status));
    }
    if (path.endsWith(`/communities/${community.slug}/feed/`)) return page(posts);
    if (path.endsWith(`/communities/${community.slug}/`)) return json({ success: true, data: detail });
    if (path.includes('/communities/') && request.method === 'GET') return json({ success: false, code: 'not_found', message: 'Communauté introuvable.' }, 404);
    return json({ success: true, data: {} }, request.method === 'POST' ? 201 : 200);
  });
  return calls;
}

const openMenu = async (label: string) => {
  const trigger = await screen.findByRole('button', { name: label }, SLOW);
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return screen.findByRole('menu', {}, SLOW);
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Admin community details', () => {
  it('shows the community of the api, its pending requests and its members', async () => {
    stubCommunityApi();
    renderAt(`/admin/communities/${community.slug}`);
    expect(await screen.findByRole('heading', { level: 1, name: community.name }, SLOW)).toBeTruthy();
    const pendingCard = screen.getByText("Demandes d'adhésion en attente").closest('div')?.parentElement as HTMLElement;
    await waitFor(() => expect(within(pendingCard).getByText('1')).toBeTruthy(), SLOW);
    expect(await screen.findByText('Kofi Mensah', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Awa Ndiaye')).toBeTruthy();
    // No action on the owner
    expect(screen.queryByRole('button', { name: 'Actions pour Chidi Okafor' })).toBeNull();
  });

  it('approves a join request through the api', async () => {
    const calls = stubCommunityApi();
    renderAt(`/admin/communities/${community.slug}/members`);
    const menu = await openMenu('Actions pour Awa Ndiaye');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Approuver' }));
    expect(await screen.findByText('Awa Ndiaye a été approuvé.', {}, SLOW)).toBeTruthy();
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url.pathname).toMatch(/\/members\/m2\/$/);
    expect(put?.body).toEqual({ approve: true });
  });

  it('suspends a member with a reason and a duration', async () => {
    const calls = stubCommunityApi();
    renderAt(`/admin/communities/${community.slug}/members`);
    const menu = await openMenu('Actions pour Kofi Mensah');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Suspendre' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Spam répété dans le fil' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspendre' }));
    expect(await screen.findByText('Kofi Mensah est suspendu pour 7 jours.', {}, SLOW)).toBeTruthy();
    const post = calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/members/m3/sanctions/'));
    expect(post?.body).toEqual({ sanction_type: 'suspension', reason: 'Spam répété dans le fil', duration_days: 7 });
  });

  it('pins and deletes a post through the api', async () => {
    const calls = stubCommunityApi();
    renderAt(`/admin/communities/${community.slug}/posts`);
    let menu = await openMenu(`Actions pour ${posts[0].title}`);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Épingler' }));
    expect(await screen.findByText('Publication épinglée.', {}, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/posts/p1/pin/'))).toBe(true);

    menu = await openMenu(`Actions pour ${posts[0].title}`);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Supprimer' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText('Publication supprimée.', {}, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/posts/p1/'))).toBe(true);
  });

  it('shows the rules and settings that come with the community', async () => {
    stubCommunityApi();
    renderAt(`/admin/communities/${community.slug}/settings`);
    expect(await screen.findByText('Bienveillance avant tout', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Bienvenue !')).toBeTruthy();
  });

  it('says payments are not available yet for a paid community', async () => {
    stubCommunityApi();
    renderAt(`/admin/communities/${community.slug}/payments`);
    expect(await screen.findByText('Paiements bientôt disponibles', {}, SLOW)).toBeTruthy();
  });

  it('handles an unknown community', async () => {
    stubCommunityApi();
    renderAt('/admin/communities/nope');
    expect(await screen.findByText('Cette communauté est introuvable ou a été archivée.', {}, SLOW)).toBeTruthy();
  });
});
