import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Toaster } from '@kodinga/ui';
import { adminCommunities } from '@/data/admin-communities.data';
import store from '@/redux/store';
import { must } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import CommunityDetails from './community-details';
import CommunityEventsTab from './tabs/events';
import CommunityHackathonsTab from './tabs/hackathons';
import CommunityMembersTab from './tabs/members';
import CommunityOpportunitiesTab from './tabs/opportunities';
import CommunityPaymentsTab from './tabs/payments';
import CommunityPostsTab from './tabs/posts';
import CommunityProjectsTab from './tabs/projects';
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
            <Route path="events" element={<CommunityEventsTab />} />
            <Route path="opportunities" element={<CommunityOpportunitiesTab />} />
            <Route path="hackathons" element={<CommunityHackathonsTab />} />
            <Route path="projects" element={<CommunityProjectsTab />} />
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

const revenue = {
  total_gross: '45000.00',
  total_platform_fees: '4500.00',
  total_net: '40500.00',
  available_balance: '30500.00',
  withdrawn_amount: '10000.00',
  currency: 'XOF',
  active_subscribers_count: 3,
  monthly_revenue: [{ month: '2026-10', gross: '45000.00', fees: '4500.00', net: '40500.00', payments_count: 3 }],
};
const plan = { id: 'pl1', name: 'Mensuel', price: '15000.00', currency: 'XOF', billing_interval: 'month' };
const transactions = [
  {
    id: 't1',
    user: user('u3', 'Kofi', 'Mensah'),
    plan_name: 'Mensuel',
    plan_interval: 'month',
    amount: '15000.00',
    platform_fee: '1500.00',
    net_amount: '13500.00',
    currency: 'XOF',
    status: 'PAID',
    provider: 'paydunya',
    provider_reference: 'pd-1',
    paid_at: '2026-10-12T10:00:00Z',
    created_at: '2026-10-12T09:58:00Z',
  },
];
const subscribers = [
  {
    id: 's1',
    user: user('u2', 'Awa', 'Ndiaye'),
    plan,
    status: 'active',
    is_active: true,
    current_period_start: '2026-10-12T10:00:00Z',
    current_period_end: '2026-11-12T10:00:00Z',
    cancel_at_period_end: false,
    canceled_at: null,
    created_at: '2026-10-12T10:00:00Z',
  },
];

const events = [
  {
    id: 'e1',
    community: { id: community.id, name: community.name, slug: community.slug, avatar_url: '' },
    host: { ...user('u1', 'Chidi', 'Okafor'), avatar_url: '' },
    title: 'Atelier Terraform',
    slug: 'atelier-terraform',
    description: '',
    cover_image_url: '',
    event_type: 'workshop',
    format: 'livekit',
    status: 'scheduled',
    start_time: '2026-12-01T18:00:00Z',
    end_time: '2026-12-01T20:00:00Z',
    timezone: 'Africa/Dakar',
    venue_name: '',
    location_address: '',
    location_city: '',
    location_country: '',
    attendees_count: 24,
    max_attendees: 50,
    is_full: false,
    is_upcoming: true,
    is_in_progress: false,
    is_recorded: false,
    is_public: false,
    duration_minutes: 120,
  },
];
const opportunities = [
  {
    id: 'o1',
    title: 'Ingénieur DevOps senior',
    slug: 'ingenieur-devops-senior',
    company_name: 'Wave',
    company_logo_url: '',
    company_website: '',
    opportunity_type: 'full_time',
    workplace_type: 'remote',
    location: 'Dakar',
    salary_min: '1500000.00',
    salary_max: null,
    currency: 'XOF',
    experience_level: 'senior',
    status: 'open',
    views_count: 120,
    applications_count: 7,
    expires_at: null,
    has_applied: false,
    poster: { ...user('u1', 'Chidi', 'Okafor'), avatar_url: '' },
    technologies: [],
    created_at: '2026-10-20T10:00:00Z',
  },
];

const hackathons = [
  {
    id: 'h1',
    community: { id: community.id, name: community.name, slug: community.slug },
    organizer: { id: 'u1', username: 'chidiokafor', full_name: 'Chidi Okafor' },
    title: 'Hack the Sahel',
    slug: 'hack-the-sahel',
    tagline: '',
    cover_image_url: '',
    format: 'hybrid',
    venue_city: 'Dakar',
    venue_country: 'SN',
    theme: 'Climat',
    main_language: 'fr',
    registration_start: '2026-11-01T00:00:00Z',
    registration_end: '2026-11-30T00:00:00Z',
    start_time: '2026-12-05T09:00:00Z',
    submission_deadline: '2026-12-07T18:00:00Z',
    judging_end: '2026-12-10T18:00:00Z',
    results_announced_at: null,
    timezone: 'Africa/Dakar',
    status: 'draft',
    is_registration_open: false,
    is_submission_open: false,
    results_published: false,
    prizes_count: 3,
    participants_count: 0,
    created_at: '2026-10-25T10:00:00Z',
  },
];
const projects = [
  {
    id: 'pr1',
    title: 'AgriSense',
    slug: 'agrisense',
    tagline: 'Capteurs pour les maraîchers',
    cover_image_url: '',
    demo_url: '',
    repository_url: '',
    status: 'published',
    upvotes_count: 42,
    views_count: 300,
    is_featured: false,
    is_upvoted: false,
    owner: { ...user('u3', 'Kofi', 'Mensah'), avatar_url: '', headline: '' },
    technologies: [{ id: 't1', name: 'Python', slug: 'python', icon_url: '' }],
    created_at: '2026-10-15T10:00:00Z',
  },
];

type Call = { method: string; url: URL; body: unknown };

/** Fake api of the page: routes on path, method and filters */
function stubCommunityApi({ community: shown = detail, billingDenied = false }: { community?: typeof detail; billingDenied?: boolean } = {}) {
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
    if (path.endsWith(`/communities/${community.slug}/events/`)) {
      const status = url.searchParams.get('status');
      return page(events.filter((e) => !status || e.status === status));
    }
    if (path.endsWith('/opportunities/') && request.method === 'GET') return json({ success: true, data: opportunities });
    if (path.endsWith(`/communities/${community.slug}/hackathons/`)) return page(hackathons);
    if (path.endsWith('/projects/') && request.method === 'GET') return json({ success: true, data: projects });
    if (path.includes(`/billing/communities/${shown.slug}/`)) {
      if (billingDenied) return json({ success: false, code: 'permission_denied', message: 'Seul le créateur peut consulter ses données financières.' }, 403);
      if (path.endsWith('/revenue/')) return json({ success: true, data: revenue });
      if (path.endsWith('/transactions/')) return json({ success: true, data: transactions });
      if (path.endsWith('/subscribers/')) return json({ success: true, data: subscribers });
    }
    if (path.endsWith(`/communities/${shown.slug}/`)) return json({ success: true, data: shown });
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
    // Revenue of the paid community, from billing/communities/<slug>/revenue/
    const revenueCard = screen.getByText('Revenus encaissés (total)').closest('div')?.parentElement as HTMLElement;
    await waitFor(() => expect(within(revenueCard).getByText(/^45\s?k FCFA$/)).toBeTruthy(), SLOW);
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

  it('shows the revenue, payments and subscribers of a paid community', async () => {
    const calls = stubCommunityApi();
    renderAt(`/admin/communities/${community.slug}/payments`);
    expect(await screen.findByText('30 500 FCFA', {}, SLOW)).toBeTruthy();
    expect(screen.getAllByText('4 500 FCFA').length).toBeGreaterThan(0);
    expect(await screen.findByText('Kofi Mensah', {}, SLOW)).toBeTruthy();
    expect(screen.getAllByText('13 500 FCFA').length).toBeGreaterThan(0);
    expect(await screen.findByText('Awa Ndiaye', {}, SLOW)).toBeTruthy();
    // The creator's wording ("Net pour vous") is not shown to the admin
    expect(screen.getByRole('columnheader', { name: 'Net pour le créateur' })).toBeTruthy();
    expect(calls.filter((c) => c.url.pathname.includes('/billing/communities/')).length).toBe(3);
  });

  it('shows the api error when billing is refused', async () => {
    stubCommunityApi({ billingDenied: true });
    renderAt(`/admin/communities/${community.slug}/payments`);
    expect(await screen.findByRole('button', { name: 'Réessayer' }, SLOW)).toBeTruthy();
    expect(screen.getAllByText('Seul le créateur peut consulter ses données financières.').length).toBeGreaterThan(0);
  });

  it('asks nothing to the billing api for a free community', async () => {
    const free = { ...detail, slug: 'free-one', pricing_type: 'free' as const };
    const calls = stubCommunityApi({ community: free as typeof detail });
    renderAt('/admin/communities/free-one/payments');
    expect(await screen.findByText("Ses membres ne paient pas d'abonnement : aucun paiement à afficher.", {}, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.url.pathname.includes('/billing/'))).toBe(false);
  });

  it('lists the events of the api, filters them and cancels one', async () => {
    const calls = stubCommunityApi();
    renderAt(`/admin/communities/${community.slug}/events`);
    expect(await screen.findByText('Atelier Terraform', {}, SLOW)).toBeTruthy();
    expect(screen.getByText(/réservé aux membres/)).toBeTruthy();
    expect(screen.getByText('24 / 50')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Annulés' }));
    expect(await screen.findByText('Aucun événement avec ce statut.', {}, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.url.pathname.endsWith('/events/') && c.url.searchParams.get('status') === 'cancelled')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Tous' }));
    const menu = await openMenu('Actions pour Atelier Terraform');
    fireEvent.click(within(menu).getByRole('menuitem', { name: "Annuler l'événement" }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: "Annuler l'événement" }));
    expect(await screen.findByText('« Atelier Terraform » est annulé.', {}, SLOW)).toBeTruthy();
    const post = calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/events/e1/status/'));
    expect(post?.body).toEqual({ status: 'cancelled' });
  });

  it('lists the open offers of the community and closes one', async () => {
    const calls = stubCommunityApi();
    renderAt(`/admin/communities/${community.slug}/opportunities`);
    expect(await screen.findByText('Ingénieur DevOps senior', {}, SLOW)).toBeTruthy();
    expect(screen.getByText(/À partir de 1\s500\s000 FCFA/)).toBeTruthy();
    expect(calls.find((c) => c.url.pathname.endsWith('/opportunities/'))?.url.searchParams.get('community')).toBe(community.slug);

    const menu = await openMenu('Actions pour Ingénieur DevOps senior');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Clôturer' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clôturer' }));
    expect(await screen.findByText('« Ingénieur DevOps senior » est clôturée.', {}, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/opportunities/ingenieur-devops-senior/'))).toBe(true);
  });

  it('lists the hackathons, drafts included, and cancels one', async () => {
    const calls = stubCommunityApi();
    renderAt(`/admin/communities/${community.slug}/hackathons`);
    expect(await screen.findByText('Hack the Sahel', {}, SLOW)).toBeTruthy();
    expect(screen.getByText(/Hybride · Dakar · organisé par Chidi Okafor/)).toBeTruthy();

    const menu = await openMenu('Actions pour Hack the Sahel');
    // A draft has no public page yet
    expect(within(menu).queryByRole('menuitem', { name: 'Voir la page publique' })).toBeNull();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Annuler le hackathon' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler le hackathon' }));
    expect(await screen.findByText('« Hack the Sahel » est annulé.', {}, SLOW)).toBeTruthy();
    const post = calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/hackathons/hack-the-sahel/lifecycle/'));
    expect(post?.body).toEqual({ status: 'cancelled' });
  });

  it('lists the published projects, features and deletes one', async () => {
    const calls = stubCommunityApi();
    renderAt(`/admin/communities/${community.slug}/projects`);
    expect(await screen.findByText('AgriSense', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Python')).toBeTruthy();
    expect(calls.find((c) => c.url.pathname.endsWith('/projects/'))?.url.searchParams.get('community')).toBe(community.slug);

    let menu = await openMenu('Actions pour AgriSense');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Mettre à la une' }));
    expect(await screen.findByText('« AgriSense » est à la une.', {}, SLOW)).toBeTruthy();
    expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/projects/agrisense/feature/'))?.body).toEqual({ is_featured: true });

    menu = await openMenu('Actions pour AgriSense');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Supprimer' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    expect(await screen.findByText('« AgriSense » a été supprimé.', {}, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/projects/agrisense/'))).toBe(true);
  });

  it('handles an unknown community', async () => {
    stubCommunityApi();
    renderAt('/admin/communities/nope');
    expect(await screen.findByText('Cette communauté est introuvable ou a été archivée.', {}, SLOW)).toBeTruthy();
  });
});
