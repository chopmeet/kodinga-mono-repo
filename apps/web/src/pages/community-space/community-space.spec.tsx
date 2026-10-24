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
function stubMyCommunities(memberships: [slug: string, role: CommunityRole][], extra: Parameters<typeof stubApi>[0] = {}) {
  const communities = memberships.map(([slug]) => must(getAdminCommunity(slug), slug));
  return stubApi({
    ...extra,
    'communities/my/': { body: { success: true, pagination: { count: communities.length }, results: communities } },
    ...Object.fromEntries(
      memberships.map(([slug, role], i) => [
        `communities/${slug}/`,
        ok({ ...communities[i], description: '', user_membership: { is_member: true, role, status: 'active' } }),
      ])
    ),
  });
}

/** A Kodinga Pro plan (no community) */
const proPlan = {
  id: 'pro-m',
  name: 'Pro mensuel',
  slug: 'pro-month',
  description: '',
  price: '5000.00',
  currency: 'XOF',
  billing_interval: 'month',
  interval_count: 1,
  community_id: null,
  community_name: null,
  features: ['Communautés payantes'],
  is_active: true,
  order: 1,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('My communities /c', () => {
  it('lists the communities the user manages, with the role, then the ones they only joined', async () => {
    signIn();
    stubMyCommunities([
      ['lagos-ai-data', 'owner'],
      ['python-africa-core', 'moderator'],
      ['dakar-devops', 'member'],
    ]);
    renderAppAt('/c');
    const managed = await screen.findByRole('list', { name: 'Communautés que je gère' }, SLOW);
    expect(within(managed).getAllByRole('link')).toHaveLength(2);
    expect(within(managed).getByText('Propriétaire')).toBeTruthy();
    expect(within(managed).getByText('Modérateur')).toBeTruthy();
    expect(within(managed).queryByText(/Dakar DevOps/)).toBeNull();
    // A plain member opens the public page, not the space
    const joined = screen.getByRole('list', { name: 'Communautés dont je suis membre' });
    expect(within(joined).getByRole('link', { name: /Dakar DevOps/ }).getAttribute('href')).toBe('/communities/dakar-devops');
  });

  it('stays on /c when the user manages one community', async () => {
    signIn();
    stubMyCommunities([['lagos-ai-data', 'owner']]);
    const { where } = renderAppAt('/c');
    const managed = await screen.findByRole('list', { name: 'Communautés que je gère' }, SLOW);
    expect(within(managed).getByRole('link').getAttribute('href')).toBe('/c/lagos-ai-data/dashboard');
    expect(where()).toBe('/c');
  });

  it('sends to PayDunya to become Pro, and tells a Pro member their plan', async () => {
    signIn();
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, origin: 'http://localhost:4200', assign } });
    try {
      const calls = stubMyCommunities([], {
        'billing/plans/': ok([proPlan]),
        'billing/subscriptions/me/': ok([]),
        'billing/checkout/': ok({ payment_id: 'pay1', token: 't', checkout_url: 'https://paydunya.com/checkout/t', amount: '5000', currency: 'XOF', plan_name: 'Pro mensuel' }),
      });
      renderAppAt('/c');
      const plans = await screen.findByRole('list', { name: 'Formules Pro' }, SLOW);
      expect(within(plans).getByText('5 000 FCFA')).toBeTruthy();
      fireEvent.click(within(plans).getByRole('button', { name: 'Devenir Pro — Pro mensuel' }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith('https://paydunya.com/checkout/t'), SLOW);
      expect(calls.find((c) => c.url.endsWith('/billing/checkout/'))?.body).toEqual({
        plan_id: proPlan.id,
        return_url: 'http://localhost:4200/c?payment=done',
        cancel_url: 'http://localhost:4200/c?payment=cancelled',
      });
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('shows the Pro plan of a subscribed user', async () => {
    signIn();
    stubMyCommunities([], {
      'billing/plans/': ok([proPlan]),
      'billing/subscriptions/me/': ok([{ id: 'sub1', plan: proPlan, community_id: null, status: 'active', is_active: true, current_period_start: '2026-10-01T00:00:00Z', current_period_end: '2026-11-01T00:00:00Z', cancel_at_period_end: false, canceled_at: null, created_at: '2026-10-01T00:00:00Z' }]),
    });
    renderAppAt('/c');
    expect(await screen.findByText('Membre Pro', {}, SLOW)).toBeTruthy();
    const plans = screen.getByRole('list', { name: 'Formules Pro' });
    expect(within(plans).getByText('Votre formule')).toBeTruthy();
    expect(within(plans).queryByRole('button')).toBeNull();
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
