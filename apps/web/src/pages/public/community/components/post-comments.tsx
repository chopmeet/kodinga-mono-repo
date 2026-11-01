import { Lock, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@kodinga-mono-repo/ui';
import type { CommunityPostItem, PostComment } from '@/utils/api/community/community.type';
import type { CommunityPage } from '../form/UseCommunityPage';
import UsePostComments from '../form/UsePostComments';
import { CommentForm } from '../post/comment-form';
import { CommentItem } from '../post/comment-item';
import { DeleteCommentDialog } from '../post/delete-comment-dialog';

/** Shown at first, then 10 more at each click */
const FIRST = 3;
const MORE = 10;

/**
 * Comments under a card of the feed, LinkedIn way: the field to comment, the first comments, the
 * others on demand. Everything happens in the feed (no page change, the scroll stays where it is).
 */
export function PostComments({ post, page }: { post: CommunityPostItem; page: CommunityPage }) {
  const comments = UsePostComments({ post, isMember: page.membership === 'member', role: page.role });
  const [shown, setShown] = useState(FIRST);
  const [toDelete, setToDelete] = useState<PostComment | null>(null);
  const isQuestion = post.post_type === 'question';
  const noun = isQuestion ? 'réponse' : 'commentaire';
  const list = comments.comments;
  const rest = list.length - shown;

  return (
    <section aria-label={`${isQuestion ? 'Réponses' : 'Commentaires'} de la publication`} className="mt-4 flex flex-col gap-4 border-t border-slate-100 pt-4">
      {comments.canComment ? (
        <CommentForm
          label={isQuestion ? 'Votre réponse' : 'Votre commentaire'}
          placeholder={isQuestion ? 'Partagez une solution, un lien, un extrait de code…' : 'Ajouter un commentaire…'}
          submitLabel="Publier"
          rows={2}
          onSend={(content) => comments.send(content)}
        />
      ) : post.is_locked ? (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Lock className="size-4" aria-hidden /> Les commentaires sont fermés sur cette publication.
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          {page.membership === 'visitor' ? (
            <>
              <Link to={page.loginUrl} className="font-semibold text-blue-900 hover:underline">
                Connectez-vous
              </Link>{' '}
              et rejoignez la communauté pour commenter.
            </>
          ) : (
            'Rejoignez la communauté pour commenter.'
          )}
        </p>
      )}

      {comments.isCommentsLoading ? (
        <p className="text-sm text-slate-500" role="status">
          Chargement des {noun}s…
        </p>
      ) : comments.commentsError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p role="alert" className="text-red-700">
            {comments.commentsError}
          </p>
          <Button variant="outline" size="sm" onClick={() => comments.retryComments()}>
            <RotateCw /> Réessayer
          </Button>
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-500">{isQuestion ? 'Pas encore de réponse : soyez le premier à aider !' : 'Pas encore de commentaire.'}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3" aria-label={isQuestion ? 'Réponses' : 'Commentaires'}>
            {list.slice(0, shown).map((c) => (
              <li key={c.id}>
                <CommentItem comment={c} page={comments} onDelete={setToDelete} />
              </li>
            ))}
          </ul>
          {rest > 0 && (
            <button type="button" onClick={() => setShown((n) => n + MORE)} className="self-start text-sm font-semibold text-blue-900 hover:underline">
              Voir {Math.min(rest, MORE)} {noun}
              {Math.min(rest, MORE) > 1 ? 's' : ''} de plus ({rest} restant{rest > 1 ? 's' : ''})
            </button>
          )}
        </>
      )}

      <DeleteCommentDialog comment={toDelete} onClose={() => setToDelete(null)} onDelete={comments.remove} />
    </section>
  );
}
