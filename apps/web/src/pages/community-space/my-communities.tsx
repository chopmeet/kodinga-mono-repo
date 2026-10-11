import { ArrowRight, Plus, RotateCw, Sparkles } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { Badge } from '@kodinga-mono-repo/ui';
import { roleLabel } from '@/data/community-space.data';
import { FormAlert } from '@/pages/auth/components/form-alert';
import { CommunityAvatar } from '@/pages/shared/community-avatar';
import { useGetMyManagedCommunitiesQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { formatCompact, useUser } from '@/utils/Utils';

const createLinkClassName =
  'inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover';


function MyCommunities() {
  const user = useUser();
  const location = useLocation();
  const deniedSlug = (location.state as { deniedSlug?: string } | null)?.deniedSlug;
  const { data: communities = [], isLoading, isFetching, error, refetch } = useGetMyManagedCommunitiesQuery(undefined, { skip: !user });

  if (!user) return <Navigate to="/auth/login?next=/c" replace />;

  if (!isLoading && !error && communities.length === 1 && !deniedSlug) {
    return <Navigate to={`/c/${communities[0].community.slug}/dashboard`} replace />;
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mes communautés</h1>
          <p className="mt-1 text-slate-500">Choisissez l'espace à gérer.</p>
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

      {isLoading ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label="Chargement de vos communautés">
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
        <div className="mt-8 flex flex-col items-start gap-3">
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
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
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
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {communities.map(({ community, role }) => (
            <li key={community.id}>
              <Link
                to={`/c/${community.slug}/dashboard`}
                className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
              >
                <CommunityAvatar community={community} className="size-14 rounded-xl font-mono" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900 group-hover:text-primary">{community.name}</span>
                  <span className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                    <Badge variant="outline" className="text-slate-700">{roleLabel[role]}</Badge>
                    {formatCompact(community.members_count)} membre{community.members_count > 1 ? 's' : ''}
                  </span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-slate-400 group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default MyCommunities;
