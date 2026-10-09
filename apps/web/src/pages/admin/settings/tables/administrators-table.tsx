import type { ColumnDef } from '@tanstack/react-table';
import { MailCheck, ShieldOff } from 'lucide-react';

import { Badge, DataTable } from '@kodinga-mono-repo/ui';
import type { AdminUser } from '@/data/admin-users.data';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';
import { formatLastLogin, initials } from '../../users/tables/users-table';

/** An invited account that never signed in yet */
export const isPending = (admin: AdminUser) => !admin.is_email_verified && !admin.last_login;

type Props = {
  admins: AdminUser[];
  currentUserId?: string;
  onResendInvite: (admin: AdminUser) => void;
  onRevoke: (admin: AdminUser) => void;
};

function AdministratorsTable({ admins, currentUserId, onResendInvite, onRevoke }: Props) {
  const actionsFor = (admin: AdminUser): RowAction[] => [
    ...(isPending(admin)
      ? [{ label: "Renvoyer l'invitation", icon: <MailCheck />, onSelect: () => onResendInvite(admin) }]
      : []),
    { label: "Retirer l'accès", icon: <ShieldOff />, danger: true, onSelect: () => onRevoke(admin) },
  ];

  const columns: ColumnDef<AdminUser>[] = [
    {
      id: 'admin',
      header: 'Super-administrateur',
      cell: ({ row }) => (
        <div className="flex min-w-56 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-700 text-xs font-semibold text-white" aria-hidden>
            {initials(row.original.full_name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">
              {row.original.full_name}
              {currentUserId === row.original.id && <span className="ml-1.5 text-xs font-normal text-slate-500">(vous)</span>}
            </p>
            <p className="truncate text-xs text-slate-500">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) =>
        isPending(row.original) ? (
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Invitation en attente</Badge>
        ) : (
          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Actif</Badge>
        ),
    },
    {
      id: 'added',
      header: 'Ajouté le',
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
      cell: ({ row }) => <RowActions label={`Actions pour ${row.original.full_name}`} actions={actionsFor(row.original)} />,
    },
  ];

  return <DataTable columns={columns} data={admins} isLoading={false} />;
}

export default AdministratorsTable;
