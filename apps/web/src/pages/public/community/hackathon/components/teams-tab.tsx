import { Crown, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { HackathonTeam } from '@/utils/api/hackathon/hackathon.type';
import { getName } from '@/utils/Utils';

/** Teams of the hackathon (their active members), to find teammates or follow the competition */
function TeamsTab({ teams, maxSize }: { teams: HackathonTeam[]; maxSize: number }) {
  const { t: tr } = useTranslation();
  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-12 text-center">
        <Users className="size-8 text-slate-300" />
        <p className="mt-3 font-semibold text-foreground">{tr('hackathon.teams.none')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{tr('hackathon.teams.noneText')}</p>
      </div>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2" aria-label={tr('hackathon.teams.label')}>
      {teams.map((t) => {
        const members = t.members.filter((m) => m.status === 'accepted');
        return (
          <li key={t.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-foreground">{t.name}</h3>
                {t.tagline && <p className="mt-0.5 text-sm text-muted-foreground">{t.tagline}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-soft">
                {members.length} / {maxSize}
              </span>
            </div>
            <ul className="mt-4 flex flex-wrap gap-2">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-sm text-body">
                  {m.role === 'leader' && <Crown className="size-3.5 text-amber-500" aria-label={tr('hackathon.team.captain')} />}
                  {getName(m.user)}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

export default TeamsTab;
