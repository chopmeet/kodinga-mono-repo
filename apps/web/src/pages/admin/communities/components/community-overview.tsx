import { CalendarDays, FileText, GraduationCap, UserPlus, Users, Wallet } from 'lucide-react';

import { type CardType, OverviewCardItem } from '@kodinga-mono-repo/ui';
import { getCommunityMembers, getCommunityPayments } from '@/data/admin-community-details.data';
import type { CommunityListItem } from '@/utils/api/community/community.type';
import { formatCompact } from '@/utils/Utils';

function CommunityOverview({ community }: { community: CommunityListItem }) {
  const pendingRequests = getCommunityMembers(community).filter((m) => m.status === 'pending').length;
  const revenue = getCommunityPayments(community)
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount, 0);

  const cards: CardType[] = [
    { id: 'members', label: 'Membres', value: formatCompact(community.members_count), icon: <Users size={18} />, color: '#1D4ED8' },
    { id: 'pending', label: "Demandes d'adhésion en attente", value: pendingRequests, icon: <UserPlus size={18} />, color: '#0f766e' },
    { id: 'posts', label: 'Publications', value: formatCompact(community.posts_count), icon: <FileText size={18} />, color: '#c2410c' },
    { id: 'courses', label: 'Formations', value: community.courses_count, icon: <GraduationCap size={18} />, color: '#7c3aed' },
    { id: 'events', label: 'Événements', value: community.events_count, icon: <CalendarDays size={18} />, color: '#b45309' },
    {
      id: 'revenue',
      label: community.pricing_type === 'paid' ? 'Revenus encaissés (45 j)' : 'Communauté gratuite',
      value: community.pricing_type === 'paid' ? `${formatCompact(revenue)} FCFA` : '—',
      icon: <Wallet size={18} />,
      color: '#15803d',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <OverviewCardItem item={card} key={card.id} />
      ))}
    </div>
  );
}

export default CommunityOverview;
