import { CalendarDays, Plus, RotateCw, Trophy, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge, Button, ColgateWrapper, EmptyAlert, Pagination, TopTitle } from '@kodinga/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { RowActions } from '@/pages/shared/row-actions';
import { useGetCommunityHackathonsQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { HackathonStatus } from '@/utils/api/hackathon/hackathon.type';
import { useCommunitySpace } from '../community-space-context';
import UseHackathonActions from './form/UseHackathonActions';
import { formatDay, hackathonFormatLabel, hackathonStatusStyle } from './hackathon-labels';
import { useRealtimeRegistrations } from '@/utils/realtime/use-realtime';

const FILTERS: { id: HackathonStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'draft', label: 'Brouillons' },
  { id: 'registration_open', label: 'Inscriptions ouvertes' },
  { id: 'in_progress', label: 'En cours' },
  { id: 'judging', label: 'Évaluation' },
  { id: 'completed', label: 'Terminés' },
];

/** /c/:slug/hackathons — the hackathons of the community */
function CommunityHackathons() {
  const { community } = useCommunitySpace();
  const [filter, setFilter] = useState<HackathonStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const { canManage, actionsFor, confirmDialog } = UseHackathonActions();
  const pollingInterval = useRealtimeRegistrations(community.id);
  const { data, isLoading, isFetching, error, refetch } = useGetCommunityHackathonsQuery(
    {
      slug: community.slug,
      status: filter === 'all' ? undefined : filter,
      page,
      page_size: size,
    },
    { pollingInterval },
  );
  const hackathons = data?.results ?? [];
  const total = data?.pagination.count ?? 0;
  const newLink = `/c/${community.slug}/hackathons/new`;

  return (
    <div className="community__hackathons">
      <div className="flex flex-wrap items-start justify-between gap-4 [&>:last-child]:mb-4">
        <TopTitle title="Hackathons" paragraph={`Défis, équipes et projets de ${community.name}`} />
        {canManage && (
          <Button asChild>
            <Link to={newLink}>
              <Plus />
              Nouveau hackathon
            </Link>
          </Button>
        )}
      </div>

      <ColgateWrapper className="border border-neutral-200 p-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto" role="group" aria-label="Filtrer les hackathons">
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

        <div className="mt-4" aria-busy={isFetching}>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-slate-500">Chargement des hackathons…</p>
          ) : error && !data ? (
            <div className="flex flex-col items-start gap-3">
              <EmptyAlert text={parseApiError(error).message} />
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RotateCw />
                Réessayer
              </Button>
            </div>
          ) : hackathons.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600" aria-hidden>
                <Trophy className="size-6" />
              </span>
              <p className="mt-4 font-semibold text-slate-900">Aucun hackathon {filter === 'all' ? 'pour le moment' : 'avec ce statut'}</p>
              <p className="mt-1 text-sm text-slate-500">Un défi de quelques jours fédère la communauté et révèle des talents.</p>
              {canManage && (
                <Button asChild className="mt-5">
                  <Link to={newLink}>
                    <Plus />
                    Organiser un hackathon
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <ul className={`divide-y divide-slate-100 ${isFetching ? 'opacity-60 transition-opacity' : ''}`} aria-label="Hackathons">
                {hackathons.map((h) => {
                  const status = hackathonStatusStyle[h.status];
                  return (
                    <li key={h.id} className="flex items-start gap-4 py-4">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600" aria-hidden>
                        <Trophy className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/c/${community.slug}/hackathons/${h.slug}`} className="truncate font-semibold text-slate-900 hover:text-primary">
                            {h.title}
                          </Link>
                          <Badge variant="outline" className={status.className}>
                            {status.label}
                          </Badge>
                        </div>
                        {h.tagline && <p className="mt-0.5 truncate text-sm text-slate-600">{h.tagline}</p>}
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                          <span className="flex items-center gap-1.5">
                            <CalendarDays className="size-3.5 text-slate-400" aria-hidden />
                            {formatDay(h.start_time)} → {formatDay(h.submission_deadline)}
                          </span>
                          <span>{hackathonFormatLabel[h.format]}</span>
                          <span className="flex items-center gap-1.5">
                            <Users className="size-3.5 text-slate-400" aria-hidden />
                            {h.participants_count} participant{h.participants_count > 1 ? 's' : ''}
                          </span>
                          {h.prizes_count > 0 && (
                            <span>
                              {h.prizes_count} prix
                            </span>
                          )}
                        </div>
                      </div>
                      <RowActions label={`Actions pour ${h.title}`} actions={actionsFor(h)} />
                    </li>
                  );
                })}
              </ul>
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
            </>
          )}
        </div>
      </ColgateWrapper>
      {confirmDialog}
    </div>
  );
}

export default CommunityHackathons;
