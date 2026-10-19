import { act, cleanup, screen, waitFor, within } from '@testing-library/react';

import { onLogout, onSetUserToken } from '@/redux/slice/User.slice';
import store from '@/redux/store';
import { renderAppAt, SLOW, TEST_TOKEN } from '@/test-utils';
import { CommunityApi } from '@/utils/api/community/community.api';
import type { User } from '@/utils/api/user/user.type';

vi.setConfig({ testTimeout: 15_000 });

const plan = { id: 'p1', name: 'Mensuel', slug: 'p1', description: '', price: '15000.00', currency: 'XOF', billing_interval: 'month', interval_count: 1, community_id: 'c1', community_name: 'Lagos AI', features: [], is_active: true, order: 0 };

type Call = { url: URL };

/** Lagos AI (paid): a payment checked with the api until PayDunya confirms it */
function stubBillingApi({ confirmAfter = 1, finalStatus = 'PAID' } = {}) {
  const calls: Call[] = [];
  let checks = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const request = input as Request;
    const url = new URL(request.url);
    calls.push({ url });
    const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
    const path = url.pathname;
    const paid = checks > confirmAfter && finalStatus === 'PAID';
    if (path.endsWith('/communities/lagos-ai/')) {
      return json({
        success: true,
        data: {
          id: 'c1', name: 'Lagos AI', slug: 'lagos-ai', privacy_type: 'private', pricing_type: 'paid', members_count: 12, owner: { id: 'o', username: 'o' },
          user_membership: paid ? { is_member: true, role: 'member', status: 'active' } : { is_member: false, role: null, status: null },
        },
      });
    }
    if (path.endsWith('/billing/payments/pay-1/status/')) {
      checks += 1;
      const status = checks > confirmAfter ? finalStatus : 'PENDING';
      return json({ success: true, data: { payment_id: 'pay-1', status, is_paid: status === 'PAID', receipt_url: '', paid_at: null } });
    }
    if (path.endsWith('/billing/payments/my/')) {
      return json({ success: true, data: [{ id: 'pay-1', plan, amount: '15000.00', currency: 'XOF', status: paid ? 'PAID' : 'PENDING', provider: 'paydunya', provider_reference: '', checkout_url: 'https://paydunya.com/checkout/x', paid_at: null, created_at: '2026-10-19T10:00:00Z' }] });
    }
    if (path.endsWith('/billing/subscriptions/me/')) {
      return json({ success: true, data: [{ id: 's1', plan, community_id: 'c1', status: 'active', is_active: true, current_period_start: '2026-10-19T10:00:00Z', current_period_end: '2026-11-19T10:00:00Z', cancel_at_period_end: false, canceled_at: null, created_at: '2026-10-19T10:00:00Z' }] });
    }
    if (path.endsWith('/billing/plans/')) return json({ success: true, data: [plan] });
    return json({ success: true, data: [], pagination: { count: 0 }, results: [] });
  });
  return calls;
}

const signIn = () =>
  act(() => {
    store.dispatch(onSetUserToken({ user: { id: 'u1', username: 'fatou' } as User, token: TEST_TOKEN, refresh: 'r' }));
  });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
  act(() => {
    store.dispatch(onLogout());
    store.dispatch(CommunityApi.util.resetApiState());
  });
});

describe('Back from PayDunya', () => {
  it('checks the payment until it is confirmed, then opens the community', async () => {
    signIn();
    sessionStorage.setItem('kodinga_pending_payment', JSON.stringify({ slug: 'lagos-ai', paymentId: 'pay-1' }));
    const calls = stubBillingApi({ confirmAfter: 1 });
    renderAppAt('/communities/lagos-ai?payment=done');
    expect(await screen.findByText(/Vérification de votre paiement/, {}, SLOW)).toBeTruthy();
    expect(await screen.findByText(/Paiement confirmé/, {}, { timeout: 8000 })).toBeTruthy();
    expect(calls.filter((c) => c.url.pathname.endsWith('/pay-1/status/')).length).toBeGreaterThanOrEqual(2);
    expect(sessionStorage.getItem('kodinga_pending_payment')).toBeNull();
  });

  it('finds the payment of the community when the tab did not keep it, and tells a failure', async () => {
    signIn();
    stubBillingApi({ confirmAfter: 0, finalStatus: 'FAILED' });
    renderAppAt('/communities/lagos-ai?payment=done');
    expect(await screen.findByText(/Le paiement n’a pas abouti/, {}, SLOW)).toBeTruthy();
  });

  it('says when the payment was cancelled', async () => {
    signIn();
    stubBillingApi();
    renderAppAt('/communities/lagos-ai?payment=cancelled');
    expect(await screen.findByText(/Paiement annulé/, {}, SLOW)).toBeTruthy();
  });
});

describe('Account: subscriptions', () => {
  it('lists the subscriptions and the payments', async () => {
    signIn();
    stubBillingApi();
    renderAppAt('/account/billing');
    const subs = await screen.findByRole('list', { name: 'Mes abonnements' }, SLOW);
    expect(subs.textContent).toMatch(/Lagos AI/);
    expect(subs.textContent).toMatch(/Renouvellement le 19 novembre 2026/);
    const table = screen.getByRole('table', { name: 'Historique des paiements' });
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2));
    expect(within(table).getByText('En attente')).toBeTruthy();
    expect(within(table).getByRole('link', { name: 'Finaliser' }).getAttribute('href')).toBe('https://paydunya.com/checkout/x');
  });
});
