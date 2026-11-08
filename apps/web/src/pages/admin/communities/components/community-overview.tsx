import { CalendarDays, FileText, GraduationCap, UserPlus, Users, Wallet } from 'lucide-react';

import { type CardType, OverviewCardItem } from '@kodinga/ui';
import { useGetCommunityMembersQuery } from '@/utils/api/community/community.api';
import type { CommunityListItem } from '@/utils/api/community/community.type';
import { formatCompact } from '@/utils/Utils';

function CommunityOverview({ community }: { community: CommunityListItem }) {
  // Only the total is needed: one pending request per page
  const { data: pending } = useGetCommunityMembersQuery({ slug: community.slug, status: 'pending', page_size: 1 });

  const cards: CardType[] = [
    { id: 'members', label: 'Membres', value: formatCompact(community.members_count), icon: <Users size={18} />, color: '#1D4ED8' },
    {
      id: 'pending',
      label: "Demandes d'adhésion en attente",
      value: pending ? pending.pagination.count : '…',
      icon: <UserPlus size={18} />,
      color: '#0f766e',
    },
    { id: 'posts', label: 'Publications', value: formatCompact(community.posts_count), icon: <FileText size={18} />, color: '#c2410c' },
    { id: 'courses', label: 'Formations', value: community.courses_count, icon: <GraduationCap size={18} />, color: '#7c3aed' },
    { id: 'events', label: 'Événements', value: community.events_count, icon: <CalendarDays size={18} />, color: '#b45309' },
    {
      id: 'revenue',
      // No billing endpoint per community yet
      label: community.pricing_type === 'paid' ? 'Revenus (bientôt disponibles)' : 'Communauté gratuite',
      value: '—',
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
