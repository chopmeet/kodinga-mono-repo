import type { ColumnDef } from '@tanstack/react-table';
import { Ban, Check, PauseCircle, PlayCircle, Shield, ShieldCheck, User, X } from 'lucide-react';

import type { ReactNode } from 'react';

import { Badge, Button, DataTable } from '@kodinga-mono-repo/ui';
import type { AdminMember, MemberRole } from '@/data/admin-community-details.data';
import type { SpaceRole } from '@/data/community-space.data';
import { memberRoleLabel, memberStatusStyle } from '@/pages/shared/community-labels';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';
import { assignableRoles, canReviewRequest, canSanction } from '../form/member-permissions';
import type { SanctionTarget } from '../modals/sanction-modal';

const roleAction: Record<Exclude<MemberRole, 'owner'>, { label: string; icon: ReactNode }> = {
  admin: { label: 'Nommer administrateur', icon: <ShieldCheck /> },
  moderator: { label: 'Nommer modérateur', icon: <Shield /> },
  member: { label: 'Repasser en membre', icon: <User /> },
};

type Props = {
  members: AdminMember[];
  actor: SpaceRole;
  onApprove: (m: AdminMember) => void;
  onReject: (m: AdminMember) => void;
  onReactivate: (m: AdminMember) => void;
  onSanction: (target: SanctionTarget) => void;
  onChangeRole: (m: AdminMember, role: MemberRole) => void;
};

function MembersTable({ members, actor, onApprove, onReject, onReactivate, onSanction, onChangeRole }: Props) {
  const actionsFor = (m: AdminMember): RowAction[] => {
    const actions: RowAction[] = assignableRoles(actor, m).map((role) => ({
      ...roleAction[role],
      onSelect: () => onChangeRole(m, role),
    }));
    if (canSanction(actor, m)) {
      if (m.status === 'active') actions.push({ label: 'Suspendre', icon: <PauseCircle />, onSelect: () => onSanction({ member: m, type: 'suspension' }) });
      if (m.status === 'suspended' || m.status === 'banned') actions.push({ label: 'Réactiver', icon: <PlayCircle />, onSelect: () => onReactivate(m) });
      if (m.status !== 'banned') actions.push({ label: 'Bannir', icon: <Ban />, danger: true, onSelect: () => onSanction({ member: m, type: 'ban' }) });
    }
    return actions;
  };

  const columns: ColumnDef<AdminMember>[] = [
    {
      id: 'member',
      header: 'Membre',
      cell: ({ row }) => (
        <div className="min-w-44">
          <p className="font-medium text-slate-900">{row.original.name}</p>
          <p className="text-xs text-slate-500">@{row.original.username} · {row.original.city}</p>
        </div>
      ),
    },
    { id: 'role', header: 'Rôle', cell: ({ row }) => <span className="text-slate-700">{memberRoleLabel[row.original.role]}</span> },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const s = memberStatusStyle[row.original.status];
        return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
      },
    },
    {
      id: 'posts',
      header: () => <span className="block text-right">Publications</span>,
      cell: ({ row }) => <span className="block text-right text-slate-700 tabular-nums">{row.original.posts_count}</span>,
    },
    {
      id: 'joined',
      header: 'Membre depuis',
      cell: ({ row }) => <span className="whitespace-nowrap text-slate-600">{dateFormat.format(new Date(row.original.joined_at))}</span>,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const m = row.original;
        // Join requests: decided in one click, right in the row
        if (canReviewRequest(actor, m)) {
          return (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" onClick={() => onApprove(m)} aria-label={`Approuver ${m.name}`}>
                <Check />
                Approuver
              </Button>
              <Button size="sm" variant="outline" onClick={() => onReject(m)} aria-label={`Refuser ${m.name}`}>
                <X />
                Refuser
              </Button>
            </div>
          );
        }
        return (
          <div className="flex justify-end">
            <RowActions label={`Actions pour ${m.name}`} actions={actionsFor(m)} />
          </div>
        );
      },
    },
  ];

  return <DataTable columns={columns} data={members} isLoading={false} />;
}

export default MembersTable;
