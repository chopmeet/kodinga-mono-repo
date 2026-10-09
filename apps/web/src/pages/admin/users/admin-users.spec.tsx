import { act, fireEvent, render, renderHook, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import { adminUsers } from '@/data/admin-users.data';
import store from '@/redux/store';
import { must } from '@/test-utils';
import AdminUsers from './admin-users';
import UseUsersList from './form/UseUsersList';

const renderPage = () =>
  render(
    <Provider store={store}>
      <MemoryRouter>
        <AdminUsers />
      </MemoryRouter>
    </Provider>
  );

// Generous timeout: the whole suite runs in parallel and Radix menus mount asynchronously
const SLOW = { timeout: 3000 };

const rows = (container: HTMLElement) => Array.from(container.querySelectorAll('tbody tr'));

// Open the "…" menu with the keyboard (Enter): deterministic, unlike jsdom's pointer events,
// which sometimes left the second menu of a test closed when the whole suite ran in parallel.
const openMenu = async (utils: ReturnType<typeof renderPage>, name: string) => {
  const trigger = await utils.findByRole('button', { name: `Actions pour ${name}` }, SLOW);
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
};

describe('AdminUsers (mock data)', () => {
  it('lists the first page and the key figures', async () => {
    const utils = renderPage();
    await utils.findByText(adminUsers[0].full_name);
    expect(rows(utils.container)).toHaveLength(10);
    const total = utils.getByText('Utilisateurs', { selector: 'p' }).parentElement as HTMLElement;
    expect(within(total).getByText(String(adminUsers.length))).toBeTruthy();
  });

  it('filters on administrators', async () => {
    const utils = renderPage();
    await utils.findByText(adminUsers[0].full_name);
    fireEvent.click(utils.getByRole('button', { name: 'Administrateurs' }));
    await waitFor(() => expect(rows(utils.container)).toHaveLength(adminUsers.filter((u) => u.is_staff).length));
  });

  it('suspends an account from the actions menu', async () => {
    const target = must(adminUsers.find((u) => u.is_active && !u.is_staff));
    const utils = renderPage();
    await openMenu(utils, target.full_name);
    fireEvent.click(await utils.findByRole('menuitem', { name: 'Suspendre le compte' }, SLOW));
    const row = (await utils.findByText(target.full_name)).closest('tr') as HTMLElement;
    expect(within(row).getByText('Suspendu')).toBeTruthy();
  });

  it('never removes the last administrator', () => {
    // Business rule tested on the hook itself: two Radix menus opened back to back were flaky
    // under the parallel suite (late focus/pointer timers), the menu path is covered above.
    const query = { search: '', role: 'staff' as const, status: 'all' as const, page: 1, size: 10 };
    const { result } = renderHook(() => UseUsersList(query));
    const [first, second] = result.current.users.filter((u) => u.is_staff);

    act(() => result.current.toggleStaff(first));
    act(() => result.current.toggleStaff(must(result.current.users.find((u) => u.id === second.id))));

    const staff = result.current.users.filter((u) => u.is_staff);
    expect(staff.map((u) => u.id)).toEqual([second.id]);
  });

  it('invites an administrator after validating the form', async () => {
    const utils = renderPage();
    await utils.findByText(adminUsers[0].full_name);
    fireEvent.click(utils.getByRole('button', { name: /inviter un administrateur/i }));
    const dialog = await utils.findByRole('dialog', {}, SLOW);

    fireEvent.click(within(dialog).getByRole('button', { name: "Envoyer l'invitation" }));
    expect(await within(dialog).findByText("Saisissez l'email")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/prénom/i), { target: { value: 'Aminata' } });
    fireEvent.change(within(dialog).getByLabelText(/^nom/i), { target: { value: 'Touré' } });
    fireEvent.change(within(dialog).getByLabelText(/adresse email/i), { target: { value: adminUsers[0].email } });
    fireEvent.click(within(dialog).getByRole('button', { name: "Envoyer l'invitation" }));
    expect(await within(dialog).findByText('Un compte existe déjà avec cet email.')).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/adresse email/i), { target: { value: 'aminata.toure@kodinga.dev' } });
    fireEvent.click(within(dialog).getByRole('button', { name: "Envoyer l'invitation" }));
    expect(await utils.findByText('Aminata Touré', {}, { timeout: 2000 })).toBeTruthy();
  });

  it('opens the profile sheet from the name', async () => {
    const target = adminUsers[0];
    const utils = renderPage();
    fireEvent.click(await utils.findByText(target.full_name));
    const sheet = await utils.findByRole('dialog', {}, SLOW);
    expect(within(sheet).getByText(target.email)).toBeTruthy();
  });
});
