import { Crown, MailWarning, UserCheck, UserPlus, Users, UserX } from 'lucide-react';

import { type CardType, OverviewCardItem } from '@kodinga/ui';
import { useGetUsersQuery } from '@/utils/api/user/user.api';
import type { UsersQuery } from '@/utils/api/user/user.type';
import { formatCompact } from '@/utils/Utils';

/** Only the total of each status is needed: one user per page */
function useCount(status?: UsersQuery['status']) {
  const { data } = useGetUsersQuery({ status, page_size: 1 });
  return data ? formatCompact(data.pagination.count) : '…';
}

function UsersOverview() {
  const cards: CardType[] = [
    { id: 'total', label: 'Utilisateurs', value: useCount(), icon: <Users size={18} />, color: '#1D4ED8' },
    // Not plugged yet: the api has no filter on the join date, nor on community owners
    { id: 'new', label: 'Nouveaux (30 j)', value: '—', icon: <UserPlus size={18} />, color: '#0f766e' },
    { id: 'creators', label: 'Créateurs de communauté', value: '—', icon: <Crown size={18} />, color: '#b45309' },
    { id: 'active', label: 'Comptes actifs et vérifiés', value: useCount('active'), icon: <UserCheck size={18} />, color: '#15803d' },
    { id: 'unverified', label: 'Emails non vérifiés', value: useCount('unverified'), icon: <MailWarning size={18} />, color: '#c2410c' },
    { id: 'suspended', label: 'Comptes suspendus', value: useCount('inactive'), icon: <UserX size={18} />, color: '#b91c1c' },
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
