import { Crown, Users } from 'lucide-react';

import type { HackathonPerson, HackathonTeam } from '@/utils/api/hackathon/hackathon.type';

export const personName = (p: HackathonPerson) => [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username;

/** Teams of the hackathon (their active members), to find teammates or follow the competition */
function TeamsTab({ teams, maxSize }: { teams: HackathonTeam[]; maxSize: number }) {
  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
        <Users className="size-8 text-slate-300" />
        <p className="mt-3 font-semibold text-slate-900">Aucune équipe pour le moment</p>
        <p className="mt-1 text-sm text-slate-500">Les participants acceptés peuvent créer la leur depuis « Mon espace ».</p>
      </div>
    );
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-2" aria-label="Équipes">
      {teams.map((t) => {
        const members = t.members.filter((m) => m.status === 'accepted');
        return (
          <li key={t.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-slate-900">{t.name}</h3>
                {t.tagline && <p className="mt-0.5 text-sm text-slate-500">{t.tagline}</p>}
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {members.length} / {maxSize}
              </span>
            </div>
            <ul className="mt-4 flex flex-wrap gap-2">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-sm text-slate-700">
                  {m.role === 'leader' && <Crown className="size-3.5 text-amber-500" aria-label="Capitaine" />}
                  {personName(m.user)}
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
