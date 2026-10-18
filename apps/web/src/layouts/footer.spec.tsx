import { act, cleanup, screen, within } from '@testing-library/react';

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

describe('Footer', () => {
  it('offers the account links to a visitor, and keeps the pages to come out of reach', async () => {
    renderAppAt('/');
    const footer = await screen.findByRole('contentinfo', {}, SLOW);
    const account = within(footer).getByRole('navigation', { name: 'Compte' });
    expect(within(account).getByRole('link', { name: 'Créer un compte' }).getAttribute('href')).toBe('/auth/register');
    // The call to action and the "Plateforme" column
    within(footer)
      .getAllByRole('link', { name: /Créer une communauté/ })
      .forEach((link) => expect(link.getAttribute('href')).toBe('/create-community'));
    // Pages that do not exist yet: shown, not linked
    const kodinga = within(footer).getByRole('navigation', { name: 'Kodinga' });
    expect(within(kodinga).queryAllByRole('link')).toHaveLength(0);
    expect(within(kodinga).getByText('Confidentialité')).toBeTruthy();
    expect(within(footer).getByRole('list', { name: 'Moyens de paiement' }).textContent).toContain('Wave');
  });

  it('turns the account column into the user space once signed in', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'fatou' } as User, token: 'access', refresh: 'r' }));
    });
    renderAppAt('/');
    const footer = await screen.findByRole('contentinfo', {}, SLOW);
    const space = within(footer).getByRole('navigation', { name: 'Mon espace' });
    expect(within(space).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/c', '/messages', '/profiles/fatou']);
  });
});
