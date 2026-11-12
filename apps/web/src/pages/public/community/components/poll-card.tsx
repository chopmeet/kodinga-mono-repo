import { Check, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, cn, customToast } from '@kodinga/ui';
import { useVotePollMutation } from '@/utils/api/community/community.api';
import type { PostPoll } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { dateFormat } from '@/utils/format';


/**
 * Poll of a post: members vote (POST posts/<id>/vote/, a new vote replaces the previous one), then
 * see the results with their choice. Visitors and closed polls show the results only.
 */
export function PollCard({ postId, poll: cached, canVote }: { postId: string; poll: PostPoll; canVote: boolean }) {
  const { t } = useTranslation();
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
      customToast.success({ message: voted ? t('community.poll.changed') : t('community.poll.recorded') });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return (
    <section aria-label={t('community.poll.label', { question: poll.question })} className="mt-5 rounded-xl border border-border p-4">
      {voting ? (
        <fieldset>
          <legend className="mb-3 text-sm text-soft">{poll.is_multiple_choice ? t('community.poll.multiple') : t('community.poll.single')}</legend>
          <div className="space-y-2">
            {options.map((o) => {
              const selected = chosen.includes(o.id);
              return (
                <label
                  key={o.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                    selected ? 'border-blue-900 bg-brand-subtle text-brand-strong' : 'border-border text-foreground hover:border-border-strong',
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
              {voted ? t('community.poll.saveVote') : t('community.poll.vote')}
            </Button>
            {changing && (
              <Button size="sm" variant="ghost" onClick={() => setChanging(false)} disabled={isLoading}>
                {t('common.actions.cancel')}
              </Button>
            )}
          </div>
        </fieldset>
      ) : (
        <ul className="space-y-3" aria-label={t('community.poll.results')}>
          {options.map((o) => {
            const mine = poll.user_voted_option_ids?.includes(o.id);
            return (
              <li key={o.id}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className={cn('flex items-center gap-1.5', mine ? 'font-semibold text-brand-strong' : 'text-foreground')}>
                    {mine && <Check className="size-4" aria-label={t('community.poll.yourChoice')} />}
                    {o.text}
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">{Math.round(o.percentage)} %</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden>
                  <div className={cn('h-full rounded-full', mine ? 'bg-blue-900' : 'bg-blue-300')} style={{ width: `${o.percentage}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          {t('community.poll.votes', { count: poll.total_votes })}
        </span>
        {poll.is_expired ? (
          <span>{t('community.poll.ended')}</span>
        ) : (
          poll.expires_at && (
            <span className="flex items-center gap-1">
              · <Clock className="size-3" />{' '}
              {t('community.poll.until', { date: dateFormat({ day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(poll.expires_at)) })}
            </span>
          )
        )}
        {!canVote && !poll.is_expired && <span>{t('community.poll.membersOnly')}</span>}
        {open && voted && !changing && (
          <button type="button" onClick={() => setChanging(true)} className="ml-auto font-semibold text-brand-strong hover:underline">
            {t('community.poll.change')}
          </button>
        )}
      </div>
    </section>
  );
}
