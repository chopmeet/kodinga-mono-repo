import { act, cleanup, screen } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

// Platform admin: opens the admin area and the mock community spaces
const signIn = () =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', first_name: 'Awa', is_superadmin: true } as User, token: 'access', refresh: 'refresh' }));
  });

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

describe('Kodinga assistant placement', () => {
  it('shows the assistant on the public pages', async () => {
    renderAppAt('/');
    expect(await screen.findByText('Assistant Kodinga', {}, SLOW)).toBeTruthy();
  });

  it('hides it in the admin area', async () => {
    signIn();
    renderAppAt('/admin/communities');
    expect(await screen.findByRole('heading', { name: 'Communautés' }, SLOW)).toBeTruthy();
    expect(screen.queryByText('Assistant Kodinga')).toBeNull();
  });

  it('hides it in a community space', async () => {
    signIn();
    renderAppAt('/c/dakar-devops/dashboard');
    expect(await screen.findByRole('heading', { name: 'Tableau de bord' }, SLOW)).toBeTruthy();
    expect(screen.queryByText('Assistant Kodinga')).toBeNull();
  });
});
