import { Lock, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@kodinga/ui';
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
  const { t } = useTranslation();
  const comments = UsePostComments({ post, isMember: page.membership === 'member', role: page.role });
  const [shown, setShown] = useState(FIRST);
  const [toDelete, setToDelete] = useState<PostComment | null>(null);
  const isQuestion = post.post_type === 'question';
  const list = comments.comments;
  const rest = list.length - shown;

  return (
    <section aria-label={isQuestion ? t('community.comments.sectionAnswers') : t('community.comments.sectionComments')} className="mt-4 flex flex-col gap-4 border-t border-slate-100 pt-4">
      {comments.canComment ? (
        <CommentForm
          label={isQuestion ? t('community.comments.yourAnswer') : t('community.comments.yourComment')}
          placeholder={isQuestion ? t('community.comments.answerPlaceholder') : t('community.comments.commentPlaceholder')}
          submitLabel={t('community.comments.publish')}
          rows={2}
          onSend={(content) => comments.send(content)}
        />
      ) : post.is_locked ? (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Lock className="size-4" aria-hidden /> {t('community.comments.closed')}
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          {page.membership === 'visitor' ? (
            <>
              <Link to={page.loginUrl} className="font-semibold text-blue-900 hover:underline">
                {t('community.comments.login')}
              </Link>{' '}
              {t('community.comments.loginThenJoin')}
            </>
          ) : (
            t('community.comments.joinToComment')
          )}
        </p>
      )}

      {comments.isCommentsLoading ? (
        <p className="text-sm text-slate-500" role="status">
          {isQuestion ? t('community.comments.loadingAnswers') : t('community.comments.loadingComments')}
        </p>
      ) : comments.commentsError ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p role="alert" className="text-red-700">
            {comments.commentsError}
          </p>
          <Button variant="outline" size="sm" onClick={() => comments.retryComments()}>
            <RotateCw /> {t('common.actions.retry')}
          </Button>
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-500">{isQuestion ? t('community.comments.noAnswer') : t('community.comments.noComment')}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3" aria-label={isQuestion ? t('community.comments.answers') : t('community.comments.comments')}>
            {list.slice(0, shown).map((c) => (
              <li key={c.id}>
                <CommentItem comment={c} page={comments} onDelete={setToDelete} />
              </li>
            ))}
          </ul>
          {rest > 0 && (
            <button type="button" onClick={() => setShown((n) => n + MORE)} className="self-start text-sm font-semibold text-blue-900 hover:underline">
              {t(isQuestion ? 'community.comments.moreAnswers' : 'community.comments.moreComments', { count: Math.min(rest, MORE), rest })}
            </button>
          )}
        </>
      )}

      <DeleteCommentDialog comment={toDelete} onClose={() => setToDelete(null)} onDelete={comments.remove} />
    </section>
  );
}
