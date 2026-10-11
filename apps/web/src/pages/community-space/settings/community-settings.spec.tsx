import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { getCommunityMembers } from '@/data/admin-community-details.data';
import { getMyCommunity } from '@/data/community-space.data';
import store from '@/redux/store';
import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import { must, renderAppAt, SLOW, stubApi } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

// Full app tree + Radix dialogs/menus: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });

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

  it('checks the links, then saves the community profile', async () => {
    renderAppAt('/c/lagos-ai-data/settings/general');
    const save = await screen.findByRole('button', { name: 'Enregistrer' }, SLOW);
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Discord'), { target: { value: 'discord' } });
    fireEvent.click(save);
    expect(await screen.findByText('Lien invalide (https://…)', {}, SLOW)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Discord'), { target: { value: 'https://discord.gg/lagos-ai' } });
    fireEvent.click(save);
    expect(await screen.findByText('Informations de la communauté enregistrées.', {}, SLOW)).toBeTruthy();
  });

  it('saves the join rules', async () => {
    renderAppAt('/c/lagos-ai-data/settings/access');
    const approval = await screen.findByRole('checkbox', { name: "Valider les demandes d'adhésion" }, SLOW);
    fireEvent.click(approval);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Règles d’accès enregistrées.', {}, SLOW)).toBeTruthy();
  });

  it('adds, reorders and deletes rules', async () => {
    renderAppAt('/c/lagos-ai-data/settings/rules');
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter une règle' }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^Règle/), { target: { value: 'Pas de spam' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter' }));
    await screen.findByText('Pas de spam', {}, SLOW);

    const titles = () => within(screen.getByRole('list', { name: 'Règles de la communauté' })).getAllByRole('listitem').map((li) => li.querySelector('p')?.textContent);
    expect(titles().at(-1)).toBe('Pas de spam');
    fireEvent.click(screen.getByRole('button', { name: 'Monter « Pas de spam »' }));
    expect(titles().at(-2)).toBe('Pas de spam');
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer « Pas de spam »' }));
    expect(titles()).not.toContain('Pas de spam');
  });

  it('deletes the community only once its name is typed (owner)', async () => {
    const { community } = must(getMyCommunity('lagos-ai-data'));
    // Back on /c (signed-in page): the user has no other community left
    act(() => {
      store.dispatch(onSetUserToken({ user: { id: 'u1' } as User, token: 'access', refresh: 'refresh' }));
    });
    stubApi({ 'communities/my/': { body: { success: true, pagination: { count: 0 }, results: [] } } });
    const { where } = renderAppAt('/c/lagos-ai-data/settings/danger');
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer' }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    const confirm = within(dialog).getByRole('button', { name: 'Supprimer définitivement' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/pour confirmer/), { target: { value: community.name } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(where()).toBe('/c'), SLOW);
  });

  it('transfers the ownership to an administrator only', async () => {
    const { community } = must(getMyCommunity('lagos-ai-data'));
    const admins = getCommunityMembers(community).filter((m) => m.role === 'admin' && m.status === 'active');
    renderAppAt('/c/lagos-ai-data/settings/danger');
    const select = await screen.findByLabelText('Nouveau propriétaire', {}, SLOW);
    expect(within(select).getAllByRole('option')).toHaveLength(admins.length + 1);
    fireEvent.change(select, { target: { value: admins[0].id } });
    fireEvent.click(screen.getByRole('button', { name: 'Transférer' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/pour confirmer/), { target: { value: community.name } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Transférer la propriété' }));
    expect(await screen.findByText(`${admins[0].name} est maintenant propriétaire. Vous restez administrateur.`, {}, SLOW)).toBeTruthy();
  });
});
