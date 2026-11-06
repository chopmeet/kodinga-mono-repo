import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { must, renderAppAt, SLOW, stubApi } from '@/test-utils';
import { leaveTo } from './hooks/oauth-state';

vi.mock('./hooks/oauth-state', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./hooks/oauth-state')>()),
  leaveTo: vi.fn(),
}));

// Full app tree + network stubs: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });

const fill = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillForm = () => {
  fill(/^Prénom/, 'Aïcha');
  fill(/^Nom\b(?! d)/, 'Ndiaye');
  fill(/^Adresse email/, 'Aicha.Ndiaye@Example.com');
  fill(/^Mot de passe/, 'kodinga2026');
};

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('Register', () => {
  it('suggests a username from the name, until it is edited', async () => {
    renderAppAt('/auth/register');
    await screen.findByRole('heading', { name: 'Créer un compte' }, SLOW);
    fill(/^Prénom/, 'Aïcha');
    fill(/^Nom\b(?! d)/, 'Ndiaye');
    const username = screen.getByLabelText(/Nom d'utilisateur/) as HTMLInputElement;
    expect(username.value).toBe('aicha_ndiaye');
    fireEvent.change(username, { target: { value: 'aicha_dev' } });
    fill(/^Prénom/, 'Awa');
    expect(username.value).toBe('aicha_dev');
  });

  it('requires the terms before calling the api', async () => {
    const calls = stubApi({});
    renderAppAt('/auth/register');
    await screen.findByRole('heading', { name: 'Créer un compte' }, SLOW);
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(await screen.findByText("Acceptez les conditions d'utilisation pour continuer", {}, SLOW)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('creates the account, then offers to resend the email', async () => {
    const calls = stubApi({
      'auth/register/': { status: 201, body: { success: true, data: { id: 'u1', email: 'aicha.ndiaye@example.com' } } },
      'auth/resend-verification/': { body: { success: true, message: 'ok' } },
    });
    renderAppAt('/auth/register');
    await screen.findByRole('heading', { name: 'Créer un compte' }, SLOW);
    fillForm();
    fireEvent.click(screen.getByRole('checkbox', { name: /J'accepte les conditions/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(await screen.findByRole('heading', { name: 'Vérifiez vos emails' }, SLOW)).toBeTruthy();
    expect(screen.getByText('aicha.ndiaye@example.com')).toBeTruthy();
    expect(calls[0].body).toMatchObject({
      email: 'aicha.ndiaye@example.com',
      username: 'aicha_ndiaye',
      first_name: 'Aïcha',
      last_name: 'Ndiaye',
      password: 'kodinga2026',
      terms_accepted: true,
      preferred_language: expect.any(String),
      timezone: expect.any(String),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Renvoyer le lien' }));
    expect(await screen.findByText('Un nouveau lien vient de vous être envoyé.', {}, SLOW)).toBeTruthy();
    expect(calls[1]).toMatchObject({ method: 'POST', body: { email: 'aicha.ndiaye@example.com' } });
  });

  it('shows the api field errors in French under the inputs', async () => {
    stubApi({
      'auth/register/': {
        status: 400,
        body: {
          success: false,
          code: 'validation_error',
          message: 'Invalid input.',
          details: {
            email: ['An account with this email address already exists.'],
            password: ['This password is too common.'],
          },
        },
      },
    });
    renderAppAt('/auth/register');
    await screen.findByRole('heading', { name: 'Créer un compte' }, SLOW);
    fillForm();
    fireEvent.click(screen.getByRole('checkbox', { name: /J'accepte les conditions/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));
    expect(await screen.findByText('Un compte existe déjà avec cette adresse email.', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('Ce mot de passe est trop courant.')).toBeTruthy();
  });

  it('starts Google sign-in with our callback url and keeps the state', async () => {
    const calls = stubApi({
      'auth/google/start/': { body: { success: true, data: { url: 'https://accounts.google.com/o/oauth2?x=1', state: 'st4te' } } },
    });
    renderAppAt('/auth/register');
    fireEvent.click(await screen.findByRole('button', { name: 'Continuer avec Google' }, SLOW));
    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2?x=1'));
    expect(new URL(calls[0].url).searchParams.get('redirect_uri')).toBe(`${window.location.origin}/auth/callback/google`);
    expect(sessionStorage.getItem('oauth_state_google')).toBe('st4te');
    expect(sessionStorage.getItem('oauth_next_google')).toBeNull();
  });

  it('keeps where the user was going through the provider', async () => {
    stubApi({ 'auth/google/start/': { body: { success: true, data: { url: 'https://accounts.google.com/o/oauth2?x=1', state: 'st4te' } } } });
    renderAppAt('/auth/register?next=%2Finvite%2FTOKEN');
    fireEvent.click(await screen.findByRole('button', { name: 'Continuer avec Google' }, SLOW));
    await waitFor(() => expect(leaveTo).toHaveBeenCalled());
    expect(sessionStorage.getItem('oauth_next_google')).toBe('/invite/TOKEN');
    expect(screen.getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toBe('/auth/login?next=%2Finvite%2FTOKEN');
  });
});

describe('OAuth callback', () => {
  it('refuses a return whose state was not issued by this tab', async () => {
    const calls = stubApi({});
    sessionStorage.setItem('oauth_state_github', 'expected');
    renderAppAt('/auth/callback/github?code=abc&state=forged');
    expect(await screen.findByRole('heading', { name: 'Connexion impossible' }, SLOW)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('exchanges the code, signs in and goes home', async () => {
    const calls = stubApi({
      'auth/github/callback/': {
        body: {
          success: true,
          data: { access: 'a', refresh: 'r', session_id: 's', user: { id: 'u1', first_name: 'Kofi', email: 'kofi@example.com' } },
        },
      },
    });
    sessionStorage.setItem('oauth_state_github', 'st4te');
    const { where } = renderAppAt('/auth/callback/github?code=abc&state=st4te');
    await waitFor(() => expect(where()).toBe('/'), SLOW);
    expect(calls[0].body).toEqual({ code: 'abc', state: 'st4te', redirect_uri: `${window.location.origin}/auth/callback/github` });
  });
});

describe('OAuth callback, where it goes', () => {
  const signedIn = { 'auth/github/callback/': { body: { success: true, data: { access: 'a', refresh: 'r', session_id: 's', user: { id: 'u1', first_name: 'Kofi', email: 'kofi@example.com' } } } } };

  it('goes back to the page the user was going to', async () => {
    stubApi(signedIn);
    sessionStorage.setItem('oauth_state_github', 'st4te');
    sessionStorage.setItem('oauth_next_github', '/invite/TOKEN');
    const { where } = renderAppAt('/auth/callback/github?code=abc&state=st4te');
    await waitFor(() => expect(where()).toBe('/invite/TOKEN'), SLOW);
    expect(sessionStorage.getItem('oauth_next_github')).toBeNull();
  });

  it('never leaves the app', async () => {
    stubApi(signedIn);
    sessionStorage.setItem('oauth_state_github', 'st4te');
    sessionStorage.setItem('oauth_next_github', '//evil.example.com');
    const { where } = renderAppAt('/auth/callback/github?code=abc&state=st4te');
    await waitFor(() => expect(where()).toBe('/'), SLOW);
  });

  it('says a misconfigured provider in french, and keeps the destination to retry', async () => {
    stubApi({ 'auth/github/callback/': { status: 400, body: { success: false, code: 'redirect_uri_mismatch', message: "Erreur redirect_uri_mismatch : l'URI…" } } });
    sessionStorage.setItem('oauth_state_github', 'st4te');
    sessionStorage.setItem('oauth_next_github', '/invite/TOKEN');
    renderAppAt('/auth/callback/github?code=abc&state=st4te');
    expect(await screen.findByText(/mal configuré/, {}, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour à la connexion' }).getAttribute('href')).toBe('/auth/login?next=%2Finvite%2FTOKEN');
  });
});

describe('Verify email', () => {
  it('confirms the address from the emailed link', async () => {
    const calls = stubApi({ 'auth/verify-email/': { body: { success: true, data: { id: 'u1', first_name: 'Aïcha' } } } });
    renderAppAt('/auth/verify-email?token=0123456789abcdef');
    expect(await screen.findByRole('heading', { name: 'Bienvenue Aïcha !' }, SLOW)).toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ token: '0123456789abcdef' });
  });

  it('offers a new link when the token is expired', async () => {
    stubApi({
      'auth/verify-email/': { status: 400, body: { success: false, code: 'invalid_verification_token', message: 'Invalid' } },
      'auth/resend-verification/': { body: { success: true } },
    });
    renderAppAt('/auth/verify-email?token=0123456789abcdef');
    expect(await screen.findByRole('heading', { name: 'Lien invalide' }, SLOW)).toBeTruthy();
    const form = must(screen.getByLabelText('Recevoir un nouveau lien').closest('form'));
    fireEvent.change(within(form).getByLabelText('Recevoir un nouveau lien'), { target: { value: 'aicha@example.com' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Renvoyer le lien' }));
    expect(await screen.findByText(/un nouveau lien vient d'être envoyé/, {}, SLOW)).toBeTruthy();
  });
});
