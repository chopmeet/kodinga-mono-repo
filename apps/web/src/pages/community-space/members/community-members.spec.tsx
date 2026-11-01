import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { CommunityMemberItem, CommunityRole, MembershipStatus } from '@/utils/api/community/community.type';
import type { User } from '@/utils/api/user/user.type';

// Full app tree + Radix dialogs/menus: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });

const member = (id: string, first_name: string, last_name: string, role: CommunityRole, status: MembershipStatus = 'active'): CommunityMemberItem => ({
  id,
  user: { id: `u-${id}`, email: `${first_name.toLowerCase()}@example.com`, username: first_name.toLowerCase(), first_name, last_name } as User,
  role,
  status,
  custom_title: '',
  joined_at: '2026-03-01T10:00:00Z',
  reputation_score: 120,
  created_at: '2026-03-01T10:00:00Z',
});

const MEMBERS = [
  member('m1', 'Moussa', 'Diallo', 'owner'),
  member('m2', 'Awa', 'Ndiaye', 'admin'),
  member('m3', 'Kofi', 'Mensah', 'moderator'),
  member('m4', 'Yao', 'Kouassi', 'member'),
  member('m5', 'Fatou', 'Sow', 'member', 'pending'),
  member('m6', 'Chidi', 'Okafor', 'member', 'suspended'),
];

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** Fake members api: list (status / role / search / pagination), decision, role, sanctions */
function stubMembersApi() {
  let members = [...MEMBERS];
  // WorkspaceInvitationSerializer: the code of a link is never listed
  let invitations = [
    { id: 'i2', email: 'awa@example.com', role: 'member', status: 'pending', expires_at: '2026-11-20T10:00:00Z', accepted_at: null, is_valid: true, invited_by: MEMBERS[0].user, created_at: '2026-10-20T10:00:00Z' },
    { id: 'i1', email: '', role: 'member', status: 'pending', expires_at: '2026-11-21T10:00:00Z', accepted_at: null, is_valid: true, invited_by: MEMBERS[0].user, created_at: '2026-10-01T10:00:00Z' },
    { id: 'i0', email: 'kofi@example.com', role: 'member', status: 'accepted', expires_at: '2026-10-08T10:00:00Z', accepted_at: '2026-10-02T10:00:00Z', is_valid: false, invited_by: MEMBERS[0].user, created_at: '2026-09-01T10:00:00Z' },
  ];
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const id = url.pathname.match(/members\/([^/]+)\//)?.[1];

    const invitationId = url.pathname.match(/invitations\/([^/]+)\//)?.[1];
    if (invitationId && url.pathname.endsWith('/resend/')) {
      invitations = invitations.map((i) => (i.id === invitationId ? { ...i, status: 'pending', is_valid: true } : i));
      return json({ success: true, data: { ...invitations.find((i) => i.id === invitationId), raw_token: 'TOKEN-AGAIN' } });
    }
    if (invitationId && request.method === 'DELETE') {
      invitations = invitations.map((i) => (i.id === invitationId ? { ...i, status: 'revoked', is_valid: false } : i));
      return json({ success: true, data: invitations.find((i) => i.id === invitationId) });
    }
    if (url.pathname.endsWith('/invitations/')) {
      if (request.method === 'POST') {
        // With an email: 30 days at most (CreateWorkspaceInvitationSerializer)
        if (body?.email && body.expires_in_days > 30) return json({ success: false, code: 'validation_error', message: 'Données invalides.', details: { expires_in_days: ['Assurez-vous que cette valeur est inférieure ou égale à 30.'] } }, 400);
        const created = { id: `i${invitations.length + 1}`, invite_code: 'CODE-NEW', email: body?.email ?? '', role: body?.role, status: 'pending', max_uses: body?.max_uses, uses_count: 0, expires_at: '2026-10-24T10:00:00Z', accepted_at: null, is_valid: true, invited_by: MEMBERS[0].user, created_at: '2026-10-17T10:00:00Z' };
        invitations = [created, ...invitations];
        return json({ success: true, data: created }, 201);
      }
      // Paginated, like StandardResultsSetPagination
      return json({ success: true, pagination: { count: invitations.length }, results: invitations });
    }
    if (id && url.pathname.endsWith('/sanctions/')) {
      if (body?.sanction_type === 'ban') members = members.map((m) => (m.id === id ? { ...m, status: 'banned' } : m));
      return json({ success: true, data: { id: 's1' } }, 201);
    }
    if (id && request.method === 'PUT') {
      members = members.map((m) => (m.id === id ? { ...m, status: body?.approve ? 'active' : 'rejected' } : m));
      return json({ success: true, data: members.find((m) => m.id === id) });
    }
    if (id && request.method === 'PATCH') {
      members = members.map((m) => (m.id === id ? { ...m, role: body?.role } : m));
      return json({ success: true, data: members.find((m) => m.id === id) });
    }
    if (url.pathname.endsWith('/members/')) {
      const p = url.searchParams;
      const search = (p.get('search') ?? '').toLowerCase();
      const found = members.filter(
        (m) =>
          (!p.get('status') || m.status === p.get('status')) &&
          (!p.get('role') || m.role === p.get('role')) &&
          (!search || `${m.user.username} ${m.user.first_name} ${m.user.last_name}`.toLowerCase().includes(search)),
      );
      const size = Number(p.get('page_size') ?? 20);
      const page = Number(p.get('page') ?? 1);
      return json({ success: true, pagination: { count: found.length }, results: found.slice((page - 1) * size, page * size) });
    }
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
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

describe('Community space: members', () => {
  it('opens on the join requests from the dashboard link, with the counts of each status', async () => {
    const calls = stubMembersApi();
    renderAppAt('/c/python-africa-core/members?status=pending');
    // The table is rendered again once loaded (skeleton first)
    await waitFor(() => expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2), SLOW);
    expect(within(screen.getByRole('table')).getByText('Fatou Sow')).toBeTruthy();
    expect(screen.getByRole('button', { name: /En attente/, pressed: true }).textContent).toContain('1');
    expect(await screen.findByRole('button', { name: /Tous 6/ }, SLOW)).toBeTruthy();
    expect(calls.some((c) => c.url.searchParams.get('status') === 'pending' && c.url.searchParams.get('page_size') === '10')).toBe(true);
  });

  it('approves a join request in one click', async () => {
    const calls = stubMembersApi();
    const { where } = renderAppAt('/c/python-africa-core/members?status=pending');
    fireEvent.click(await screen.findByRole('button', { name: 'Approuver Fatou Sow' }, SLOW));
    expect(await screen.findByText('Fatou Sow a rejoint la communauté.', {}, SLOW)).toBeTruthy();
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ approve: true });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Approuver Fatou Sow' })).toBeNull(), SLOW);
    expect(where()).toBe('/c/python-africa-core/members?status=pending');
  });

  it('searches and filters on the role through the api', async () => {
    const calls = stubMembersApi();
    renderAppAt('/c/dakar-devops/members');
    await screen.findByText('Yao Kouassi', {}, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Modérateurs' }));
    await waitFor(() => expect(screen.queryByText('Yao Kouassi')).toBeNull(), SLOW);
    expect(screen.getByText('Kofi Mensah')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tous les rôles' }));
    fireEvent.change(screen.getByLabelText('Rechercher un membre'), { target: { value: 'awa' } });
    await waitFor(() => expect(calls.some((c) => c.url.searchParams.get('search') === 'awa')).toBe(true), SLOW);
    await waitFor(() => expect(screen.queryByText('Kofi Mensah')).toBeNull(), SLOW);
    expect(screen.getByText('Awa Ndiaye')).toBeTruthy();
  });

  it('gives a moderator no action on the owner and the admins', async () => {
    stubMembersApi();
    renderAppAt('/c/python-africa-core/members');
    await screen.findByText('Kofi Mensah', {}, SLOW);
    expect(screen.queryByRole('button', { name: 'Actions pour Moussa Diallo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Actions pour Awa Ndiaye' })).toBeNull();
    const menu = await openMenu('Actions pour Kofi Mensah');
    expect(within(menu).queryByRole('menuitem', { name: /Nommer/ })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Suspendre' })).toBeTruthy();
  });

  it('lets the owner name a moderator', async () => {
    const calls = stubMembersApi();
    renderAppAt('/c/dakar-devops/members');
    const menu = await openMenu('Actions pour Yao Kouassi');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Nommer modérateur' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ role: 'moderator' }), SLOW);
    expect(calls.find((c) => c.method === 'PATCH')?.url.pathname).toMatch(/\/communities\/dakar-devops\/members\/m4\/$/);
    expect(await screen.findByText('Yao Kouassi est maintenant modérateur.', {}, SLOW)).toBeTruthy();
  });

  it('shows reactivation as coming soon on a suspended member', async () => {
    stubMembersApi();
    renderAppAt('/c/dakar-devops/members');
    const menu = await openMenu('Actions pour Chidi Okafor');
    expect(within(menu).getByRole('menuitem', { name: /Réactiver/ }).getAttribute('aria-disabled')).toBe('true');
  });

  it('warns a member, without a duration', async () => {
    const calls = stubMembersApi();
    renderAppAt('/c/dakar-devops/members');
    const menu = await openMenu('Actions pour Yao Kouassi');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Avertir' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    expect(within(dialog).queryByLabelText('Durée')).toBeNull();
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Ton agressif en commentaire' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Avertir' }));
    expect(await screen.findByText('Yao Kouassi a reçu un avertissement.', {}, SLOW)).toBeTruthy();
    expect(calls.find((c) => c.url.pathname.endsWith('/m4/sanctions/'))?.body).toEqual({
      sanction_type: 'warning',
      reason: 'Ton agressif en commentaire',
      duration_days: null,
    });
  });

  it('mutes a member for the chosen duration', async () => {
    const calls = stubMembersApi();
    renderAppAt('/c/dakar-devops/members');
    const menu = await openMenu('Actions pour Yao Kouassi');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Mettre en sourdine' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText('Durée'), { target: { value: '1' } });
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Flood dans le fil' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mettre en sourdine' }));
    expect(await screen.findByText('Yao Kouassi est en sourdine pour 1 jour.', {}, SLOW)).toBeTruthy();
    expect(calls.find((c) => c.url.pathname.endsWith('/m4/sanctions/'))?.body).toEqual({ sanction_type: 'mute', reason: 'Flood dans le fil', duration_days: 1 });
  });

  it('asks a reason before banning (owner)', async () => {
    const calls = stubMembersApi();
    renderAppAt('/c/dakar-devops/members');
    const menu = await openMenu('Actions pour Awa Ndiaye');
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Bannir' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bannir' }));
    expect(await within(dialog).findByText('Indiquez le motif (5 caractères minimum)', {}, SLOW)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Spam répété dans le fil' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bannir' }));
    expect(await screen.findByText('Awa Ndiaye a été banni.', {}, SLOW)).toBeTruthy();
    expect(calls.find((c) => c.url.pathname.endsWith('/m2/sanctions/'))?.body).toEqual({ sanction_type: 'ban', reason: 'Spam répété dans le fil', duration_days: null });
  });

  it('lets the owner create an invitation link, up to the admin role', async () => {
    const calls = stubMembersApi();
    renderAppAt('/c/dakar-devops/members');
    fireEvent.click(await screen.findByRole('button', { name: /Inviter des membres/ }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    // The pending ones, the past ones on demand
    const pending = await within(dialog).findByRole('list', { name: 'Invitations en attente' }, SLOW);
    expect(within(pending).getAllByRole('listitem')).toHaveLength(2);
    expect(within(pending).getByText('Lien partageable')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /Voir les invitations passées \(1\)/ }));
    expect(within(within(dialog).getByRole('list', { name: 'Invitations passées' })).getByText('Acceptée')).toBeTruthy();

    const role = within(dialog).getByLabelText("Rôle à l'arrivée");
    expect(within(role).getAllByRole('option').map((o) => o.textContent)).toEqual(['Membre', 'Modérateur', 'Administrateur']);
    fireEvent.change(role, { target: { value: 'moderator' } });
    fireEvent.change(within(dialog).getByLabelText(/Nombre d'utilisations/), { target: { value: '5' } });
    fireEvent.change(within(dialog).getByLabelText('Valable'), { target: { value: '30' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Créer le lien/ }));

    const link = (await within(dialog).findByLabelText("Lien d'invitation", {}, SLOW)) as HTMLInputElement;
    expect(link.value).toMatch(/\/invitations\/CODE-NEW\?community=dakar-devops$/);
    expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/invitations/'))?.body).toEqual({ role: 'moderator', max_uses: 5, expires_in_days: 30 });
  });

  it('invites by email for 30 days at most, then revokes or sends an invitation again', async () => {
    const calls = stubMembersApi();
    renderAppAt('/c/dakar-devops/members');
    fireEvent.click(await screen.findByRole('button', { name: /Inviter des membres/ }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/Email/), { target: { value: 'fatou@example.com' } });
    // One person: no number of uses, no 90 days
    expect(within(dialog).queryByLabelText(/Nombre d'utilisations/)).toBeNull();
    expect(within(within(dialog).getByLabelText('Valable')).getAllByRole('option').map((o) => o.textContent)).toEqual(['1 jour', '7 jours', '30 jours']);
    fireEvent.click(within(dialog).getByRole('button', { name: /Envoyer l’invitation/ }));
    expect(await within(dialog).findByText('Invitation envoyée à fatou@example.com', {}, SLOW)).toBeTruthy();
    expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/invitations/'))?.body).toEqual({ role: 'member', expires_in_days: 7, email: 'fatou@example.com' });

    // Sent again: a new link to copy
    const pending = await within(dialog).findByRole('list', { name: 'Invitations en attente' }, SLOW);
    fireEvent.click(within(pending).getByRole('button', { name: "Renvoyer l'invitation à awa@example.com" }));
    const renewed = (await within(dialog).findByLabelText('Nouveau lien pour awa@example.com', {}, SLOW)) as HTMLInputElement;
    expect(renewed.value).toMatch(/\/invitations\/TOKEN-AGAIN\?community=dakar-devops$/);
    expect(calls.some((c) => c.method === 'POST' && c.url.pathname.endsWith('/workspaces/dakar-devops/invitations/i2/resend/'))).toBe(true);

    // Revoked: leaves the pending ones
    fireEvent.click(within(pending).getByRole('button', { name: "Révoquer l'invitation : Lien partageable" }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/workspaces/dakar-devops/invitations/i1/'))).toBe(true), SLOW);
    await waitFor(() => expect(within(within(dialog).getByRole('list', { name: 'Invitations en attente' })).queryByText('Lien partageable')).toBeNull(), SLOW);
  });

  it('lets an admin invite up to moderator, and a moderator not at all', async () => {
    stubMembersApi();
    renderAppAt('/c/frontend-francophone/members');
    fireEvent.click(await screen.findByRole('button', { name: /Inviter des membres/ }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    expect(within(within(dialog).getByLabelText("Rôle à l'arrivée")).getAllByRole('option').map((o) => o.textContent)).toEqual(['Membre', 'Modérateur']);
    cleanup();

    renderAppAt('/c/python-africa-core/members');
    await screen.findByRole('heading', { name: 'Membres' }, SLOW);
    expect(screen.queryByRole('button', { name: /Inviter des membres/ })).toBeNull();
  });
});
