import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { getAdminCommunity } from '@/data/admin-community-details.data';
import store from '@/redux/store';
import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import { must, renderAppAt, SLOW, stubApi } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { CommunityRole } from '@/utils/api/community/community.type';
import type { User } from '@/utils/api/user/user.type';
import { rememberReferral } from '@/utils/referral';

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

/** communities/<slug>/me/dashboard/ and analytics/member/dashboard/ (MemberActivityDashboardResponseSerializer) */
const ACTIVITY = {
  kpis: {
    hackathons: { total_participated: 2, successful_count: 1, failed_count: 1, in_progress_count: 0, prizes_won_count: 1, submissions_count: 2, success_rate: 50 },
    events: { total_registered: 5, attended_count: 3, upcoming_count: 1, completed_count: 4, missed_count: 1, attendance_rate: 75 },
    opportunities: { total_applied: 4, accepted_count: 1, rejected_count: 1, in_review_count: 2, success_rate: 50 },
    courses: { total_enrolled: 2, completed_count: 1, in_progress_count: 1, total_lessons_completed: 14, average_progress_percent: 87.5 },
  },
  highlights: {
    recent_hackathons: [{ id: 'h1', title: 'Hackathon AgriTech', slug: 'agri', tagline: '', banner_url: null, status: 'completed', status_display: 'Terminé', start_time: '2026-09-01T09:00:00Z', end_time: '2026-09-03T18:00:00Z', community: { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', logo_url: '' }, participation_mode: 'team', team: { id: 't1', name: 'Les Baobabs', slug: 'baobabs', role: 'leader', is_leader: true }, submission: null, member_result: 'won', is_winner: true, is_podium: true }],
    upcoming_or_recent_events: [{ id: 'e1', title: 'Atelier Next.js', slug: 'atelier', event_type: 'workshop', event_type_display: 'Atelier', format: 'livekit', format_display: 'Live', status: 'scheduled', status_display: 'Programmé', start_time: '2026-11-20T18:00:00Z', end_time: '2026-11-20T20:00:00Z', community: { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', logo_url: '' }, rsvp_status: 'attending', rsvp_status_display: 'Inscrit', is_checked_in: false, is_upcoming: true, is_in_progress: false, is_completed: false }],
    recent_opportunity_applications: [{ id: 'a1', status: 'shortlisted', status_display: 'Présélectionné', applied_at: '2026-10-10T10:00:00Z', is_successful: false, is_failed: false, is_in_review: true, opportunity: { id: 'o1', title: 'Dev React', slug: 'dev-react', company_name: 'Wave', company_logo_url: '', opportunity_type_display: 'CDI' } }],
    active_courses: [{ id: 'en1', course_id: 'co1', title: 'React 19 en pratique', slug: 'react-19', level_display: 'Intermédiaire', thumbnail_url: '', community: { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', logo_url: '' }, enrolled_at: '2026-10-01T10:00:00Z', completed_at: null, overall_progress_percent: 60, total_lessons: 10, completed_lessons: 6, is_completed: false }],
  },
};

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

describe('Dashboard: my communities', () => {
  it('lists every community with the role, the space and member page for managers, the public page for members', async () => {
    signIn();
    stubMyCommunities([
      ['lagos-ai-data', 'owner'],
      ['python-africa-core', 'moderator'],
      ['dakar-devops', 'member'],
    ]);
    renderAppAt('/dashboard/communities');
    const list = await screen.findByRole('list', { name: 'Mes communautés' }, SLOW);
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: '3 communautés' })).toBeTruthy();
    const lagos = must(getAdminCommunity('lagos-ai-data'), 'lagos-ai-data');
    expect(within(list).getByRole('link', { name: `Administrer ${lagos.name}` }).getAttribute('href')).toBe('/c/lagos-ai-data/dashboard');
    expect(within(list).getByRole('link', { name: `Espace membre de ${lagos.name}` }).getAttribute('href')).toBe('/communities/lagos-ai-data');
    // A plain member opens the public page, not the space
    const devops = must(getAdminCommunity('dakar-devops'), 'dakar-devops');
    expect(within(list).getByRole('link', { name: `Ouvrir ${devops.name}` }).getAttribute('href')).toBe('/communities/dakar-devops');
    expect(within(list).queryByRole('link', { name: `Administrer ${devops.name}` })).toBeNull();
  });

  it('filters by role', async () => {
    signIn();
    stubMyCommunities([
      ['lagos-ai-data', 'owner'],
      ['python-africa-core', 'moderator'],
      ['dakar-devops', 'member'],
    ]);
    renderAppAt('/dashboard/communities');
    await screen.findByRole('list', { name: 'Mes communautés' }, SLOW);
    fireEvent.click(within(screen.getByRole('group', { name: 'Filtrer par rôle' })).getByRole('button', { name: 'Modérateur' }));
    const list = screen.getByRole('list', { name: 'Mes communautés' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText(/Modérateur/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: '1 communauté' })).toBeTruthy();
  });

  it('invites to create a first community when there is none', async () => {
    signIn();
    stubMyCommunities([]);
    renderAppAt('/dashboard/communities');
    expect(await screen.findByText('Vous n\'avez encore aucune communauté', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Créer ma communauté' }).getAttribute('href')).toBe('/create-community');
  });

  it('offers to retry when the api cannot be reached', async () => {
    signIn();
    stubApi({ 'communities/my/': { status: 500, body: { success: false, code: 'error', message: 'Erreur serveur.' } } });
    renderAppAt('/dashboard/communities');
    expect(await screen.findByText('Erreur serveur.', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('asks anonymous visitors to log in first', async () => {
    const { where } = renderAppAt('/dashboard/communities');
    await waitFor(() => expect(where()).toBe('/auth/login?next=%2Fdashboard%2Fcommunities'), SLOW);
  });

  it('sends the old /c address to the dashboard', async () => {
    signIn();
    stubMyCommunities([['lagos-ai-data', 'owner']]);
    const { where } = renderAppAt('/c');
    await waitFor(() => expect(where()).toBe('/dashboard/communities'), SLOW);
  });
});

describe('Dashboard: Kodinga Pro', () => {
  it('sends to PayDunya to become Pro, back to the billing page', async () => {
    signIn();
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, origin: 'http://localhost:4200', assign } });
    // Node's own localStorage has no backing file in the tests: one in memory, for the affiliate code
    const storage = new Map<string, string>();
    vi.spyOn(window, 'localStorage', 'get').mockReturnValue({
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    } as Storage);
    try {
      const calls = stubMyCommunities([], {
        'billing/plans/': ok([proPlan]),
        'billing/subscriptions/me/': ok([]),
        'billing/payments/my/': ok([]),
        'billing/checkout/': ok({ payment_id: 'pay1', token: 't', checkout_url: 'https://paydunya.com/checkout/t', amount: '5000', currency: 'XOF', plan_name: 'Pro mensuel' }),
      });
      // Arrived from an affiliate link (kept by App on any page): the code goes with the checkout
      rememberReferral('?ref=AMI2026');
      renderAppAt('/dashboard/billing');
      const plans = await screen.findByRole('list', { name: 'Formules Pro' }, SLOW);
      expect(within(plans).getByText('5 000 FCFA')).toBeTruthy();
      fireEvent.click(within(plans).getByRole('button', { name: 'Devenir Pro — Pro mensuel' }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith('https://paydunya.com/checkout/t'), SLOW);
      expect(calls.find((c) => c.url.endsWith('/billing/checkout/'))?.body).toEqual({
        plan_id: proPlan.id,
        return_url: 'http://localhost:4200/dashboard/billing?payment=done',
        cancel_url: 'http://localhost:4200/dashboard/billing?payment=cancelled',
        referral_code: 'AMI2026',
      });
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('shows the Pro plan of a subscribed user', async () => {
    signIn();
    stubMyCommunities([], {
      'billing/plans/': ok([proPlan]),
      'billing/payments/my/': ok([]),
      'billing/subscriptions/me/': ok([{ id: 'sub1', plan: proPlan, community_id: null, status: 'active', is_active: true, current_period_start: '2026-10-01T00:00:00Z', current_period_end: '2026-11-01T00:00:00Z', cancel_at_period_end: false, canceled_at: null, created_at: '2026-10-01T00:00:00Z' }]),
    });
    renderAppAt('/dashboard/billing');
    expect(await screen.findByText('Membre Pro', {}, SLOW)).toBeTruthy();
    const plans = screen.getByRole('list', { name: 'Formules Pro' });
    expect(within(plans).getByText('Votre formule')).toBeTruthy();
    expect(within(plans).queryByRole('button')).toBeNull();
  });

  it('lands the old Pro payment return of /c on the billing page', async () => {
    signIn();
    stubMyCommunities([], { 'billing/plans/': ok([proPlan]), 'billing/subscriptions/me/': ok([]), 'billing/payments/my/': ok([]) });
    const { where } = renderAppAt('/c?payment=cancelled');
    await waitFor(() => expect(where()).toBe('/dashboard/billing?payment=cancelled'), SLOW);
  });
});

describe('Dashboard: overview', () => {
  it('greets the user with their figures, and logs out', async () => {
    signIn();
    stubMyCommunities(
      [
        ['lagos-ai-data', 'owner'],
        ['dakar-devops', 'member'],
      ],
      {
        'billing/subscriptions/me/': ok([]),
        'profiles/me/': ok({ reputation_points: 340 }),
        'billing/communities/lagos-ai-data/revenue/': ok({ monthly_revenue: [{ month: new Date().toISOString().slice(0, 7), gross: '20000.00', fees: '2000.00', net: '18000.00', payments_count: 2 }] }),
        'analytics/member/dashboard/': ok(ACTIVITY),
        'gamification/reputation/me/': ok({ total_points: 1240, level: 6, rank_title: 'Expert', current_streak_days: 4, last_activity_date: '2026-10-31', badges_count: 1 }),
        'gamification/badges/my/': ok([{ id: 'ub1', badge: { id: 'b1', slug: 'first-post', name: 'Première publication', description: '', icon_url: '', category: 'community', points_reward: 10 }, community: null, awarded_at: '2026-10-01T10:00:00Z' }]),
        'gamification/reputation/history/': ok([{ id: 't1', community_id: 'c1', community_name: 'Lagos AI', community_slug: 'lagos-ai-data', action: 'post_created', action_label: 'Publication', points: 10, source: 'automatic', source_label: 'Automatique', awarded_by: null, description: '', created_at: '2026-10-30T10:00:00Z' }]),
      }
    );
    const { where } = renderAppAt('/dashboard');
    expect(await screen.findByRole('heading', { name: 'Bonjour, Awa' }, SLOW)).toBeTruthy();
    const figures = screen.getByRole('region', { name: 'Mes chiffres' });
    await waitFor(() => expect(within(figures).getByRole('link', { name: /Communautés rejointes/ }).textContent).toContain('2'), SLOW);
    expect(within(figures).getByRole('link', { name: /Communauté créée/ }).textContent).toContain('1');
    await waitFor(() => expect(within(figures).getByRole('link', { name: /Points de réputation/ }).textContent).toContain('340'), SLOW);
    // Net of this month over the paid communities owned (here one: its payments)
    const received = await within(figures).findByRole('link', { name: /Reçu ce mois-ci/ }, SLOW);
    await waitFor(() => expect(received.textContent).toMatch(/18\s000 FCFA/), SLOW);
    expect(received.getAttribute('href')).toBe('/c/lagos-ai-data/payments/transactions');
    // The activity across communities: each line says where it happened
    const figures2 = await screen.findByRole('group', { name: 'Mes indicateurs' }, SLOW);
    expect(within(figures2).getByText('Candidatures').parentElement?.textContent).toMatch(/4/);
    expect(within(screen.getByRole('region', { name: 'Mes événements' })).getByText(/Abidjan React/)).toBeTruthy();
    // Points across Kodinga, badges and the last gains
    const reputation = screen.getByRole('group', { name: 'Ma réputation' });
    await waitFor(() => expect(reputation.textContent).toMatch(/1\s240/), SLOW);
    expect(reputation.textContent).toMatch(/6 · Expert/);
    expect(await within(screen.getByRole('region', { name: 'Mes badges' })).findByText('Première publication', {}, SLOW)).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Derniers points' })).getByText(/Lagos AI/).parentElement?.parentElement?.textContent).toMatch(/\+10/);
    expect(screen.getByRole('link', { name: 'Facturation' }).getAttribute('href')).toBe('/dashboard/billing');
    fireEvent.click(within(screen.getByRole('region', { name: 'Session' })).getByRole('button', { name: 'Se déconnecter' }));
    await waitFor(() => expect(store.getState().user.token).toBeNull(), SLOW);
    expect(where()).not.toMatch(/^\/dashboard/);
  });
});

describe('Community space /c/:slug', () => {
  it('sends back to the dashboard when the user does not manage the community', async () => {
    signIn();
    stubMyCommunities([['abidjan-flutter-devs', 'member']]);
    const { where } = renderAppAt('/c/abidjan-flutter-devs/dashboard');
    await waitFor(() => expect(where()).toBe('/dashboard/communities'), SLOW);
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
    expect(screen.queryByText('Revenus nets ce mois-ci')).toBeNull();
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
