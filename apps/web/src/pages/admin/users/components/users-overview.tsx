import { MailWarning, ShieldCheck, UserPlus, Users, UserX, Crown } from 'lucide-react';

import { type CardType, OverviewCardItem } from '@kodinga-mono-repo/ui';
import { type AdminUser, userRole } from '@/data/admin-users.data';
import { formatCompact } from '@/utils/Utils';

const THIRTY_DAYS = 30 * 86_400_000;

function UsersOverview({ users }: { users: AdminUser[] }) {
  const now = Date.UTC(2026, 9, 9, 10);
  const cards: CardType[] = [
    { id: 'total', label: 'Utilisateurs', value: formatCompact(users.length), icon: <Users size={18} />, color: '#1D4ED8' },
    {
      id: 'new',
      label: 'Nouveaux (30 j)',
      value: users.filter((u) => now - new Date(u.date_joined).getTime() <= THIRTY_DAYS).length,
      icon: <UserPlus size={18} />,
      color: '#0f766e',
    },
    { id: 'creators', label: 'Créateurs de communauté', value: users.filter((u) => userRole(u) === 'creator').length, icon: <Crown size={18} />, color: '#b45309' },
    { id: 'staff', label: 'Administrateurs', value: users.filter((u) => u.is_staff).length, icon: <ShieldCheck size={18} />, color: '#7c3aed' },
    { id: 'unverified', label: 'Emails non vérifiés', value: users.filter((u) => !u.is_email_verified).length, icon: <MailWarning size={18} />, color: '#c2410c' },
    { id: 'suspended', label: 'Comptes suspendus', value: users.filter((u) => !u.is_active).length, icon: <UserX size={18} />, color: '#b91c1c' },
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
