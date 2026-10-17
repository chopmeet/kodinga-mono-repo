import { Crown, Download, Medal, RotateCw, SlidersHorizontal, Sparkles, Trophy, Users } from 'lucide-react';

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
} from '@kodinga-mono-repo/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { SoonBadge } from '@/pages/shared/row-actions';
import { parseApiError } from '@/utils/api/errors';
import type { LeaderboardEntry } from '@/utils/api/gamification/gamification.type';
import { nameInitials } from '@/utils/Utils';
import { useCommunitySpace } from '../community-space-context';
import UseCommunityLeaderboard, { LIMITS, type Limit } from './form/UseCommunityLeaderboard';
import { LEVELS, POINT_RULES, pointsFormat } from './leaderboard-labels';

const PODIUM_STYLE: Record<number, { ring: string; badge: string; height: string }> = {
  1: { ring: 'ring-amber-400', badge: 'bg-amber-400 text-amber-950', height: 'sm:pt-0' },
  2: { ring: 'ring-slate-300', badge: 'bg-slate-300 text-slate-900', height: 'sm:pt-6' },
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
            <ColgateWrapper className="flex flex-col items-center border border-neutral-200 p-5 text-center">
              <div className="relative">
                <MemberAvatar entry={e} className={cn('size-16 ring-4', style.ring)} />
                <span className={cn('absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full text-sm font-bold', style.badge)}>
                  {e.rank}
                </span>
                {e.rank === 1 && <Crown className="absolute -top-5 left-1/2 size-5 -translate-x-1/2 text-amber-500" aria-hidden />}
              </div>
              <p className="mt-3 font-semibold text-slate-900">{e.user.name}</p>
              <p className="text-xs text-slate-500">
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

/** /c/:slug/leaderboard — members ranked by the points earned in the community */
function CommunityLeaderboard() {
  const { community } = useCommunitySpace();
  const { entries, filtered, stats, limit, setLimit, search, setSearch, exportCsv, userId, isLoading, isFetching, error, refetch } =
    UseCommunityLeaderboard(community.slug);

  const cards: CardType[] = [
    { id: 'ranked', label: 'Membres classés', value: stats.ranked, icon: <Users size={18} />, color: '#1D4ED8' },
    { id: 'total', label: 'Points distribués', value: pointsFormat.format(stats.total), icon: <Sparkles size={18} />, color: '#7c3aed' },
    { id: 'top', label: 'Meilleur score', value: `${pointsFormat.format(stats.top)} pts`, icon: <Trophy size={18} />, color: '#b45309' },
  ];

  return (
    <div className="community__leaderboard">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <TopTitle title="Classement" paragraph={`Les membres les plus actifs de ${community.name}`} />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled title="Bientôt disponible">
            <SlidersHorizontal />
            Ajuster des points
            <SoonBadge />
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={entries.length === 0}>
            <Download />
            Exporter
          </Button>
        </div>
      </div>

      {isLoading ? (
        <ul aria-label="Chargement du classement" className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-44 animate-pulse rounded-xl bg-slate-100" />
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
        <ColgateWrapper className="flex flex-col items-center border border-neutral-200 py-12 text-center">
          <Medal className="size-10 text-slate-300" aria-hidden />
          <p className="mt-3 font-semibold text-slate-900">Personne n'a encore marqué de points</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Les membres gagnent des points en publiant, en commentant, en suivant les formations et en participant aux événements.
          </p>
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
        <ColgateWrapper className="border border-neutral-200 p-4 lg:col-span-2">
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
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Afficher
              <select
                aria-label="Nombre de membres affichés"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800"
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
            <FilterChip active onClick={() => undefined}>
              Depuis le début
            </FilterChip>
            {['Ce mois-ci', 'Cette semaine'].map((label) => (
              <FilterChip key={label} active={false} disabled title="Bientôt disponible" onClick={() => undefined}>
                {label} <SoonBadge />
              </FilterChip>
            ))}
          </div>

          {!isLoading && entries.length > 0 && (
            <ol aria-label="Classement des membres" className={cn('mt-4 divide-y divide-slate-100', isFetching && 'opacity-60 transition-opacity')}>
              {filtered.length === 0 && <li className="py-8 text-center text-sm text-slate-500">Aucun membre ne correspond à « {search} ».</li>}
              {filtered.map((e) => {
                const mine = e.user.id === userId;
                return (
                  <li key={e.user.id} className={cn('flex items-center gap-3 py-3', mine && '-mx-2 rounded-lg bg-blue-50 px-2')}>
                    <span className="w-8 shrink-0 text-center text-sm font-bold text-slate-500 tabular-nums">{e.rank}</span>
                    <MemberAvatar entry={e} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">
                        {e.user.name}
                        {mine && <span className="ml-2 text-xs font-semibold text-brand">Vous</span>}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        @{e.user.username} · Niv. {e.level} {e.rank_title}
                      </p>
                      <div className="mt-1.5 h-1.5 w-full max-w-60 rounded-full bg-slate-100" aria-hidden>
                        <div className="h-full rounded-full bg-brand" style={{ width: `${stats.top ? Math.max(4, (e.points / stats.top) * 100) : 0}%` }} />
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">{pointsFormat.format(e.points)} pts</span>
                  </li>
                );
              })}
            </ol>
          )}
        </ColgateWrapper>

        <div className="space-y-6">
          <ColgateWrapper className="border border-neutral-200 p-5">
            <h2 className="font-semibold text-slate-900">Comment gagner des points</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {POINT_RULES.map((r) => (
                <li key={r.label} className="flex justify-between gap-3">
                  <span className="text-slate-600">{r.label}</span>
                  <span className="font-semibold text-emerald-700 tabular-nums">+{r.points}</span>
                </li>
              ))}
            </ul>
          </ColgateWrapper>
          <ColgateWrapper className="border border-neutral-200 p-5">
            <h2 className="font-semibold text-slate-900">Niveaux</h2>
            <p className="mt-1 text-xs text-slate-500">Calculés sur tous les points du membre dans Kodinga.</p>
            <ul className="mt-3 space-y-2 text-sm">
              {LEVELS.map((l) => (
                <li key={l.level} className="flex justify-between gap-3">
                  <span className="text-slate-600">
                    <span className="font-semibold text-slate-900">{l.level}</span> · {l.title}
                  </span>
                  <span className="text-slate-500 tabular-nums">{pointsFormat.format(l.from)} pts</span>
                </li>
              ))}
            </ul>
          </ColgateWrapper>
        </div>
      </div>
    </div>
  );
}

export default CommunityLeaderboard;
