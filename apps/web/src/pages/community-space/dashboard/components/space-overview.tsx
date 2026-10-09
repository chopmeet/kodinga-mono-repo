import { FileText, UserPlus, Users, UserRoundCheck, Wallet } from 'lucide-react';

import { type CardType, OverviewCardItem } from '@kodinga-mono-repo/ui';
import type { CommunityDashboard } from '@/data/community-space.data';
import { formatCompact } from '@/pages/shared/chart-theme';
import { canAccess, useCommunitySpace } from '../../community-space-context';

function SpaceOverview({ stats }: { stats: CommunityDashboard }) {
  const space = useCommunitySpace();
  const cards: CardType[] = [
    { id: 'members', label: 'Membres', value: formatCompact(space.community.members_count), icon: <Users size={18} />, color: '#1D4ED8' },
    { id: 'new', label: 'Nouveaux membres (30 j)', value: stats.newMembers30d, icon: <UserPlus size={18} />, color: '#0f766e' },
    { id: 'posts', label: 'Publications (30 j)', value: formatCompact(stats.posts30d), icon: <FileText size={18} />, color: '#c2410c' },
    { id: 'pending', label: "Demandes d'adhésion", value: stats.pendingRequests, icon: <UserRoundCheck size={18} />, color: '#b45309' },
  ];
  // Revenue: owner of a paid community only (same rule as the "Monétisation" menu)
  if (canAccess(space, 'payments')) {
    cards.push({ id: 'revenue', label: 'Revenus (30 j)', value: `${formatCompact(stats.revenue30d)} FCFA`, icon: <Wallet size={18} />, color: '#15803d' });
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
