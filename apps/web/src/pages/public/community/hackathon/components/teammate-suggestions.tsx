import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@kodinga/ui';
import { useGetTeammateSuggestionsQuery } from '@/utils/api/community/community.api';
import { getName } from '@/utils/Utils';
import type { HackathonPage } from '../form/UseHackathonPage';

const MAX_SHOWN = 3;

/**
 * Participants suggested to the captain. The api also proposes people who already have a team, whom
 * an invitation would not reach: they are left out with the teams of the page.
 */
export function TeammateSuggestions({ page, hackathonId }: { page: HackathonPage; hackathonId: string }) {
  const { t } = useTranslation();
  const { data = [] } = useGetTeammateSuggestionsQuery({ slug: page.slug, hackathon_id: hackathonId });
  const [inviting, setInviting] = useState<string | null>(null);
  const taken = new Set(page.teams.flatMap((t) => t.members.map((m) => m.user.id)));
  const suggestions = data.filter((s) => !taken.has(s.user_id)).slice(0, MAX_SHOWN);
  if (suggestions.length === 0) return null;

  const invite = async (username: string) => {
    setInviting(username);
    await page.invite(username);
    setInviting(null);
  };

  return (
    <section aria-labelledby="teammates-title" className="mt-5 border-t border-slate-100 pt-5">
      <h3 id="teammates-title" className="text-sm font-semibold text-slate-900">
        {t('hackathon.team.suggested')}
      </h3>
      <ul className="mt-2 flex flex-col divide-y divide-slate-100" aria-label={t('hackathon.team.suggested')}>
        {suggestions.map((s) => {
          const name = getName(s) || s.username;
          return (
            <li key={s.user_id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span className="min-w-0 flex-[1_1_14rem] text-sm">
                <Link to={`/profiles/${s.username}`} className="font-medium text-slate-900 hover:underline">
                  {name}
                </Link>
                {s.match_reasons.map((reason) => (
                  <span key={reason} className="block text-xs text-slate-500">
                    {reason}
                  </span>
                ))}
              </span>
              <Button size="sm" variant="outline" disabled={page.isInviting} isLoading={inviting === s.username} onClick={() => invite(s.username)} aria-label={t('hackathon.team.inviteName', { name })}>
                <UserPlus /> {t('hackathon.team.inviteButton')}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
