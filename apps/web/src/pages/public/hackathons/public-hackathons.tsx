import { RotateCw, Search, Trophy } from 'lucide-react';

import { useTranslation } from 'react-i18next';

import { Loader, Pagination } from '@kodinga/ui';
import { Pill } from '@/pages/public/community/components/section-header';
import { HackathonCard } from '@/pages/shared/hackathon-card';
import { parseApiError } from '@/utils/api/errors';
import UsePublicHackathons, { type FormatFilter, PAGE_SIZE, type StatusFilter } from './form/UsePublicHackathons';

const FORMATS: FormatFilter[] = ['all', 'online', 'in_person', 'hybrid'];
const STATUSES: StatusFilter[] = ['all', 'registration_open', 'in_progress', 'completed'];
const STATUS_KEY = { all: 'all', registration_open: 'registrationOpen', in_progress: 'inProgress', completed: 'completed' } as const;

/** /hackathons: the hackathons of every community, open to visitors (footer "Hackathons & défis") */
function PublicHackathons() {
  const { t } = useTranslation();
  const list = UsePublicHackathons();

  return (
    <div className="min-h-full bg-subtle/60">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-soft uppercase">{t('discover.hackathons.eyebrow')}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{t('discover.hackathons.title')}</h1>
            <p className="mt-4 text-soft">{t('discover.hackathons.intro')}</p>
          </div>
          <Trophy className="mt-6 size-8 shrink-0 text-amber-600" aria-hidden />
        </div>

        <div role="search" className="mb-4">
          <label className="relative block">
            <span className="sr-only">{t('discover.hackathons.searchLabel')}</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              type="search"
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
              placeholder={t('discover.hackathons.searchPlaceholder')}
              className="h-11 w-full rounded-lg border border-border bg-card pr-4 pl-10 text-sm outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-900/15"
            />
          </label>
        </div>

        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t('discover.hackathons.status')}>
          {STATUSES.map((s) => (
            <Pill key={s} active={list.status === s} onClick={() => list.setStatus(s)}>
              {t(`discover.hackathons.${STATUS_KEY[s]}`)}
            </Pill>
          ))}
        </div>
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t('discover.hackathons.format')}>
          {FORMATS.map((f) => (
            <Pill key={f} active={list.format === f} onClick={() => list.setFormat(f)}>
              {f === 'all' ? t('discover.hackathons.allFormats') : t(`labels.hackathonFormat.${f}`)}
            </Pill>
          ))}
        </div>

        {list.isLoading ? (
          <Loader inline size="sm" message={t('discover.hackathons.loading')} />
        ) : list.error && list.hackathons.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-12 text-center">
            <p className="text-sm text-soft">{parseApiError(list.error).message}</p>
            <button type="button" onClick={() => list.refetch()} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-strong hover:underline">
              <RotateCw className="size-4" /> {t('common.actions.retry')}
            </button>
          </div>
        ) : list.hackathons.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-12 text-center">
            <Trophy className="size-8 text-slate-300" />
            <p className="mt-3 font-semibold text-foreground">{list.isFiltered ? t('discover.hackathons.noMatch') : t('discover.hackathons.none')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {list.isFiltered ? t('discover.hackathons.tryOther') : t('discover.hackathons.noneText')}
            </p>
          </div>
        ) : (
          <div className={list.isFetching ? 'opacity-60 transition-opacity' : undefined} aria-busy={list.isFetching}>
            <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
              {t('discover.hackathons.count', { count: list.total })}
            </p>
            <ul className="flex flex-col gap-6" aria-label={t('discover.hackathons.listLabel')}>
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
