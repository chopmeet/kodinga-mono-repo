import { CircleCheck, CornerDownRight, ThumbsUp, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage, Button, cn } from '@kodinga-mono-repo/ui';
import type { PostComment } from '@/utils/api/community/community.type';
import { ago, getName, nameInitials, plain } from '@/utils/Utils';
import type { PostDetailsPage } from '../form/UsePostDetails';
import { CommentForm } from './comment-form';

type Props = {
  comment: PostComment;
  page: PostDetailsPage;
  onDelete: (comment: PostComment) => void;
  /** Replies are not answered again (one level, like the api) */
  isReply?: boolean;
};

export function CommentItem({ comment: c, page, onDelete, isReply = false }: Props) {
  const [replying, setReplying] = useState(false);
  const author = getName(c.author) || c.author.username;
  const liked = c.user_reactions.includes('like');
  const accepted = c.is_accepted_answer && !isReply;

  return (
    <article
      aria-label={`${accepted ? 'Réponse acceptée' : isReply ? 'Réponse' : 'Commentaire'} de ${author}`}
      className={cn(!isReply && 'rounded-xl border bg-white p-5', !isReply && (accepted ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200'))}
    >
      {accepted && (
        <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
          <CircleCheck className="size-4" /> Réponse acceptée par l’auteur de la question
        </p>
      )}
      <header className="flex items-center gap-3">
        <Avatar className={isReply ? 'size-8' : 'size-10'}>
          {c.author.avatar && <AvatarImage src={c.author.avatar} alt="" />}
          <AvatarFallback className="bg-blue-50 text-xs font-semibold text-blue-900">{nameInitials(author)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{author}</p>
          <p className="text-xs text-slate-500">
            <time dateTime={c.created_at}>{c.created_at ? ago(c.created_at) : ''}</time>
          </p>
        </div>
      </header>

      <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-slate-700">{plain(c.content)}</p>

      <footer className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
        <button
          type="button"
          onClick={() => page.likeComment(c)}
          disabled={!page.isMember}
          aria-pressed={liked}
          aria-label={`${liked ? 'Retirer mon j’aime' : 'J’aime'} (${author})`}
          title={page.isMember ? undefined : 'Réservé aux membres'}
          className={cn('flex items-center gap-1.5 disabled:cursor-not-allowed', liked ? 'font-semibold text-blue-900' : 'hover:text-slate-900')}
        >
          <ThumbsUp className="size-4" /> {c.reactions_count}
        </button>
        {!isReply && page.canComment && (
          <button type="button" onClick={() => setReplying((v) => !v)} aria-expanded={replying} className="hover:text-slate-900">
            Répondre
          </button>
        )}
        {page.canDelete(c) && (
          <button type="button" onClick={() => onDelete(c)} className="flex items-center gap-1 text-slate-500 hover:text-red-600">
            <Trash2 className="size-3.5" /> Supprimer
          </button>
        )}
        {page.canAccept(c) && (
          <Button size="sm" variant="outline" className="ml-auto border-emerald-300 text-emerald-700 hover:bg-emerald-50" isLoading={page.isAccepting} onClick={() => page.accept(c)}>
            <CircleCheck /> Accepter cette réponse
          </Button>
        )}
      </footer>

      {!isReply && (c.replies.length > 0 || replying) && (
        <ul className="mt-4 space-y-4 border-l-2 border-slate-100 pl-4" aria-label={`Réponses à ${author}`}>
          {c.replies.map((r) => (
            <li key={r.id}>
              <CommentItem comment={r} page={page} onDelete={onDelete} isReply />
            </li>
          ))}
          {replying && (
            <li className="flex gap-2">
              <CornerDownRight className="mt-8 size-4 shrink-0 text-slate-400" aria-hidden />
              <div className="flex-1">
                <CommentForm
                  label={`Répondre à ${author}`}
                  placeholder="Votre réponse…"
                  submitLabel="Envoyer"
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
