import type { ColumnDef } from '@tanstack/react-table';
import { Ban, ExternalLink, RotateCw, Trash2, Trophy, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge, cn, customToast, DataTable, EmptyAlert, Pagination } from '@kodinga/ui';
import { formatDay, hackathonFormatLabel, hackathonStatusStyle, isFinal } from '@/pages/community-space/hackathons/hackathon-labels';
import { FilterChip } from '@/pages/shared/filter-chip';
import { type RowAction, RowActions } from '@/pages/shared/row-actions';
import {
  useDeleteHackathonMutation,
  useGetCommunityHackathonsQuery,
  useTransitionHackathonMutation,
} from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { HackathonListItem, HackathonStatus } from '@/utils/api/hackathon/hackathon.type';
import { useDetailsCommunity } from '../form/UseCommunityFromParams';
import ConfirmActionModal, { type ConfirmAction } from '../modals/confirm-action-modal';

const FILTERS: { id: HackathonStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'draft', label: 'Brouillons' },
  { id: 'registration_open', label: 'Inscriptions ouvertes' },
  { id: 'in_progress', label: 'En cours' },
  { id: 'judging', label: 'Évaluation' },
  { id: 'completed', label: 'Terminés' },
  { id: 'cancelled', label: 'Annulés' },
];

/**
 * Hackathons of the community (communities/<slug>/hackathons/): a platform admin counts as a
 * manager, so drafts are listed too, and may cancel or delete them (HackathonService.require_manager)
 */
function CommunityHackathonsTab() {
  const community = useDetailsCommunity();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<HackathonStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useGetCommunityHackathonsQuery({
    slug: community.slug,
    status: filter === 'all' ? undefined : filter,
    page,
    page_size: size,
  });
  const [transition, { isLoading: isCancelling }] = useTransitionHackathonMutation();
  const [deleteHackathon, { isLoading: isDeleting }] = useDeleteHackathonMutation();

  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      customToast.success({ message });
      return true;
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
      return false;
    }
  };

  const actionsFor = (h: HackathonListItem): RowAction[] => {
    const ids = { slug: community.slug, hackathonSlug: h.slug };
    const actions: RowAction[] = [];
    if (h.status !== 'draft' && community.privacy_type !== 'secret') {
      actions.push({ label: 'Voir la page publique', icon: <ExternalLink />, onSelect: () => navigate(`/communities/${community.slug}/hackathons/${h.slug}`) });
    }
    if (!isFinal(h.status)) {
      actions.push({
        label: 'Annuler le hackathon',
        icon: <Ban />,
        danger: true,
        onSelect: () =>
          setConfirm({
            title: `Annuler « ${h.title} » ?`,
            description: `Ses ${h.participants_count} participants verront le hackathon comme annulé. Un hackathon annulé ne peut plus être relancé.`,
            confirmLabel: 'Annuler le hackathon',
            icon: <Ban />,
            run: () => run(transition({ ...ids, status: 'cancelled' }).unwrap(), `« ${h.title} » est annulé.`),
          }),
      });
    }
    actions.push({
      label: 'Supprimer',
      icon: <Trash2 />,
      danger: true,
      onSelect: () =>
        setConfirm({
          title: `Supprimer « ${h.title} » ?`,
          description: 'Le hackathon, ses candidatures, équipes et soumissions seront supprimés définitivement.',
          confirmLabel: 'Supprimer',
          icon: <Trash2 />,
          run: () => run(deleteHackathon(ids).unwrap(), `« ${h.title} » a été supprimé.`),
        }),
    });
    return actions;
  };

  const columns: ColumnDef<HackathonListItem>[] = [
    {
      id: 'hackathon',
      header: 'Hackathon',
      cell: ({ row }) => {
        const h = row.original;
        const place = h.format === 'online' ? hackathonFormatLabel.online : [hackathonFormatLabel[h.format], h.venue_city].filter(Boolean).join(' · ');
        return (
          <div className="max-w-md min-w-64">
            <p className="truncate font-medium text-slate-900">{h.title}</p>
            <p className="text-xs text-slate-500">
              {place}
              {h.organizer && ` · organisé par ${h.organizer.full_name || h.organizer.username}`}
            </p>
          </div>
        );
      },
    },
    {
      id: 'dates',
      header: 'Dates',
      cell: ({ row }) => (
        <div className="whitespace-nowrap text-slate-600">
          {formatDay(row.original.start_time)}
          <span className="block text-xs text-slate-500">Rendu le {formatDay(row.original.submission_deadline)}</span>
        </div>
      ),
    },
    {
      id: 'figures',
      header: 'Participants',
      cell: ({ row }) => (
        <span className="flex items-center gap-3 text-slate-600 tabular-nums">
          <span className="flex items-center gap-1" title="Participants"><Users className="size-3.5" />{row.original.participants_count}</span>
          <span className="flex items-center gap-1" title="Prix"><Trophy className="size-3.5" />{row.original.prizes_count}</span>
        </span>
      ),
    },
    {
      id: 'theme',
      header: 'Thème',
      cell: ({ row }) => (row.original.theme ? <Badge variant="outline" className="text-slate-700">{row.original.theme}</Badge> : <span className="text-slate-400">—</span>),
    },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const style = hackathonStatusStyle[row.original.status];
        return <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', style.className)}>{style.label}</span>;
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowActions label={`Actions pour ${row.original.title}`} actions={actionsFor(row.original)} />,
    },
  ];

  const hackathons = data?.results ?? [];
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
      ) : !isLoading && hackathons.length === 0 ? (
        <EmptyAlert text={filter === 'all' ? 'Aucun hackathon dans cette communauté.' : 'Aucun hackathon avec ce statut.'} />
      ) : (
        <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined} aria-busy={isFetching}>
          <DataTable columns={columns} data={hackathons} isLoading={isLoading} />
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
      <ConfirmActionModal action={confirm} isLoading={isCancelling || isDeleting} onCancel={() => setConfirm(null)} />
    </div>
  );
}

export default CommunityHackathonsTab;
