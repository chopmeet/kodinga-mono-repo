import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

import store from '@/redux/store';
import { adminUsers } from '@/data/admin-users.data';
import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import { must, stubUsersAdmin } from '@/test-utils';
import { UserApi } from '@/utils/api/user/user.api';
import AdminSettings from './admin-settings';
import AdministratorsSettingsTab from './tabs/administrators';
import CategoriesSettingsTab from './tabs/categories';
import GeneralSettingsTab from './tabs/general';
import LegalPageTab from './tabs/legal-page';
import MonetizationSettingsTab from './tabs/monetization';

const SLOW = { timeout: 3000 };

const renderAt = (tab: string) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[tab ? `/admin/settings/${tab}` : '/admin/settings']}>
        <Routes>
          <Route path="/admin/settings" element={<AdminSettings />}>
            <Route index element={<Navigate to="administrators" replace />} />
            <Route path="administrators" element={<AdministratorsSettingsTab />} />
            <Route path="general" element={<GeneralSettingsTab />} />
            <Route path="categories" element={<CategoriesSettingsTab />} />
            <Route path="monetization" element={<MonetizationSettingsTab />} />
            <Route path="terms" element={<LegalPageTab key="terms" pageId="terms" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Provider>
  );

// Accounts of the fake api: the mock staff are the super-admins
const accounts = adminUsers.map((u) => ({ ...u, is_superadmin: u.is_staff }));
const staff = accounts.filter((u) => u.is_superadmin);
const member = must(accounts.find((u) => !u.is_superadmin && u.is_active));

const category = (id: string, name: string, slug: string, order: number, communities_count: number) => ({
  id, name, slug, description: '', icon_url: '', order, is_active: true, communities_count, created_at: '2026-01-01T00:00:00Z',
});

/** Fake communities/categories/ CRUD (the api refuses a duplicate name, like CategoryService) */
function stubCategoriesApi() {
  let categories = [category('c1', 'Cloud & DevOps', 'cloud-devops', 1, 4), category('c2', 'Game Development', 'game-development', 2, 0)];
  const calls: { method: string; url: URL; body: unknown }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : {};
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const slug = url.pathname.match(/categories\/([^/]+)\/$/)?.[1];
    if (request.method === 'POST') {
      if (categories.some((c) => c.name.toLowerCase() === String(body.name).trim().toLowerCase())) {
        return json({ success: false, code: 'validation_error', message: 'Invalid', details: { name: ['Une catégorie avec ce nom existe déjà.'] } }, 400);
      }
      const created = category(`c${categories.length + 1}`, body.name, body.slug, body.order, 0);
      categories = [...categories, created];
      return json({ success: true, data: created }, 201);
    }
    if (request.method === 'PATCH' && slug) {
      categories = categories.map((c) => (c.slug === slug ? { ...c, ...body } : c));
      return json({ success: true, data: categories.find((c) => c.slug === (body.slug ?? slug)) });
    }
    if (request.method === 'DELETE' && slug) {
      categories = categories.filter((c) => c.slug !== slug);
      return json({ success: true });
    }
    return json({ success: true, data: categories });
  });
  return calls;
}

const openMenu = async (utils: ReturnType<typeof renderAt>, name: string) => {
  const trigger = await utils.findByRole('button', { name: `Actions pour ${name}` }, SLOW);
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
};

describe('AdminSettings', () => {
  beforeEach(() => {
    stubUsersAdmin(accounts);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    act(() => {
      store.dispatch(onLogout());
      store.dispatch(UserApi.util.resetApiState());
    });
  });

  it('opens on the super admins tab, first in the tab bar, with the super admins of the api', async () => {
    const utils = renderAt('');
    expect(await utils.findByRole('heading', { name: 'Super-administrateurs' })).toBeTruthy();
    expect(utils.getAllByRole('button', { name: /./ })[0].textContent).toBe('Super-administrateurs');
    for (const admin of staff) expect(await utils.findByText(admin.full_name, {}, SLOW)).toBeTruthy();
    expect(utils.queryByText(member.full_name)).toBeNull();
  });

  it('promotes an existing account found by its email', async () => {
    const calls = stubUsersAdmin(accounts);
    const utils = renderAt('administrators');
    fireEvent.click(await utils.findByRole('button', { name: /ajouter un super-administrateur/i }));
    const dialog = await utils.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText('Rechercher un compte'), { target: { value: member.email } });
    fireEvent.click(await within(dialog).findByRole('button', { name: `Nommer ${member.full_name} super-administrateur` }, SLOW));
    expect(await utils.findByText(member.full_name, {}, SLOW)).toBeTruthy();
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url.pathname).toMatch(new RegExp(`admin/users/${member.id}/toggle-admin/$`));
    expect(post?.body).toEqual({ is_superadmin: true });
  });

  it('revokes a super admin after confirmation', async () => {
    const calls = stubUsersAdmin(accounts);
    const utils = renderAt('administrators');
    await openMenu(utils, staff[0].full_name);
    fireEvent.click(await utils.findByRole('menuitem', { name: "Retirer l'accès" }, SLOW));
    const dialog = await utils.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: "Retirer l'accès" }));
    await waitFor(() => expect(utils.queryByText(staff[0].full_name)).toBeNull(), SLOW);
    expect(utils.getByText(staff[1].full_name)).toBeTruthy();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ is_superadmin: false });
  });

  it('does not let an admin remove their own access', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: staff[1], token: 'test-token' }));
    });
    const utils = renderAt('administrators');
    expect(await utils.findByText('(vous)', {}, SLOW)).toBeTruthy();
    await openMenu(utils, staff[1].full_name);
    fireEvent.click(await utils.findByRole('menuitem', { name: "Retirer l'accès" }, SLOW));
    await waitFor(() => expect(utils.queryByRole('menu')).toBeNull(), SLOW);
    expect(utils.queryByRole('dialog')).toBeNull();
    expect(utils.getByText(staff[1].full_name)).toBeTruthy();
  });

  it('saves the general settings and keeps them when switching tabs', async () => {
    const { getByLabelText, getByRole, findByRole } = renderAt('general');
    const save = getByRole('button', { name: 'Enregistrer' });
    expect(save).toHaveProperty('disabled', true);

    fireEvent.change(getByLabelText(/nom de la plateforme/i), { target: { value: 'Kodinga Africa' } });
    await waitFor(() => expect(save).toHaveProperty('disabled', false));
    fireEvent.click(save);
    await waitFor(() => expect(getByRole('button', { name: 'Enregistrer' })).toHaveProperty('disabled', true), SLOW);

    fireEvent.click(getByRole('button', { name: 'Catégories' }));
    await findByRole('heading', { name: 'Catégories' });
    fireEvent.click(getByRole('button', { name: 'Général' }));
    await findByRole('heading', { name: 'Général' });
    expect(((await findByRole('textbox', { name: /nom de la plateforme/i })) as HTMLInputElement).value).toBe('Kodinga Africa');
  });

  it('validates the support email', async () => {
    const { getByLabelText, getByRole, findByText } = renderAt('general');
    fireEvent.change(getByLabelText(/email de support/i), { target: { value: 'pas-un-email' } });
    fireEvent.click(getByRole('button', { name: 'Enregistrer' }));
    expect(await findByText('Adresse email invalide')).toBeTruthy();
  });

  it('keeps at least one payment channel enabled', async () => {
    const { getAllByRole, getByRole, findByRole } = renderAt('monetization');
    for (const sw of getAllByRole('checkbox')) if ((sw as HTMLInputElement).checked) fireEvent.click(sw);
    fireEvent.click(getByRole('button', { name: 'Enregistrer' }));
    expect((await findByRole('alert')).textContent).toBe('Gardez au moins un moyen de paiement actif.');
  });

  it('creates a category through the api, which refuses a duplicate name', async () => {
    const calls = stubCategoriesApi();
    const { getByRole, findByRole, findByText } = renderAt('categories');
    expect(await findByText('Cloud & DevOps', {}, SLOW)).toBeTruthy();

    fireEvent.click(getByRole('button', { name: /nouvelle catégorie/i }));
    let dialog = await findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^nom/i), { target: { value: 'Robotique' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Créer la catégorie' }));
    expect(await findByText('/robotique', {}, SLOW)).toBeTruthy();
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ name: 'Robotique', slug: 'robotique', order: 3 });

    fireEvent.click(getByRole('button', { name: /nouvelle catégorie/i }));
    dialog = await findByRole('dialog', {}, SLOW);
    // Same name in another case: the modal lets it through, the api refuses it
    fireEvent.change(within(dialog).getByLabelText(/^nom/i), { target: { value: 'ROBOTIQUE ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Créer la catégorie' }));
    expect(await within(dialog).findByText(/porte déjà ce nom|existe déjà/, {}, SLOW)).toBeTruthy();
  });

  it('deactivates a category, and deletes for good one without communities', async () => {
    const calls = stubCategoriesApi();
    const utils = renderAt('categories');
    await openMenu(utils, 'Cloud & DevOps');
    let menu = await utils.findByRole('menu', {}, SLOW);
    // Used by communities: no definitive delete
    expect(within(menu).queryByRole('menuitem', { name: 'Supprimer' })).toBeNull();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Désactiver' }));
    const row = utils.getByText('Cloud & DevOps').closest('tr') as HTMLElement;
    expect(await within(row).findByText(/Désactivée|Inactive/, {}, SLOW)).toBeTruthy();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ is_active: false });

    await openMenu(utils, 'Game Development');
    menu = await utils.findByRole('menu', {}, SLOW);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Supprimer' }));
    const dialog = await utils.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() => expect(utils.queryByText('Game Development')).toBeNull(), SLOW);
    const del = calls.find((c) => c.method === 'DELETE');
    expect(del?.url.searchParams.get('hard_delete')).toBe('true');
  });

  it('shows a legal page and opens the editor', async () => {
    const { getByRole, findByText, findByRole } = renderAt('terms');
    expect(await findByText(/Kodinga met en relation des développeurs/)).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Modifier' }));
    expect(await findByRole('button', { name: 'Annuler' })).toBeTruthy();
  });
});
