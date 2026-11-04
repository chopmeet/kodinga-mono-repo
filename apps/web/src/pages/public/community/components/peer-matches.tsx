import { X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage, customToast } from '@kodinga-mono-repo/ui';
import { MessageButton } from '@/pages/public/messages/components/message-button';
import { useGetPeerMatchesQuery, useRespondPeerMatchMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { getName } from '@/utils/Utils';

/** Members suggested to an active member, with the reasons of the api; the ones ignored stay away */
export function PeerMatches({ slug }: { slug: string }) {
  const { data = [] } = useGetPeerMatchesQuery(slug);
  const [respond, { isLoading }] = useRespondPeerMatchMutation();
  const matches = data.filter((m) => m.status !== 'declined');
  if (matches.length === 0) return null;

  const ignore = async (id: string) => {
    try {
      await respond({ id, action: 'decline' }).unwrap();
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return (
    <section aria-labelledby="peer-matches-title" className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <h3 id="peer-matches-title" className="font-semibold text-slate-900">
        Membres à rencontrer
      </h3>
      <ul className="mt-3 grid gap-3 md:grid-cols-2" aria-label="Membres à rencontrer">
        {matches.map((m) => {
          const name = getName(m) || m.username;
          return (
            <li key={m.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
              <Avatar className="size-10">
                {m.avatar_url && <AvatarImage src={m.avatar_url} alt="" />}
                <AvatarFallback className="bg-blue-50 text-sm font-semibold text-blue-900">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <Link to={`/profiles/${m.username}`} className="font-medium text-slate-900 hover:underline">
                  {name}
                </Link>
                {m.match_reasons.map((reason) => (
                  <p key={reason} className="text-xs text-slate-500">
                    {reason}
                  </p>
                ))}
                <MessageButton userId={m.user_id} label="Écrire" size="sm" variant="outline" className="mt-2" />
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => ignore(m.id)}
                aria-label={`Ignorer ${name}`}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
