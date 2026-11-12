import { Briefcase, ChevronDown, RotateCw, Search } from 'lucide-react';

import { useTranslation } from 'react-i18next';

import { Loader } from '@kodinga/ui';
import { Pill } from '@/pages/public/community/components/section-header';
import { OpportunityCard } from '@/pages/shared/opportunity-card';
import { parseApiError } from '@/utils/api/errors';
import UsePublicOpportunities, { type TypeFilter, type WorkplaceFilter } from './form/UsePublicOpportunities';

const TYPES = ['all', 'full_time', 'contract', 'internship', 'freelance', 'bounty'] as const satisfies readonly TypeFilter[];
const WORKPLACES: WorkplaceFilter[] = ['all', 'remote', 'hybrid', 'onsite'];

/** /opportunities: the open offers of the platform the viewer may see (footer "Offres & missions") */
function PublicOpportunities() {
  const { t } = useTranslation();
  const list = UsePublicOpportunities();

  return (
    <div className="min-h-full bg-subtle/60">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-soft uppercase">{t('discover.opportunities.eyebrow')}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{t('discover.opportunities.title')}</h1>
            <p className="mt-4 text-soft">{t('discover.opportunities.intro')}</p>
          </div>
          <Briefcase className="mt-6 size-8 shrink-0 text-amber-600" aria-hidden />
        </div>

        <div role="search" className="mb-4">
          <label className="relative block">
            <span className="sr-only">{t('discover.opportunities.searchLabel')}</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              type="search"
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
              placeholder={t('discover.opportunities.searchPlaceholder')}
              className="h-11 w-full rounded-lg border border-border bg-card pr-4 pl-10 text-sm outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-900/15"
            />
          </label>
        </div>

        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t('discover.opportunities.type')}>
          {TYPES.map((type) => (
            <Pill key={type} active={list.type === type} onClick={() => list.setType(type)}>
              {t(`discover.opportunities.types.${type}`)}
            </Pill>
          ))}
        </div>
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t('discover.opportunities.workplace')}>
          {WORKPLACES.map((w) => (
            <Pill key={w} active={list.workplace === w} onClick={() => list.setWorkplace(w)}>
              {w === 'all' ? t('discover.opportunities.everywhere') : t(`labels.workplace.${w}`)}
            </Pill>
          ))}
        </div>

        {list.isLoading ? (
          <Loader inline size="sm" message={t('discover.opportunities.loading')} />
        ) : list.error && list.total === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-12 text-center">
            <p className="text-sm text-soft">{parseApiError(list.error).message}</p>
            <button type="button" onClick={() => list.refetch()} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-strong hover:underline">
              <RotateCw className="size-4" /> {t('common.actions.retry')}
            </button>
          </div>
        ) : list.total === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-12 text-center">
            <Briefcase className="size-8 text-slate-300" />
            <p className="mt-3 font-semibold text-foreground">{list.isFiltered ? t('discover.opportunities.noMatch') : t('discover.opportunities.none')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {list.isFiltered ? t('discover.opportunities.tryOther') : t('discover.opportunities.noneText')}
            </p>
          </div>
        ) : (
          <div className={list.isFetching ? 'opacity-60 transition-opacity' : undefined} aria-busy={list.isFetching}>
            <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
              {t('discover.opportunities.count', { count: list.total })}
            </p>
            <ul className="flex flex-col gap-4" aria-label={t('discover.opportunities.listLabel')}>
              {list.offers.map((o) => (
                <OpportunityCard key={o.id} opportunity={o} />
              ))}
            </ul>
            {list.offers.length < list.total && (
              <button
                type="button"
                onClick={list.showMore}
                className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-3 text-sm font-medium text-body hover:border-border-strong"
              >
                {t('common.actions.showMore')} <ChevronDown className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PublicOpportunities;
