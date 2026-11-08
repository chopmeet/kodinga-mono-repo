import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

const URL_PATH = '/communities/abidjan-react/hackathons/devfest';
const DAY = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const person = (id: string, username: string, first_name: string) => ({ id, username, first_name, last_name: '', email: `${username}@example.com` });

type Call = { method: string; url: URL; body: Record<string, unknown> | null };
type Options = { member?: boolean; application?: 'accepted' | 'pending' | null; invitedBy?: boolean; results?: boolean; requireRepo?: boolean; suggests?: boolean; closesInMs?: number; applyRefusal?: 'closed' | 'other'; question?: boolean };

/** A hackathon of abidjan-react, running: registrations and submissions open */
function stubHackathonApi({ member = true, application = null, invitedBy = false, results = false, requireRepo = true, suggests = false, closesInMs, applyRefusal, question = false }: Options = {}) {
  // Set once: every read of the hackathon gives the same deadline
  const registrationEnd = closesInMs === undefined ? at(5) : new Date(Date.now() + closesInMs).toISOString();
  let closedByServer = false;
  const calls: Call[] = [];
  let status = application;
  let team: Record<string, unknown> | null = null;
  const project = { id: 's1', title: 'Projet de fatou', tagline: '', description: '', repository_url: '', gitlab_url: '', demo_url: '', video_url: '', is_final: false, submitted_at: null, files: [] as unknown[] };
  const otherTeam = {
    id: 't9',
    name: 'Les Baobabs',
    slug: 'les-baobabs',
    tagline: 'On code sous l’arbre',
    leader: person('u9', 'yao', 'Yao'),
    members: [
      { id: 'tm9', user: person('u9', 'yao', 'Yao'), role: 'leader', status: 'accepted' },
      ...(invitedBy ? [{ id: 'tm1', user: person('u1', 'fatou', 'Fatou'), role: 'member', status: 'invited' }] : []),
    ],
    active_members_count: 1,
  };

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, code = 200) => new Response(JSON.stringify(data), { status: code, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    const base = '/communities/abidjan-react/hackathons/devfest/';

    if (path.endsWith('/communities/abidjan-react/')) {
      return json({
        success: true,
        data: {
          id: 'c1', name: 'Abidjan React', slug: 'abidjan-react', privacy_type: 'public', pricing_type: 'free', members_count: 40, owner: { id: 'o', username: 'o' },
          user_membership: member ? { is_member: true, role: 'member', status: 'active' } : { is_member: false, role: null, status: null },
        },
      });
    }
    if (path.endsWith('/communities/abidjan-react/hackathons/')) {
      return json({
        success: true,
        pagination: { count: 1 },
        results: [{ id: 'h1', title: 'DevFest Hack', slug: 'devfest', tagline: '', cover_image_url: '', format: 'online', venue_city: '', venue_country: '', status: 'registration_open', is_registration_open: true, registration_end: at(5), start_time: at(-1), participants_count: 12, prizes_count: 1 }],
      });
    }
    if (path.endsWith(`${base}apply/`)) {
      if (applyRefusal === 'closed') {
        closedByServer = true;
        return json({ success: false, code: 'invalid', message: 'Validation or processing error.', details: { hackathon: ['La date limite de candidature pour ce hackathon est dépassée.'] } }, 400);
      }
      if (applyRefusal === 'other') {
        return json({ success: false, code: 'invalid', message: 'Validation or processing error.', details: { team_name: ['Ce nom d’équipe est déjà pris.'] } }, 400);
      }
      status = 'accepted';
      return json({ success: true, data: { id: 'a1', status: 'accepted', participation_mode: body?.participation_mode } }, 201);
    }
    if (path.endsWith('/communities/abidjan-react/ai/hackathon-suggestions/')) {
      const candidate = (id: string, username: string, first_name: string) => ({ id, user_id: id, username, first_name, last_name: 'Sow', avatar_url: null, match_type: 'hackathon_team', compatibility_score: 0.9, match_reasons: ['Maîtrise les compétences recherchées : React'], status: 'suggested' });
      // u9 already leads Les Baobabs
      return json(suggests ? [candidate('u9', 'yao', 'Yao'), candidate('u2', 'awa', 'Awa'), candidate('u3', 'kofi', 'Kofi')] : []);
    }
    if (path.endsWith(`${base}teams/`) && request.method === 'POST') {
      team = { id: 't1', name: body?.name, slug: 'team', tagline: body?.tagline ?? '', leader: person('u1', 'fatou', 'Fatou'), members: [{ id: 'tm1', user: person('u1', 'fatou', 'Fatou'), role: 'leader', status: 'accepted' }], active_members_count: 1 };
      return json({ success: true, data: team }, 201);
    }
    if (path.endsWith(`${base}teams/t1/invite/`)) {
      (team?.members as unknown[]).push({ id: 'tm2', user: person('u2', body?.identifier, 'Awa'), role: 'member', status: 'invited' });
      return json({ success: true, data: {} }, 201);
    }
    if (path.endsWith(`${base}teams/respond-invite/`)) {
      if (body?.accept) {
        otherTeam.members = otherTeam.members.map((m) => (m.user.id === 'u1' ? { ...m, status: 'accepted' } : m));
        team = otherTeam;
      }
      return json({ success: true, data: {} });
    }
    if (path.endsWith(`${base}teams/`)) return json({ success: true, pagination: { count: 1 + (team && team !== otherTeam ? 1 : 0) }, results: team && team !== otherTeam ? [otherTeam, team] : [otherTeam] });
    if (path.endsWith(`${base}submissions/my-project/submit/`)) {
      if (requireRepo && !project.repository_url) return json({ success: false, code: 'validation_error', message: 'Erreur', details: { repository_url: ['Un lien vers le dépôt GitHub ou GitLab est obligatoire.'] } }, 400);
      Object.assign(project, { is_final: true, submitted_at: at(0) });
      return json({ success: true, data: project });
    }
    if (path.endsWith(`${base}submissions/my-project/`)) {
      if (request.method === 'PATCH') Object.assign(project, body);
      return json({ success: true, data: project });
    }
    if (path.endsWith(`${base}results/`)) {
      return json({
        success: true,
        data: [
          { id: 's7', title: 'Wari Pay', slug: 'wari-pay', tagline: 'Payer en un geste', applicant_username: 'yao', team_name: 'Les Baobabs', demo_url: 'https://wari.example.com', repository_url: '', total_score: '18.50', evaluations_count: 3, rank: 1, won_prizes: [{ id: 'p1', title: 'Grand prix', rank: 1 }] },
        ],
      });
    }
    if (path.endsWith(base)) {
      return json({
        success: true,
        data: {
          id: 'h1', community: { id: 'c1', name: 'Abidjan React', slug: 'abidjan-react' }, title: 'DevFest Hack', slug: 'devfest', tagline: 'Construire pour l’Afrique', cover_image_url: '',
          description: '## Le défi\n\nUne app **utile**.', format: 'online', venue_name: '', venue_city: '', venue_country: '', venue_address: '', location_url: '', theme: 'Fintech', main_language: 'fr',
          target_audience: 'Développeurs', prerequisites: '', rules_url: '', terms_and_conditions: 'Soyez fair-play.',
          registration_start: at(-5), registration_end: closedByServer ? at(-1) : registrationEnd, start_time: at(-1), submission_deadline: at(10), judging_end: at(15), results_announced_at: null, timezone: 'UTC',
          status: results ? 'completed' : 'registration_open', is_registration_open: !results && !closedByServer, is_submission_open: !results, results_published: results, results_published_at: null,
          is_member_only: false, allow_teams: true, min_team_size: 2, max_team_size: 4, max_participants: null, auto_accept_applications: true,
          require_demo_url: false, require_video_url: false, require_repo_url: requireRepo, allowed_file_types: [], max_file_size_mb: 25, max_files_count: 5,
          custom_registration_questions: question ? [{ id: 'why', label: 'Pourquoi participer ?', required: true }] : [], custom_submission_questions: [], prizes_count: 1, participants_count: 12,
          prizes: [{ id: 'p1', title: 'Grand prix', description: '', reward_amount: '500000', reward_currency: 'XOF', reward_description: '', rank: 1 }],
          criteria: [{ id: 'k1', name: 'Impact', description: 'Utilité pour les usagers', min_score: '0', max_score: '10', weight: '2' }],
          judges: [],
          user_status: member
            ? {
                has_applied: !!status, application_status: status, team_id: (team as { id?: string } | null)?.id ?? null, team_name: (team as { name?: string } | null)?.name ?? null,
                has_submission: false, submission_id: null, submission_is_final: project.is_final, is_judge: false, is_manager: false,
              }
            : null,
          created_at: at(-10),
        },
      });
    }
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const signIn = () =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'fatou' } as User, token: `${b64({ alg: 'HS256' })}.${b64({ exp: 4102444800 })}.sig`, refresh: 'r' }));
  });
const card = () => screen.getByRole('region', { name: 'Ma participation' });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Hackathon page (participants)', () => {
  it('presents the hackathon to a visitor and asks to sign in', async () => {
    stubHackathonApi({ member: false });
    renderAppAt(URL_PATH);
    expect(await screen.findByRole('heading', { level: 1, name: 'DevFest Hack' }, SLOW)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Le défi', level: 2 })).toBeTruthy();
    expect(screen.getByText('500 000 FCFA')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Calendrier' })).getAllByRole('listitem')).toHaveLength(5);
    expect(within(card()).getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toContain('/auth/login?next=');
  });

  it('opens from the Hackathons tab of the community', async () => {
    signIn();
    stubHackathonApi();
    renderAppAt('/communities/abidjan-react?tab=hackathons');
    const list = await screen.findByRole('list', { name: 'Hackathons' }, SLOW);
    expect(within(list).getByRole('link', { name: 'DevFest Hack' }).getAttribute('href')).toBe(URL_PATH);
    expect(within(list).getByRole('link', { name: /Voir et candidater/ }).getAttribute('href')).toBe(URL_PATH);
  });

  it('applies once the rules are accepted, then opens the participant space', async () => {
    signIn();
    const calls = stubHackathonApi();
    renderAppAt(URL_PATH);
    fireEvent.click(await within(await screen.findByRole('region', { name: 'Ma participation' }, SLOW)).findByRole('button', { name: 'Candidater' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('radio', { name: /En équipe/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer ma candidature' }));
    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/règlement/);
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer ma candidature' }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/apply/'))?.body).toEqual({ participation_mode: 'team', team_name: '', answers: {}, accept_terms: true }), SLOW);
    expect(await within(card()).findByText('Vous participez !', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mon espace' })).toBeTruthy();
  });

  it('closes the applications of a page left open when the deadline passes', async () => {
    signIn();
    stubHackathonApi({ closesInMs: 1500 });
    renderAppAt(URL_PATH);
    fireEvent.click(await within(await screen.findByRole('region', { name: 'Ma participation' }, SLOW)).findByRole('button', { name: 'Candidater' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    expect(within(dialog).getByRole('button', { name: 'Envoyer ma candidature' })).toHaveProperty('disabled', false);
    // The deadline passes while the form is open: closed, nothing to send
    expect(await within(dialog).findByText('Les candidatures ne sont plus acceptées', {}, { timeout: 4000 })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Envoyer ma candidature' })).toHaveProperty('disabled', true);
    expect(within(dialog).getByRole('checkbox').matches(':disabled')).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fermer' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), SLOW);
    expect(within(card()).getByText('Les candidatures ne sont plus acceptées.')).toBeTruthy();
    expect(within(card()).queryByRole('button', { name: 'Candidater' })).toBeNull();
  });

  it('says the closing refused by the api, keeping what was typed', async () => {
    signIn();
    stubHackathonApi({ applyRefusal: 'closed', question: true });
    renderAppAt(URL_PATH);
    fireEvent.click(await within(await screen.findByRole('region', { name: 'Ma participation' }, SLOW)).findByRole('button', { name: 'Candidater' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/Pourquoi participer/), { target: { value: 'Pour apprendre' } });
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer ma candidature' }));
    const alert = await within(dialog).findByRole('alert', {}, SLOW);
    expect(alert.textContent).toMatch(/Les candidatures ne sont plus acceptées/);
    expect(alert.textContent).toMatch(/date limite de candidature pour ce hackathon est dépassée/);
    expect(screen.queryByText('Validation or processing error.')).toBeNull();
    expect((within(dialog).getByLabelText(/Pourquoi participer/) as HTMLTextAreaElement).value).toBe('Pour apprendre');
    expect(within(dialog).getByRole('button', { name: 'Envoyer ma candidature' })).toHaveProperty('disabled', true);
    // The hackathon is read again: the card follows the server
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fermer' }));
    expect(await within(card()).findByText('Les candidatures ne sont plus acceptées.', {}, SLOW)).toBeTruthy();
  });

  it('keeps the form usable on another refusal of the api', async () => {
    signIn();
    stubHackathonApi({ applyRefusal: 'other' });
    renderAppAt(URL_PATH);
    fireEvent.click(await within(await screen.findByRole('region', { name: 'Ma participation' }, SLOW)).findByRole('button', { name: 'Candidater' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Envoyer ma candidature' }));
    expect((await within(dialog).findByRole('alert', {}, SLOW)).textContent).toBe('Ce nom d’équipe est déjà pris.');
    expect(within(dialog).getByRole('button', { name: 'Envoyer ma candidature' })).toHaveProperty('disabled', false);
  });

  it('creates a team and invites a teammate', async () => {
    signIn();
    const calls = stubHackathonApi({ application: 'accepted' });
    renderAppAt(`${URL_PATH}?tab=space`);
    const name = await screen.findByLabelText('Nom de l’équipe', {}, SLOW);
    fireEvent.change(name, { target: { value: 'Les Lions' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer l’équipe' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/teams/'))?.body).toEqual({ name: 'Les Lions', tagline: '' }), SLOW);
    expect(await screen.findByRole('heading', { name: 'Les Lions' }, SLOW)).toBeTruthy();
    // Two members at least: one more to invite
    expect(screen.getByText(/invitez encore 1 personne/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Nom d’utilisateur ou email'), { target: { value: 'awa' } });
    fireEvent.click(screen.getByRole('button', { name: /Inviter/ }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/teams/t1/invite/'))?.body).toEqual({ identifier: 'awa' }), SLOW);
    expect(await screen.findByText('Invitation envoyée', { selector: 'span' }, SLOW)).toBeTruthy();
  });

  it('suggests teammates to the captain, without those who already have a team', async () => {
    signIn();
    const calls = stubHackathonApi({ application: 'accepted', suggests: true });
    renderAppAt(`${URL_PATH}?tab=space`);
    fireEvent.change(await screen.findByLabelText('Nom de l’équipe', {}, SLOW), { target: { value: 'Les Lions' } });
    expect(screen.queryByRole('list', { name: 'Coéquipiers suggérés' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Créer l’équipe' }));
    const list = await screen.findByRole('list', { name: 'Coéquipiers suggérés' }, SLOW);
    expect(within(list).getByRole('link', { name: 'Awa Sow' }).getAttribute('href')).toBe('/profiles/awa');
    expect(within(list).getAllByText('Maîtrise les compétences recherchées : React')).toHaveLength(2);
    expect(within(list).queryByText('Yao Sow')).toBeNull();
    expect(calls.find((c) => c.url.pathname.endsWith('/ai/hackathon-suggestions/'))?.body).toMatchObject({ limit: 10 });
    expect(calls.find((c) => c.url.pathname.endsWith('/ai/hackathon-suggestions/'))?.body?.hackathon_id).toBeTruthy();

    fireEvent.click(within(list).getByRole('button', { name: 'Inviter Awa Sow' }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/teams/t1/invite/'))?.body).toEqual({ identifier: 'awa' }), SLOW);
    // Invited: no longer a suggestion
    await waitFor(() => expect(within(list).queryByRole('link', { name: 'Awa Sow' })).toBeNull(), SLOW);
    expect(within(list).getByRole('link', { name: 'Kofi Sow' })).toBeTruthy();
  });

  it('joins the team of a captain who invited the participant', async () => {
    signIn();
    const calls = stubHackathonApi({ application: 'accepted', invitedBy: true });
    renderAppAt(`${URL_PATH}?tab=space`);
    const invitations = await screen.findByRole('list', { name: 'Invitations reçues' }, SLOW);
    expect(invitations.textContent).toMatch(/Yao vous invite dans l’équipe Les Baobabs/);
    fireEvent.click(within(invitations).getByRole('button', { name: 'Rejoindre' }));
    await waitFor(() => expect(calls.find((c) => c.url.pathname.endsWith('/respond-invite/'))?.body).toEqual({ team_id: 't9', accept: true }), SLOW);
    expect(await screen.findByRole('heading', { name: 'Les Baobabs' }, SLOW)).toBeTruthy();
  });

  it('saves the project, refuses to submit it without its repository, then submits it', async () => {
    signIn();
    const calls = stubHackathonApi({ application: 'accepted' });
    renderAppAt(`${URL_PATH}?tab=space`);
    const title = await screen.findByLabelText(/Nom du projet/, {}, SLOW);
    await waitFor(() => expect((title as HTMLInputElement).value).toBe('Projet de fatou'), SLOW);
    fireEvent.change(title, { target: { value: 'Tontine Plus' } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Une tontine en ligne.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre le projet' }));
    // The repository is required by the organizers: checked before calling the api
    expect(await screen.findByText(/Dépôt GitHub ou GitLab : obligatoire/, {}, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.url.pathname.endsWith('/submit/'))).toBe(false);

    fireEvent.change(screen.getByLabelText(/Dépôt GitHub/), { target: { value: 'https://github.com/fatou/tontine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre le projet' }));
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith('/submit/'))).toBe(true), SLOW);
    expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ title: 'Tontine Plus', description: 'Une tontine en ligne.', repository_url: 'https://github.com/fatou/tontine' });
    expect(await screen.findByText(/^Soumis/, {}, SLOW)).toBeTruthy();
  });

  it('shows the published results', async () => {
    stubHackathonApi({ member: false, results: true });
    renderAppAt(`${URL_PATH}?tab=results`);
    const ranking = await screen.findByRole('list', { name: 'Classement' }, SLOW);
    expect(ranking.textContent).toMatch(/Wari Pay/);
    expect(ranking.textContent).toMatch(/Grand prix/);
    expect(ranking.textContent).toMatch(/18\.5/);
  });
});
