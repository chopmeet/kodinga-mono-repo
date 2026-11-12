import { Crown, MailWarning, UserCheck, UserPlus, Users, UserX } from 'lucide-react';

import { type CardType, OverviewCardItem } from '@kodinga/ui';
import { useGetUsersKPIsQuery } from '@/utils/api/user/user.api';
import { formatCompact } from '@/utils/Utils';

function UsersOverview() {
  const { data: kpis, isLoading } = useGetUsersKPIsQuery();

  const cards: CardType[] = [
    {
      id: 'total',
      label: 'Utilisateurs',
      value: kpis ? formatCompact(kpis.total_users) : isLoading ? '…' : '0',
      icon: <Users size={18} />,
      color: '#1D4ED8',
    },
    {
      id: 'creators',
      label: 'Créateurs de communauté',
      value: kpis ? formatCompact(kpis.creators_count) : isLoading ? '…' : '0',
      secondaryValue: kpis ? `${kpis.members_count} membre(s)` : undefined,
      icon: <Crown size={18} />,
      color: '#b45309',
    },
    {
      id: 'new',
      label: 'Nouveaux (30 j)',
      value: kpis ? formatCompact(kpis.new_users_30d) : isLoading ? '…' : '0',
      secondaryValue: kpis ? `+${kpis.new_users_7d} sur 7 j` : undefined,
      icon: <UserPlus size={18} />,
      color: '#0f766e',
    },
    {
      id: 'active',
      label: 'Comptes actifs et vérifiés',
      value: kpis ? formatCompact(kpis.active_users_count) : isLoading ? '…' : '0',
      icon: <UserCheck size={18} />,
      color: '#15803d',
    },
    {
      id: 'unverified',
      label: 'Emails non vérifiés',
      value: kpis ? formatCompact(kpis.unverified_users_count) : isLoading ? '…' : '0',
      icon: <MailWarning size={18} />,
      color: '#c2410c',
    },
    {
      id: 'suspended',
      label: 'Comptes suspendus',
      value: kpis ? formatCompact(kpis.suspended_users_count) : isLoading ? '…' : '0',
      icon: <UserX size={18} />,
      color: '#b91c1c',
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

export default UsersOverview;
