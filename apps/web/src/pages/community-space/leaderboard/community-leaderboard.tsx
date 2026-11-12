import { Crown, Download, Medal, Pencil, RotateCw, SlidersHorizontal, Sparkles, Trophy, Users } from 'lucide-react';
import { useState } from 'react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  type CardType,
  ColgateWrapper,
  EmptyAlert,
  OverviewCardItem,
  SearchInput,
  TopTitle,
  cn,
} from '@kodinga/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { parseApiError } from '@/utils/api/errors';
import { type LeaderboardEntry, type LeaderboardPeriod, PERIOD_LABEL } from '@/utils/api/gamification/gamification.type';
import { nameInitials } from '@/utils/Utils';
import { useCommunitySpace } from '../community-space-context';
import PointsJournalTable from './tables/points-journal-table';
import UseCommunityLeaderboard, { LIMITS, type Limit } from './form/UseCommunityLeaderboard';
import UsePointsAdmin from './form/UsePointsAdmin';
import { LEVELS, pointsFormat } from './leaderboard-labels';
import AdjustPointsModal from './modals/adjust-points-modal';
import RulesModal from './modals/rules-modal';

const PODIUM_STYLE: Record<number, { ring: string; badge: string; height: string }> = {
  1: { ring: 'ring-amber-400', badge: 'bg-amber-400 text-amber-950', height: 'sm:pt-0' },
  2: { ring: 'ring-slate-300', badge: 'bg-slate-300 text-foreground', height: 'sm:pt-6' },
  3: { ring: 'ring-orange-300', badge: 'bg-orange-300 text-orange-950', height: 'sm:pt-10' },
};

function MemberAvatar({ entry, className }: { entry: LeaderboardEntry; className?: string }) {
  return (
    <Avatar className={className}>
      {entry.user.avatar_url && <AvatarImage src={entry.user.avatar_url} alt="" />}
      <AvatarFallback>{nameInitials(entry.user.name || entry.user.username)}</AvatarFallback>
    </Avatar>
  );
}

/** Top 3, second / first / third from left to right on wide screens */
function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const order = [entries[1], entries[0], entries[2]].filter(Boolean);
  return (
    <ol aria-label="Podium" className="grid gap-3 sm:grid-cols-3 sm:items-end">
      {order.map((e) => {
        const style = PODIUM_STYLE[e.rank] ?? PODIUM_STYLE[3];
        return (
          <li key={e.user.id} className={cn('order-none', e.rank === 1 && 'max-sm:order-first', style.height)}>
            <ColgateWrapper className="flex flex-col items-center border border-border p-5 text-center">
              <div className="relative">
                <MemberAvatar entry={e} className={cn('size-16 ring-4', style.ring)} />
                <span className={cn('absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full text-sm font-bold', style.badge)}>
                  {e.rank}
                </span>
                {e.rank === 1 && <Crown className="absolute -top-5 left-1/2 size-5 -translate-x-1/2 text-amber-500" aria-hidden />}
              </div>
              <p className="mt-3 font-semibold text-foreground">{e.user.name}</p>
              <p className="text-xs text-muted-foreground">
                Niv. {e.level} · {e.rank_title}
              </p>
              <p className="mt-2 text-lg font-bold text-brand tabular-nums">{pointsFormat.format(e.points)} pts</p>
            </ColgateWrapper>
          </li>
        );
      })}
    </ol>
  );
}

const PERIODS: LeaderboardPeriod[] = ['all_time', 'monthly', 'weekly'];

/** /c/:slug/leaderboard — members ranked by the points earned in the community */
function CommunityLeaderboard() {
  const { community } = useCommunitySpace();
  const { entries, filtered, stats, limit, setLimit, period, setPeriod, search, setSearch, exportCsv, userId, isLoading, isFetching, error, refetch } =
    UseCommunityLeaderboard(community.slug);
  const points = UsePointsAdmin();
  const [modal, setModal] = useState<'rules' | 'adjust' | null>(null);
  const activeRules = points.rules.filter((r) => r.is_active && r.points > 0).sort((a, b) => b.points - a.points);

  const cards: CardType[] = [
    { id: 'ranked', label: 'Membres classés', value: stats.ranked, icon: <Users size={18} />, color: '#1D4ED8' },
    { id: 'total', label: 'Points distribués', value: pointsFormat.format(stats.total), icon: <Sparkles size={18} />, color: '#7c3aed' },
    { id: 'top', label: 'Meilleur score', value: `${pointsFormat.format(stats.top)} pts`, icon: <Trophy size={18} />, color: '#b45309' },
  ];

  return (
    <div className="community__leaderboard">
      <div className="flex flex-wrap items-start justify-between gap-4 [&>:last-child]:mb-4">
        <TopTitle title="Classement" paragraph={`Les membres les plus actifs de ${community.name}`} />
        <div className="flex flex-wrap gap-2">
          {points.canManage && (
            <Button variant="outline" onClick={() => setModal('adjust')}>
              <SlidersHorizontal />
              Ajuster des points
            </Button>
          )}
          <Button variant="outline" onClick={exportCsv} disabled={entries.length === 0}>
            <Download />
            Exporter
          </Button>
        </div>
      </div>

      {isLoading ? (
        <ul aria-label="Chargement du classement" className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-44 animate-pulse rounded-xl bg-muted" />
          ))}
        </ul>
      ) : error && !entries.length ? (
        <div className="flex flex-col items-start gap-3">
          <EmptyAlert text={parseApiError(error).message} />
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCw />
            Réessayer
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <ColgateWrapper className="flex flex-col items-center border border-border py-12 text-center">
          <Medal className="size-10 text-slate-300" aria-hidden />
          {period === 'all_time' ? (
            <>
              <p className="mt-3 font-semibold text-foreground">Personne n'a encore marqué de points</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Les membres gagnent des points en publiant, en commentant, en suivant les formations et en participant aux événements.
              </p>
            </>
          ) : (
            // The period chips are in the hidden panel: a way back
            <>
              <p className="mt-3 font-semibold text-foreground">Aucun point marqué sur les {PERIOD_LABEL[period].toLowerCase()}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setPeriod('all_time')}>
                Voir le classement depuis le début
              </Button>
            </>
          )}
        </ColgateWrapper>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
            {cards.map((card) => (
              <OverviewCardItem item={card} key={card.id} />
            ))}
          </div>
          <div className="mt-6">
            <Podium entries={entries} />
          </div>
        </>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ColgateWrapper className="border border-border p-4 lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SearchInput
              id="space-leaderboard-search"
              size="md"
              className="md:max-w-xs"
              label="Rechercher un membre"
              clearLabel="Effacer la recherche"
              placeholder="Nom ou pseudo…"
              value={search}
              onValueChange={(value: string) => setSearch(value)}
            />
            <label className="flex items-center gap-2 text-sm text-soft">
              Afficher
              <select
                aria-label="Nombre de membres affichés"
                className="h-9 rounded-lg border border-border bg-card px-2 text-sm text-foreground"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) as Limit)}
              >
                {LIMITS.map((n) => (
                  <option key={n} value={n}>
                    Top {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Période">
            {PERIODS.map((p) => (
              <FilterChip key={p} active={period === p} onClick={() => setPeriod(p)}>
                {PERIOD_LABEL[p]}
              </FilterChip>
            ))}
          </div>

          {!isLoading && entries.length > 0 && (
            <ol aria-label="Classement des membres" className={cn('mt-4 divide-y divide-border-soft', isFetching && 'opacity-60 transition-opacity')}>
              {filtered.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Aucun membre ne correspond à « {search} ».</li>}
              {filtered.map((e) => {
                const mine = e.user.id === userId;
                return (
                  <li key={e.user.id} className={cn('flex items-center gap-3 py-3', mine && '-mx-2 rounded-lg bg-brand-subtle px-2')}>
                    <span className="w-8 shrink-0 text-center text-sm font-bold text-muted-foreground tabular-nums">{e.rank}</span>
                    <MemberAvatar entry={e} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {e.user.name}
                        {mine && <span className="ml-2 text-xs font-semibold text-brand">Vous</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{e.user.username} · Niv. {e.level} {e.rank_title}
                      </p>
                      <div className="mt-1.5 h-1.5 w-full max-w-60 rounded-full bg-muted" aria-hidden>
                        <div className="h-full rounded-full bg-brand" style={{ width: `${stats.top ? Math.max(4, (e.points / stats.top) * 100) : 0}%` }} />
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{pointsFormat.format(e.points)} pts</span>
                  </li>
                );
              })}
            </ol>
          )}
        </ColgateWrapper>

        <div className="space-y-6">
          <ColgateWrapper className="border border-border p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-foreground">Comment gagner des points</h2>
              {points.canManage && (
                <Button variant="ghost" size="sm" onClick={() => setModal('rules')} disabled={points.rules.length === 0}>
                  <Pencil />
                  Modifier
                </Button>
              )}
            </div>
            {points.rulesLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Chargement du barème…</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm" aria-label="Barème des points">
                {activeRules.length === 0 && <li className="text-muted-foreground">Aucune action ne rapporte de points.</li>}
                {activeRules.map((r) => (
                  <li key={r.action} className="flex justify-between gap-3">
                    <span className="text-soft">{r.label}</span>
                    <span className="font-semibold text-emerald-700 tabular-nums">+{r.points}</span>
                  </li>
                ))}
              </ul>
            )}
          </ColgateWrapper>
          <ColgateWrapper className="border border-border p-5">
            <h2 className="font-semibold text-foreground">Niveaux</h2>
            <p className="mt-1 text-xs text-muted-foreground">Calculés sur tous les points du membre dans Kodinga.</p>
            <ul className="mt-3 space-y-2 text-sm">
              {LEVELS.map((l) => (
                <li key={l.level} className="flex justify-between gap-3">
                  <span className="text-soft">
                    <span className="font-semibold text-foreground">{l.level}</span> · {l.title}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{pointsFormat.format(l.from)} pts</span>
                </li>
              ))}
            </ul>
          </ColgateWrapper>
        </div>
      </div>

      {points.canManage && (
        <ColgateWrapper className="mt-6 border border-border p-4">
          <h2 className="mb-3 font-semibold text-foreground">Journal des points</h2>
          <PointsJournalTable items={points.journal} isLoading={points.journalLoading} />
        </ColgateWrapper>
      )}

      <RulesModal open={modal === 'rules'} rules={points.rules} onOpenChange={(open) => setModal(open ? 'rules' : null)} onSave={points.saveRules} />
      <AdjustPointsModal open={modal === 'adjust'} slug={community.slug} onOpenChange={(open) => setModal(open ? 'adjust' : null)} onAdjust={points.adjust} />
    </div>
  );
}

export default CommunityLeaderboard;
