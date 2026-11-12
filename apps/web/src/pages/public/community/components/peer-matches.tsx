import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage, customToast } from '@kodinga/ui';
import { MessageButton } from '@/pages/public/messages/components/message-button';
import { useGetPeerMatchesQuery, useRespondPeerMatchMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import { getName } from '@/utils/Utils';

/** Members suggested to an active member, with the reasons of the api; the ones ignored stay away */
export function PeerMatches({ slug }: { slug: string }) {
  const { t } = useTranslation();
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
    <section aria-labelledby="peer-matches-title" className="mb-6 rounded-xl border border-border bg-card p-5">
      <h3 id="peer-matches-title" className="font-semibold text-foreground">
        {t('community.peers.title')}
      </h3>
      <ul className="mt-3 grid gap-3 md:grid-cols-2" aria-label={t('community.peers.title')}>
        {matches.map((m) => {
          const name = getName(m) || m.username;
          return (
            <li key={m.id} className="flex items-start gap-3 rounded-lg border border-border-soft p-3">
              <Avatar className="size-10">
                {m.avatar_url && <AvatarImage src={m.avatar_url} alt="" />}
                <AvatarFallback className="bg-brand-subtle text-sm font-semibold text-brand-strong">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <Link to={`/profiles/${m.username}`} className="font-medium text-foreground hover:underline">
                  {name}
                </Link>
                {m.match_reasons.map((reason) => (
                  <p key={reason} className="text-xs text-muted-foreground">
                    {reason}
                  </p>
                ))}
                <MessageButton userId={m.user_id} label={t('community.peers.write')} size="sm" variant="outline" className="mt-2" />
              </div>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => ignore(m.id)}
                aria-label={t('community.peers.ignore', { name })}
                className="rounded-md p-1.5 text-faint hover:bg-muted hover:text-body"
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
