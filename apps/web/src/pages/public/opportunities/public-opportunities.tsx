import { Briefcase, ChevronDown, RotateCw, Search } from 'lucide-react';

import { Loader } from '@kodinga/ui';
import { Pill } from '@/pages/public/community/components/section-header';
import { OpportunityCard } from '@/pages/shared/opportunity-card';
import { parseApiError } from '@/utils/api/errors';
import UsePublicOpportunities, { type TypeFilter, type WorkplaceFilter } from './form/UsePublicOpportunities';

const TYPES: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'full_time', label: 'Emplois' },
  { id: 'contract', label: 'CDD / contrats' },
  { id: 'internship', label: 'Stages' },
  { id: 'freelance', label: 'Freelance' },
  { id: 'bounty', label: 'Bounties' },
];

const WORKPLACES: { id: WorkplaceFilter; label: string }[] = [
  { id: 'all', label: 'Partout' },
  { id: 'remote', label: 'Télétravail' },
  { id: 'hybrid', label: 'Hybride' },
  { id: 'onsite', label: 'Sur site' },
];

/** /opportunities: the open offers of the platform the viewer may see (footer "Offres & missions") */
function PublicOpportunities() {
  const list = UsePublicOpportunities();

  return (
    <div className="min-h-full bg-slate-50/60">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-600 uppercase">Saisir sa chance</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Offres & missions</h1>
            <p className="mt-4 text-slate-600">Emplois, stages, missions freelance et bounties partagés par les communautés Kodinga.</p>
          </div>
          <Briefcase className="mt-6 size-8 shrink-0 text-amber-600" aria-hidden />
        </div>

        <div role="search" className="mb-4">
          <label className="relative block">
            <span className="sr-only">Rechercher une offre</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
              placeholder="Rechercher par poste, entreprise, ville…"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pr-4 pl-10 text-sm outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-900/15"
            />
          </label>
        </div>

        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Type d’offre">
          {TYPES.map((t) => (
            <Pill key={t.id} active={list.type === t.id} onClick={() => list.setType(t.id)}>
              {t.label}
            </Pill>
          ))}
        </div>
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Lieu de travail">
          {WORKPLACES.map((w) => (
            <Pill key={w.id} active={list.workplace === w.id} onClick={() => list.setWorkplace(w.id)}>
              {w.label}
            </Pill>
          ))}
        </div>

        {list.isLoading ? (
          <Loader inline size="sm" message="Chargement des offres…" />
        ) : list.error && list.total === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-slate-600">{parseApiError(list.error).message}</p>
            <button type="button" onClick={() => list.refetch()} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-900 hover:underline">
              <RotateCw className="size-4" /> Réessayer
            </button>
          </div>
        ) : list.total === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
            <Briefcase className="size-8 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-900">{list.isFiltered ? 'Aucune offre ne correspond' : 'Aucune offre pour le moment'}</p>
            <p className="mt-1 text-sm text-slate-500">
              {list.isFiltered ? 'Essayez une autre recherche ou un autre filtre.' : 'Les opportunités partagées par les communautés apparaîtront ici.'}
            </p>
          </div>
        ) : (
          <div className={list.isFetching ? 'opacity-60 transition-opacity' : undefined} aria-busy={list.isFetching}>
            <p className="mb-3 text-sm text-slate-500" aria-live="polite">
              {list.total} offre{list.total > 1 ? 's' : ''}
            </p>
            <ul className="flex flex-col gap-4" aria-label="Opportunités">
              {list.offers.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} />
              ))}
            </ul>
            {list.offers.length < list.total && (
              <button
                type="button"
                onClick={list.showMore}
                className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 hover:border-slate-300"
              >
                Afficher plus <ChevronDown className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PublicOpportunities;
