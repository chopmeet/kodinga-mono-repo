import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import store from '@/redux/store';
import { stubApi } from '@/test-utils';
import { AdminApi } from '@/utils/api/admin/admin.api';
import type { AnalyticsOverview, DashboardAuditLog, MonthlyGrowthPoint, PlatformActivity } from '@/utils/api/admin/admin.type';
import CommunityApi from '@/utils/api/community/community.api';
import type { CommunityListItem } from '@/utils/api/community/community.type';
import AdminDashboard from './admin-dashboard';
import { rankCommunities, toActivity, toFeedActivity } from './form/UseAdminDashboard';

const overview: AnalyticsOverview = {
  users: { total: 48500, active_30d: 9000, active_24h: 1200, new_7d: 740 },
  communities: { total: 1240 },
  content: { total_posts: 90000, total_comments: 210000 },
  learning: { total_courses: 80, lessons_completed: 5000 },
  ecosystem: { total_events: 40, total_projects: 120, total_opportunities: 60 },
  financial: { total_revenue: 25_000_000, total_paid_transactions: 3000, active_subscriptions: 812 },
  generated_at: '2026-11-08T10:00:00Z',
};

const log = (action: string, extra: Partial<DashboardAuditLog> = {}): DashboardAuditLog => ({
  id: action,
  action,
  actor_username: 'fatou',
  target_type: 'user',
  target_id: '3f2c0d6e-0000-0000-0000-000000000000',
  created_at: new Date().toISOString(),
  ...extra,
});

const feed = (id: string, type: PlatformActivity['type'], action: string, action_label: string, target: string | null): PlatformActivity => ({
  id,
  type,
  actor: 'fatou',
  action,
  action_label,
  target,
  at: new Date().toISOString(),
});

const MONTHS = ['Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov'];
const growth: MonthlyGrowthPoint[] = MONTHS.map((month, i) => ({
  month,
  year: 2026,
  date: `2026-${String(i + 1).padStart(2, '0')}`,
  newMembers: 100 + i,
  new_members: 100 + i,
  posts: 1000 + i,
  revenue: 0,
}));

const community = (name: string, members_count: number, is_featured = false) =>
  ({ id: name, name, slug: name.toLowerCase(), members_count, is_featured }) as CommunityListItem;

const ok = (data: unknown) => ({ body: { success: true, data } });

const stubDashboard = (
  dashboard: { status?: number; body: unknown } = ok({
    overview,
    recent_audit_logs: [],
    recent_activities: [
      feed('c1', 'community', 'community.created', "a créé la communauté 'Dakar Data'", 'Dakar Data'),
      feed('audit-1', 'admin', 'user.suspend', 'user.suspend', '3f2c0d6e-0000-0000-0000-000000000000'),
      feed('audit-2', 'setting', 'system.update_setting', 'system.update_setting', 'pro_monthly_price'),
    ],
  }),
  {
    methods = [{ method: 'Orange Money', amount: 1_890_000, count: 60 }, { method: 'Wave', amount: 1_420_000, count: 40 }],
    financial,
  }: { methods?: unknown[]; financial?: { status?: number; body: unknown } } = {},
) =>
  stubApi({
    'admin/dashboard/': dashboard,
    'analytics/growth/': ok(growth),
    'analytics/financial/':
      financial ?? ok({ recent_30d_revenue: 4_850_000, recent_30d_transactions: 310, payment_methods_30d: methods, generated_at: '' }),
    'analytics/engagement/': ok({ dau: 1, wau: 2, mau: 3, posts_last_7d: 4200, comments_last_7d: 9000, generated_at: '' }),
    'communities/': {
      body: {
        success: true,
        pagination: { count: 2, total_pages: 1, current_page: 1, next: null, previous: null, page_size: 50 },
        results: [community('Featured', 10, true), community('Python Africa Core', 5800)],
      },
    },
  });

const renderDashboard = () =>
  render(
    <Provider store={store}>
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    </Provider>
  );

beforeEach(() => {
  store.dispatch(AdminApi.util.resetApiState());
  store.dispatch(CommunityApi.util.resetApiState());
});
afterEach(() => vi.restoreAllMocks());

describe('AdminDashboard', () => {
  it('shows the key figures of the api and every panel', async () => {
    const calls = stubDashboard();
    const { getByRole, findByText, getByText } = renderDashboard();
    expect(getByRole('heading', { name: 'Tableau de bord' })).toBeTruthy();
    expect(await findByText('4,9 M FCFA')).toBeTruthy();
    expect(getByText('Nouveaux membres (7 j)')).toBeTruthy();
    expect(getByText('812')).toBeTruthy();
    for (const panel of [
      'Croissance de la plateforme',
      'Top 6 des communautés',
      "Communautés par type d'accès",
      'Moyens de paiement',
      'Activités récentes',
    ]) {
      expect(getByRole('heading', { name: panel })).toBeTruthy();
    }
    const list = calls.find((c) => new URL(c.url).pathname.endsWith('communities/'));
    expect(new URL(list?.url ?? 'http://x').searchParams.get('sort')).toBe('members_count');
    expect(new URL(list?.url ?? 'http://x').searchParams.get('page_size')).toBe('6');
  });

  it('shows the growth and the payment channels of the api, only the access split stays mock', async () => {
    stubDashboard();
    const { getAllByText, findAllByText, findByText, getByText } = renderDashboard();
    // Last month of the series of the api, under both small charts
    expect(await findAllByText('en nov.')).toHaveLength(2);
    // Payment amounts are written as text, not only as bar lengths
    expect(await findByText('1 890 000 FCFA')).toBeTruthy();
    expect(getByText('Wave')).toBeTruthy();
    expect(getAllByText('Données fictives')).toHaveLength(1);
  });

  it('says when nothing was collected, instead of showing made-up amounts', async () => {
    stubDashboard(undefined, { methods: [] });
    const { findByText, queryByText } = renderDashboard();
    expect(await findByText('Aucun paiement encaissé sur les 30 derniers jours.')).toBeTruthy();
    expect(queryByText('Orange Money')).toBeNull();
  });

  it('lists the activity feed of the platform, without ids as targets', async () => {
    stubDashboard();
    const { findByText, getByText, queryByText } = renderDashboard();
    expect(await findByText(/a créé la communauté 'Dakar Data'/)).toBeTruthy();
    expect(getByText(/a suspendu un compte/)).toBeTruthy();
    expect(queryByText(/3f2c0d6e/)).toBeNull();
    expect(getByText(/pro_monthly_price/)).toBeTruthy();
  });

  it('keeps the other key figures when the financial analytics fail', async () => {
    stubDashboard(undefined, { financial: { status: 500, body: { success: false, code: 'server_error', message: 'Erreur' } } });
    const { findByText, getByText, findAllByRole } = renderDashboard();
    expect(await findByText('812')).toBeTruthy();
    expect(getByText('Revenus (30 j)')).toBeTruthy();
    expect(getByText('—')).toBeTruthy();
    // Only the payments panel offers a retry
    expect(await findAllByRole('button', { name: 'Réessayer' })).toHaveLength(1);
  });

  it('shows the api error with a retry button', async () => {
    stubDashboard({ status: 403, body: { success: false, code: 'permission_denied', message: 'Droits superadmin requis' } });
    const { findAllByRole } = renderDashboard();
    await waitFor(async () => expect((await findAllByRole('button', { name: 'Réessayer' })).length).toBeGreaterThan(0));
  });
});

describe('rankCommunities', () => {
  it('ranks by members, featured or not, and keeps 6', () => {
    const list = [community('A', 10, true), ...[50, 40, 30, 20, 15, 12, 5].map((m) => community(`C${m}`, m))];
    expect(rankCommunities(list).map((c) => c.name)).toEqual(['C50', 'C40', 'C30', 'C20', 'C15', 'C12']);
  });
});

describe('toActivity', () => {
  it('keeps an unknown action code as is, without a uuid target', () => {
    expect(toActivity(log('billing.refund'))).toMatchObject({ action: 'billing.refund', target: null, actor: 'fatou' });
  });
});

describe('toFeedActivity', () => {
  it('words the admin actions, keeps the sentence of the api for the rest', () => {
    expect(toFeedActivity(feed('a', 'admin', 'user.promote_superadmin', 'user.promote_superadmin', '3f2c0d6e-0000-0000-0000-000000000000'))).toMatchObject({
      type: 'admin',
      action: 'a nommé un super-administrateur',
      target: null,
    });
    expect(toFeedActivity(feed('p', 'payment', 'payment.paid', 'a souscrit à Pass mensuel', '5000 XOF'))).toMatchObject({
      type: 'payment',
      action: 'a souscrit à Pass mensuel',
      target: '5000 XOF',
    });
  });
});
