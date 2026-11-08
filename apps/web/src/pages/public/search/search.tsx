import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@kodinga/ui';
import type { DiscoveryType } from '@/utils/api/discovery/discovery.type';
import { CommunityRow, CourseRow, DeveloperRow, EventRow, PostRow } from './components/search-results';
import UseGlobalSearch, { type GlobalSearch, MIN_QUERY } from './form/UseGlobalSearch';

const FILTERS: { value: DiscoveryType | null; label: string }[] = [
  { value: null, label: 'Tout' },
  { value: 'community', label: 'Communautés' },
  { value: 'course', label: 'Formations' },
  { value: 'event', label: 'Événements' },
  { value: 'developer', label: 'Développeurs' },
  { value: 'post', label: 'Discussions' },
];

/** A titled list; "Voir plus" opens its kind alone when the overview shows the first ones only */
function Group({ title, count, type, search, children }: { title: string; count: number; type: DiscoveryType; search: GlobalSearch; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section aria-label={title} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3 px-2">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {!search.type && count >= 5 && (
          <button type="button" onClick={() => search.setType(type)} className="text-sm font-semibold text-blue-900 hover:underline">
            Voir plus
          </button>
        )}
      </div>
      <ul className="mt-1">{children}</ul>
    </section>
  );
}

function Results({ search }: { search: GlobalSearch }) {
  const r = search.results;
  if (!r) return null;
  const total = r.communities.length + r.courses.length + r.events.length + r.developers.length + r.posts.length;
  if (total === 0) {
    return <p className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-slate-500">Aucun résultat pour « {search.q} ».</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <Group title="Communautés" count={r.communities.length} type="community" search={search}>
        {r.communities.map((c) => <CommunityRow key={c.id} c={c} />)}
      </Group>
      <Group title="Formations" count={r.courses.length} type="course" search={search}>
        {r.courses.map((c) => <CourseRow key={c.id} c={c} />)}
      </Group>
      <Group title="Événements" count={r.events.length} type="event" search={search}>
        {r.events.map((e) => <EventRow key={e.id} e={e} />)}
      </Group>
      <Group title="Développeurs" count={r.developers.length} type="developer" search={search}>
        {r.developers.map((d) => <DeveloperRow key={d.id} d={d} />)}
      </Group>
      <Group title="Discussions" count={r.posts.length} type="post" search={search}>
        {r.posts.map((p) => <PostRow key={p.id} p={p} />)}
      </Group>
    </div>
  );
}

/** With no words: what moves on the platform */
function Trending({ search }: { search: GlobalSearch }) {
  const t = search.trending;
  if (!t) return null;
  return (
    <div className="flex flex-col gap-4">
      <Group title="Communautés populaires" count={t.communities.length} type="community" search={{ ...search, type: 'community' }}>
        {t.communities.map((c) => <CommunityRow key={c.id} c={c} />)}
      </Group>
      <Group title="Formations les plus suivies" count={t.courses.length} type="course" search={{ ...search, type: 'course' }}>
        {t.courses.map((c) => <CourseRow key={c.id} c={c} />)}
      </Group>
      <Group title="Prochains événements" count={t.events.length} type="event" search={{ ...search, type: 'event' }}>
        {t.events.map((e) => <EventRow key={e.id} e={e} />)}
      </Group>
    </div>
  );
}

/** /search — communities, courses, events, developers and discussions of the whole platform */
function GlobalSearchPage() {
  const search = UseGlobalSearch();

  return (
    <div className="min-h-full bg-slate-50/60">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rechercher sur Kodinga</h1>
        <div role="search" className="mt-4">
          <label className="relative block">
            <span className="sr-only">Rechercher sur Kodinga</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              autoFocus
              value={search.text}
              onChange={(e) => search.setText(e.target.value)}
              placeholder="Une communauté, une formation, un développeur…"
              className="h-12 w-full rounded-lg border border-slate-200 bg-white pr-4 pl-11 text-slate-800 placeholder:text-slate-400"
            />
          </label>
        </div>

        {search.searching && (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer les résultats">
            {FILTERS.map((f) => (
              <button
                key={f.label}
                type="button"
                aria-pressed={search.type === f.value}
                onClick={() => search.setType(f.value)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                  search.type === f.value ? 'border-blue-900 bg-blue-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6" aria-busy={search.isLoading}>
          {search.failed ? (
            <p className="text-center text-sm text-red-700">La recherche est momentanément indisponible.</p>
          ) : search.searching ? (
            search.isLoading && !search.results ? <p className="py-12 text-center text-sm text-slate-500">Recherche…</p> : <Results search={search} />
          ) : (
            <>
              {search.text.trim().length > 0 && search.text.trim().length < MIN_QUERY && <p className="mb-4 text-sm text-slate-500">Encore une lettre…</p>}
              <Trending search={search} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default GlobalSearchPage;
