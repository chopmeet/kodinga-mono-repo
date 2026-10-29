import type { ColumnDef } from '@tanstack/react-table';
import { Ban, CircleCheck, CircleX, PauseCircle, RotateCw } from 'lucide-react';
import { useState } from 'react';

import { Badge, customToast, DataTable, EmptyAlert, Pagination } from '@kodinga-mono-repo/ui';
import SanctionModal, { type SanctionTarget } from '@/pages/community-space/members/modals/sanction-modal';
import { FilterChip } from '@/pages/shared/filter-chip';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';
import {
  useDecideMemberMutation,
  useGetCommunityMembersQuery,
  useSanctionMemberMutation,
} from '@/utils/api/community/community.api';
import type { CommunityMemberItem, MembershipStatus } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { getName, memberRoleLabel as roleLabel, memberStatusStyle as statusStyle } from '@/utils/Utils';
import { useDetailsCommunity } from '../form/UseCommunityFromParams';

const FILTERS: { id: MembershipStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'active', label: 'Actifs' },
  { id: 'pending', label: 'En attente' },
  { id: 'suspended', label: 'Suspendus' },
  { id: 'banned', label: 'Bannis' },
];

type Target = CommunityMemberItem & { name: string };

function CommunityMembersTab() {
  const community = useDetailsCommunity();
  const [filter, setFilter] = useState<MembershipStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [sanctionTarget, setSanctionTarget] = useState<SanctionTarget<Target> | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useGetCommunityMembersQuery({
    slug: community.slug,
    status: filter === 'all' ? undefined : filter,
    page,
    page_size: size,
  });
  const [decideMember] = useDecideMemberMutation();
  const [sanctionMember] = useSanctionMemberMutation();

  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      customToast.success({ message });
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };

  const decide = (m: Target, approve: boolean) =>
    run(
      decideMember({ slug: community.slug, memberId: m.id, approve }).unwrap(),
      approve ? `${m.name} a été approuvé.` : `La demande de ${m.name} a été refusée.`
    );

  // No action on the owner. Lifting a sanction has no api endpoint yet.
  const actionsFor = (m: Target): RowAction[] => {
    if (m.role === 'owner') return [];
    const actions: RowAction[] = [];
    if (m.status === 'pending') {
      actions.push({ label: 'Approuver', icon: <CircleCheck />, onSelect: () => decide(m, true) });
      actions.push({ label: 'Refuser', icon: <CircleX />, onSelect: () => decide(m, false) });
    }
    if (m.status === 'active') actions.push({ label: 'Suspendre', icon: <PauseCircle />, onSelect: () => setSanctionTarget({ member: m, type: 'suspension' }) });
    if (m.status === 'active' || m.status === 'suspended') {
      actions.push({ label: 'Bannir', icon: <Ban />, danger: true, onSelect: () => setSanctionTarget({ member: m, type: 'ban' }) });
    }
    return actions;
  };

  const columns: ColumnDef<Target>[] = [
    {
      id: 'member',
      header: 'Membre',
      cell: ({ row }) => (
        <div className="min-w-44">
          <p className="font-medium text-slate-900">{row.original.name}</p>
          <p className="text-xs text-slate-500">@{row.original.user.username}</p>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Rôle',
      cell: ({ row }) => <span className="text-slate-700">{row.original.custom_title || roleLabel[row.original.role]}</span>,
    },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const s = statusStyle[row.original.status];
        return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
      },
    },
    {
      id: 'reputation',
      header: () => <span className="block text-right">Réputation</span>,
      cell: ({ row }) => <span className="block text-right text-slate-700 tabular-nums">{row.original.reputation_score}</span>,
    },
    {
      id: 'joined',
      header: 'Membre depuis',
      cell: ({ row }) => <span className="whitespace-nowrap text-slate-600">{dateFormat.format(new Date(row.original.joined_at))}</span>,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowActions label={`Actions pour ${row.original.name}`} actions={actionsFor(row.original)} />,
    },
  ];

  const members: Target[] = (data?.results ?? []).map((m) => ({ ...m, name: getName(m.user) || m.user.email }));
  const total = data?.pagination.count ?? 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
        {FILTERS.map((f) => (
          <FilterChip
            key={f.id}
            active={filter === f.id}
            onClick={() => {
              setFilter(f.id);
              setPage(1);
            }}
          >
            {f.label}
          </FilterChip>
        ))}
      </div>
      {error && !data ? (
        <div className="flex flex-col items-start gap-3">
          <EmptyAlert text={parseApiError(error).message} />
          <button type="button" onClick={() => refetch()} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <RotateCw className="size-4" />
            Réessayer
          </button>
        </div>
      ) : !isLoading && members.length === 0 ? (
        <EmptyAlert text="Aucun membre avec ce statut." />
      ) : (
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined} aria-busy={isFetching}>
          <DataTable columns={columns} data={members} isLoading={isLoading} />
          {total > 0 && (
            <Pagination
              totalItems={total}
              currentPage={page}
              perPage={size}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setSize(n);
                setPage(1);
              }}
            />
          )}
        </div>
      )}

      <SanctionModal<Target>
        target={sanctionTarget}
        onCancel={() => setSanctionTarget(null)}
        onConfirm={async (member, sanction) => {
          await run(
            sanctionMember({
              slug: community.slug,
              memberId: member.id,
              sanction_type: sanction.type,
              reason: sanction.reason,
              duration_days: sanction.duration_days ?? null,
            }).unwrap(),
            sanction.type === 'ban' ? `${member.name} a été banni.` : `${member.name} est suspendu pour ${sanction.duration_days} jours.`
          );
          setSanctionTarget(null);
        }}
      />
    </div>
  );
}

export default CommunityMembersTab;
