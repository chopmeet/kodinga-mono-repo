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
    if (path.endsWith('/billing/communities/lagos-ai-data/revenue/')) return json({ success: true, data: { ...revenue, available_balance: balance } });
    if (path.endsWith('/billing/communities/lagos-ai-data/subscribers/')) return json({ success: true, data: [subscriber] });
    if (path.endsWith('/billing/communities/lagos-ai-data/transactions/')) return json({ success: true, data: [transaction] });
    if (path.endsWith('/billing/communities/lagos-ai-data/payouts/') && request.method === 'GET') return json({ success: true, data: payouts });
    if (path.endsWith('/billing/communities/lagos-ai-data/payouts/') && request.method === 'POST') {
      const created = { id: `po${payouts.length + 1}`, amount: `${body?.amount}.00`, currency: 'XOF', status: 'pending', payment_method: body?.payment_method, account_identifier: body?.account_identifier, account_name: body?.account_name ?? '', reference: '', processed_at: null, rejection_reason: '', created_at: '2026-10-29T10:00:00Z' };
      payouts = [created, ...payouts];
      balance = (Number(balance) - Number(body?.amount)).toFixed(2);
      return json({ success: true, data: created }, 201);
    }
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const member = { id: 'u9', username: 'kofi', email: 'kofi@example.com', first_name: 'Kofi', last_name: 'Mensah', full_name: 'Kofi Mensah', avatar_url: null };
const subscriber = {
  id: 'sub1', user: member, plan: { id: 'p-month', name: 'Mensuel', price: '15000.00', currency: 'XOF', billing_interval: 'month' },
  status: 'active', is_active: true, current_period_start: '2026-10-19T00:00:00Z', current_period_end: '2026-11-18T00:00:00Z',
  cancel_at_period_end: true, canceled_at: '2026-10-20T00:00:00Z', created_at: '2026-10-19T00:00:00Z',
};
const transaction = {
  id: 'pay1', user: member, plan_name: 'Mensuel', plan_interval: 'month', amount: '15000.00', platform_fee: '1500.00', net_amount: '13500.00',
  currency: 'XOF', status: 'PAID', provider: 'paydunya', provider_reference: '', paid_at: '2026-10-19T10:00:00Z', created_at: '2026-10-19T09:58:00Z',
};
const revenue = {
  total_gross: '15000.00', total_platform_fees: '1500.00', total_net: '13500.00', available_balance: '13500.00', withdrawn_amount: '0.00', currency: 'XOF',
  active_subscribers_count: 1, monthly_revenue: [{ month: '2026-10', gross: '15000.00', fees: '1500.00', net: '13500.00', payments_count: 1 }],
};
let payouts: Record<string, unknown>[] = [];
let balance = revenue.available_balance;
beforeEach(() => {
  payouts = [];
  balance = revenue.available_balance;
});

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

  it('shows the subscribers, the net revenue and the monthly chart of the api', async () => {
    stubPlansApi();
    renderAppAt('/c/lagos-ai-data/payments/subscribers');
    const table = await screen.findByRole('table', { name: 'Abonnés de la communauté' }, SLOW);
    expect(within(table).getByText('Kofi Mensah')).toBeTruthy();
    expect(within(table).getByText('Ne sera pas renouvelé')).toBeTruthy();
    const figures = screen.getByRole('region', { name: 'Indicateurs de facturation' });
    await waitFor(() => expect(figures.textContent).toMatch(/13\s500 FCFARevenus nets/), SLOW);
    // The chart has a table for screen readers: one row per month, the latest one with the payment
    const months = screen.getByRole('table', { name: 'Revenus par mois' });
    expect(within(months).getAllByRole('row')).toHaveLength(13);
    expect(within(months).getAllByRole('row')[12].textContent).toMatch(/15\s000 FCFA1\s500 FCFA13\s500 FCFA1/);
  });

  it('lists the payments with the Kodinga commission and the net', async () => {
    stubPlansApi();
    renderAppAt('/c/lagos-ai-data/payments/transactions');
    const table = await screen.findByRole('table', { name: 'Paiements reçus' }, SLOW);
    const row = within(table).getAllByRole('row')[1];
    expect(row.textContent).toMatch(/Kofi Mensah/);
    expect(row.textContent).toMatch(/− 1\s500 FCFA/);
    expect(row.textContent).toMatch(/13\s500 FCFA/);
  });

  it('asks a payout within the available balance', async () => {
    const calls = stubPlansApi();
    renderAppAt('/c/lagos-ai-data/payments/payouts');
    const solde = await screen.findByRole('region', { name: 'Solde' }, SLOW);
    await waitFor(() => expect(solde.textContent).toMatch(/13\s500 FCFA/), SLOW);
    fireEvent.click(within(solde).getByRole('button', { name: 'Demander un reversement' }));
    const dialog = await screen.findByRole('dialog', {}, SLOW);
    fireEvent.change(within(dialog).getByLabelText(/Montant/), { target: { value: '20000' } });
    fireEvent.change(within(dialog).getByLabelText(/Numéro de téléphone/), { target: { value: '+221770000000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Demander le reversement' }));
    expect(await within(dialog).findByText(/Au plus votre solde disponible/, {}, SLOW)).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/Montant/), { target: { value: '10000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Demander le reversement' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.url.pathname.endsWith('/payouts/'))?.body).toEqual({ amount: 10000, payment_method: 'wave', account_identifier: '+221770000000', account_name: '' }), SLOW);
    const table = await screen.findByRole('table', { name: 'Demandes de reversement' }, SLOW);
    expect(within(table).getByText('En attente')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('region', { name: 'Solde' }).textContent).toMatch(/3\s500 FCFA/), SLOW);
  });
});
