import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import { adminUsers } from '@/data/admin-users.data';
import store from '@/redux/store';
import { UserApi } from '@/utils/api/user/user.api';
import type { User } from '@/utils/api/user/user.type';
import { must, stubUsersAdmin } from '@/test-utils';
import AdminUsers from './admin-users';

// Network stubs + Radix sheet: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });
const SLOW = { timeout: 3000 };

const renderPage = () =>
  render(
    <Provider store={store}>
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    </Provider>
  );

const users: User[] = adminUsers.map((u) => ({ ...u, is_superadmin: u.is_staff }));

const stubUsersApi = () => stubUsersAdmin(users);

const rows = (container: HTMLElement) => Array.from(container.querySelectorAll('tbody tr'));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(UserApi.util.resetApiState());
  });
});

describe('AdminUsers', () => {
  it('lists the first page of the api and the totals by status', async () => {
    stubUsersApi();
    const { container } = renderPage();
    expect(await screen.findByText(users[0].email, {}, SLOW)).toBeTruthy();
    expect(rows(container)).toHaveLength(10);
    const kpis = screen.getByRole('region', { name: 'Indicateurs utilisateurs' });
    const total = within(kpis).getByText('Utilisateurs').closest('div')?.parentElement as HTMLElement;
    await waitFor(() => expect(within(total).getByText(String(users.length))).toBeTruthy(), SLOW);
    const suspended = within(kpis).getByText('Comptes suspendus').closest('div')?.parentElement as HTMLElement;
    await waitFor(() => expect(within(suspended).getByText(String(users.filter((u) => !u.is_active).length))).toBeTruthy(), SLOW);
  });

  it('sends the search to the api and starts again from page 1', async () => {
    const calls = stubUsersApi();
    const { container } = renderPage();
    await screen.findByText(users[0].email, {}, SLOW);
    const target = users[5];
    fireEvent.change(screen.getByRole('searchbox', { name: /rechercher un utilisateur/i }), { target: { value: target.email } });
    await waitFor(() => expect(rows(container)).toHaveLength(1), SLOW);
    const last = calls.map((c) => c.url).filter((u) => u.searchParams.get('page_size') === '10').at(-1);
    expect(last?.searchParams.get('search')).toBe(target.email);
    expect(last?.searchParams.get('page')).toBe('1');
  });

  it('maps the "Suspendus" filter to the api inactive status', async () => {
    const calls = stubUsersApi();
    const { container } = renderPage();
    await screen.findByText(users[0].email, {}, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Suspendus' }));
    const suspended = users.filter((u) => !u.is_active);
    await waitFor(() => expect(rows(container)).toHaveLength(Math.min(10, suspended.length)), SLOW);
    expect(calls.map((c) => c.url).some((u) => u.searchParams.get('status') === 'inactive' && u.searchParams.get('page_size') === '10')).toBe(true);
  });

  it('opens the profile sheet from the name', async () => {
    stubUsersApi();
    renderPage();
    const target = users[0];
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(target.email) }, SLOW));
    const sheet = await screen.findByRole('dialog', {}, SLOW);
    expect(within(sheet).getByText(`@${target.username}`)).toBeTruthy();
    expect(within(sheet).getByText(target.timezone)).toBeTruthy();
  });

  it('allows filtering users by role: creator, member, admin', async () => {
    const calls = stubUsersApi();
    renderPage();
    await screen.findByText(users[0].email, {}, SLOW);
    const roles = screen.getByRole('group', { name: 'Filtrer par rôle' });
    const creatorBtn = within(roles).getByRole('button', { name: 'Créateurs' }) as HTMLButtonElement;
    expect(creatorBtn.disabled).toBe(false);
    fireEvent.click(creatorBtn);
    await waitFor(() => {
      expect(calls.some((c) => c.url.searchParams.get('role') === 'creator')).toBe(true);
    }, SLOW);
  });

  it('appoints a super admin from the actions menu', async () => {
    const target = must(users.find((u) => !u.is_superadmin && u.is_active));
    const calls = stubUsersApi();
    renderPage();
    const trigger = await screen.findByRole('button', { name: `Actions pour ${target.full_name}` }, SLOW);
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(within(await screen.findByRole('menu', {}, SLOW)).getByRole('menuitem', { name: 'Nommer administrateur' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true), SLOW);
    const post = must(calls.find((c) => c.method === 'POST'));
    expect(post.url.pathname).toMatch(new RegExp(`admin/users/${target.id}/toggle-admin/$`));
    expect(post.body).toEqual({ is_superadmin: true });
  });

  it('suspends an account with a reason, after confirmation', async () => {
    const target = must(users.find((u) => !u.is_superadmin && u.is_active));
    const calls = stubUsersApi();
    renderPage();
    const trigger = await screen.findByRole('button', { name: `Actions pour ${target.full_name}` }, SLOW);
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.click(within(await screen.findByRole('menu', {}, SLOW)).getByRole('menuitem', { name: 'Suspendre le compte' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: 'Spam' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspendre' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), SLOW);
    const post = must(calls.find((c) => c.method === 'POST'));
    expect(post.url.pathname).toMatch(new RegExp(`admin/users/${target.id}/toggle-status/$`));
    expect(post.body).toEqual({ is_active: false, reason: 'Spam' });
  });

  it('offers to retry when the api cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(JSON.stringify({ success: false, code: 'error', message: 'Service indisponible.' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    renderPage();
    expect(await screen.findByText('Service indisponible.', {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });
});
