import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';
import i18n from '@/utils/i18n';

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
  it('offers the platform and account links to a visitor', async () => {
    renderAppAt('/');
    const footer = await screen.findByRole('contentinfo', {}, SLOW);
    const account = within(footer).getByRole('navigation', { name: 'Compte' });
    expect(within(account).getByRole('link', { name: 'Créer un compte' }).getAttribute('href')).toBe('/auth/register');
    // The call to action and the "Plateforme" column
    within(footer)
      .getAllByRole('link', { name: /Créer une communauté/ })
      .forEach((link) => expect(link.getAttribute('href')).toBe('/create-community'));
    const platform = within(footer).getByRole('navigation', { name: 'Plateforme' });
    expect(within(platform).getByRole('link', { name: 'Hackathons & défis' }).getAttribute('href')).toBe('/hackathons');
    expect(within(platform).getByRole('link', { name: 'Offres & missions' }).getAttribute('href')).toBe('/opportunities');
    // No page to come is announced anymore
    expect(within(footer).queryByRole('navigation', { name: 'Kodinga' })).toBeNull();
    expect(within(footer).queryByText('Bientôt')).toBeNull();
    expect(within(footer).getByRole('list', { name: 'Moyens de paiement' }).textContent).toContain('Wave');
  });

  it('turns the account column into the user space once signed in', async () => {
    act(() => {
      store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'fatou' } as User, token: 'access', refresh: 'r' }));
    });
    renderAppAt('/');
    const footer = await screen.findByRole('contentinfo', {}, SLOW);
    const space = within(footer).getByRole('navigation', { name: 'Mon espace' });
    expect(within(space).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/dashboard/communities', '/messages', '/profiles/fatou']);
  });

  it('follows the language chosen in the footer', async () => {
    renderAppAt('/');
    const footer = await screen.findByRole('contentinfo', {}, SLOW);
    fireEvent.click(within(footer).getByRole('button', { name: 'EN' }));
    const english = await screen.findByRole('contentinfo', {}, SLOW);
    expect(await within(english).findByRole('link', { name: 'Jobs & gigs' }, SLOW)).toBeTruthy();
    expect(within(english).getByRole('list', { name: 'Payment methods' }).textContent).toContain('Bank card');
    expect(document.documentElement.lang).toBe('en');
    await act(() => i18n.changeLanguage('fr'));
  });
});
