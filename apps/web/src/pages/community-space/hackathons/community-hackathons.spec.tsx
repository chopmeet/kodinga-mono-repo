import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { Hackathon, HackathonApplication } from '@/utils/api/hackathon/hackathon.type';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 20_000 });

const at = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const judge = { id: 'u-judge', username: 'fatou', first_name: 'Fatou', last_name: 'Sow', email: 'fatou@example.com' };

const hackathon = (slug: string, title: string, status: Hackathon['status']): Hackathon => ({
  id: slug,
  community: { id: 'c', name: 'Dakar DevOps', slug: 'dakar-devops' },
  organizer: null,
  title,
  slug,
  tagline: 'Construire pour l’agriculture',
  description: 'Le défi : des outils IA pour les agriculteurs.',
  cover_image_url: '',
  format: 'online',
  venue_name: '',
  venue_address: '',
  venue_city: '',
  venue_country: '',
  location_url: '',
  theme: 'AgriTech',
  main_language: 'fr',
  target_audience: '',
  prerequisites: '',
  rules_url: '',
  terms_and_conditions: '',
  registration_start: at(1),
  registration_end: at(10),
  start_time: at(12),
  submission_deadline: at(14),
  judging_end: at(20),
  results_announced_at: null,
  timezone: 'Africa/Dakar',
  status,
  is_registration_open: false,
  is_submission_open: false,
  results_published: false,
  prizes_count: 1,
  participants_count: 8,
  is_member_only: false,
  allow_teams: true,
  min_team_size: 1,
  max_team_size: 4,
  max_participants: null,
  auto_accept_applications: false,
  require_demo_url: false,
  require_video_url: false,
  require_repo_url: true,
  prizes: [{ id: 'p1', title: '1er prix', description: '', reward_amount: '500000.00', reward_currency: 'XOF', reward_description: '', rank: 1 }],
  criteria: [{ id: 'k1', name: 'Innovation', description: '', min_score: '0', max_score: '20.00', weight: '1.00' }],
  judges: [{ id: 'j1', user: judge, user_id: judge.id, can_evaluate_all: true, created_at: at(0) }],
  results_published_at: null,
  created_at: at(0),
});

const team = {
  id: 't1',
  name: 'AgriBots',
  slug: 'agribots',
  tagline: 'Des robots pour les champs',
  leader: { id: 'u2', username: 'awa', first_name: 'Awa', last_name: 'Ndiaye', email: 'awa@example.com' },
  members: [
    { id: 'tm1', user: { id: 'u2', username: 'awa', first_name: 'Awa', last_name: 'Ndiaye', email: 'awa@example.com' }, role: 'leader', status: 'accepted' },
    { id: 'tm2', user: { id: 'u3', username: 'kofi', first_name: 'Kofi', last_name: 'Mensah', email: 'kofi@example.com' }, role: 'member', status: 'invited' },
  ],
  active_members_count: 1,
  created_at: at(-1),
};

const submission = {
  id: 's1',
  team: 't1',
  team_name: 'AgriBots',
  applicant: team.leader,
  title: 'Irrigo',
  slug: 'irrigo',
  tagline: 'Irrigation pilotée par IA',
  demo_url: 'https://irrigo.app',
  video_url: '',
  repository_url: 'https://github.com/agribots/irrigo',
  gitlab_url: '',
  status: 'submitted',
  is_final: true,
  submitted_at: at(-1),
  total_score: '16.50',
  evaluations_count: 2,
  rank: 1,
  files_count: 0,
};

const application: HackathonApplication = {
  id: 'a1',
  applicant: { id: 'u2', username: 'awa', first_name: 'Awa', last_name: 'Ndiaye', email: 'awa@example.com' },
  participation_mode: 'team',
  team_name: 'AgriBots',
  status: 'pending',
  rejection_reason: '',
  reviewed_at: null,
  created_at: at(-1),
};

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** Fake hackathons api of dakar-devops (list with status filter, CRUD, publish, lifecycle, dashboard, applications) */
function stubHackathonsApi(status: Hackathon['status'] = 'draft') {
  let items = [hackathon('agri-ia', 'Hackathon AgriTech IA', status)];
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    const slug = path.match(/hackathons\/([^/]+)\//)?.[1];
    const find = () => items.find((h) => h.slug === slug);

    if (path.endsWith('/applications/')) return json({ success: true, pagination: { count: 1 }, results: [application] });
    if (path.endsWith('/teams/')) return json({ success: true, pagination: { count: 1 }, results: [team] });
    if (path.endsWith('/submissions/')) return json({ success: true, pagination: { count: 1 }, results: [submission] });
    if (path.endsWith('/evaluate/')) return json({ success: true, data: request.method === 'GET' ? null : { id: 'ev1', ...body, scores: [] } });
    if (path.endsWith('/judges/')) return json({ success: true, data: [] });
    if (path.endsWith('/results/')) return json({ success: true, data: [{ ...submission, applicant_username: 'awa', won_prizes: [] }] });
    if (path.endsWith('/publish-results/')) return json({ success: true, data: { ...find(), status: 'completed', results_published: true } });
    if (path.endsWith('/communities/dakar-devops/members/')) {
      return json({ success: true, pagination: { count: 1 }, results: [{ id: 'm9', user: { id: 'u9', username: 'yao', first_name: 'Yao', last_name: 'Kouassi', email: 'yao@example.com' }, role: 'member', status: 'active' }] });
    }
    if (path.match(/\/applications\/[^/]+\/$/)) return json({ success: true, data: { ...application, ...body } });
    if (path.endsWith('/dashboard/')) {
      return json({ success: true, data: { status: 'draft', total_applications: 3, accepted_applications: 1, pending_applications: 2, total_teams: 1, total_submissions: 0, final_submissions: 0, draft_submissions: 0, judges_count: 0, evaluations_completed: 0 } });
    }
    if (path.endsWith('/publish/')) {
      items = items.map((h) => (h.slug === slug ? { ...h, status: 'published' } : h));
      return json({ success: true, data: find() });
    }
    if (path.endsWith('/lifecycle/')) {
      items = items.map((h) => (h.slug === slug ? { ...h, status: body?.status } : h));
      return json({ success: true, data: find() });
    }
    if (path.endsWith('/communities/dakar-devops/hackathons/')) {
      if (request.method === 'POST') {
        const created = { ...hackathon('defi-fintech', String(body?.title), 'draft'), ...body } as Hackathon;
        items = [...items, created];
        return json({ success: true, data: created }, 201);
      }
      const status = url.searchParams.get('status');
      const found = items.filter((h) => !status || h.status === status);
      return json({ success: true, pagination: { count: found.length }, results: found });
    }
    if (slug && request.method === 'GET') return json({ success: true, data: find() });
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Community space: hackathons', () => {
  it('lists the hackathons and filters on their status', async () => {
    const calls = stubHackathonsApi();
    renderAppAt('/c/dakar-devops/hackathons');
    expect(await screen.findByRole('link', { name: 'Hackathon AgriTech IA' }, SLOW)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Brouillons' }));
    await waitFor(() => expect(calls.at(-1)?.url.searchParams.get('status')).toBe('draft'), SLOW);
  });

  it('creates a draft with its prizes and criteria, then opens it', async () => {
    const calls = stubHackathonsApi();
    const { where } = renderAppAt('/c/dakar-devops/hackathons/new');
    fireEvent.change(await screen.findByLabelText(/^Titre/, {}, SLOW), { target: { value: 'Défi Fintech' } });
    fireEvent.change(screen.getByLabelText(/^Description du défi/), { target: { value: 'Paiements mobiles pour les commerçants.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le brouillon' }));

    await waitFor(() => expect(where()).toBe('/c/dakar-devops/hackathons/defi-fintech'), SLOW);
    const post = calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/hackathons/'));
    expect(post?.body).toMatchObject({ title: 'Défi Fintech', format: 'online', allow_teams: true, prizes: [{ title: '1er prix', rank: 1, reward_currency: 'XOF' }] });
    expect((post?.body?.criteria as unknown[]).length).toBe(3);
  });

  it('checks the order of the dates before sending', async () => {
    const calls = stubHackathonsApi();
    renderAppAt('/c/dakar-devops/hackathons/new');
    fireEvent.change(await screen.findByLabelText(/^Titre/, {}, SLOW), { target: { value: 'Défi Fintech' } });
    fireEvent.change(screen.getByLabelText(/^Description du défi/), { target: { value: 'Paiements mobiles pour les commerçants.' } });
    fireEvent.change(screen.getByLabelText(/^Clôture des inscriptions/), { target: { value: '2020-01-01T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer le brouillon' }));
    expect(await screen.findByText('Après l’ouverture des inscriptions', {}, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('publishes a draft from its page', async () => {
    const calls = stubHackathonsApi();
    renderAppAt('/c/dakar-devops/hackathons/agri-ia');
    fireEvent.click(await screen.findByRole('button', { name: 'Publier' }, SLOW));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/agri-ia/publish/'))).toBe(true), SLOW);
    expect(await screen.findByRole('button', { name: 'Ouvrir les inscriptions' }, SLOW)).toBeTruthy();
  });

  it('refuses an application with a reason', async () => {
    const calls = stubHackathonsApi();
    renderAppAt('/c/dakar-devops/hackathons/agri-ia?tab=applications');
    const trigger = await screen.findByRole('button', { name: 'Actions pour Awa Ndiaye' }, SLOW);
    expect(screen.getByText('Équipe « AgriBots »')).toBeTruthy();
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(within(await screen.findByRole('menu', {}, SLOW)).getByRole('menuitem', { name: 'Refuser' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Équipe complète' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Refuser' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true), SLOW);
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'rejected', reason: 'Équipe complète' });
  });

  it('keeps moderators out of creating hackathons', async () => {
    stubHackathonsApi();
    const { where } = renderAppAt('/c/python-africa-core/hackathons/new');
    await waitFor(() => expect(where()).toBe('/c/python-africa-core/hackathons'), SLOW);
    expect(screen.queryByRole('link', { name: /Nouveau hackathon/ })).toBeNull();
  });

  it('shows the teams with their leader and pending invitations', async () => {
    stubHackathonsApi();
    renderAppAt('/c/dakar-devops/hackathons/agri-ia?tab=teams');
    expect(await screen.findByText('AgriBots', {}, SLOW)).toBeTruthy();
    expect(screen.getByLabelText("Chef d'équipe")).toBeTruthy();
    expect(screen.getByText('Invité')).toBeTruthy();
  });

  it('adds a community member to the jury and removes a judge', async () => {
    const calls = stubHackathonsApi();
    renderAppAt('/c/dakar-devops/hackathons/agri-ia?tab=jury');
    fireEvent.change(await screen.findByLabelText('Rechercher un membre', {}, SLOW), { target: { value: 'yao' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter Yao Kouassi au jury' }, SLOW));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/judges/'))).toBe(true), SLOW);
    expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/judges/'))?.body).toEqual({ user_ids: ['u9'] });

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Fatou Sow du jury' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'DELETE')?.url.searchParams.get('user_id')).toBe('u-judge'), SLOW);
  });

  it('lets a judge evaluate a submitted project on each criterion', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: { ...judge } as unknown as User, token: 'access', refresh: 'r' }));
    });
    // Evaluation is open while the hackathon is in judging
    const calls = stubHackathonsApi('judging');
    renderAppAt('/c/dakar-devops/hackathons/agri-ia?tab=projects');
    fireEvent.click(await screen.findByRole('button', { name: 'Évaluer Irrigo' }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    // The form shows once the judge's previous evaluation is loaded
    await within(dialog).findByLabelText(/Innovation/, {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: "Envoyer l'évaluation" }));
    expect(await within(dialog).findByText('Notez « Innovation ».', {}, SLOW)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/Innovation/), { target: { value: '17' } });
    fireEvent.change(within(dialog).getByLabelText("Retour à l'équipe"), { target: { value: 'Très bon pitch.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: "Envoyer l'évaluation" }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/evaluate/'))).toBe(true), SLOW);
    expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/evaluate/'))?.body).toEqual({
      scores: [{ criterion_id: 'k1', score: 17 }],
      general_feedback: 'Très bon pitch.',
      private_notes: '',
      is_submitted: true,
    });
  });

  it('publishes the results with the prizes suggested by the ranking', async () => {
    const calls = stubHackathonsApi();
    renderAppAt('/c/dakar-devops/hackathons/agri-ia?tab=results');
    const ranking = await screen.findByRole('list', { name: 'Classement' }, SLOW);
    expect(within(ranking).getByText('Irrigo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Publier les résultats/ }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publier' }));
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith('/publish-results/'))).toBe(true), SLOW);
    expect(calls.find((c) => c.url.pathname.endsWith('/publish-results/'))?.body).toEqual({ winners: [{ prize_id: 'p1', submission_id: 's1' }] });
  });
});
