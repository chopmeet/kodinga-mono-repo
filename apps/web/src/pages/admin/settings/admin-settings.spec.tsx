import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

import store from '@/redux/store';
import { adminUsers } from '@/data/admin-users.data';
import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
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

const staff = adminUsers.filter((u) => u.is_staff);

const openMenu = async (utils: ReturnType<typeof renderAt>, name: string) => {
  const trigger = await utils.findByRole('button', { name: `Actions pour ${name}` }, SLOW);
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
};

describe('AdminSettings (mock data)', () => {
  afterEach(() => {
    store.dispatch(onLogout());
  });

  it('opens on the super admins tab, first in the tab bar', async () => {
    const utils = renderAt('');
    expect(await utils.findByRole('heading', { name: 'Super-administrateurs' })).toBeTruthy();
    expect(utils.getAllByRole('button', { name: /./ })[0].textContent).toBe('Super-administrateurs');
    for (const admin of staff) expect(utils.getByText(admin.full_name)).toBeTruthy();
  });

  it('invites a super admin, shown as pending', async () => {
    const utils = renderAt('administrators');
    fireEvent.click(await utils.findByRole('button', { name: /inviter un super-administrateur/i }));
    const dialog = await utils.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/prénom/i), { target: { value: 'Ndeye' } });
    fireEvent.change(within(dialog).getByLabelText(/^nom/i), { target: { value: 'Faye' } });
    fireEvent.change(within(dialog).getByLabelText(/adresse email/i), { target: { value: 'ndeye.faye@kodinga.dev' } });
    fireEvent.click(within(dialog).getByRole('button', { name: "Envoyer l'invitation" }));
    const row = (await utils.findByText('Ndeye Faye', {}, SLOW)).closest('tr') as HTMLElement;
    expect(within(row).getByText('Invitation en attente')).toBeTruthy();
  });

  it('revokes a super admin after confirmation', async () => {
    const utils = renderAt('administrators');
    await openMenu(utils, staff[0].full_name);
    fireEvent.click(await utils.findByRole('menuitem', { name: "Retirer l'accès" }, SLOW));
    const dialog = await utils.findByRole('dialog', {}, SLOW);
    fireEvent.click(within(dialog).getByRole('button', { name: "Retirer l'accès" }));
    await waitFor(() => expect(utils.queryByText(staff[0].full_name)).toBeNull(), SLOW);
    expect(utils.getByText(staff[1].full_name)).toBeTruthy();
  });

  it('does not let an admin remove their own access', async () => {
    store.dispatch(onSetUserToken({ user: staff[1], token: 'test-token' }));
    const utils = renderAt('administrators');
    expect(await utils.findByText('(vous)')).toBeTruthy();
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

  it('creates a category and refuses a duplicate name', async () => {
    const { getByRole, findByRole, findByText, getAllByText } = renderAt('categories');
    fireEvent.click(getByRole('button', { name: /nouvelle catégorie/i }));
    let dialog = await findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^nom/i), { target: { value: 'Robotique' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Créer la catégorie' }));
    expect(await findByText('/robotique', {}, SLOW)).toBeTruthy();

    fireEvent.click(getByRole('button', { name: /nouvelle catégorie/i }));
    dialog = await findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^nom/i), { target: { value: 'robotique' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Créer la catégorie' }));
    expect(await within(dialog).findByText('Une catégorie porte déjà ce nom.')).toBeTruthy();
    expect(getAllByText('/robotique')).toHaveLength(1);
  });

  it('shows a legal page and opens the editor', async () => {
    const { getByRole, findByText, findByRole } = renderAt('terms');
    expect(await findByText(/Kodinga met en relation des développeurs/)).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Modifier' }));
    expect(await findByRole('button', { name: 'Annuler' })).toBeTruthy();
  });
});
