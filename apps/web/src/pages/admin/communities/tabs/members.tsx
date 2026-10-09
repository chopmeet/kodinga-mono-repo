import type { ColumnDef } from '@tanstack/react-table';
import { Ban, CircleCheck, PauseCircle, PlayCircle } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge, cn, customToast, DataTable, EmptyAlert, Pagination } from '@kodinga-mono-repo/ui';
import { type AdminMember, getCommunityMembers, type MemberStatus } from '@/data/admin-community-details.data';
import { memberRoleLabel as roleLabel, memberStatusStyle as statusStyle } from '@/pages/shared/community-labels';
import { useDetailsCommunity } from '../form/UseCommunityFromParams';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';

const FILTERS: { id: MemberStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'active', label: 'Actifs' },
  { id: 'pending', label: 'En attente' },
  { id: 'suspended', label: 'Suspendus' },
  { id: 'banned', label: 'Bannis' },
];

function CommunityMembersTab() {
  const community = useDetailsCommunity();
  // Mock: moderation changes live in local state
  const [members, setMembers] = useState(() => getCommunityMembers(community));
  const [filter, setFilter] = useState<MemberStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const filtered = useMemo(() => members.filter((m) => filter === 'all' || m.status === filter), [members, filter]);
  const visible = filtered.slice((page - 1) * size, page * size);

  const setStatus = (member: AdminMember, status: MemberStatus, message: string) => {
    setMembers((list) => list.map((m) => (m.id === member.id ? { ...m, status } : m)));
    customToast.success({ message });
  };

  const actionsFor = (m: AdminMember): RowAction[] => {
    if (m.role === 'owner') return [];
    const actions: RowAction[] = [];
    if (m.status === 'pending') actions.push({ label: 'Approuver', icon: <CircleCheck />, onSelect: () => setStatus(m, 'active', `${m.name} a été approuvé.`) });
    if (m.status === 'active') actions.push({ label: 'Suspendre', icon: <PauseCircle />, onSelect: () => setStatus(m, 'suspended', `${m.name} est suspendu.`) });
    if (m.status === 'suspended' || m.status === 'banned') actions.push({ label: 'Réactiver', icon: <PlayCircle />, onSelect: () => setStatus(m, 'active', `${m.name} est de nouveau actif.`) });
    if (m.status !== 'banned') actions.push({ label: 'Bannir', icon: <Ban />, danger: true, onSelect: () => setStatus(m, 'banned', `${m.name} a été banni.`) });
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
    { id: 'role', header: 'Rôle', cell: ({ row }) => <span className="text-slate-700">{roleLabel[row.original.role]}</span> },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const s = statusStyle[row.original.status];
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
      cell: ({ row }) => <RowActions label={`Actions pour ${row.original.name}`} actions={actionsFor(row.original)} />,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
        {FILTERS.map((f) => {
          const count = f.id === 'all' ? members.length : members.filter((m) => m.status === f.id).length;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                filter === f.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              )}
            >
              {f.label} <span className="tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <EmptyAlert text="Aucun membre avec ce statut." />
      ) : (
        <>
          <DataTable columns={columns} data={visible} isLoading={false} />
          <Pagination totalItems={filtered.length} currentPage={page} perPage={size} onPageChange={setPage} onPageSizeChange={(n) => { setSize(n); setPage(1); }} />
        </>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Échantillon de démonstration : {members.length} membres sur {community.members_count.toLocaleString('fr-FR')}.
      </p>
    </div>
  );
}

export default CommunityMembersTab;
