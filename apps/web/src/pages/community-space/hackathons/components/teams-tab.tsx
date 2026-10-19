import { Crown, Users } from 'lucide-react';
import { useState } from 'react';

import { Badge, EmptyAlert, Pagination } from '@kodinga-mono-repo/ui';
import { useGetHackathonTeamsQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { personName } from '@/pages/shared/person';

const memberStatus: Record<string, string> = { accepted: 'Membre', invited: 'Invité', declined: 'A refusé', left: 'A quitté' };

/** Teams of a hackathon (formed by the participants themselves) */
export function TeamsTab({ slug, hackathonSlug }: { slug: string; hackathonSlug: string }) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const { data, isLoading, error } = useGetHackathonTeamsQuery({ slug, hackathonSlug, page, page_size: size });
  const teams = data?.results ?? [];
  const total = data?.pagination.count ?? 0;

  if (error && !data) return <EmptyAlert text={parseApiError(error).message} />;
  if (isLoading) return <p className="py-8 text-center text-sm text-slate-500">Chargement des équipes…</p>;
  if (teams.length === 0) return <EmptyAlert text="Aucune équipe formée pour le moment." />;

  return (
    <>
      <ul className="grid gap-4 md:grid-cols-2" aria-label="Équipes">
        {teams.map((team) => (
          <li key={team.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{team.name}</p>
                {team.tagline && <p className="truncate text-sm text-slate-500">{team.tagline}</p>}
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm text-slate-600">
                <Users className="size-4" aria-hidden />
                {team.active_members_count}
              </span>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {team.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-slate-800">
                    {m.user.id === team.leader.id && <Crown className="size-3.5 text-amber-500" aria-label="Chef d'équipe" />}
                    {personName(m.user)}
                  </span>
                  {m.status !== 'accepted' && (
                    <Badge variant="outline" className="text-slate-500">
                      {memberStatus[m.status] ?? m.status}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {total > size && (
        <Pagination
          totalItems={total}
          currentPage={page}
          perPage={size}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setSize(n);
            setPage(1);
          }}
        />
      )}
    </>
  );
}
