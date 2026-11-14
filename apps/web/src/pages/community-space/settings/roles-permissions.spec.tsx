import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { getMyCommunity } from '@/data/community-space.data';
import store from '@/redux/store';
import { must, renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';

vi.setConfig({ testTimeout: 15_000 });

type Call = { method: string; url: URL; body: Record<string, unknown> | null };
type Perms = Record<string, boolean>;

const KEYS = [
  'can_create_posts', 'can_pin_posts', 'can_delete_posts', 'can_moderate_comments', 'can_create_events', 'can_manage_events',
  'can_create_courses', 'can_manage_courses', 'can_create_hackathons', 'can_manage_hackathons', 'can_create_projects', 'can_feature_projects',
  'can_invite_members', 'can_review_requests', 'can_sanction_members', 'can_assign_roles', 'can_manage_settings', 'can_view_analytics',
  'can_start_live',
];
const all = (value: boolean, overrides: Perms = {}): Perms => ({ ...Object.fromEntries(KEYS.map((k) => [k, value])), ...overrides });

/** A fixture community (role of the user from data/community-space.data.ts) with its role permissions */
function stubSpaceApi(slug: string, matrix: { admin: Perms; moderator: Perms; member: Perms }) {
  const { community } = must(getMyCommunity(slug));
  const calls: Call[] = [];
  let settings = { allow_member_invites: true, require_approval_to_join: false, welcome_message: '', default_post_permission: 'all_members', is_read_only: false, role_permissions: matrix, all_role_permissions: matrix };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    if (path.endsWith(`/communities/${slug}/`)) return json({ success: true, data: { ...community, settings } });
    if (path.endsWith(`/communities/${slug}/settings/`)) {
      if (request.method === 'PATCH') {
        const next = { ...settings.all_role_permissions, ...(body?.role_permissions as object) };
        settings = { ...settings, role_permissions: next, all_role_permissions: next };
      }
      return json({ success: true, data: settings });
    }
    if (path.endsWith(`/communities/${slug}/events/`) && request.method === 'POST') {
      return json({ success: false, code: 'permission_denied', message: 'Votre rôle ne vous autorise pas à gérer les événements dans cette communauté.', details: {} }, 403);
    }
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const DEFAULTS = {
  admin: all(true, { can_assign_roles: false, can_start_live: false }),
  moderator: all(false, { can_create_posts: true, can_delete_posts: true, can_moderate_comments: true }),
  member: all(false, { can_create_posts: true, can_create_projects: true }),
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Community space: roles and permissions', () => {
  it('lets the owner change the permissions of a role, save them and reset them', async () => {
    const calls = stubSpaceApi('dakar-devops', DEFAULTS);
    renderAppAt('/c/dakar-devops/settings/roles');
    const events = await screen.findByLabelText('Gérer les événements et les hackathons', {}, SLOW);
    // Only what the api applies is offered: no "Bientôt" permission left
    expect(screen.getByLabelText('Inviter de nouveaux membres')).toBeTruthy();
    expect(screen.getByLabelText('Valider les demandes d’adhésion')).toBeTruthy();
    expect(screen.queryByLabelText('Épingler des publications')).toBeNull();
    expect(screen.queryByLabelText('Sanctionner des membres')).toBeNull();
    expect(screen.queryByText('Bientôt')).toBeNull();

    // Admins can manage the events by default: the owner takes it away
    expect((events as HTMLInputElement).checked).toBe(true);
    fireEvent.click(events);
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer les permissions/ }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ role_permissions: { admin: { can_manage_events: false } } }), SLOW);
    expect(await screen.findByText(/enregistrée avec succès/, {}, SLOW)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser tous les rôles par défaut/ }));
    expect(((await screen.findByLabelText('Gérer les événements et les hackathons')) as HTMLInputElement).checked).toBe(true);
  });

  it('keeps the admins and the moderators out of the roles', async () => {
    stubSpaceApi('frontend-francophone', DEFAULTS);
    const { where } = renderAppAt('/c/frontend-francophone/settings/roles');
    await waitFor(() => expect(where()).toBe('/c/frontend-francophone/dashboard'), SLOW);
  });

  it('gives the events to a moderator once the owner allowed it', async () => {
    stubSpaceApi('python-africa-core', { ...DEFAULTS, moderator: { ...DEFAULTS.moderator, can_manage_events: true } });
    renderAppAt('/c/python-africa-core/events');
    expect(await screen.findByRole('button', { name: /Nouvel événement/ }, SLOW)).toBeTruthy();
  });

  it('takes the courses away from an admin when the owner removed it', async () => {
    stubSpaceApi('frontend-francophone', { ...DEFAULTS, admin: { ...DEFAULTS.admin, can_manage_courses: false } });
    renderAppAt('/c/frontend-francophone/courses');
    await screen.findByRole('heading', { name: /Formations/ }, SLOW);
    expect(screen.queryByRole('button', { name: /Nouvelle formation/ })).toBeNull();
  });

  it('says plainly when the api refuses (rights changed while the page was open)', async () => {
    stubSpaceApi('frontend-francophone', DEFAULTS);
    renderAppAt('/c/frontend-francophone/events');
    fireEvent.click(await screen.findByRole('button', { name: /Nouvel événement/ }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^Titre/), { target: { value: 'Live CI/CD' } });
    fireEvent.change(within(dialog).getByLabelText('Format'), { target: { value: 'external' } });
    fireEvent.change(within(dialog).getByLabelText(/Lien de connexion/), { target: { value: 'https://meet.google.com/abc' } });
    fireEvent.click(within(dialog).getByRole('button', { name: "Créer l'événement" }));
    // The message of the api, not a generic error
    expect(await screen.findByText('Votre rôle ne vous autorise pas à gérer les événements dans cette communauté.', {}, SLOW)).toBeTruthy();
  });
});
