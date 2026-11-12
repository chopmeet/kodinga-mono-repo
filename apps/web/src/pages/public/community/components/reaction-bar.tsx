import { SmilePlus, ThumbsUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@kodinga/ui';
import { EmojiPickerButton } from '@/pages/shared/emoji-picker-button';
import { reactionsOf } from '@/utils/api/community/community.api';

/** The named reactions of the api (ReactionType), shown as their emoji */
const NAMED: Record<string, string> = { like: '👍', fire: '🔥', rocket: '🚀', heart: '❤️', eyes: '👀', thinking: '🤔', unicorn: '🦄' };
const emojiOf = (reaction: string) => NAMED[reaction] ?? reaction;

type Target = { reactions_count: number; reactions_summary?: Record<string, number>; user_reactions?: string[] };

type Props = {
  target: Target;
  canReact: boolean;
  onToggle: (reaction: string) => void;
  busy?: boolean;
  /** Accessible name of the like button ("J’aime", "J’aime (Kofi Mensah)"…), from whether it is on */
  likeLabel: (liked: boolean) => string;
  size?: 'sm' | 'md';
};


export function ReactionBar({ target, canReact, onToggle, busy, likeLabel, size = 'md' }: Props) {
  const { t } = useTranslation();
  const summary = reactionsOf(target);
  const mine = target.user_reactions ?? [];
  const liked = mine.includes('like');
  const others = Object.entries(summary)
    .filter(([reaction, count]) => reaction !== 'like' && count > 0)
    .sort((a, b) => b[1] - a[1]);
  const icon = size === 'sm' ? 'size-4' : 'size-5';
  const blocked = canReact ? undefined : t('community.feed.membersOnly');

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onToggle('like')}
        disabled={!canReact || busy}
        aria-pressed={liked}
        aria-label={likeLabel(liked)}
        title={blocked}
        className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors disabled:cursor-not-allowed', liked ? 'font-semibold text-brand-strong' : 'hover:text-foreground')}
      >
        <ThumbsUp className={cn(icon, liked && 'fill-brand-strong/15')} /> {summary.like ?? 0}
      </button>
      {others.map(([reaction, count]) => {
        const on = mine.includes(reaction);
        return (
          <button
            key={reaction}
            type="button"
            onClick={() => onToggle(reaction)}
            disabled={!canReact || busy}
            aria-pressed={on}
            aria-label={t(on ? 'community.feed.reactionOn' : 'community.feed.reactionOf', { emoji: emojiOf(reaction), count })}
            title={blocked}
            className={cn(
              'flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors disabled:cursor-not-allowed',
              on ? 'border-blue-300 bg-brand-subtle font-semibold text-brand-strong' : 'border-border bg-card hover:border-border-strong'
            )}
          >
            <span aria-hidden>{emojiOf(reaction)}</span> {count}
          </button>
        );
      })}
      <EmojiPickerButton onSelect={onToggle} label={t('common.emoji.react')} disabled={!canReact || busy} align="start">
        <SmilePlus className={icon} />
      </EmojiPickerButton>
    </div>
  );
}
