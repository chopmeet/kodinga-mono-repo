import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import { adminUsers } from '@/data/admin-users.data';
import store from '@/redux/store';
import { UserApi } from '@/utils/api/user/user.api';
import type { User } from '@/utils/api/user/user.type';
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

const users: User[] = adminUsers;

/** Fake GET users/ (search, status, page, page_size), like apps/accounts/views/user.py */
function stubUsersApi() {
  const urls: URL[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL((input as Request).url);
    urls.push(url);
    const p = url.searchParams;
    const q = (p.get('search') ?? '').toLowerCase();
    const status = p.get('status');
    const found = users.filter(
      (u) =>
        (!q || `${u.email} ${u.username} ${u.first_name} ${u.last_name}`.toLowerCase().includes(q)) &&
        (status !== 'active' || (u.is_active && u.is_email_verified)) &&
        (status !== 'unverified' || (u.is_active && !u.is_email_verified)) &&
        (status !== 'inactive' || !u.is_active)
    );
    const page = Number(p.get('page') ?? 1);
    const size = Number(p.get('page_size') ?? 20);
    return new Response(
      JSON.stringify({ success: true, pagination: { count: found.length, page_size: size }, results: found.slice((page - 1) * size, page * size) }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  });
  return urls;
}

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
    const urls = stubUsersApi();
    const { container } = renderPage();
    await screen.findByText(users[0].email, {}, SLOW);
    const target = users[5];
    fireEvent.change(screen.getByRole('searchbox', { name: /rechercher un utilisateur/i }), { target: { value: target.email } });
    await waitFor(() => expect(rows(container)).toHaveLength(1), SLOW);
    const last = urls.filter((u) => u.searchParams.get('page_size') === '10').at(-1);
    expect(last?.searchParams.get('search')).toBe(target.email);
    expect(last?.searchParams.get('page')).toBe('1');
  });

  it('maps the "Suspendus" filter to the api inactive status', async () => {
    const urls = stubUsersApi();
    const { container } = renderPage();
    await screen.findByText(users[0].email, {}, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Suspendus' }));
    const suspended = users.filter((u) => !u.is_active);
    await waitFor(() => expect(rows(container)).toHaveLength(Math.min(10, suspended.length)), SLOW);
    expect(urls.some((u) => u.searchParams.get('status') === 'inactive' && u.searchParams.get('page_size') === '10')).toBe(true);
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

  it('shows the actions and filters the api does not support yet, disabled', async () => {
    stubUsersApi();
    renderPage();
    const target = users[0];
    await screen.findByText(target.email, {}, SLOW);

    expect((screen.getByRole('button', { name: /Inviter un administrateur/ }) as HTMLButtonElement).disabled).toBe(true);
    const roles = screen.getByRole('group', { name: 'Filtrer par rôle' });
    expect((within(roles).getByRole('button', { name: 'Créateurs' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(roles).getByRole('button', { name: 'Membres' }) as HTMLButtonElement).disabled).toBe(true);

    const [trigger] = screen.getAllByRole('button', { name: /^Actions pour/ });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const menu = await screen.findByRole('menu', {}, SLOW);
    expect(within(menu).getByRole('menuitem', { name: /Nommer administrateur/ }).getAttribute('aria-disabled')).toBe('true');
    expect(within(menu).getByRole('menuitem', { name: /Suspendre le compte/ }).getAttribute('aria-disabled')).toBe('true');
    expect(within(menu).getByRole('menuitem', { name: 'Voir le profil' }).getAttribute('aria-disabled')).toBeNull();
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
