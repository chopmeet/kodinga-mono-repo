import { CalendarDays, FileText, GraduationCap, UserPlus, Users, Wallet } from 'lucide-react';

import { type CardType, OverviewCardItem } from '@kodinga/ui';
import { useGetCommunityMembersQuery, useGetCommunityRevenueQuery } from '@/utils/api/community/community.api';
import type { CommunityListItem } from '@/utils/api/community/community.type';
import { formatCompact } from '@/utils/Utils';

function CommunityOverview({ community }: { community: CommunityListItem }) {
  // Only the total is needed: one pending request per page
  const { data: pending } = useGetCommunityMembersQuery({ slug: community.slug, status: 'pending', page_size: 1 });
  // Same cache entry as the Paiements tab (billing/communities/<slug>/revenue/, owner or platform admin)
  const paid = community.pricing_type === 'paid';
  const revenue = useGetCommunityRevenueQuery(community.slug, { skip: !paid });
  const revenueValue = revenue.data ? `${formatCompact(Number(revenue.data.total_gross))} FCFA` : revenue.isLoading ? '…' : '—';

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
      // What the members paid in total, before the Kodinga commission
      label: paid ? 'Revenus encaissés (total)' : 'Communauté gratuite',
      value: paid ? revenueValue : '—',
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
