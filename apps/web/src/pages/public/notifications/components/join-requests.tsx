import { UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@kodinga-mono-repo/ui';
import { getName } from '@/utils/Utils';
import type { JoinRequests } from '../form/UseJoinRequests';

const when = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Join requests to answer (communities the user reviews), above the notifications */
export function JoinRequestsSection({ requests, busyId, accept, refuse }: JoinRequests) {
  if (requests.length === 0) return null;

  return (
    <section aria-labelledby="join-requests-title" className="mt-6 overflow-hidden rounded-xl border border-amber-200 bg-white">
      <h2 id="join-requests-title" className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/60 px-4 py-3 text-sm font-semibold text-amber-900">
        <UserPlus className="size-4" aria-hidden />
        Demandes d’adhésion à traiter ({requests.length})
      </h2>
      <ul className="divide-y divide-slate-100" aria-label="Demandes d’adhésion">
        {requests.map((r) => {
          const name = getName(r.member.user);
          const busy = busyId === r.member.id;
          return (
            <li key={r.member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-slate-900">
                  <strong>{name}</strong> souhaite rejoindre{' '}
                  <Link to={`/c/${r.community.slug}/members?status=pending`} className="font-semibold text-blue-900 hover:underline">
                    {r.community.name}
                  </Link>
                </p>
                <p className="text-xs text-slate-500">
                  @{r.member.user.username} · {when.format(new Date(r.member.created_at))}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={!!busyId} onClick={() => refuse(r)} aria-label={`Refuser ${name}`}>
                  Refuser
                </Button>
                <Button size="sm" disabled={!!busyId} isLoading={busy} onClick={() => accept(r)} aria-label={`Accepter ${name}`}>
                  Accepter
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
