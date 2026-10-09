import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { getCommunityPayments } from '@/data/admin-community-details.data';
import { getCommunitySubscriptions } from '@/data/community-billing.data';
import { getMyCommunity } from '@/data/community-space.data';
import { must, renderAppAt, SLOW } from '@/test-utils';

const lagos = () => must(getMyCommunity('lagos-ai-data')).community;

// Full app tree + Radix dialogs/menus: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });

describe('Community space: subscriptions & payments', () => {
  it('is reserved to the owner of a paid community', async () => {
    const admin = renderAppAt('/c/frontend-francophone/payments');
    await waitFor(() => expect(admin.where()).toBe('/c/frontend-francophone/dashboard'));
    admin.unmount();
    // Owner, but the community is free
    const freeOwner = renderAppAt('/c/dakar-devops/payments');
    await waitFor(() => expect(freeOwner.where()).toBe('/c/dakar-devops/dashboard'));
  });

  it('opens on the plans with the key figures', async () => {
    const { where } = renderAppAt('/c/lagos-ai-data/payments');
    await waitFor(() => expect(where()).toBe('/c/lagos-ai-data/payments/plans'));
    expect(screen.getByRole('heading', { name: 'Abonnements & paiements' })).toBeTruthy();
    expect(screen.getByText('Net pour vous (après 10 % de commission)')).toBeTruthy();
    expect(screen.getByRole('listitem', { name: 'Formule Mensuel' })).toBeTruthy();
    expect(screen.getByRole('listitem', { name: 'Formule Annuel' })).toBeTruthy();
  });

  it('refuses a price under the platform minimum, then creates the plan', async () => {
    renderAppAt('/c/lagos-ai-data/payments/plans');
    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle formule' }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^Nom/), { target: { value: 'Étudiant' } });
    fireEvent.change(within(dialog).getByLabelText(/Prix/), { target: { value: '1000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Créer la formule' }));
    expect(await within(dialog).findByText(/Prix minimum/, {}, SLOW)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/Prix/), { target: { value: '5000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Créer la formule' }));
    expect(await screen.findByRole('listitem', { name: 'Formule Étudiant' }, SLOW)).toBeTruthy();
  });

  it('always keeps one plan open to new members', async () => {
    renderAppAt('/c/lagos-ai-data/payments/plans');
    const monthly = await screen.findByRole('listitem', { name: 'Formule Mensuel' }, SLOW);
    const yearly = screen.getByRole('listitem', { name: 'Formule Annuel' });
    fireEvent.click(within(yearly).getByRole('button', { name: 'Désactiver' }));
    expect(within(yearly).getByText('Désactivée')).toBeTruthy();
    fireEvent.click(within(monthly).getByRole('button', { name: 'Désactiver' }));
    expect(await screen.findByText(/Gardez au moins une formule active/, {}, SLOW)).toBeTruthy();
    expect(within(monthly).getByText('Active')).toBeTruthy();
  });

  it('lists unpaid subscriptions and sends a reminder', async () => {
    const unpaid = getCommunitySubscriptions(lagos()).filter((s) => s.status === 'past_due');
    expect(unpaid.length).toBeGreaterThan(0);
    renderAppAt('/c/lagos-ai-data/payments/subscribers');
    fireEvent.click(await screen.findByRole('button', { name: /Impayés/ }, SLOW));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(unpaid.length + 1);
    fireEvent.click(screen.getByRole('button', { name: `Relancer ${unpaid[0].member}` }));
    expect(await screen.findByText(`Rappel de paiement envoyé à ${unpaid[0].member}.`, {}, SLOW)).toBeTruthy();
  });

  it('exports the filtered payments as CSV', async () => {
    const failed = getCommunityPayments(lagos()).filter((p) => p.status === 'FAILED');
    expect(failed.length).toBeGreaterThan(0);
    const createObjectURL = vi.fn(() => 'blob:csv');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    renderAppAt('/c/lagos-ai-data/payments/transactions');
    fireEvent.click(await screen.findByRole('button', { name: /Échecs/ }, SLOW));
    fireEvent.click(screen.getByRole('button', { name: 'Exporter (CSV)' }));

    expect(click).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    // jsdom's Blob has no .text()
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    const lines = text.trim().split('\n');
    expect(lines[0]).toContain('Date;Membre;Formule');
    expect(lines).toHaveLength(failed.length + 1);
    click.mockRestore();
  });
});
