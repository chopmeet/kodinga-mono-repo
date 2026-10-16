import type { ColumnDef } from '@tanstack/react-table';
import { ShieldOff } from 'lucide-react';

import { DataTable } from '@kodinga-mono-repo/ui';
import { dateFormat, RowActions } from '@/pages/shared/row-actions';
import type { User } from '@/utils/api/user/user.type';
import { getName, nameInitials } from '@/utils/Utils';
import { formatLastLogin, UserStatusBadges } from '../../users/tables/users-table';

type Props = {
  admins: User[];
  isLoading: boolean;
  currentUserId?: string;
  onRevoke: (admin: User) => void;
};

function AdministratorsTable({ admins, isLoading, currentUserId, onRevoke }: Props) {
  const columns: ColumnDef<User>[] = [
    {
      id: 'admin',
      header: 'Super-administrateur',
      cell: ({ row }) => {
        const name = getName(row.original) || row.original.email;
        return (
          <div className="flex min-w-56 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-700 text-xs font-semibold text-white" aria-hidden>
              {nameInitials(name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">
                {name}
                {currentUserId === row.original.id && <span className="ml-1.5 text-xs font-normal text-slate-500">(vous)</span>}
              </p>
              <p className="truncate text-xs text-slate-500">{row.original.email}</p>
            </div>
          </div>
        );
      },
    },
    { id: 'status', header: 'Statut', cell: ({ row }) => <UserStatusBadges user={row.original} /> },
    {
      id: 'joined',
      header: 'Inscrit le',
      cell: ({ row }) => <span className="whitespace-nowrap text-slate-600">{dateFormat.format(new Date(row.original.date_joined))}</span>,
    },
    {
      id: 'login',
      header: 'Dernière connexion',
      cell: ({ row }) => <span className="whitespace-nowrap text-slate-600">{formatLastLogin(row.original.last_login)}</span>,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <RowActions
          label={`Actions pour ${getName(row.original) || row.original.email}`}
          actions={[{ label: "Retirer l'accès", icon: <ShieldOff />, danger: true, onSelect: () => onRevoke(row.original) }]}
        />
      ),
    },
  ];

  return <DataTable columns={columns} data={admins} isLoading={isLoading} />;
}

export default AdministratorsTable;
