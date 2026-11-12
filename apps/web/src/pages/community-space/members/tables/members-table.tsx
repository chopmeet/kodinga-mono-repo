import type { ColumnDef } from '@tanstack/react-table';
import { Ban, Check, PauseCircle, PlayCircle, Shield, ShieldCheck, TriangleAlert, User, VolumeX, X } from 'lucide-react';

import type { ReactNode } from 'react';

import { Badge, Button, DataTable } from '@kodinga/ui';
import type { SpaceRole } from '@/data/community-space.data';
import type { CommunityRole } from '@/utils/api/community/community.type';
import { memberRoleLabel, memberStatusStyle } from '@/utils/Utils';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';
import { assignableRoles, canReviewRequest, canSanction } from '../form/member-permissions';
import type { SpaceMember } from '../form/UseSpaceMembers';
import type { SanctionTarget } from '../modals/sanction-modal';

const roleAction: Record<Exclude<CommunityRole, 'owner'>, { label: string; icon: ReactNode }> = {
  admin: { label: 'Nommer administrateur', icon: <ShieldCheck /> },
  moderator: { label: 'Nommer modérateur', icon: <Shield /> },
  member: { label: 'Repasser en membre', icon: <User /> },
};

type Props = {
  members: SpaceMember[];
  actor: SpaceRole;
  isLoading: boolean;
  onApprove: (m: SpaceMember) => void;
  onReject: (m: SpaceMember) => void;
  onSanction: (target: SanctionTarget<SpaceMember>) => void;
  onChangeRole: (m: SpaceMember, role: CommunityRole) => void;
};

function MembersTable({ members, actor, isLoading, onApprove, onReject, onSanction, onChangeRole }: Props) {
  const actionsFor = (m: SpaceMember): RowAction[] => {
    const actions: RowAction[] = assignableRoles(actor, m).map((role) => ({
      ...roleAction[role],
      onSelect: () => onChangeRole(m, role),
    }));
    if (canSanction(actor, m)) {
      if (m.status === 'active') {
        actions.push({ label: 'Avertir', icon: <TriangleAlert />, onSelect: () => onSanction({ member: m, type: 'warning' }) });
        actions.push({ label: 'Mettre en sourdine', icon: <VolumeX />, onSelect: () => onSanction({ member: m, type: 'mute' }) });
        actions.push({ label: 'Suspendre', icon: <PauseCircle />, onSelect: () => onSanction({ member: m, type: 'suspension' }) });
      }
      // Lifting a sanction has no api endpoint yet
      if (m.status === 'suspended' || m.status === 'banned') actions.push({ label: 'Réactiver', icon: <PlayCircle />, soon: true, onSelect: () => undefined });
      if (m.status !== 'banned') actions.push({ label: 'Bannir', icon: <Ban />, danger: true, onSelect: () => onSanction({ member: m, type: 'ban' }) });
    }
    return actions;
  };

  const columns: ColumnDef<SpaceMember>[] = [
    {
      id: 'member',
      header: 'Membre',
      cell: ({ row }) => (
        <div className="min-w-44">
          <p className="font-medium text-foreground">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">@{row.original.user.username}</p>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Rôle',
      cell: ({ row }) => (
        <span className="text-body">
          {memberRoleLabel[row.original.role]}
          {row.original.custom_title && <span className="block text-xs text-muted-foreground">{row.original.custom_title}</span>}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const s = memberStatusStyle[row.original.status];
        return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
      },
    },
    {
      id: 'reputation',
      header: () => <span className="block text-right">Réputation</span>,
      cell: ({ row }) => <span className="block text-right text-body tabular-nums">{row.original.reputation_score}</span>,
    },
    {
      id: 'joined',
      header: 'Membre depuis',
      cell: ({ row }) => <span className="whitespace-nowrap text-soft">{dateFormat.format(new Date(row.original.joined_at))}</span>,
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

  return <DataTable columns={columns} data={members} isLoading={isLoading} />;
}

export default MembersTable;
