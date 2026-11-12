import { CircleCheck, CornerDownRight, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Avatar, AvatarFallback, AvatarImage, Button, cn } from '@kodinga/ui';
import type { PostComment } from '@/utils/api/community/community.type';
import { ago, getName, nameInitials, plain } from '@/utils/Utils';
import type { PostComments } from '../form/UsePostComments';
import { CommentForm } from './comment-form';
import { ReactionBar } from '../components/reaction-bar';

type Props = {
  comment: PostComment;
  page: PostComments;
  onDelete: (comment: PostComment) => void;
  /** Replies are not answered again (one level, like the api) */
  isReply?: boolean;
};

export function CommentItem({ comment: c, page, onDelete, isReply = false }: Props) {
  const { t } = useTranslation();
  const [replying, setReplying] = useState(false);
  const author = getName(c.author) || c.author.username;
  const accepted = c.is_accepted_answer && !isReply;

  return (
    <article
      aria-label={t('community.comment.labelOf', {
        kind: accepted ? t('community.comment.accepted') : isReply ? t('community.comment.answer') : t('community.comment.comment'),
        author,
      })}
      className={cn(!isReply && 'rounded-xl border bg-card p-5', !isReply && (accepted ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-border'))}
    >
      {accepted && (
        <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
          <CircleCheck className="size-4" /> {t('community.comment.acceptedByAuthor')}
        </p>
      )}
      <header className="flex items-center gap-3">
        <Avatar className={isReply ? 'size-8' : 'size-10'}>
          {c.author.avatar && <AvatarImage src={c.author.avatar} alt="" />}
          <AvatarFallback className="bg-brand-subtle text-xs font-semibold text-brand-strong">{nameInitials(author)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{author}</p>
          <p className="text-xs text-muted-foreground">
            <time dateTime={c.created_at}>{c.created_at ? ago(c.created_at) : ''}</time>
          </p>
        </div>
      </header>

      <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-body">{plain(c.content)}</p>

      <footer className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-soft">
        <ReactionBar
          target={c}
          size="sm"
          canReact={page.isMember}
          onToggle={(reaction) => page.reactComment(c, reaction)}
          likeLabel={(liked) => t('community.comment.likeOf', { action: liked ? t('community.feed.unlike') : t('community.feed.like'), author })}
        />
        {!isReply && page.canComment && (
          <button type="button" onClick={() => setReplying((v) => !v)} aria-expanded={replying} className="hover:text-foreground">
            {t('community.comment.reply')}
          </button>
        )}
        {page.canDelete(c) && (
          <button type="button" onClick={() => onDelete(c)} className="flex items-center gap-1 text-muted-foreground hover:text-red-600">
            <Trash2 className="size-3.5" /> {t('community.comment.delete')}
          </button>
        )}
        {page.canAccept(c) && (
          <Button size="sm" variant="outline" className="ml-auto border-emerald-300 text-emerald-700 hover:bg-emerald-50" isLoading={page.isAccepting} onClick={() => page.accept(c)}>
            <CircleCheck /> {t('community.comment.accept')}
          </Button>
        )}
      </footer>

      {!isReply && (c.replies.length > 0 || replying) && (
        <ul className="mt-4 space-y-4 border-l-2 border-border-soft pl-4" aria-label={t('community.comment.repliesTo', { author })}>
          {c.replies.map((r) => (
            <li key={r.id}>
              <CommentItem comment={r} page={page} onDelete={onDelete} isReply />
            </li>
          ))}
          {replying && (
            <li className="flex gap-2">
              <CornerDownRight className="mt-8 size-4 shrink-0 text-faint" aria-hidden />
              <div className="flex-1">
                <CommentForm
                  label={t('community.comment.replyTo', { author })}
                  placeholder={t('community.comment.replyPlaceholder')}
                  submitLabel={t('community.comment.send')}
                  isSending={page.isSending}
                  autoFocus
                  onCancel={() => setReplying(false)}
                  onSend={(content) => {
                    page.send(content, c.id);
                    setReplying(false);
                  }}
                />
              </div>
            </li>
          )}
        </ul>
      )}
    </article>
  );
}
