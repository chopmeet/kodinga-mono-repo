import { BookOpen, MessageSquare, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@kodinga/ui';
import UseSemanticSearch, { MIN_QUERY } from '../form/UseSemanticSearch';

const KINDS = ['post', 'lesson', 'event'] as const;
const isKind = (value: string): value is (typeof KINDS)[number] => (KINDS as readonly string[]).includes(value);

/** "Chercher avec l'IA": the posts and lessons close in meaning to the words of the feed search */
export function SemanticSearch({ slug, query }: { slug: string; query: string }) {
  const { t } = useTranslation();
  const search = UseSemanticSearch(slug);
  const text = query.trim();
  const results = search.result?.results.filter((r) => r.url.startsWith('/')) ?? [];

  return (
    <div className="flex flex-col gap-3">
      {text.length >= MIN_QUERY && search.result?.query !== text && (
        <Button type="button" variant="outline" size="sm" className="self-start" isLoading={search.isLoading} onClick={() => search.run(text)}>
          <Sparkles /> {t('community.semantic.ask', { text })}
        </Button>
      )}
      {search.error && (
        <p role="alert" className="text-sm text-red-700">
          {search.error}
        </p>
      )}
      {search.result && (
        <section aria-labelledby="semantic-title" className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 id="semantic-title" className="flex items-center gap-2 text-sm font-semibold text-blue-950">
              <Sparkles className="size-4" aria-hidden />
              {t('community.semantic.close', { query: search.result.query })}
            </h3>
            <button type="button" onClick={search.clear} aria-label={t('community.semantic.closeResults')} className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-800">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          {results.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">{t('community.semantic.nothing')}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3" aria-label={t('community.semantic.results')}>
              {results.map((r) => (
                <li key={`${r.content_type}-${r.id}`} className="min-w-0 text-sm">
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    {r.content_type === 'lesson' ? <BookOpen className="size-3.5" aria-hidden /> : <MessageSquare className="size-3.5" aria-hidden />}
                    {isKind(r.content_type) ? t(`community.semantic.${r.content_type}`) : t('community.semantic.content')}
                  </span>
                  <Link to={r.url} className="block truncate font-medium text-blue-900 hover:underline">
                    {r.title || t('community.semantic.untitled')}
                  </Link>
                  {r.snippet && <span className="line-clamp-2 text-slate-600">{r.snippet}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
