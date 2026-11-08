import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import store from '@/redux/store';
import { stubApi } from '@/test-utils';
import { AdminApi } from '@/utils/api/admin/admin.api';
import type { AnalyticsOverview, DashboardAuditLog } from '@/utils/api/admin/admin.type';
import CommunityApi from '@/utils/api/community/community.api';
import type { CommunityListItem } from '@/utils/api/community/community.type';
import AdminDashboard from './admin-dashboard';
import { rankCommunities, toActivity } from './form/UseAdminDashboard';

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

const community = (name: string, members_count: number, is_featured = false) =>
  ({ id: name, name, slug: name.toLowerCase(), members_count, is_featured }) as CommunityListItem;

const ok = (data: unknown) => ({ body: { success: true, data } });

const stubDashboard = (dashboard: { status?: number; body: unknown } = ok({
  overview,
  recent_audit_logs: [
    log('system.update_setting', { target_type: 'setting', target_id: 'pro_monthly_price' }),
    log('user.suspend'),
  ],
})) =>
  stubApi({
    'admin/dashboard/': dashboard,
    'analytics/financial/': ok({ recent_30d_revenue: 4_850_000, recent_30d_transactions: 310, generated_at: '' }),
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
    expect(new URL(list?.url ?? 'http://x').searchParams.get('sort')).toBe('popular');
  });

  it('flags the blocks still on mock data', async () => {
    stubDashboard();
    const { getAllByText, findByText } = renderDashboard();
    await findByText('4,9 M FCFA');
    expect(getAllByText('Données fictives')).toHaveLength(3);
    // Payment amounts are written as text, not only as bar lengths
    expect(getAllByText('1 890 000 FCFA')).toHaveLength(1);
  });

  it('lists the audit log as readable activities', async () => {
    stubDashboard();
    const { findByText, getByText } = renderDashboard();
    expect(await findByText(/a modifié le paramètre/)).toBeTruthy();
    expect(getByText(/pro_monthly_price/)).toBeTruthy();
    expect(getByText(/a suspendu un compte/)).toBeTruthy();
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
