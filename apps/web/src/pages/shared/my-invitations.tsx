import { MailOpen } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@kodinga/ui';
import { dateFormat } from '@/pages/shared/row-actions';
import { getName, memberRoleLabel } from '@/utils/Utils';
import UseMyInvitations from './form/UseMyInvitations';

/**
 * Invitations waiting for an answer: to a community and to a hackathon team. Nothing when there are
 * none. The name of a community opens the invitation page, which also shows a secret community.
 */
export function MyInvitations({ className }: { className?: string }) {
  const { invitations, teams, busyId, acceptInvitation, declineInvitation, answerTeam } = UseMyInvitations();
  const count = invitations.length + teams.length;
  if (count === 0) return null;

  return (
    <section aria-labelledby="my-invitations-title" className={`overflow-hidden rounded-xl border border-blue-200 bg-white ${className ?? ''}`}>
      <h2 id="my-invitations-title" className="flex items-center gap-2 border-b border-blue-100 bg-blue-50/60 px-4 py-3 text-sm font-semibold text-blue-900">
        <MailOpen className="size-4" aria-hidden />
        Mes invitations ({count})
      </h2>
      <ul className="divide-y divide-slate-100" aria-label="Mes invitations">
        {invitations.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-slate-900">
                Rejoindre{' '}
                <Link to={`/invite/${i.id}`} className="font-semibold text-blue-900 hover:underline">
                  {i.community_name}
                </Link>
              </p>
              <p className="text-xs text-slate-500">
                {memberRoleLabel[i.role] ?? i.role}
                {i.invited_by ? ` · invité par ${getName(i.invited_by) || i.invited_by.username}` : ''}
                {i.expires_at ? ` · expire le ${dateFormat.format(new Date(i.expires_at))}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!!busyId} onClick={() => declineInvitation(i)} aria-label={`Refuser l’invitation de ${i.community_name}`}>
                Refuser
              </Button>
              <Button size="sm" disabled={!!busyId} isLoading={busyId === i.id} onClick={() => acceptInvitation(i)} aria-label={`Rejoindre ${i.community_name}`}>
                Accepter
              </Button>
            </div>
          </li>
        ))}
        {teams.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-slate-900">
                Rejoindre l’équipe <strong>{t.team_name}</strong>
                {t.hackathon_title && <> · {t.hackathon_title}</>}
              </p>
              {t.leader && <p className="text-xs text-slate-500">Invitation de {getName(t.leader) || t.leader.username}</p>}
              <Link to={`/communities/${t.community_slug}/hackathons/${t.hackathon_slug}`} className="text-xs font-semibold text-blue-900 hover:underline">
                Voir le hackathon
              </Link>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!!busyId} onClick={() => answerTeam(t, false)} aria-label={`Refuser l’équipe ${t.team_name}`}>
                Refuser
              </Button>
              <Button size="sm" disabled={!!busyId} isLoading={busyId === t.id} onClick={() => answerTeam(t, true)} aria-label={`Rejoindre l’équipe ${t.team_name}`}>
                Accepter
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
