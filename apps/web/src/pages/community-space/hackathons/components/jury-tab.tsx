import { Search, ShieldCheck, UserMinus } from 'lucide-react';
import { useState } from 'react';

import { Button, customToast, EmptyAlert } from '@kodinga/ui';
import {
  useAssignHackathonJudgesMutation,
  useGetCommunityMembersQuery,
  useRemoveHackathonJudgeMutation,
} from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { Hackathon } from '@/utils/api/hackathon/hackathon.type';
import { useDebounced } from '@/utils/hooks/useDebounced';
import { getName } from '@/utils/Utils';

/** Judges of a hackathon: the organizers pick them among the active members of the community */
export function JuryTab({ slug, hackathon, canManage }: { slug: string; hackathon: Hackathon; canManage: boolean }) {
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim(), 300);
  const { data: members, isFetching } = useGetCommunityMembersQuery(
    { slug, search: query, status: 'active', page_size: 6 },
    { skip: !canManage || query.length < 2 }
  );
  const [assign, { isLoading: assigning }] = useAssignHackathonJudgesMutation();
  const [remove] = useRemoveHackathonJudgeMutation();
  const judgeIds = new Set(hackathon.judges.map((j) => j.user.id));

  const add = async (userId: string, name: string) => {
    try {
      await assign({ slug, hackathonSlug: hackathon.slug, user_ids: [userId] }).unwrap();
      customToast.success({ message: `${name} rejoint le jury.` });
      setSearch('');
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  const drop = async (userId: string, name: string) => {
    try {
      await remove({ slug, hackathonSlug: hackathon.slug, userId }).unwrap();
      customToast.success({ message: `${name} ne fait plus partie du jury.` });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h2 className="mb-3 font-semibold text-slate-900">Membres du jury ({hackathon.judges.length})</h2>
        {hackathon.judges.length === 0 ? (
          <EmptyAlert text="Aucun juré pour le moment." />
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200" aria-label="Jury">
            {hackathon.judges.map((j) => (
              <li key={j.id} className="flex items-center gap-3 px-4 py-3">
                <ShieldCheck className="size-4 shrink-0 text-violet-600" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{getName(j.user)}</span>
                  <span className="block truncate text-xs text-slate-500">{j.user.email}</span>
                </span>
                {canManage && (
                  <Button variant="ghost" size="icon-sm" aria-label={`Retirer ${getName(j.user)} du jury`} onClick={() => drop(j.user.id, getName(j.user))}>
                    <UserMinus />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage && (
        <section>
          <h2 className="mb-3 font-semibold text-slate-900">Ajouter un juré</h2>
          <label htmlFor="jury-search" className="sr-only">
            Rechercher un membre
          </label>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              id="jury-search"
              type="search"
              placeholder="Un membre de la communauté…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="custom-form-control block w-full bg-background py-2 pr-4 pl-9"
            />
          </div>
          <div className="mt-3" aria-busy={isFetching}>
            {query.length < 2 ? (
              <p className="text-sm text-slate-500">Saisissez au moins 2 caractères.</p>
            ) : (members?.results ?? []).length === 0 && !isFetching ? (
              <p className="text-sm text-slate-500">Aucun membre actif ne correspond.</p>
            ) : (
              <ul className="divide-y divide-slate-100" aria-label="Membres trouvés">
                {(members?.results ?? []).map((m) => {
                  const name = getName(m.user) || m.user.username;
                  const already = judgeIds.has(m.user.id);
                  return (
                    <li key={m.id} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{name}</span>
                      {already ? (
                        <span className="text-xs font-medium text-violet-700">Déjà juré</span>
                      ) : (
                        <Button size="sm" variant="outline" disabled={assigning} onClick={() => add(m.user.id, name)} aria-label={`Ajouter ${name} au jury`}>
                          Ajouter
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
