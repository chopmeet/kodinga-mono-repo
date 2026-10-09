import { act, fireEvent, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import { onSetHeroSearchVisible, onSetSearchQuery } from '@/redux/slice/Search.slice';
import store from '@/redux/store';
import i18n from '@/utils/i18n';
import App from './app';

const renderAt = (path: string) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </Provider>
  );

describe('App', () => {
  // jsdom reports navigator.language = en-US; the assertions below are in French
  beforeAll(() => i18n.changeLanguage('fr'));

  // The store is a singleton shared by every test
  beforeEach(() => {
    store.dispatch(onSetSearchQuery(''));
    store.dispatch(onSetHeroSearchVisible(true));
  });

  it('renders the public home page', () => {
    const { getByRole } = renderAt('/');
    expect(getByRole('heading', { level: 1, name: /trouvez votre communauté tech/i })).toBeTruthy();
  });

  it('redirects anonymous users from /admin to login', () => {
    const { getByRole } = renderAt('/admin');
    expect(getByRole('button', { name: /se connecter/i })).toBeTruthy();
  });

  it('renders the 404 page for unknown routes', () => {
    const { getByText } = renderAt('/nope');
    expect(getByText('404')).toBeTruthy();
  });

  it('renders the login link in the header', () => {
    const { getByRole } = renderAt('/');
    expect(getByRole('link', { name: /se connecter/i })).toBeTruthy();
  });

  it('moves the search bar into the header once the hero search scrolls away', () => {
    const { getAllByRole, getByRole, queryByRole } = renderAt('/');
    expect(getAllByRole('searchbox')).toHaveLength(1);

    act(() => {
      store.dispatch(onSetHeroSearchVisible(false));
    });
    const headerSearch = getByRole('banner').querySelector('input[type="search"]');
    expect(headerSearch).toBeTruthy();

    fireEvent.change(headerSearch as Element, { target: { value: 'kigali' } });
    expect(getByRole('heading', { level: 3, name: 'Kigali Green & Embedded Tech' })).toBeTruthy();
    expect(queryByRole('heading', { level: 3, name: 'Python Africa Core' })).toBeNull();
  });

  it('filters communities from the hero search bar', () => {
    const { getByRole, queryByRole } = renderAt('/');
    fireEvent.change(getByRole('searchbox', { name: /rechercher une communauté/i }), {
      target: { value: 'nairobi' },
    });
    // Card titles are h3 (the leaderboard repeats some names as plain text)
    expect(getByRole('heading', { level: 3, name: 'Nairobi Rustaceans' })).toBeTruthy();
    expect(queryByRole('heading', { level: 3, name: 'Python Africa Core' })).toBeNull();
  });

  it('renders a community details page on the About tab by default', () => {
    const { getByRole, getAllByRole } = renderAt('/communities/nairobi-rustaceans');
    expect(getByRole('heading', { level: 1, name: 'Nairobi Rustaceans' })).toBeTruthy();
    expect(getByRole('link', { name: 'À propos', current: 'page' })).toBeTruthy();
    expect(getAllByRole('link', { name: 'Rejoindre' }).length).toBeGreaterThan(0);
  });

  it('opens the tab given in the url', () => {
    const { getByRole } = renderAt('/communities/nairobi-rustaceans?tab=classroom');
    expect(getByRole('heading', { level: 3, name: 'Fondamentaux Rust' })).toBeTruthy();
  });

  it('shows a not found message for an unknown community', () => {
    const { getByRole } = renderAt('/communities/nope');
    expect(getByRole('heading', { level: 1, name: /communauté introuvable/i })).toBeTruthy();
  });


  it('validates the login form before calling the api', async () => {
    const { getByRole, findByText } = renderAt('/auth/login');
    fireEvent.click(getByRole('button', { name: 'Se connecter' }));
    expect(await findByText('Saisissez votre email')).toBeTruthy();
    expect(await findByText('Saisissez votre mot de passe')).toBeTruthy();
  });

  it('renders the forgot password page', () => {
    const { getByRole } = renderAt('/auth/forgot-password');
    expect(getByRole('heading', { level: 1, name: 'Mot de passe oublié' })).toBeTruthy();
    expect(getByRole('link', { name: /retour à la connexion/i })).toBeTruthy();
  });

  it('shows an invalid link message when the reset token is missing', () => {
    const { getByRole } = renderAt('/auth/reset-password');
    expect(getByRole('heading', { level: 1, name: 'Lien invalide' })).toBeTruthy();
    expect(getByRole('link', { name: /demander un nouveau lien/i })).toBeTruthy();
  });

  it('checks the new password rules on the reset page', async () => {
    const { getByLabelText, getByRole, findByText } = renderAt('/auth/reset-password?token=abcdefghij123');
    fireEvent.change(getByLabelText(/nouveau mot de passe/i), { target: { value: '12345678' } });
    fireEvent.change(getByLabelText(/confirmer le mot de passe/i), { target: { value: '12345679' } });
    fireEvent.click(getByRole('button', { name: /réinitialiser le mot de passe/i }));
    expect(await findByText('Le mot de passe ne peut pas contenir uniquement des chiffres')).toBeTruthy();
    expect(await findByText('Les mots de passe ne correspondent pas')).toBeTruthy();
  });

  it('labels the login inputs (Input / InputPassword from the ui lib)', () => {
    const { getByLabelText } = renderAt('/auth/login');
    expect(getByLabelText(/adresse email/i)).toHaveProperty('type', 'email');
    expect(getByLabelText(/mot de passe/i)).toHaveProperty('type', 'password');
  });
});
