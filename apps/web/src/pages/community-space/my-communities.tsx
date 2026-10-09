import { ArrowRight } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { Badge, EmptyAlert } from '@kodinga-mono-repo/ui';
import { myCommunities, roleLabel } from '@/data/community-space.data';
import { formatCompact } from '@/utils/Utils';

/** /c — the communities the signed-in user manages; straight to the space when there is only one */
function MyCommunities() {
  const location = useLocation();
  const deniedSlug = (location.state as { deniedSlug?: string } | null)?.deniedSlug;

  if (myCommunities.length === 1 && !deniedSlug) {
    return <Navigate to={`/c/${myCommunities[0].community.slug}/dashboard`} replace />;
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mes communautés</h1>
      <p className="mt-1 text-slate-500">Choisissez l'espace à gérer.</p>

      {deniedSlug && (
        <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Vous n'avez pas accès à la gestion de « {deniedSlug} ».
        </p>
      )}

      {myCommunities.length === 0 ? (
        <div className="mt-8">
          <EmptyAlert text="Vous ne gérez encore aucune communauté." />
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {myCommunities.map(({ community, role }) => (
            <li key={community.id}>
              <Link
                to={`/c/${community.slug}/dashboard`}
                className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
              >
                {community.avatar_url ? (
                  <img src={community.avatar_url} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-slate-900 font-mono font-bold text-white" aria-hidden>
                    {community.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-900 group-hover:text-primary">{community.name}</span>
                  <span className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                    <Badge variant="outline" className="text-slate-700">{roleLabel[role]}</Badge>
                    {formatCompact(community.members_count)} membres
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
