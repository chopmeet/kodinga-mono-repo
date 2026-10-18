import { Check, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, cn, customToast } from '@kodinga-mono-repo/ui';
import { useVotePollMutation } from '@/utils/api/community/community.api';
import type { PostPoll } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';

const until = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/**
 * Poll of a post: members vote (POST posts/<id>/vote/, a new vote replaces the previous one), then
 * see the results with their choice. Visitors and closed polls show the results only.
 */
export function PollCard({ postId, poll: cached, canVote }: { postId: string; poll: PostPoll; canVote: boolean }) {
  const [votePoll, { isLoading }] = useVotePollMutation();
  // The poll answered by the vote, shown at once: the cache update lands a moment later and
  // would otherwise flash the previous results
  const [answered, setAnswered] = useState<PostPoll | null>(null);
  useEffect(() => setAnswered(null), [cached]);
  const poll = answered ?? cached;
  const [changing, setChanging] = useState(false);
  const [chosen, setChosen] = useState<string[]>(poll.user_voted_option_ids ?? []);
  const options = [...poll.options].sort((a, b) => a.order - b.order);
  const voted = poll.user_has_voted;
  const open = canVote && !poll.is_expired;
  const voting = open && (!voted || changing);

  const toggle = (id: string) =>
    setChosen((current) => (poll.is_multiple_choice ? (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]) : [id]));

  const submit = async () => {
    try {
      setAnswered(await votePoll({ postId, option_ids: chosen }).unwrap());
      setChanging(false);
      customToast.success({ message: voted ? 'Vote modifié.' : 'Vote enregistré.' });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return (
    <section aria-label={`Sondage : ${poll.question}`} className="mt-5 rounded-xl border border-slate-200 p-4">
      {voting ? (
        <fieldset>
          <legend className="mb-3 text-sm text-slate-600">{poll.is_multiple_choice ? 'Plusieurs réponses possibles' : 'Une seule réponse'}</legend>
          <div className="space-y-2">
            {options.map((o) => {
              const selected = chosen.includes(o.id);
              return (
                <label
                  key={o.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                    selected ? 'border-blue-900 bg-blue-50 text-blue-950' : 'border-slate-200 text-slate-800 hover:border-slate-300',
                  )}
                >
                  <input
                    type={poll.is_multiple_choice ? 'checkbox' : 'radio'}
                    name={`poll-${poll.id}`}
                    checked={selected}
                    onChange={() => toggle(o.id)}
                    className="size-4 accent-blue-900"
                  />
                  {o.text}
                </label>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={submit} isLoading={isLoading} disabled={chosen.length === 0}>
              {voted ? 'Enregistrer mon vote' : 'Voter'}
            </Button>
            {changing && (
              <Button size="sm" variant="ghost" onClick={() => setChanging(false)} disabled={isLoading}>
                Annuler
              </Button>
            )}
          </div>
        </fieldset>
      ) : (
        <ul className="space-y-3" aria-label="Résultats du sondage">
          {options.map((o) => {
            const mine = poll.user_voted_option_ids?.includes(o.id);
            return (
              <li key={o.id}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className={cn('flex items-center gap-1.5', mine ? 'font-semibold text-blue-900' : 'text-slate-800')}>
                    {mine && <Check className="size-4" aria-label="Votre choix" />}
                    {o.text}
                  </span>
                  <span className="font-semibold text-slate-900 tabular-nums">{Math.round(o.percentage)} %</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100" aria-hidden>
                  <div className={cn('h-full rounded-full', mine ? 'bg-blue-900' : 'bg-blue-300')} style={{ width: `${o.percentage}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>
          {poll.total_votes} vote{poll.total_votes > 1 ? 's' : ''}
        </span>
        {poll.is_expired ? (
          <span>· Sondage terminé</span>
        ) : (
          poll.expires_at && (
            <span className="flex items-center gap-1">
              · <Clock className="size-3" /> jusqu’au {until.format(new Date(poll.expires_at))}
            </span>
          )
        )}
        {!canVote && !poll.is_expired && <span>· Réservé aux membres</span>}
        {open && voted && !changing && (
          <button type="button" onClick={() => setChanging(true)} className="ml-auto font-semibold text-blue-900 hover:underline">
            Modifier mon vote
          </button>
        )}
      </div>
    </section>
  );
}
