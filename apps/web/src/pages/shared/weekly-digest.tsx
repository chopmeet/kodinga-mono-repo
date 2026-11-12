import { CalendarDays, MessageCircle, RefreshCw, Rocket, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button, customToast } from '@kodinga/ui';
import { dateFormat } from '@/pages/shared/row-actions';
import { useGetWeeklyDigestQuery, useRegenerateWeeklyDigestMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { Markdown } from './markdown';

type Props = { slug: string; canRegenerate?: boolean; className?: string };

/**
 * The summary of the week of a community: closed on its headline, opened on the text and what it
 * talks about. The first reading of the week writes it, on the side of the api.
 */
export function WeeklyDigest({ slug, canRegenerate = false, className }: Props) {
  const { data: digest } = useGetWeeklyDigestQuery(slug);
  const [regenerate, { isLoading }] = useRegenerateWeeklyDigestMutation();
  if (!digest?.headline) return null;
  const { new_members = 0, posts_created = 0, comments_posted = 0 } = digest.kpis_snapshot ?? {};
  const project = digest.highlighted_project;

  const write = async () => {
    try {
      await regenerate(slug).unwrap();
      customToast.success({ message: 'Résumé de la semaine réécrit.' });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return (
    <section aria-label="Résumé de la semaine" className={`rounded-xl border border-border bg-card p-5 ${className ?? ''}`}>
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-strong uppercase">
        <Sparkles className="size-4" aria-hidden />
        Résumé de la semaine
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer font-semibold text-foreground">{digest.headline}</summary>
        <Markdown source={digest.summary_markdown} className="mt-3" />
        <p className="mt-4 text-sm text-soft">
          {new_members} nouveau{new_members > 1 ? 'x' : ''} membre{new_members > 1 ? 's' : ''} · {posts_created} publication{posts_created > 1 ? 's' : ''} · {comments_posted} commentaire
          {comments_posted > 1 ? 's' : ''}
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {digest.top_debates.map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              <MessageCircle className="size-4 shrink-0 text-faint" aria-hidden />
              <Link to={`/communities/${slug}/posts/${d.id}`} className="truncate font-medium text-brand-strong hover:underline">
                {d.title}
              </Link>
            </li>
          ))}
          {project && (
            <li className="flex items-center gap-2">
              <Rocket className="size-4 shrink-0 text-faint" aria-hidden />
              <Link to={`/projects/${project.slug}`} className="truncate font-medium text-brand-strong hover:underline">
                {project.title}
              </Link>
            </li>
          )}
          {digest.upcoming_events.map((e) => (
            <li key={e.id} className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0 text-faint" aria-hidden />
              <Link to={`/communities/${slug}?tab=events`} className="truncate font-medium text-brand-strong hover:underline">
                {e.title}
              </Link>
              {e.start_date && <span className="shrink-0 text-xs text-muted-foreground">{dateFormat.format(new Date(e.start_date))}</span>}
            </li>
          ))}
        </ul>
        {canRegenerate && (
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={write} isLoading={isLoading}>
            <RefreshCw /> Réécrire le résumé
          </Button>
        )}
      </details>
    </section>
  );
}
