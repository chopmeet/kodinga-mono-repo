import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { getMyCommunity } from '@/data/community-space.data';
import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { Opportunity, OpportunityApplication } from '@/utils/api/opportunity/opportunity.type';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 20_000 });

const COMMUNITY_ID = getMyCommunity('dakar-devops')?.community.id ?? '';
const me = { id: 'u-me', username: 'fatou', first_name: 'Fatou', last_name: 'Sow', avatar_url: '' };
const other = { id: 'u-other', username: 'kofi', first_name: 'Kofi', last_name: 'Mensah', avatar_url: '' };

const offer = (slug: string, title: string, extra: Partial<Opportunity> = {}): Opportunity => ({
  id: slug,
  slug,
  title,
  company_name: 'Wave',
  company_logo_url: '',
  company_website: 'https://wave.com',
  opportunity_type: 'full_time',
  workplace_type: 'hybrid',
  location: 'Dakar',
  salary_min: '800000.00',
  salary_max: '1200000.00',
  currency: 'XOF',
  experience_level: 'senior',
  status: 'open',
  views_count: 42,
  applications_count: 2,
  expires_at: null,
  has_applied: false,
  poster: me,
  technologies: [{ id: 't1', name: 'Kubernetes', slug: 'kubernetes', icon_url: '' }],
  created_at: '2026-10-01T10:00:00Z',
  description: 'Faire tourner la plateforme de paiement.',
  requirements: '5 ans en SRE.',
  apply_url: '',
  apply_email: 'jobs@wave.com',
  community_id: COMMUNITY_ID,
  updated_at: '2026-10-01T10:00:00Z',
  ...extra,
});

const application = (id: string, first_name: string, status: OpportunityApplication['status']): OpportunityApplication => ({
  id,
  opportunity: offer('sre-wave', 'SRE senior'),
  applicant: { id: `u-${id}`, username: first_name.toLowerCase(), first_name, last_name: 'Diop', avatar_url: '' },
  resume_url: 'https://cv.example.com/cv.pdf',
  cover_letter: 'Je maintiens des clusters depuis 6 ans.',
  portfolio_url: '',
  status,
  created_at: '2026-10-05T10:00:00Z',
  updated_at: '2026-10-05T10:00:00Z',
});

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** Fake opportunities api (raw responses, like the api): list, detail, create, edit, close, applications */
function stubOpportunitiesApi() {
  let offers = [
    offer('sre-wave', 'SRE senior'),
    offer('bounty-docs', 'Bounty : documentation Terraform', { opportunity_type: 'bounty', poster: other, company_name: 'Kodinga', salary_min: '150000.00', salary_max: null }),
    offer('ailleurs', 'Offre ailleurs', { community_id: 'another-community' }),
  ];
  let applications = [application('a1', 'Awa', 'pending'), application('a2', 'Moussa', 'shortlisted')];
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;

    const appId = path.match(/opportunities\/applications\/([^/]+)\/status\/$/)?.[1];
    if (appId) {
      applications = applications.map((a) => (a.id === appId ? { ...a, status: body?.status } : a));
      return json(applications.find((a) => a.id === appId));
    }
    if (path.endsWith('/profiles/technologies/')) {
      return json({ success: true, data: [{ id: 't2', name: 'Terraform', slug: 'terraform' }] });
    }
    if (path.endsWith('/opportunities/')) {
      if (request.method === 'POST') {
        const created = offer('new-offer', String(body?.title), { ...body, technologies: [] });
        offers = [...offers, created];
        return json(created, 201);
      }
      // Only the open offers of the community, like OpportunitySelector
      return json(offers.filter((o) => o.status === 'open' && (o.community_id === COMMUNITY_ID) === (url.searchParams.get('community') === 'dakar-devops')));
    }
    const slug = path.match(/opportunities\/([^/]+)\//)?.[1];
    if (slug && path.endsWith('/applications/')) return json(applications);
    if (slug && request.method === 'DELETE') {
      offers = offers.map((o) => (o.slug === slug ? { ...o, status: 'closed' } : o));
      return json({ status: 'closed' });
    }
    if (slug && request.method === 'PATCH') {
      offers = offers.map((o) => (o.slug === slug ? { ...o, ...body } : o));
      return json(offers.find((o) => o.slug === slug));
    }
    const found = offers.find((o) => o.slug === slug);
    if (slug) return found ? json(found) : json({ success: false, code: 'not_found', message: 'Opportunité introuvable.' }, 404);
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const signIn = () =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { ...me } as unknown as User, token: 'access', refresh: 'r' }));
  });

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
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Community space: opportunities', () => {
  it('lists the open offers of the community, with type filters and a search', async () => {
    signIn();
    const calls = stubOpportunitiesApi();
    renderAppAt('/c/dakar-devops/opportunities');
    expect(await screen.findByRole('link', { name: 'SRE senior' }, SLOW)).toBeTruthy();
    expect(screen.getByText('Publiée par vous')).toBeTruthy();
    expect(screen.getByText('800 000 – 1 200 000 FCFA')).toBeTruthy();
    expect(screen.queryByText('Offre ailleurs')).toBeNull();
    expect(calls.find((c) => c.url.pathname.endsWith('/opportunities/'))?.url.searchParams.get('community')).toBe('dakar-devops');

    fireEvent.click(screen.getByRole('button', { name: /Bounties/ }));
    expect(screen.queryByRole('link', { name: 'SRE senior' })).toBeNull();
    expect(screen.getByRole('link', { name: /documentation Terraform/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Toutes/ }));
    fireEvent.change(screen.getByLabelText('Rechercher une offre'), { target: { value: 'kubernetes' } });
    // Both offers use Kubernetes; the company narrows it down
    fireEvent.change(screen.getByLabelText('Rechercher une offre'), { target: { value: 'wave' } });
    await waitFor(() => expect(screen.queryByRole('link', { name: /documentation Terraform/ })).toBeNull(), SLOW);
    expect(screen.getByRole('link', { name: 'SRE senior' })).toBeTruthy();
  });

  it('publishes an offer for the community: an onsite job needs its city', async () => {
    signIn();
    const calls = stubOpportunitiesApi();
    renderAppAt('/c/dakar-devops/opportunities');
    fireEvent.click(await screen.findByRole('button', { name: /Publier une offre/ }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^Intitulé/), { target: { value: 'Stage data analyst' } });
    fireEvent.change(within(dialog).getByLabelText(/^Entreprise/), { target: { value: 'Orange' } });
    fireEvent.change(within(dialog).getByLabelText('Type'), { target: { value: 'internship' } });
    fireEvent.change(within(dialog).getByLabelText('Mode de travail'), { target: { value: 'onsite' } });
    fireEvent.change(within(dialog).getByLabelText(/^Description/), { target: { value: 'Six mois au sein de la squad data.' } });
    fireEvent.change(within(dialog).getByLabelText(/Rémunération min/), { target: { value: '150000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: "Publier l'offre" }));
    expect(await within(dialog).findByText('Indiquez la ville', {}, SLOW)).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/^Ville/), { target: { value: 'Abidjan' } });
    fireEvent.change(within(dialog).getByLabelText('Technologies'), { target: { value: 'terra' } });
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Terraform' }, SLOW));
    fireEvent.click(within(dialog).getByRole('button', { name: "Publier l'offre" }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true), SLOW);
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({
      title: 'Stage data analyst',
      company_name: 'Orange',
      opportunity_type: 'internship',
      workplace_type: 'onsite',
      location: 'Abidjan',
      salary_min: '150000',
      salary_max: null,
      currency: 'XOF',
      status: 'open',
      community_id: COMMUNITY_ID,
      technology_ids: ['t2'],
    });
    // The new offer opens
    expect(await screen.findByRole('heading', { level: 1, name: 'Stage data analyst' }, SLOW)).toBeTruthy();
  });

  it('lets the poster follow the applications and change their status', async () => {
    signIn();
    const calls = stubOpportunitiesApi();
    renderAppAt('/c/dakar-devops/opportunities/sre-wave');
    expect(await screen.findByRole('heading', { level: 1, name: 'SRE senior' }, SLOW)).toBeTruthy();
    const list = await screen.findByRole('list', { name: 'Liste des candidatures' }, SLOW);
    expect(within(list).getByText('Awa Diop')).toBeTruthy();
    expect(within(list).getByRole('link', { name: 'CV de Awa Diop' }).getAttribute('href')).toBe('https://cv.example.com/cv.pdf');

    fireEvent.change(within(list).getByLabelText('Statut de la candidature de Awa Diop'), { target: { value: 'accepted' } });
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true), SLOW);
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.url.pathname).toMatch(/\/opportunities\/applications\/a1\/status\/$/);
    expect(patch?.body).toEqual({ status: 'accepted' });
  });

  it('closes an offer from the list', async () => {
    signIn();
    const calls = stubOpportunitiesApi();
    renderAppAt('/c/dakar-devops/opportunities');
    const menu = await openMenu('Actions pour SRE senior');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Clôturer' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: "Clôturer l'offre" }));
    await waitFor(() => expect(calls.find((c) => c.method === 'DELETE')?.url.pathname).toMatch(/\/opportunities\/sre-wave\/$/), SLOW);
    await waitFor(() => expect(screen.queryByRole('link', { name: 'SRE senior' })).toBeNull(), SLOW);
  });

  it("keeps someone else's offer read-only", async () => {
    signIn();
    stubOpportunitiesApi();
    renderAppAt('/c/dakar-devops/opportunities/bounty-docs');
    expect(await screen.findByRole('heading', { level: 1, name: /documentation Terraform/ }, SLOW)).toBeTruthy();
    expect(screen.getByText(/Les candidatures sont visibles par Kofi Mensah/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull();
  });

  it('hides the offers of other communities', async () => {
    stubOpportunitiesApi();
    signIn();
    renderAppAt('/c/dakar-devops/opportunities/ailleurs');
    expect(await screen.findByText('Cette offre est introuvable dans la communauté.', {}, SLOW)).toBeTruthy();
  });

  it('lets a moderator browse the offers without publishing', async () => {
    stubOpportunitiesApi();
    renderAppAt('/c/python-africa-core/opportunities');
    await screen.findByRole('heading', { name: 'Opportunités' }, SLOW);
    expect(screen.queryByRole('button', { name: /Publier une offre/ })).toBeNull();
  });
});
