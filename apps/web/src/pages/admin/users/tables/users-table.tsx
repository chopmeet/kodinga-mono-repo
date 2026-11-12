import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, Crown, Eye, PauseCircle, PlayCircle, ShieldCheck, ShieldOff } from 'lucide-react';

import { Badge, DataTable } from '@kodinga/ui';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';
import type { User } from '@/utils/api/user/user.type';
import { getName, isAdmin, nameInitials } from '@/utils/Utils';

export function formatLastLogin(iso: string | null) {
  if (!iso) return 'Jamais';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  return `Il y a ${days} j`;
}

/** Account state badges (shared with the profile sheet) */
export function UserStatusBadges({ user }: { user: User }) {
  const commCount = user.communities_created_count ?? 0;
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {user.is_active ? (
        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Actif</Badge>
      ) : (
        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Suspendu</Badge>
      )}
      {isAdmin(user) && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">Super-admin</Badge>}
      {(user.is_creator || commCount > 0) && (
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 gap-1 inline-flex items-center">
          <Crown className="size-3 text-amber-600" />
          <span>Créateur ({commCount})</span>
        </Badge>
      )}
      {!user.is_email_verified && (
        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-800">Email non vérifié</Badge>
      )}
    </div>
  );
}

type Props = {
  users: User[];
  isLoading: boolean;
  onView: (user: User) => void;
  onToggleAdmin: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onVerifyEmail: (user: User) => void;
};

export type AccountHandlers = {
  onToggleAdmin: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onVerifyEmail: (user: User) => void;
};

/** Admin rights, email verification and suspension */
export function accountActions(user: User, { onToggleAdmin, onToggleStatus, onVerifyEmail }: AccountHandlers): RowAction[] {
  const actions: RowAction[] = [];

  if (!user.is_email_verified) {
    actions.push({
      label: "Vérifier l'adresse email",
      icon: <CheckCircle className="text-emerald-600" />,
      onSelect: () => onVerifyEmail(user),
    });
  }

  actions.push(
    isAdmin(user)
      ? { label: 'Retirer les droits admin', icon: <ShieldOff />, onSelect: () => onToggleAdmin(user) }
      : { label: 'Nommer administrateur', icon: <ShieldCheck />, onSelect: () => onToggleAdmin(user) }
  );

  actions.push(
    user.is_active
      ? { label: 'Suspendre le compte', icon: <PauseCircle />, danger: true, onSelect: () => onToggleStatus(user) }
      : { label: 'Réactiver le compte', icon: <PlayCircle />, onSelect: () => onToggleStatus(user) }
  );

  return actions;
}

function UsersTable({ users, isLoading, onView, ...handlers }: Props) {
  const columns: ColumnDef<User>[] = [
    {
      id: 'user',
      header: 'Utilisateur',
      cell: ({ row }) => {
        const name = getName(row.original) || row.original.email;
        return (
          <button type="button" onClick={() => onView(row.original)} className="flex min-w-56 items-center gap-3 text-left">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white" aria-hidden>
              {nameInitials(name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-medium text-foreground hover:text-primary hover:underline">{name}</span>
              <span className="block truncate text-xs text-muted-foreground">{row.original.email}</span>
            </span>
          </button>
        );
      },
    },
    { id: 'username', header: 'Pseudo', cell: ({ row }) => <span className="text-body">@{row.original.username}</span> },
    { id: 'status', header: 'Statut', cell: ({ row }) => <UserStatusBadges user={row.original} /> },
    {
      id: 'joined',
      header: 'Inscrit le',
      cell: ({ row }) => <span className="whitespace-nowrap text-soft">{dateFormat.format(new Date(row.original.date_joined))}</span>,
    },
    {
      id: 'login',
      header: 'Dernière connexion',
      cell: ({ row }) => <span className="whitespace-nowrap text-soft">{formatLastLogin(row.original.last_login)}</span>,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <RowActions
          label={`Actions pour ${getName(row.original) || row.original.email}`}
          actions={[{ label: 'Voir le profil', icon: <Eye />, onSelect: () => onView(row.original) }, ...accountActions(row.original, handlers)]}
        />
      ),
    },
  ];

  return <DataTable columns={columns} data={users} isLoading={isLoading} />;
}

export default UsersTable;
