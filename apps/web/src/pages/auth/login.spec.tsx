import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

import { onLogout } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW, stubApi } from '@/test-utils';
import * as oauthState from './hooks/oauth-state';

// Full app tree + network stubs: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });

// Each test starts as a visitor: the login page now sends signed-in users away (RedirectAuthRoute)
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(onLogout());
  });
});

const submit = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText(/^Adresse email/), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^Mot de passe/), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));
};

describe('Login', () => {
  it('offers Google and GitHub, and keeps where the user was going', async () => {
    const calls = stubApi({ 'auth/github/start/': { body: { success: true, data: { url: 'https://github.com/login/oauth/authorize?x=1', state: 'st4te' } } } });
    const leave = vi.spyOn(oauthState, 'leaveTo').mockImplementation(() => undefined);
    renderAppAt('/auth/login?next=%2Finvite%2FTOKEN');
    expect(await screen.findByRole('button', { name: 'Continuer avec Google' }, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: "S'inscrire" }).getAttribute('href')).toBe('/auth/register?next=%2Finvite%2FTOKEN');
    fireEvent.click(screen.getByRole('button', { name: 'Continuer avec GitHub' }));
    await waitFor(() => expect(leave).toHaveBeenCalledWith('https://github.com/login/oauth/authorize?x=1'), SLOW);
    expect(new URL(calls[0].url).searchParams.get('redirect_uri')).toBe(`${window.location.origin}/auth/callback/github`);
    expect(sessionStorage.getItem('oauth_next_github')).toBe('/invite/TOKEN');
    sessionStorage.clear();
  });

  it('shows the api error when the credentials are wrong', async () => {
    stubApi({
      'auth/login/': { status: 401, body: { success: false, code: 'invalid_credentials', message: 'Invalid credentials.' } },
    });
    renderAppAt('/auth/login');
    await screen.findByRole('heading', { name: 'Se connecter' }, SLOW);
    submit('awa@example.com', 'wrong-password');
    expect(await screen.findByText('Email ou mot de passe incorrect.', {}, SLOW)).toBeTruthy();
  });

  it('signs in, keeps the session and goes to the requested page', async () => {
    const calls = stubApi({
      'auth/login/': {
        body: {
          success: true,
          data: { access: 'access-token', refresh: 'refresh-token', session_id: 's1', user: { id: 'u1', first_name: 'Awa', email: 'awa@example.com' } },
        },
      },
    });
    const { where } = renderAppAt('/auth/login?next=/dashboard/overview');
    await screen.findByRole('heading', { name: 'Se connecter' }, SLOW);
    submit('Awa@Example.com', 'kodinga2026');
    await waitFor(() => expect(where()).toBe('/dashboard/overview'), SLOW);
    expect(calls[0].body).toMatchObject({ email: 'awa@example.com', password: 'kodinga2026' });
    expect(store.getState().user.token).toBe('access-token');
  });

  it('never redirects outside the app after login', async () => {
    stubApi({
      'auth/login/': { body: { success: true, data: { access: 'a', refresh: 'r', session_id: 's', user: { id: 'u1' } } } },
    });
    const { where } = renderAppAt('/auth/login?next=//evil.example.com');
    await screen.findByRole('heading', { name: 'Se connecter' }, SLOW);
    submit('awa@example.com', 'kodinga2026');
    await waitFor(() => expect(where()).toBe('/'), SLOW);
  });
});
