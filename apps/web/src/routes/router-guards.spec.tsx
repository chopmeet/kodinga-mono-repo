import { act, cleanup, waitFor } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

const signIn = (user: Partial<User>) =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', first_name: 'Awa', ...user } as User, token: 'access', refresh: 'refresh' }));
  });

// The admin area calls the api (e.g. the assistant): a neutral answer, never the real api
beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () => new Response(JSON.stringify({ success: true, data: [], results: [] }), { headers: { 'Content-Type': 'application/json' } })
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
  });
});

describe('IsAdminAllow (/admin)', () => {
  it('sends a visitor to the login, then back to the admin page', async () => {
    const { where } = renderAppAt('/admin/users');
    await waitFor(() => expect(where()).toBe('/auth/login?next=%2Fadmin%2Fusers'), SLOW);
  });

  it('sends a signed-in user without admin rights home', async () => {
    signIn({ is_superadmin: false, is_superuser: false });
    const { where } = renderAppAt('/admin/dashboard');
    await waitFor(() => expect(where()).toBe('/'), SLOW);
  });

  it('opens the admin area to a super-admin', async () => {
    signIn({ is_superadmin: true });
    const { where, findByRole } = renderAppAt('/admin/dashboard');
    expect(await findByRole('heading', { name: 'Tableau de bord' }, SLOW)).toBeTruthy();
    expect(where()).toBe('/admin/dashboard');
  });
});
