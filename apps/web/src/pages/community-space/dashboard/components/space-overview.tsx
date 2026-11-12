import { CalendarDays, FileText, UserPlus, Users, UserRoundCheck, Wallet } from 'lucide-react';

import { type CardType, OverviewCardItem } from '@kodinga/ui';
import { formatCompact } from '@/pages/shared/chart-theme';
import { useGetCommunityRevenueQuery } from '@/utils/api/community/community.api';
import { monthKey, xof } from '@/utils/Utils';
import { canAccess, useCommunitySpace } from '../../community-space-context';
import type UseCommunityDashboard from '../form/UseCommunityDashboard';

type Stats = ReturnType<typeof UseCommunityDashboard>;

/** "…" while loading */
const show = (value: number | undefined, format: (n: number) => string | number = (n) => n) => (value === undefined ? '…' : format(value));

/** YYYY-MM of today, the key of monthly_revenue */

function SpaceOverview({ stats }: { stats: Stats }) {
  const space = useCommunitySpace();
  // Revenue: owner of a paid community only (same rule as the "Monétisation" menu)
  const showRevenue = canAccess(space, 'payments');
  const revenue = useGetCommunityRevenueQuery(space.community.slug, { skip: !showRevenue }).data;
  const netThisMonth = revenue ? Number(revenue.monthly_revenue?.find((m) => m.month === monthKey())?.net ?? 0) : undefined;
  const cards: CardType[] = [
    { id: 'members', label: 'Membres actifs', value: show(stats.activeMembers, formatCompact), icon: <Users size={18} />, color: '#1D4ED8' },
    { id: 'new', label: 'Nouveaux membres (30 j)', value: show(stats.newMembers30d), icon: <UserPlus size={18} />, color: '#0f766e' },
    {
      id: 'posts',
      label: 'Publications (30 j)',
      value: stats.posts30d ? `${stats.posts30d.count}${stats.posts30d.atLeast ? '+' : ''}` : '…',
      icon: <FileText size={18} />,
      color: '#c2410c',
    },
    { id: 'pending', label: "Demandes d'adhésion", value: show(stats.pendingRequests), icon: <UserRoundCheck size={18} />, color: '#b45309' },
    { id: 'events', label: 'Événements à venir', value: show(stats.upcomingEvents), icon: <CalendarDays size={18} />, color: '#7c3aed' },
  ];
  if (showRevenue) {
    cards.push({ id: 'revenue', label: 'Revenus nets ce mois-ci', value: show(netThisMonth, xof), icon: <Wallet size={18} />, color: '#15803d' });
  }

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <OverviewCardItem item={card} key={card.id} />
      ))}
    </div>
  );
}

export default SpaceOverview;
