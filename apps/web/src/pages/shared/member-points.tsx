import { Award, Flame, Medal, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@kodinga/ui';
import { useGetMyBadgesQuery, useGetMyCommunityPointsQuery, useGetMyPointsHistoryQuery, useGetMyReputationQuery } from '@/utils/api/community/community.api';
import type { PointsTransaction } from '@/utils/api/gamification/gamification.type';
import { formatDayMonth } from '@/utils/format';

const points = new Intl.NumberFormat('fr-FR');
const ordinal = (n: number) => (n === 1 ? '1er' : `${n}e`);
const signed = (n: number) => `${n > 0 ? '+' : ''}${points.format(n)}`;

function Figure({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

/** Last gains (and losses) of points, the community named when across Kodinga */
function History({ items, showCommunity }: { items: PointsTransaction[]; showCommunity: boolean }) {
  return (
    <section aria-label="Derniers points" className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-semibold text-foreground">Derniers points</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Aucun point pour l’instant : publier, commenter et suivre les formations en rapporte.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border-soft">
          {items.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate text-foreground">{t.description || t.action_label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDayMonth(t.created_at)}
                  {showCommunity && t.community_name ? ` · ${t.community_name}` : ''}
                  {t.source === 'manual_adjustment' ? ' · ajustement manuel' : ''}
                </span>
              </span>
              <span className={cn('shrink-0 font-semibold tabular-nums', t.points < 0 ? 'text-red-700' : 'text-emerald-700')}>{signed(t.points)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** /dashboard/overview — points across Kodinga, badges and last gains (gamification/reputation/me/, badges/my/, reputation/history/) */
export function MyPointsAndBadges() {
  const reputation = useGetMyReputationQuery().data;
  const badges = useGetMyBadgesQuery().data ?? [];
  const history = useGetMyPointsHistoryQuery({ limit: 8 }).data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Ma réputation" className="grid gap-3 sm:grid-cols-3">
        <Figure icon={<Sparkles className="size-4 text-brand-strong" aria-hidden />} label="Points" value={reputation ? points.format(reputation.total_points) : '—'} />
        <Figure
          icon={<Medal className="size-4 text-brand-strong" aria-hidden />}
          label="Niveau"
          value={reputation ? `${reputation.level} · ${reputation.rank_title}` : '—'}
        />
        <Figure
          icon={<Flame className="size-4 text-brand-strong" aria-hidden />}
          label="Série en cours"
          value={reputation ? `${reputation.current_streak_days} j` : '—'}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section aria-label="Mes badges" className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground">Mes badges</h3>
          {badges.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Aucun badge pour l’instant.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {badges.map((b) => (
                <li
                  key={b.id}
                  title={[b.badge.description, b.community?.name].filter(Boolean).join(' · ')}
                  className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-900"
                >
                  {b.badge.icon_url ? <img src={b.badge.icon_url} alt="" className="size-4" /> : <Award className="size-4" aria-hidden />}
                  {b.badge.name}
                </li>
              ))}
            </ul>
          )}
        </section>
        <History items={history} showCommunity />
      </div>
    </div>
  );
}

/** "Mon activité" of a community — rank, points to the next one, where they come from, last gains */
export function MyCommunityPoints({ slug }: { slug: string }) {
  const mine = useGetMyCommunityPointsQuery(slug).data;
  const history = useGetMyPointsHistoryQuery({ community: slug, limit: 8 }).data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Mes points ici" className="grid gap-3 sm:grid-cols-3">
        <Figure icon={<Sparkles className="size-4 text-brand-strong" aria-hidden />} label="Points" value={mine ? points.format(mine.total_points) : '—'} />
        <Figure
          icon={<Medal className="size-4 text-brand-strong" aria-hidden />}
          label="Rang"
          value={!mine ? '—' : mine.rank ? `${ordinal(mine.rank)} sur ${mine.total_ranked_members}` : 'Pas encore classé'}
        />
        <Figure
          icon={<Award className="size-4 text-brand-strong" aria-hidden />}
          label="Avant le rang suivant"
          value={mine ? `${points.format(mine.points_to_next_rank)} pts` : '—'}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section aria-label="D’où viennent mes points" className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold text-foreground">D’où viennent mes points</h3>
          {!mine || mine.breakdown_by_action.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Aucun point gagné ici pour l’instant.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border-soft">
              {mine.breakdown_by_action.map((a) => (
                <li key={a.action} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-body">
                    {a.action_label} <span className="text-faint">× {a.count}</span>
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">{signed(a.points)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <History items={history} showCommunity={false} />
      </div>
    </div>
  );
}
