import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { renderAppAt, SLOW } from '@/test-utils';

describe('Community space /c/:slug', () => {
  it('lists the managed communities on /c with the role in each', () => {
    renderAppAt('/c');
    expect(screen.getByRole('heading', { name: 'Mes communautés' })).toBeTruthy();
    expect(within(screen.getByRole('list')).getAllByRole('link').length).toBe(4);
    expect(screen.getAllByText('Propriétaire').length).toBe(2);
    expect(screen.getByText('Modérateur')).toBeTruthy();
  });

  it('sends back to /c when the user does not manage the community', async () => {
    const { where } = renderAppAt('/c/abidjan-flutter-devs/dashboard');
    await waitFor(() => expect(where()).toBe('/c'));
    expect(screen.getByRole('alert').textContent).toContain('abidjan-flutter-devs');
  });

  it('opens the dashboard by default', async () => {
    const { where } = renderAppAt('/c/dakar-devops');
    await waitFor(() => expect(where()).toBe('/c/dakar-devops/dashboard'));
    expect(screen.getByRole('heading', { name: 'Tableau de bord' })).toBeTruthy();
  });

  it('gives a moderator the management menus only', async () => {
    renderAppAt('/c/python-africa-core/dashboard');
    const nav = await screen.findByRole('link', { name: 'Membres' }, SLOW);
    expect(nav).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Publications' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Paramètres' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Abonnements & paiements' })).toBeNull();
    expect(screen.queryByText('Revenus (30 j)')).toBeNull();
  });

  it('keeps a moderator out of the settings by url', async () => {
    const { where } = renderAppAt('/c/python-africa-core/settings');
    await waitFor(() => expect(where()).toBe('/c/python-africa-core/dashboard'));
  });

  it('gives the owner the settings', async () => {
    renderAppAt('/c/dakar-devops/settings');
    expect(await screen.findByRole('heading', { name: 'Paramètres' }, SLOW)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Paramètres' })).toBeTruthy();
  });

  it('keeps the current page when switching community', async () => {
    const { where } = renderAppAt('/c/dakar-devops/members');
    const trigger = await screen.findByRole('button', { name: /Changer de communauté/ }, SLOW);
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    const menu = await screen.findByRole('menu', {}, SLOW);
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Lagos AI/ }));
    await waitFor(() => expect(where()).toBe('/c/lagos-ai-data/members'));
  });
});
