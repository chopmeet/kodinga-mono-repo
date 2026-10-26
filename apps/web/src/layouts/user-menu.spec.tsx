import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () => new Response(JSON.stringify({ success: true, data: [], results: [], pagination: { count: 0 } }), { headers: { 'Content-Type': 'application/json' } }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

const signIn = (user: Partial<User>) =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', first_name: 'Ousmane', last_name: 'Diallo', username: 'ousmane', ...user } as User, token: 'access', refresh: 'r' }));
  });

/** Radix menus open with the keyboard in jsdom (the tests run in English) */
async function openMenu() {
  const header = await screen.findByRole('banner', {}, SLOW);
  fireEvent.keyDown(within(header).getByRole('button', { name: 'My space' }), { key: 'Enter' });
  return screen.findByRole('menu', {}, SLOW);
}

describe('User menu of the header', () => {
  it('shows the user, their spaces and account, and logs out', async () => {
    signIn({});
    const { where } = renderAppAt('/');
    const menu = await openMenu();
    expect(within(menu).getByText('Ousmane Diallo')).toBeTruthy();
    expect(within(menu).getByText('@ousmane')).toBeTruthy();
    expect(within(menu).getAllByRole('menuitem').map((item) => item.getAttribute('href'))).toEqual(['/c', '/profiles/ousmane', '/account/profile', null]);
    expect(within(menu).queryByText('Administration')).toBeNull();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Log out' }));
    await waitFor(() => expect(store.getState().user.token).toBeNull(), SLOW);
    expect(where()).not.toMatch(/^\/c/);
  });

  it('adds the administration for a superadmin', async () => {
    signIn({ is_superadmin: true });
    renderAppAt('/');
    const menu = await openMenu();
    expect(within(menu).getByRole('menuitem', { name: 'Administration' }).getAttribute('href')).toBe('/admin/dashboard');
  });
});
