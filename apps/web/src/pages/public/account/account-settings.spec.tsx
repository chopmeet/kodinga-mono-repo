import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { UserApi } from '@/utils/api/user/user.api';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

function stubAccountApi() {
  const calls: Call[] = [];
  const profile = {
    id: 'p1',
    user: { id: 'u1', username: 'fatou', first_name: 'Fatou', last_name: 'Sow' },
    display_name: 'Fatou Sow',
    headline: '',
    bio: '',
    avatar_url: '',
    banner_url: '',
    location: '',
    country_code: '',
    website_url: '',
    github_username: '',
    gitlab_username: '',
    linkedin_url: '',
    twitter_handle: '',
    youtube_url: '',
    discord_handle: '',
    custom_links: [],
    years_of_experience: null as number | null,
    availability_status: 'open_to_offers',
    is_public: true,
    is_mentor: false,
    open_to_freelance: true,
    open_to_remote: true,
    open_to_relocation: false,
    completion_percentage: 40,
    skills: [{ id: 's1', technology: { id: 't1', name: 'React' }, level: 'advanced', years_of_experience: 3, is_highlighted: true }],
    experiences: [] as unknown[],
    educations: [] as unknown[],
    portfolio_projects: [] as unknown[],
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    if (path.endsWith('/users/me/')) return json({ success: true, data: { id: 'u1', username: 'fatou', email: 'fatou@example.com', ...body } });
    if (path.endsWith('/profiles/me/')) {
      if (request.method === 'PATCH') Object.assign(profile, body);
      return json({ success: true, data: profile });
    }
    if (path.endsWith('/profiles/technologies/')) return json({ success: true, data: [{ id: 't2', name: 'Django', slug: 'django' }] });
    if (path.endsWith('/profiles/me/skills/') && request.method === 'POST') {
      profile.skills.push({ id: 's2', technology: { id: 't2', name: 'Django' }, level: body?.level, years_of_experience: body?.years_of_experience, is_highlighted: false });
      return json({ success: true, data: {} }, 201);
    }
    if (path.endsWith('/profiles/me/skills/s1/')) {
      profile.skills = profile.skills.filter((s) => s.id !== 's1');
      return json({ success: true, data: null });
    }
    if (path.endsWith('/profiles/me/experiences/')) {
      profile.experiences.push({ id: 'x1', technologies: [], ...body });
      return json({ success: true, data: {} }, 201);
    }
    if (path.endsWith('/auth/password/change/')) {
      if (body?.current_password !== 'ancien-mdp') {
        return json({ success: false, code: 'validation_error', message: 'Erreur', details: { current_password: ['Current password is incorrect.'] } }, 400);
      }
      return json({ success: true, data: null });
    }
    if (path.endsWith('/auth/sessions/')) {
      return json({
        success: true,
        data: [
          { id: 'se1', device_name: '', ip_address: '41.82.10.2', user_agent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile', last_seen_at: null, expires_at: '2030-01-01T00:00:00Z', is_active: true, revoked_at: null, created_at: new Date(Date.now() - 3_600_000).toISOString() },
        ],
      });
    }
    if (path.endsWith('/auth/sessions/se1/')) return json({ success: true, data: null });
    if (path.endsWith('/auth/logout-all/')) return json({ success: true, data: null });
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const signIn = () =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'fatou', first_name: 'Fatou', last_name: 'Sow' } as User, token: `${b64({ alg: 'HS256' })}.${b64({ exp: 4102444800 })}.sig`, refresh: 'r' }));
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(UserApi.util.resetApiState());
  });
});

describe('Account settings', () => {
  it('sends a visitor to the login page', async () => {
    stubAccountApi();
    const { where } = renderAppAt('/account/profile');
    await waitFor(() => expect(where()).toBe('/auth/login?next=%2Faccount%2Fprofile'), SLOW);
  });

  it('shows the account as a dashboard, its sections in the sidebar', async () => {
    signIn();
    stubAccountApi();
    const { where } = renderAppAt('/account/skills');
    expect(await screen.findByRole('heading', { name: 'Compétences' }, SLOW)).toBeTruthy();
    const security = screen.getByRole('link', { name: 'Sécurité' });
    expect(security.getAttribute('href')).toBe('/account/security');
    expect(screen.getByRole('link', { name: 'Compétences' }).getAttribute('data-active')).toBe('true');
    fireEvent.click(security);
    expect(await screen.findByRole('heading', { name: 'Sécurité' }, SLOW)).toBeTruthy();
    expect(where()).toBe('/account/security');
  });

  it('saves the identity and the developer profile', async () => {
    signIn();
    const calls = stubAccountApi();
    renderAppAt('/account');
    const headline = await screen.findByLabelText('Titre', {}, SLOW);
    expect(screen.getByRole('progressbar', { name: 'Profil complété' }).getAttribute('aria-valuenow')).toBe('40');
    fireEvent.change(headline, { target: { value: 'Développeuse full-stack' } });
    fireEvent.change(screen.getByLabelText('GitHub'), { target: { value: 'https://github.com/fatou' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
    // A username, not a link
    expect(await screen.findByText('Le nom d’utilisateur seul, sans lien', {}, SLOW)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('GitHub'), { target: { value: 'fatou' } });
    fireEvent.change(screen.getByLabelText('Années d’expérience'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le profil' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && c.url.pathname.endsWith('/profiles/me/'))).toBe(true), SLOW);
    expect(calls.find((c) => c.method === 'PATCH' && c.url.pathname.endsWith('/users/me/'))?.body).toEqual({ first_name: 'Fatou', last_name: 'Sow' });
    expect(calls.find((c) => c.method === 'PATCH' && c.url.pathname.endsWith('/profiles/me/'))?.body).toMatchObject({ headline: 'Développeuse full-stack', github_username: 'fatou', years_of_experience: 4, is_public: true });
  });

  it('adds a skill from the catalog and removes another one', async () => {
    signIn();
    const calls = stubAccountApi();
    renderAppAt('/account/skills');
    const list = await screen.findByRole('list', { name: 'Mes compétences' }, SLOW);
    expect(within(list).getByText('React')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Technologie'), { target: { value: 'Dja' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Django' }, SLOW));
    fireEvent.change(screen.getByLabelText('Niveau'), { target: { value: 'expert' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter Django' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/skills/'))?.body).toEqual({ technology_id: 't2', level: 'expert', years_of_experience: 1, is_highlighted: false }), SLOW);
    expect(await within(screen.getByRole('list', { name: 'Mes compétences' })).findByText('Django', {}, SLOW)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retirer React' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/skills/s1/'))).toBe(true), SLOW);
  });

  it('adds an experience with month dates', async () => {
    signIn();
    const calls = stubAccountApi();
    renderAppAt('/account/career');
    fireEvent.click(await screen.findByRole('button', { name: /Ajouter une expérience/ }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText('Poste'), { target: { value: 'Développeuse backend' } });
    fireEvent.change(within(dialog).getByLabelText('Entreprise'), { target: { value: 'Wave' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/mois de début/);
    fireEvent.change(within(dialog).getByLabelText('Début'), { target: { value: '2023-02' } });
    fireEvent.click(within(dialog).getByLabelText('J’occupe ce poste actuellement'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/experiences/'))?.body).toMatchObject({ title: 'Développeuse backend', company_name: 'Wave', start_date: '2023-02-01', end_date: null, is_current: true, technology_ids: [] }), SLOW);
    expect(await screen.findByText('Développeuse backend', {}, SLOW)).toBeTruthy();
  });

  it('changes the password, with the errors of the api under the fields', async () => {
    signIn();
    const calls = stubAccountApi();
    renderAppAt('/account/security');
    const current = await screen.findByLabelText('Mot de passe actuel', {}, SLOW);
    fireEvent.change(current, { target: { value: 'faux-mdp' } });
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'Teranga2026!' } });
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'Teranga2026?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));
    expect(await screen.findByText('Les deux mots de passe ne correspondent pas', {}, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.url.pathname.endsWith('/password/change/'))).toBe(false);

    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'Teranga2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }));
    await waitFor(() => expect(calls.some((c) => c.url.pathname.endsWith('/password/change/'))).toBe(true), SLOW);
    // Under the field, in French (the api answers in English)
    expect(await screen.findByText('Le mot de passe actuel est incorrect.', {}, SLOW)).toBeTruthy();
  });

  it('closes a session, then logs out everywhere', async () => {
    signIn();
    const calls = stubAccountApi();
    const { where } = renderAppAt('/account/security');
    const sessions = await screen.findByRole('list', { name: 'Appareils connectés' }, SLOW);
    expect(within(sessions).getByText('Chrome · Android')).toBeTruthy();
    fireEvent.click(within(sessions).getByRole('button', { name: 'Déconnecter' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/auth/sessions/se1/'))).toBe(true), SLOW);

    fireEvent.click(screen.getByRole('button', { name: /Se déconnecter de tous les appareils/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => expect(where()).toBe('/auth/login'), SLOW);
    expect(store.getState().user.token).toBeNull();
  });
});
