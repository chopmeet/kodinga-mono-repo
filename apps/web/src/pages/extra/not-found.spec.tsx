import { cleanup, screen } from '@testing-library/react';

import { renderAppAt, SLOW } from '@/test-utils';

afterEach(cleanup);

describe('Not found page', () => {
  it('says the page does not exist and leads back home', async () => {
    renderAppAt('/une-page-qui-nexiste-pas');
    expect(await screen.findByRole('heading', { level: 1, name: 'Page introuvable' }, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Retour à l’accueil/ }).getAttribute('href')).toBe('/');
    // Opened directly: no page of the app to go back to
    expect(screen.queryByRole('button', { name: /Retour$/ })).toBeNull();
  });
});
