import { ArrowRight, Plus, Radio, RotateCw, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { Badge } from '@kodinga-mono-repo/ui';
import { roleLabel } from '@/data/community-space.data';
import { FormAlert } from '@/pages/auth/components/form-alert';
import { CommunityAvatar } from '@/pages/shared/community-avatar';
import { isManaged, useGetMyCommunitiesQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { formatCompact, useUser } from '@/utils/Utils';
import { ProPlans } from './components/pro-plans';
import UseKodingaPro from './form/UseKodingaPro';

const createLinkClassName =
  'inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover';

/**
 * /c — the communities the user manages (their space /c/<slug>), the ones they joined (public page)
 * and Kodinga Pro. Always shown, even with a single community.
 */
function MyCommunities() {
  const user = useUser();
  const location = useLocation();
  const deniedSlug = (location.state as { deniedSlug?: string } | null)?.deniedSlug;
  const { data: memberships, isLoading, isFetching, error, refetch } = useGetMyCommunitiesQuery(undefined, { skip: !user });
  const communities = useMemo(() => (memberships ?? []).filter(isManaged), [memberships]);
  const joined = useMemo(() => (memberships ?? []).filter((m) => !isManaged(m)), [memberships]);
  const pro = UseKodingaPro();

  if (!user) return <Navigate to="/auth/login?next=/c" replace />;

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mes communautés</h1>
          <p className="mt-1 text-slate-500">Vos espaces à gérer, les communautés que vous suivez et votre formule Kodinga.</p>
        </div>
        {communities.length > 0 && (
          <Link to="/create-community" className={createLinkClassName}>
            <Plus className="size-4" />
            Créer une communauté
          </Link>
        )}
      </div>

      {deniedSlug && (
        <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Vous n'avez pas accès à la gestion de « {deniedSlug} ».
        </p>
      )}

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Communautés que je gère</h2>
      {isLoading ? (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Chargement de vos communautés">
          {[0, 1].map((i) => (
            <li key={i} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <span className="size-14 animate-pulse rounded-xl bg-slate-100" />
              <span className="flex-1 space-y-2">
                <span className="block h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                <span className="block h-3 w-1/3 animate-pulse rounded bg-slate-100" />
              </span>
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="mt-4 flex flex-col items-start gap-3">
          <FormAlert>{parseApiError(error).message}</FormAlert>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline disabled:opacity-60"
          >
            <RotateCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
            Réessayer
          </button>
        </div>
      ) : communities.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Sparkles className="size-6" />
          </span>
          <p className="mt-4 text-lg font-semibold text-slate-900">Vous ne gérez encore aucune communauté</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">Lancez la vôtre en quelques minutes : nom, sujet, accès, et c'est en ligne.</p>
          <Link to="/create-community" className={`mt-6 ${createLinkClassName}`}>
            <Plus className="size-4" />
            Créer ma communauté
          </Link>
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2" aria-label="Communautés que je gère">
          {communities.map(({ community, role }) => (
            <li key={community.id} className="relative">
              <Link
                to={`/c/${community.slug}/dashboard`}
                className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
              >
                <CommunityAvatar community={community} className="size-14 rounded-xl font-mono" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 truncate font-semibold text-slate-900 group-hover:text-primary">
                    <span className="truncate">{community.name}</span>
                    {community.active_live && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase animate-pulse">
                        <span className="size-1.5 rounded-full bg-white animate-ping" />
                        Live
                      </span>
                    )}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                    <Badge variant="outline" className="text-slate-700">{roleLabel[role]}</Badge>
                    {formatCompact(community.members_count)} membre{community.members_count > 1 ? 's' : ''}
                  </span>
                </span>
                {community.active_live ? (
                  <Link
                    to={`/communities/${community.slug}/events/${community.active_live.id}/live`}
                    className="relative z-10 flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-500"
                    title="Rejoindre le direct en cours"
                  >
                    <Radio className="size-3.5 animate-pulse" />
                    Rejoindre
                  </Link>
                ) : (
                  <ArrowRight className="size-4 shrink-0 text-slate-400 group-hover:text-primary" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {joined.length > 0 && (
        <section aria-labelledby="joined-communities" className="mt-12">
          <h2 id="joined-communities" className="text-lg font-semibold text-slate-900">
            Communautés dont je suis membre
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2" aria-label="Communautés dont je suis membre">
            {joined.map(({ community }) => (
              <li key={community.id} className="relative">
                <Link
                  to={`/communities/${community.slug}`}
                  className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
                >
                  <CommunityAvatar community={community} className="size-12 rounded-xl font-mono" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 truncate font-semibold text-slate-900 group-hover:text-primary">
                      <span className="truncate">{community.name}</span>
                      {community.active_live && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase animate-pulse">
                          <span className="size-1.5 rounded-full bg-white animate-ping" />
                          Live
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      {formatCompact(community.members_count)} membre{community.members_count > 1 ? 's' : ''}
                    </span>
                  </span>
                  {community.active_live ? (
                    <Link
                      to={`/communities/${community.slug}/events/${community.active_live.id}/live`}
                      className="relative z-10 flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-red-500"
                      title="Rejoindre le direct en cours"
                    >
                      <Radio className="size-3.5 animate-pulse" />
                      Rejoindre
                    </Link>
                  ) : (
                    <ArrowRight className="size-4 shrink-0 text-slate-400 group-hover:text-primary" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ProPlans pro={pro} />

      <div className="py-10" />
    </section>
  );
}

export default MyCommunities;
