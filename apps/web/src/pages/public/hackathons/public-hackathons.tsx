import { RotateCw, Search, Trophy } from 'lucide-react';

import { Loader, Pagination } from '@kodinga/ui';
import { Pill } from '@/pages/public/community/components/section-header';
import { HackathonCard } from '@/pages/shared/hackathon-card';
import { parseApiError } from '@/utils/api/errors';
import UsePublicHackathons, { type FormatFilter, PAGE_SIZE, type StatusFilter } from './form/UsePublicHackathons';

const FORMATS: { id: FormatFilter; label: string }[] = [
  { id: 'all', label: 'Tous les formats' },
  { id: 'online', label: 'En ligne' },
  { id: 'in_person', label: 'Présentiel' },
  { id: 'hybrid', label: 'Hybride' },
];

const STATUSES: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'registration_open', label: 'Inscriptions ouvertes' },
  { id: 'in_progress', label: 'En cours' },
  { id: 'completed', label: 'Terminés' },
];

/** /hackathons: the hackathons of every community, open to visitors (footer "Hackathons & défis") */
function PublicHackathons() {
  const list = UsePublicHackathons();

  return (
    <div className="min-h-full bg-slate-50/60">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-600 uppercase">Construire ensemble</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Hackathons & défis</h1>
            <p className="mt-4 text-slate-600">Les défis lancés par les communautés Kodinga : en ligne ou sur place, en solo ou en équipe.</p>
          </div>
          <Trophy className="mt-6 size-8 shrink-0 text-amber-600" aria-hidden />
        </div>

        <div role="search" className="mb-4">
          <label className="relative block">
            <span className="sr-only">Rechercher un hackathon</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
              placeholder="Rechercher par titre, thème, ville…"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pr-4 pl-10 text-sm outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-900/15"
            />
          </label>
        </div>

        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Statut">
          {STATUSES.map((s) => (
            <Pill key={s.id} active={list.status === s.id} onClick={() => list.setStatus(s.id)}>
              {s.label}
            </Pill>
          ))}
        </div>
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Format">
          {FORMATS.map((f) => (
            <Pill key={f.id} active={list.format === f.id} onClick={() => list.setFormat(f.id)}>
              {f.label}
            </Pill>
          ))}
        </div>

        {list.isLoading ? (
          <Loader inline size="sm" message="Chargement des hackathons…" />
        ) : list.error && list.hackathons.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-slate-600">{parseApiError(list.error).message}</p>
            <button type="button" onClick={() => list.refetch()} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-900 hover:underline">
              <RotateCw className="size-4" /> Réessayer
            </button>
          </div>
        ) : list.hackathons.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
            <Trophy className="size-8 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-900">{list.isFiltered ? 'Aucun hackathon ne correspond' : 'Aucun hackathon pour le moment'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {list.isFiltered ? 'Essayez une autre recherche ou un autre filtre.' : 'Les défis des communautés apparaîtront ici.'}
            </p>
          </div>
        ) : (
          <div className={list.isFetching ? 'opacity-60 transition-opacity' : undefined} aria-busy={list.isFetching}>
            <p className="mb-3 text-sm text-slate-500" aria-live="polite">
              {list.total} hackathon{list.total > 1 ? 's' : ''}
            </p>
            <ul className="flex flex-col gap-6" aria-label="Hackathons">
              {list.hackathons.map((h) => (
                <HackathonCard key={h.id} hackathon={h} showCommunity />
              ))}
            </ul>
            {list.total > PAGE_SIZE && (
              <div className="mt-6">
                <Pagination totalItems={list.total} currentPage={list.page} perPage={PAGE_SIZE} onPageChange={list.setPage} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PublicHackathons;
