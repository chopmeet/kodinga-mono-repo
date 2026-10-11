import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { getAdminCommunity } from '@/data/admin-community-details.data';
import store from '@/redux/store';
import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import { must, renderAppAt, SLOW, stubApi } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { CommunityRole } from '@/utils/api/community/community.type';
import type { User } from '@/utils/api/user/user.type';

// Full app tree + network stubs: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });

const signIn = () =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', first_name: 'Awa' } as User, token: 'access', refresh: 'refresh' }));
  });

const ok = (data: unknown) => ({ body: { success: true, data } });

/** communities/my/ + one detail per community (the role lives in user_membership) */
function stubMyCommunities(memberships: [slug: string, role: CommunityRole][]) {
  const communities = memberships.map(([slug]) => must(getAdminCommunity(slug), slug));
  return stubApi({
    'communities/my/': { body: { success: true, pagination: { count: communities.length }, results: communities } },
    ...Object.fromEntries(
      memberships.map(([slug, role], i) => [
        `communities/${slug}/`,
        ok({ ...communities[i], description: '', user_membership: { is_member: true, role, status: 'active' } }),
      ])
    ),
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('My communities /c', () => {
  it('lists the communities the user manages, with the role, not the ones they only joined', async () => {
    signIn();
    stubMyCommunities([
      ['lagos-ai-data', 'owner'],
      ['python-africa-core', 'moderator'],
      ['dakar-devops', 'member'],
    ]);
    renderAppAt('/c');
    await screen.findByText('Propriétaire', {}, SLOW);
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('link')).toHaveLength(2);
    expect(within(list).getByText('Propriétaire')).toBeTruthy();
    expect(within(list).getByText('Modérateur')).toBeTruthy();
    expect(within(list).queryByText(/Dakar DevOps/)).toBeNull();
  });

  it('goes straight to the space when the user manages one community', async () => {
    signIn();
    stubMyCommunities([['lagos-ai-data', 'owner']]);
    const { where } = renderAppAt('/c');
    await waitFor(() => expect(where()).toBe('/c/lagos-ai-data/dashboard'), SLOW);
  });

  it('invites to create a first community when there is none', async () => {
    signIn();
    stubMyCommunities([]);
    renderAppAt('/c');
    expect(await screen.findByText('Vous ne gérez encore aucune communauté', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Créer ma communauté' }).getAttribute('href')).toBe('/create-community');
  });

  it('offers to retry when the api cannot be reached', async () => {
    signIn();
    stubApi({ 'communities/my/': { status: 500, body: { success: false, code: 'error', message: 'Erreur serveur.' } } });
    renderAppAt('/c');
    expect(await screen.findByText('Erreur serveur.', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('asks anonymous visitors to log in first', async () => {
    const { where } = renderAppAt('/c');
    await waitFor(() => expect(where()).toBe('/auth/login?next=/c'), SLOW);
  });
});

describe('Community space /c/:slug', () => {
  it('sends back to /c when the user does not manage the community', async () => {
    signIn();
    stubMyCommunities([['abidjan-flutter-devs', 'member']]);
    const { where } = renderAppAt('/c/abidjan-flutter-devs/dashboard');
    await waitFor(() => expect(where()).toBe('/c'), SLOW);
    expect((await screen.findByRole('alert', {}, SLOW)).textContent).toContain('abidjan-flutter-devs');
  });

  it('opens the dashboard by default', async () => {
    const { where } = renderAppAt('/c/dakar-devops');
    await waitFor(() => expect(where()).toBe('/c/dakar-devops/dashboard'));
    expect(screen.getByRole('heading', { name: 'Tableau de bord' })).toBeTruthy();
  });

  it('gives a moderator the management menus only', async () => {
    renderAppAt('/c/python-africa-core/dashboard');
    const nav = await screen.findByRole('link', { name: 'Membres' }, SLOW);
    expect(nav).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Publications' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Paramètres' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Abonnements & paiements' })).toBeNull();
    expect(screen.queryByText('Revenus (30 j)')).toBeNull();
  });

  it('keeps a moderator out of the settings by url', async () => {
    const { where } = renderAppAt('/c/python-africa-core/settings');
    await waitFor(() => expect(where()).toBe('/c/python-africa-core/dashboard'));
  });

  it('gives the owner the settings', async () => {
    renderAppAt('/c/dakar-devops/settings');
    expect(await screen.findByRole('heading', { name: 'Paramètres' }, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Paramètres' })).toBeTruthy();
  });

  it('keeps the current page when switching community', async () => {
    signIn();
    stubMyCommunities([
      ['dakar-devops', 'owner'],
      ['lagos-ai-data', 'owner'],
    ]);
    const { where } = renderAppAt('/c/dakar-devops/members');
    const trigger = await screen.findByRole('button', { name: /Changer de communauté/ }, SLOW);
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const menu = await screen.findByRole('menu', {}, SLOW);
    fireEvent.click(await within(menu).findByRole('menuitem', { name: /Lagos AI/ }, SLOW));
    await waitFor(() => expect(where()).toBe('/c/lagos-ai-data/members'));
  });
});
