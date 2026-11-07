import type { ColumnDef } from '@tanstack/react-table';
import { CircleCheck, Clock, Download, XCircle } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  customToast,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyAlert,
  Pagination,
} from '@kodinga-mono-repo/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { dateFormat, type RowAction, RowActions } from '@/pages/shared/row-actions';
import { useGetHackathonApplicationsQuery, useReviewHackathonApplicationMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { ApplicationStatus, HackathonApplication } from '@/utils/api/hackathon/hackathon.type';
import UseApplicationsExport from '../form/UseApplicationsExport';
import { applicationStatusStyle } from '../hackathon-labels';

const FILTERS: { id: ApplicationStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'pending', label: 'En attente' },
  { id: 'accepted', label: 'Acceptées' },
  { id: 'waitlisted', label: "Liste d'attente" },
  { id: 'rejected', label: 'Refusées' },
];

const nameOf = (a: HackathonApplication) => [a.applicant.first_name, a.applicant.last_name].filter(Boolean).join(' ') || a.applicant.username;

/** Applications of a hackathon; the owner and admins decide (PATCH applications/<id>/) */
export function ApplicationsTab({ slug, hackathonSlug, canManage }: { slug: string; hackathonSlug: string; canManage: boolean }) {
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [rejecting, setRejecting] = useState<HackathonApplication | null>(null);
  const [reason, setReason] = useState('');
  const { data, isLoading, error } = useGetHackathonApplicationsQuery({
    slug,
    hackathonSlug,
    status: filter === 'all' ? undefined : filter,
    page,
    page_size: size,
  });
  const [review, { isLoading: reviewing }] = useReviewHackathonApplicationMutation();
  const { exportCsv, isExporting } = UseApplicationsExport(slug, hackathonSlug);

  const decide = async (a: HackathonApplication, status: 'accepted' | 'rejected' | 'waitlisted', why = '') => {
    try {
      await review({ slug, hackathonSlug, applicationId: a.id, status, reason: why || undefined }).unwrap();
      const messages = { accepted: 'acceptée', waitlisted: "mise en liste d'attente", rejected: 'refusée' };
      customToast.success({ message: `Candidature de ${nameOf(a)} ${messages[status]}.` });
      return true;
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
      return false;
    }
  };

  const actionsFor = (a: HackathonApplication): RowAction[] => {
    if (!canManage || a.status === 'withdrawn') return [];
    const actions: RowAction[] = [];
    if (a.status !== 'accepted') actions.push({ label: 'Accepter', icon: <CircleCheck />, onSelect: () => decide(a, 'accepted') });
    if (a.status !== 'waitlisted') actions.push({ label: "Mettre en liste d'attente", icon: <Clock />, onSelect: () => decide(a, 'waitlisted') });
    if (a.status !== 'rejected') {
      actions.push({
        label: 'Refuser',
        icon: <XCircle />,
        danger: true,
        onSelect: () => {
          setReason('');
          setRejecting(a);
        },
      });
    }
    return actions;
  };

  const columns: ColumnDef<HackathonApplication>[] = [
    {
      id: 'applicant',
      header: 'Candidat',
      cell: ({ row }) => (
        <div className="min-w-44">
          <p className="font-medium text-slate-900">{nameOf(row.original)}</p>
          <p className="text-xs text-slate-500">{row.original.applicant.email}</p>
        </div>
      ),
    },
    {
      id: 'mode',
      header: 'Participation',
      cell: ({ row }) => (
        <span className="text-slate-700">
          {row.original.participation_mode === 'team' ? `Équipe${row.original.team_name ? ` « ${row.original.team_name} »` : ''}` : 'Individuelle'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const s = applicationStatusStyle[row.original.status];
        return (
          <Badge variant="outline" className={s.className} title={row.original.rejection_reason || undefined}>
            {s.label}
          </Badge>
        );
      },
    },
    {
      id: 'date',
      header: 'Reçue le',
      cell: ({ row }) => <span className="whitespace-nowrap text-slate-600">{dateFormat.format(new Date(row.original.created_at))}</span>,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowActions label={`Actions pour ${nameOf(row.original)}`} actions={actionsFor(row.original)} />,
    },
  ];

  const applications = data?.results ?? [];
  const total = data?.pagination.count ?? 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les candidatures">
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
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => exportCsv(filter === 'all' ? undefined : filter)} isLoading={isExporting} disabled={total === 0}>
            <Download />
            Exporter en CSV
          </Button>
        )}
      </div>
      {error && !data ? (
        <EmptyAlert text={parseApiError(error).message} />
      ) : !isLoading && applications.length === 0 ? (
        <EmptyAlert text="Aucune candidature pour le moment." />
      ) : (
        <>
          <DataTable columns={columns} data={applications} isLoading={isLoading} />
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
        </>
      )}

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && !reviewing && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la candidature de {rejecting ? nameOf(rejecting) : ''} ?</DialogTitle>
            <DialogDescription>Le motif est communiqué au candidat.</DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="reject-reason" className="custom-form-label mb-1 block">
              Motif (facultatif)
            </label>
            <textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="custom-form-control block w-full bg-background px-4 py-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)} disabled={reviewing}>
              Retour
            </Button>
            <Button
              variant="danger"
              isLoading={reviewing}
              onClick={async () => {
                if (rejecting && (await decide(rejecting, 'rejected', reason.trim()))) setRejecting(null);
              }}
            >
              <XCircle />
              Refuser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
