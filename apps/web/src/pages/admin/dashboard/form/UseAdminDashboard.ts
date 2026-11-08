import type { DashboardActivity } from '../charts/recent-activities';
import {
  useGetAdminDashboardQuery,
  useGetEngagementAnalyticsQuery,
  useGetFinancialAnalyticsQuery,
} from '@/utils/api/admin/admin.api';
import type { DashboardAuditLog } from '@/utils/api/admin/admin.type';
import { useGetCommunitiesQuery } from '@/utils/api/community/community.api';
import type { CommunityListItem } from '@/utils/api/community/community.type';

export type DashboardKpi = {
  id: string;
  label: string;
  /** null while loading or when its endpoint failed */
  value: number | null;
  unit?: 'xof';
};

export type CommunityRanking = { name: string; members: number };

const TOP_SIZE = 6;

// Audit log codes (administration/services/admin_service.py, memberships/) → readable activity
const AUDIT_ACTIONS: Record<string, Pick<DashboardActivity, 'type' | 'action'>> = {
  'user.suspend': { type: 'report', action: 'a suspendu un compte' },
  'user.activate': { type: 'member', action: 'a réactivé un compte' },
  'user.promote_superadmin': { type: 'admin', action: 'a nommé un super-administrateur' },
  'user.demote_superadmin': { type: 'admin', action: 'a retiré les droits de super-administrateur' },
  'system.update_setting': { type: 'setting', action: 'a modifié le paramètre' },
  'workspace.member_role_changed': { type: 'member', action: "a changé le rôle d'un membre" },
  'workspace.member_removed': { type: 'report', action: "a retiré un membre d'une communauté" },
  'workspace.invitation_created': { type: 'community', action: 'a envoyé une invitation' },
  'workspace.invitation_accepted': { type: 'member', action: 'a accepté une invitation' },
  'workspace.invitation_declined': { type: 'member', action: 'a refusé une invitation' },
  'workspace.invitation_resent': { type: 'community', action: 'a relancé une invitation' },
  'workspace.invitation_revoked': { type: 'community', action: 'a révoqué une invitation' },
};

export const toActivity = (log: DashboardAuditLog): DashboardActivity => {
  const known = AUDIT_ACTIONS[log.action];
  return {
    id: log.id,
    type: known?.type ?? 'setting',
    actor: log.actor_username,
    action: known?.action ?? log.action,
    // Only settings have a readable target (their key); users and members are uuids
    target: log.action === 'system.update_setting' ? log.target_id : null,
    at: log.created_at,
  };
};

/** The `size` communities with the most members */
export const rankCommunities = (list: CommunityListItem[], size = TOP_SIZE): CommunityRanking[] =>
  [...list]
    .sort((a, b) => b.members_count - a.members_count)
    .slice(0, size)
    .map((c) => ({ name: c.name, members: c.members_count }));

/** Data of the admin dashboard; blocks the api does not cover yet stay on data/admin-dashboard.data.ts */
export default function useAdminDashboard() {
  const dashboard = useGetAdminDashboardQuery();
  const financial = useGetFinancialAnalyticsQuery();
  const engagement = useGetEngagementAnalyticsQuery();
  // The api puts featured communities first even when sorted by popularity: take a wider page
  // and rank it here by members
  const communities = useGetCommunitiesQuery({ sort: 'popular', page_size: 50 });

  const overview = dashboard.data?.overview;

  const kpis: DashboardKpi[] = [
    { id: 'communities', label: 'Communautés', value: overview?.communities.total ?? null },
    { id: 'members', label: 'Membres inscrits', value: overview?.users.total ?? null },
    // TODO(api): 30-day counts (users.new_30d, content.posts_30d) instead of 7 days
    { id: 'new-members', label: 'Nouveaux membres (7 j)', value: overview?.users.new_7d ?? null },
    { id: 'posts', label: 'Publications (7 j)', value: engagement.data?.posts_last_7d ?? null },
    { id: 'revenue', label: 'Revenus (30 j)', value: financial.data?.recent_30d_revenue ?? null, unit: 'xof' },
    { id: 'subscriptions', label: 'Abonnements actifs', value: overview?.financial.active_subscriptions ?? null },
  ];

  const topCommunities = rankCommunities(communities.data?.results ?? []);

  return {
    kpis,
    kpisLoading: dashboard.isLoading || financial.isLoading || engagement.isLoading,
    kpisError: dashboard.error ?? financial.error ?? engagement.error,
    refetchKpis: () => {
      dashboard.refetch();
      financial.refetch();
      engagement.refetch();
    },
    topCommunities,
    communities,
    activities: (dashboard.data?.recent_audit_logs ?? []).map(toActivity),
    dashboard,
  };
}
