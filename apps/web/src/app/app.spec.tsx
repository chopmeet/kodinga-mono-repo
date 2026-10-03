import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

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

  it('renders the public home page', () => {
    const { getByRole } = renderAt('/');
    expect(getByRole('heading', { level: 1, name: /trouvez votre communauté tech africaine/i })).toBeTruthy();
  });

  it('redirects anonymous users from /admin to login', () => {
    const { getByRole } = renderAt('/admin');
    expect(getByRole('button', { name: /se connecter/i })).toBeTruthy();
  });

  it('renders the 404 page for unknown routes', () => {
    const { getByText } = renderAt('/nope');
    expect(getByText('404')).toBeTruthy();
  });

  it('renders the header links and the blog page', () => {
    const { getAllByRole, getByRole } = renderAt('/blog');
    expect(getAllByRole('link', { name: /accueil/i }).length).toBeGreaterThan(0);
    expect(getAllByRole('link', { name: /se connecter/i }).length).toBeGreaterThan(0);
    expect(getByRole('heading', { level: 1, name: /blog/i })).toBeTruthy();
  });
});
