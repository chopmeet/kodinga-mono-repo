import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { getMyCommunity } from '@/data/community-space.data';
import store from '@/redux/store';
import { onLogout } from '@/redux/slice/User.slice';
import { must, renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';

// Full app tree + Radix dialogs/menus: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 30_000 });

type Call = { method: string; url: URL; body: Record<string, unknown> | null };

/** The api of lagos-ai-data: detail (with settings and rules), PATCH, settings, rules, members */
function stubSettingsApi(slug = 'lagos-ai-data', access: { privacy_type?: string; pricing_type?: string } = {}) {
  const { community } = must(getMyCommunity(slug));
  const calls: Call[] = [];
  let detail = {
    ...community,
    ...access,
    description: 'La data à Lagos.',
    github_url: 'https://github.com/lagos-ai',
    website_url: '',
    discord_url: '',
    twitter_url: '',
    settings: { allow_member_invites: true, require_approval_to_join: false, welcome_message: '', default_post_permission: 'all_members', is_read_only: false },
    rules: [
      { id: 'r1', title: 'Bienveillance', description: '', order: 0 },
      { id: 'r2', title: 'Pas de spam', description: '', order: 1 },
    ],
  };
  let ruleId = 2;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    const base = `/communities/${slug}/`;
    if (path.endsWith(base)) {
      if (request.method === 'PATCH') detail = { ...detail, ...body };
      if (request.method === 'DELETE') return json({ success: true, data: null });
      return json({ success: true, data: detail });
    }
    if (path.endsWith(`${base}settings/`)) {
      detail = { ...detail, settings: { ...detail.settings, ...body } };
      return json({ success: true, data: detail.settings });
    }
    if (path.endsWith(`${base}rules/`)) {
      const rule = { id: `r${++ruleId}`, title: body?.title, description: body?.description ?? '', order: body?.order ?? 0 };
      detail = { ...detail, rules: [...detail.rules, rule] };
      return json({ success: true, data: rule }, 201);
    }
    const removed = path.match(/rules\/([^/]+)\/$/)?.[1];
    if (removed) {
      detail = { ...detail, rules: detail.rules.filter((r) => r.id !== removed) };
      return json({ success: true, data: null });
    }
    if (path.endsWith(`${base}members/`)) {
      return json({
        success: true,
        pagination: { count: 1 },
        results: [{ id: 'm-admin', user: { id: 'u7', username: 'chidi', first_name: 'Chidi', last_name: 'Okafor' }, role: 'admin', status: 'active', custom_title: '', joined_at: '2026-01-01', reputation_score: 0, created_at: '2026-01-01' }],
      });
    }
    if (path.endsWith('/members/m-admin/')) return json({ success: true, data: { id: 'm-admin', role: 'owner' } });
    if (path.endsWith('/communities/categories/')) return json({ success: true, data: [{ id: 'cat-ai', name: 'IA & Data', slug: 'ia-data', is_active: true }] });
    if (path.endsWith('/communities/my/')) return json({ success: true, pagination: { count: 0 }, results: [] });
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return { calls };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Community space: settings', () => {
  it('lets an admin edit the settings, without the danger zone', async () => {
    const { where } = renderAppAt('/c/frontend-francophone/settings');
    await waitFor(() => expect(where()).toBe('/c/frontend-francophone/settings/general'));
    expect(screen.getByRole('button', { name: 'Règles' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zone sensible' })).toBeNull();
  });

  it('keeps an admin out of the danger zone by url', async () => {
    const { where } = renderAppAt('/c/frontend-francophone/settings/danger');
    await waitFor(() => expect(where()).toBe('/c/frontend-francophone/dashboard'));
  });

  it('loads the community profile, checks the links, then saves it', async () => {
    const api = stubSettingsApi();
    renderAppAt('/c/lagos-ai-data/settings/general');
    const name = await screen.findByLabelText(/^Nom/, {}, SLOW);
    expect((name as HTMLInputElement).value).toBe('Lagos AI & Data Engineers');
    expect((screen.getByLabelText('GitHub') as HTMLInputElement).value).toBe('https://github.com/lagos-ai');
    const save = screen.getByRole('button', { name: 'Enregistrer' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Discord'), { target: { value: 'discord' } });
    fireEvent.click(save);
    expect(await screen.findByText('Lien invalide (https://…)', {}, SLOW)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Discord'), { target: { value: 'https://discord.gg/lagos-ai' } });
    fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'cat-ai' } });
    fireEvent.click(save);
    expect(await screen.findByText('Informations de la communauté enregistrées.', {}, SLOW)).toBeTruthy();
    expect(api.calls.find((c) => c.method === 'PATCH' && c.url.pathname.endsWith('/communities/lagos-ai-data/'))?.body).toMatchObject({
      name: 'Lagos AI & Data Engineers',
      discord_url: 'https://discord.gg/lagos-ai',
      category_id: 'cat-ai',
    });
  });

  it('saves the privacy on the community and the join rules in its settings', async () => {
    const api = stubSettingsApi();
    renderAppAt('/c/lagos-ai-data/settings/access');
    const approval = await screen.findByRole('checkbox', { name: "Valider les demandes d'adhésion" }, SLOW);
    expect((approval as HTMLInputElement).checked).toBe(false);
    fireEvent.click(approval);
    fireEvent.change(screen.getByLabelText('Visibilité'), { target: { value: 'private' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Règles d’accès enregistrées.', {}, SLOW)).toBeTruthy();
    expect(api.calls.find((c) => c.method === 'PATCH' && c.url.pathname.endsWith('/communities/lagos-ai-data/'))?.body).toEqual({ privacy_type: 'private' });
    expect(api.calls.find((c) => c.method === 'PATCH' && c.url.pathname.endsWith('/settings/'))?.body).toMatchObject({ require_approval_to_join: true, default_post_permission: 'all_members' });
  });

  it('makes a free community paid with its first plan (owner)', async () => {
    const { calls } = stubSettingsApi('dakar-devops');
    renderAppAt('/c/dakar-devops/settings/access');
    const card = await screen.findByRole('region', { name: 'Rendre la communauté payante' }, SLOW);
    fireEvent.click(within(card).getByRole('button', { name: "Fixer un prix d'adhésion" }));
    fireEvent.change(within(card).getByLabelText(/^Prix/), { target: { value: '300' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Rendre payante' }));
    expect(await within(card).findByText(/Prix minimum/, {}, SLOW)).toBeTruthy();
    fireEvent.change(within(card).getByLabelText(/^Prix/), { target: { value: '10000' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Rendre payante' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH' && c.url.pathname.endsWith('/communities/dakar-devops/'))?.body).toEqual({ pricing_type: 'paid', membership_price: 10000, membership_interval: 'month' }), SLOW);
    // Read again: now paid, the card sends to the plans
    expect((await screen.findByRole('link', { name: 'Gérer les formules' }, SLOW)).getAttribute('href')).toBe('/c/dakar-devops/payments/plans');
  });

  it('keeps a paid community private or secret', async () => {
    const api = stubSettingsApi('lagos-ai-data', { pricing_type: 'paid', privacy_type: 'private' });
    renderAppAt('/c/lagos-ai-data/settings/access');
    const visibility = await screen.findByLabelText('Visibilité', {}, SLOW);
    expect(within(visibility).getAllByRole('option').map((o) => o.textContent)).toEqual(['Privée', 'Secrète']);
    expect(screen.getByText(/Communauté payante : privée ou secrète/)).toBeTruthy();
    // One still public from before the rule: asked to change, nothing sent
    cleanup();
    act(() => {
      store.dispatch(CommunityApi.util.resetApiState());
    });
    const legacy = stubSettingsApi('lagos-ai-data', { pricing_type: 'paid', privacy_type: 'public' });
    renderAppAt('/c/lagos-ai-data/settings/access');
    fireEvent.click(await screen.findByRole('checkbox', { name: "Valider les demandes d'adhésion" }, SLOW));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText(/ne peut pas être publique : choisissez Privée ou Secrète/, {}, SLOW)).toBeTruthy();
    expect(legacy.calls.some((c) => c.method === 'PATCH')).toBe(false);
    expect(api.calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('warns that a public community becomes private once paid', async () => {
    stubSettingsApi('dakar-devops', { pricing_type: 'free', privacy_type: 'public' });
    renderAppAt('/c/dakar-devops/settings/access');
    const card = await screen.findByRole('region', { name: 'Rendre la communauté payante' }, SLOW);
    expect(within(card).getByText(/Elle deviendra privée/)).toBeTruthy();
  });

  it('shows the paid offer to the owner only', async () => {
    stubSettingsApi('frontend-francophone');
    renderAppAt('/c/frontend-francophone/settings/access');
    await screen.findByRole('heading', { name: 'Accès & publication' }, SLOW);
    expect(screen.queryByRole('region', { name: 'Rendre la communauté payante' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Gérer les formules' })).toBeNull();
  });

  it('adds, edits and deletes rules', async () => {
    const api = stubSettingsApi();
    renderAppAt('/c/lagos-ai-data/settings/rules');
    const titles = () => within(screen.getByRole('list', { name: 'Règles de la communauté' })).getAllByRole('listitem').map((li) => li.querySelector('p')?.textContent);
    await waitFor(() => expect(titles()).toEqual(['Bienveillance', 'Pas de spam']), SLOW);

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une règle' }));
    let dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^Règle/), { target: { value: 'Citez vos sources' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => expect(titles()).toEqual(['Bienveillance', 'Pas de spam', 'Citez vos sources']), SLOW);
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({ title: 'Citez vos sources', description: '', order: 2 });

    // No update on the api: replaced at the same place
    fireEvent.click(screen.getByRole('button', { name: 'Modifier « Bienveillance »' }));
    dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^Règle/), { target: { value: 'Bienveillance avant tout' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(titles()).toEqual(['Bienveillance avant tout', 'Pas de spam', 'Citez vos sources']), SLOW);

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer « Pas de spam »' }));
    await waitFor(() => expect(titles()).toEqual(['Bienveillance avant tout', 'Citez vos sources']), SLOW);
  });

  it('deletes the community only once its name is typed (owner)', async () => {
    const { community } = must(getMyCommunity('lagos-ai-data'));
    const api = stubSettingsApi();
    const { where } = renderAppAt('/c/lagos-ai-data/settings/danger');
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    const confirm = within(dialog).getByRole('button', { name: 'Supprimer définitivement' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/pour confirmer/), { target: { value: community.name } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(where()).toBe('/dashboard/communities'), SLOW);
    expect(api.calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/communities/lagos-ai-data/'))).toBe(true);
  });

  it('transfers the ownership to an administrator only', async () => {
    const { community } = must(getMyCommunity('lagos-ai-data'));
    const api = stubSettingsApi();
    renderAppAt('/c/lagos-ai-data/settings/danger');
    const select = await screen.findByLabelText('Nouveau propriétaire', {}, SLOW);
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2), SLOW);
    fireEvent.change(select, { target: { value: 'm-admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Transférer' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/pour confirmer/), { target: { value: community.name } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Transférer la propriété' }));
    expect(await screen.findByText('Chidi Okafor est maintenant propriétaire. Vous restez administrateur.', {}, SLOW)).toBeTruthy();
    expect(api.calls.find((c) => c.method === 'PATCH' && c.url.pathname.endsWith('/members/m-admin/'))?.body).toEqual({ role: 'owner' });
  });
});
