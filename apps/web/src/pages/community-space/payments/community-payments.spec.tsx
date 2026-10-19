import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { getMyCommunity } from '@/data/community-space.data';
import store from '@/redux/store';
import { must, renderAppAt, SLOW } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';

// Full app tree + Radix dialogs/menus: slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 15_000 });

type Call = { method: string; url: URL; body: Record<string, unknown> | null };
const plan = (id: string, name: string, price: string, billing_interval: string, order: number) => ({
  id, name, slug: id, description: '', price, currency: 'XOF', billing_interval, interval_count: 1,
  community_id: 'c-lagos', community_name: 'Lagos AI', features: ['Fil et discussions'], is_active: true, order,
});

/** Plans of lagos-ai-data (billing/plans/): the api lists the active ones only */
function stubPlansApi() {
  const calls: Call[] = [];
  let plans = [plan('p-month', 'Mensuel', '15000.00', 'month', 0), plan('p-year', 'Annuel', '150000.00', 'year', 1)];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : null;
    calls.push({ method: request.method, url, body });
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    if (path.endsWith('/billing/plans/') && request.method === 'GET') return json({ success: true, data: plans.filter((p) => p.is_active) });
    if (path.endsWith('/billing/plans/') && request.method === 'POST') {
      const created = plan('p-new', String(body?.name), `${body?.price}.00`, String(body?.billing_interval), plans.length);
      plans = [...plans, created];
      return json({ success: true, data: created }, 201);
    }
    const id = path.match(/billing\/plans\/([^/]+)\/$/)?.[1];
    if (id && request.method === 'DELETE') {
      plans = plans.map((p) => (p.id === id ? { ...p, is_active: false } : p));
      return json({ success: true, data: null });
    }
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => {
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Community space: subscriptions & payments', () => {
  it('is reserved to the owner of a paid community', async () => {
    const admin = renderAppAt('/c/frontend-francophone/payments');
    await waitFor(() => expect(admin.where()).toBe('/c/frontend-francophone/dashboard'));
    admin.unmount();
    // Owner, but the community is free
    const freeOwner = renderAppAt('/c/dakar-devops/payments');
    await waitFor(() => expect(freeOwner.where()).toBe('/c/dakar-devops/dashboard'));
  });

  it('opens on the plans of the api, with the key figures', async () => {
    stubPlansApi();
    const { where } = renderAppAt('/c/lagos-ai-data/payments');
    await waitFor(() => expect(where()).toBe('/c/lagos-ai-data/payments/plans'));
    expect(screen.getByRole('heading', { name: 'Abonnements & paiements' })).toBeTruthy();
    expect(await screen.findByRole('listitem', { name: 'Formule Mensuel' }, SLOW)).toBeTruthy();
    expect(screen.getByRole('listitem', { name: 'Formule Annuel' })).toBeTruthy();
    expect(screen.getByText('Formules proposées')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Indicateurs de facturation' }).textContent).toMatch(/15\s000 FCFA \/ moisPrix d’entrée/);
  });

  it('refuses a price under the minimum of the api, then creates the plan', async () => {
    const calls = stubPlansApi();
    const { community } = must(getMyCommunity('lagos-ai-data'));
    renderAppAt('/c/lagos-ai-data/payments/plans');
    fireEvent.click(await screen.findByRole('button', { name: 'Nouvelle formule' }, SLOW));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/^Nom/), { target: { value: 'Étudiant' } });
    fireEvent.change(within(dialog).getByLabelText(/Prix/), { target: { value: '300' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Créer la formule' }));
    expect(await within(dialog).findByText(/Prix minimum/, {}, SLOW)).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/Prix/), { target: { value: '5000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Créer la formule' }));
    expect(await screen.findByRole('listitem', { name: 'Formule Étudiant' }, SLOW)).toBeTruthy();
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ community_id: community.id, name: 'Étudiant', price: 5000, billing_interval: 'month' });
  });

  it('stops offering a plan, but always keeps one', async () => {
    const calls = stubPlansApi();
    renderAppAt('/c/lagos-ai-data/payments/plans');
    const yearly = await screen.findByRole('listitem', { name: 'Formule Annuel' }, SLOW);
    fireEvent.click(within(yearly).getByRole('button', { name: 'Ne plus proposer' }));
    fireEvent.click(within(yearly).getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.url.pathname.endsWith('/billing/plans/p-year/'))).toBe(true), SLOW);
    await waitFor(() => expect(screen.queryByRole('listitem', { name: 'Formule Annuel' })).toBeNull(), SLOW);

    const monthly = screen.getByRole('listitem', { name: 'Formule Mensuel' });
    fireEvent.click(within(monthly).getByRole('button', { name: 'Ne plus proposer' }));
    fireEvent.click(within(monthly).getByRole('button', { name: 'Confirmer' }));
    expect(await screen.findByText(/Gardez au moins une formule/, {}, SLOW)).toBeTruthy();
    expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
  });

  it('says that subscribers and payments are coming soon', async () => {
    stubPlansApi();
    renderAppAt('/c/lagos-ai-data/payments/subscribers');
    expect(await screen.findByText(/La liste de vos abonnés/, {}, SLOW)).toBeTruthy();
    cleanup();
    renderAppAt('/c/lagos-ai-data/payments/transactions');
    expect(await screen.findByText(/L’historique des paiements reçus/, {}, SLOW)).toBeTruthy();
  });
});
