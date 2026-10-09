import type { ColumnDef } from '@tanstack/react-table';
import { Eye, PauseCircle, PlayCircle, ShieldCheck, ShieldOff } from 'lucide-react';

import { Badge, DataTable } from '@kodinga-mono-repo/ui';
import { type AdminUser, userRole } from '@/data/admin-users.data';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';

export const roleStyle = {
  staff: { label: 'Administrateur', className: 'border-violet-200 bg-violet-50 text-violet-800' },
  creator: { label: 'Créateur', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  member: { label: 'Membre', className: 'border-slate-200 bg-slate-50 text-slate-700' },
} as const;

export const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export function formatLastLogin(iso: string | null) {
  if (!iso) return 'Jamais';
  const days = Math.floor((Date.UTC(2026, 9, 9, 10) - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  return `Il y a ${days} j`;
}

type Props = {
  users: AdminUser[];
  isLoading: boolean;
  onView: (user: AdminUser) => void;
  onToggleActive: (user: AdminUser) => void;
  onToggleStaff: (user: AdminUser) => void;
};

function UsersTable({ users, isLoading, onView, onToggleActive, onToggleStaff }: Props) {
  const actionsFor = (u: AdminUser): RowAction[] => [
    { label: 'Voir le profil', icon: <Eye />, onSelect: () => onView(u) },
    u.is_staff
      ? { label: 'Retirer les droits admin', icon: <ShieldOff />, onSelect: () => onToggleStaff(u) }
      : { label: 'Nommer administrateur', icon: <ShieldCheck />, onSelect: () => onToggleStaff(u) },
    u.is_active
      ? { label: 'Suspendre le compte', icon: <PauseCircle />, danger: true, onSelect: () => onToggleActive(u) }
      : { label: 'Réactiver le compte', icon: <PlayCircle />, onSelect: () => onToggleActive(u) },
  ];

  const columns: ColumnDef<AdminUser>[] = [
    {
      id: 'user',
      header: 'Utilisateur',
      cell: ({ row }) => (
        <button type="button" onClick={() => onView(row.original)} className="flex min-w-56 items-center gap-3 text-left">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white" aria-hidden>
            {initials(row.original.full_name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-900 hover:text-primary hover:underline">{row.original.full_name}</span>
            <span className="block truncate text-xs text-slate-500">{row.original.email}</span>
          </span>
        </button>
      ),
    },
    {
      id: 'role',
      header: 'Rôle',
      cell: ({ row }) => {
        const role = roleStyle[userRole(row.original)];
        return <Badge variant="outline" className={role.className}>{role.label}</Badge>;
      },
    },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1.5">
          {row.original.is_active ? (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Actif</Badge>
          ) : (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Suspendu</Badge>
          )}
          {!row.original.is_email_verified && (
            <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-800">Email non vérifié</Badge>
          )}
        </div>
      ),
    },
    {
      id: 'communities',
      header: () => <span className="block text-right">Communautés</span>,
      cell: ({ row }) => (
        <span className="block text-right whitespace-nowrap text-slate-700 tabular-nums">
          {row.original.communities_joined}
          {row.original.communities_owned > 0 && <span className="text-slate-500"> · {row.original.communities_owned} créée{row.original.communities_owned > 1 ? 's' : ''}</span>}
        </span>
      ),
    },
    { id: 'city', header: 'Ville', cell: ({ row }) => <span className="text-slate-700">{row.original.city}</span> },
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
      cell: ({ row }) => <RowActions label={`Actions pour ${row.original.full_name}`} actions={actionsFor(row.original)} />,
    },
  ];

  return <DataTable columns={columns} data={users} isLoading={isLoading} />;
}

export default UsersTable;
