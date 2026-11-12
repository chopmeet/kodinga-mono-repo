import { UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@kodinga/ui';
import { dateFormat } from '@/utils/format';
import { getName } from '@/utils/Utils';
import type { JoinRequest } from '@/utils/api/community/community.type';
import type { JoinRequests } from '../form/UseJoinRequests';


/** Accept / refuse a join request, or what was decided here */
export function JoinRequestActions({ request, decision, busyId, accept, refuse }: { request?: JoinRequest; decision?: 'accepted' | 'refused'; busyId?: string; accept: JoinRequests['accept']; refuse: JoinRequests['refuse'] }) {
  const { t } = useTranslation();
  if (decision) {
    return <p className="text-sm font-semibold text-soft">{decision === 'accepted' ? t('inbox.joinRequests.accepted') : t('inbox.joinRequests.refused')}</p>;
  }
  if (!request) return null;
  const name = getName(request.member.user);
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={!!busyId} onClick={() => refuse(request)} aria-label={t('inbox.joinRequests.refuseName', { name })}>
        {t('inbox.joinRequests.refuse')}
      </Button>
      <Button size="sm" disabled={!!busyId} isLoading={busyId === request.member.id} onClick={() => accept(request)} aria-label={t('inbox.joinRequests.acceptName', { name })}>
        {t('inbox.joinRequests.accept')}
      </Button>
    </div>
  );
}

/** Join requests to answer without a notification on the page (older ones, a deleted one), above the list */
export function JoinRequestsSection({ requests, busyId, accept, refuse }: Pick<JoinRequests, 'requests' | 'busyId' | 'accept' | 'refuse'>) {
  const { t } = useTranslation();
  if (requests.length === 0) return null;

  return (
    <section aria-labelledby="join-requests-title" className="mt-6 overflow-hidden rounded-xl border border-amber-200 bg-card">
      <h2 id="join-requests-title" className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/60 px-4 py-3 text-sm font-semibold text-amber-900">
        <UserPlus className="size-4" aria-hidden />
        {t('inbox.joinRequests.title', { count: requests.length })}
      </h2>
      <ul className="divide-y divide-border-soft" aria-label={t('inbox.joinRequests.label')}>
        {requests.map((r) => {
          const name = getName(r.member.user);
          return (
            <li key={r.member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-foreground">
                  <strong>{name}</strong> {t('inbox.joinRequests.wantsToJoin')}{' '}
                  <Link to={`/c/${r.community.slug}/members?status=pending`} className="font-semibold text-brand-strong hover:underline">
                    {r.community.name}
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  @{r.member.user.username} ·{' '}
                  {dateFormat({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(r.member.created_at))}
                </p>
              </div>
              <JoinRequestActions request={r} busyId={busyId} accept={accept} refuse={refuse} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
