import { FileText, Percent, UserPlus, Users, UsersRound, Wallet } from 'lucide-react';
import type { ReactElement } from 'react';

import { type CardType, OverviewCardItem } from '@kodinga-mono-repo/ui';
import { type DashboardKpi, dashboardKpis } from '@/data/admin-dashboard.data';
import { formatCompact } from '@/pages/shared/chart-theme';

const kpiStyle: Record<string, { icon: ReactElement; color: string }> = {
  communities: { icon: <UsersRound size={18} />, color: '#1D4ED8' },
  members: { icon: <Users size={18} />, color: '#7c3aed' },
  'new-members': { icon: <UserPlus size={18} />, color: '#0f766e' },
  posts: { icon: <FileText size={18} />, color: '#c2410c' },
  revenue: { icon: <Wallet size={18} />, color: '#15803d' },
  'paid-rate': { icon: <Percent size={18} />, color: '#b45309' },
};

const formatKpi = (kpi: DashboardKpi) => {
  if (kpi.unit === 'xof') return `${formatCompact(kpi.value)} FCFA`;
  if (kpi.unit === 'percent') return `${kpi.value} %`;
  return formatCompact(kpi.value);
};

function Overview() {
  const cards: CardType[] = dashboardKpis.map((kpi) => ({
    id: kpi.id,
    label: kpi.label,
    value: formatKpi(kpi),
    ...kpiStyle[kpi.id],
  }));

  return (
    <div className="dashboard-overview">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <OverviewCardItem item={card} key={card.id} />
        ))}
      </div>
    </div>
  );
}

export default Overview;
