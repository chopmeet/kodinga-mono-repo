import { ArrowLeft, CircleCheck, Lock, MessageCircle, Pin } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage, Button, cn, Loader } from '@kodinga/ui';
import { CodeBlock } from '@/pages/shared/code-block';
import { CommunityAvatar } from '@/pages/shared/community-avatar';
import type { CommunityPostItem, PostComment } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { ago, getName, nameInitials, plain, postTypeLabel, useUser } from '@/utils/Utils';
import { PollCard } from '../components/poll-card';
import UsePostDetails, { type PostDetailsPage } from '../form/UsePostDetails';
import { CommentForm } from './comment-form';
import { PostMediaView } from '../components/post-media';
import { ReactionBar } from '../components/reaction-bar';
import { CommentItem } from './comment-item';
import { DeleteCommentDialog } from './delete-comment-dialog';
import { HelpPanel } from './help-panel';

function PostArticle({ post, page }: { post: CommunityPostItem; page: PostDetailsPage }) {
  const { t } = useTranslation();
  const author = getName(post.author) || post.author.username;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-7">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium">
        {post.is_pinned && (
          <span className="flex items-center gap-1.5 text-blue-900">
            <Pin className="size-3.5" /> {t('community.post.pinned')}
          </span>
        )}
        {page.isQuestion && post.is_resolved && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
            <CircleCheck className="size-3.5" /> {t('community.post.resolved')}
          </span>
        )}
      </div>
      <header className="flex items-center gap-3">
        <Avatar className="size-12">
          {post.author.avatar && <AvatarImage src={post.author.avatar} alt="" />}
          <AvatarFallback className="bg-blue-50 font-semibold text-blue-900">{nameInitials(author)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{author}</p>
          <p className="text-xs text-slate-500">
            <time dateTime={post.created_at}>{ago(post.created_at)}</time> · {postTypeLabel[post.post_type]}
          </p>
        </div>
      </header>

      {post.title && <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">{post.title}</h1>}
      <p className={cn('leading-relaxed whitespace-pre-line text-slate-700', post.title ? 'mt-4' : 'mt-5')}>{plain(post.content)}</p>
      <PostMediaView media={post.media} />
      {post.code_snippet && (
        <CodeBlock code={post.code_snippet} language={post.code_language} />
      )}
      {post.poll && <PollCard postId={post.id} poll={post.poll} canVote={page.isMember} />}

      <footer className="mt-6 flex items-center gap-6 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <ReactionBar
          target={post}
          canReact={page.isMember}
          busy={page.isReacting}
          onToggle={page.reactPost}
          likeLabel={(liked) => (liked ? t('community.feed.unlike') : t('community.feed.like'))}
        />
        <span className="flex items-center gap-2">
          <MessageCircle className="size-5" /> {post.comments_count}
        </span>
      </footer>
    </article>
  );
}

/** /communities/:slug/posts/:postId — one post, its answers and the accepted one */
function PostDetails() {
  const { t } = useTranslation();
  const page = UsePostDetails();
  const { community, post, comments, slug } = page;
  const [toDelete, setToDelete] = useState<PostComment | null>(null);
  const me = useUser();
  const back = `/communities/${slug}?tab=feed`;

  if (page.isLoading) {
    return (
      <Loader inline className="py-24" message={t('community.post.loading')} />
    );
  }

  if (community && !page.canSee) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <Lock className="size-8 text-slate-400" />
        <h1 className="text-2xl font-bold text-slate-900">{t('community.post.membersOnly')}</h1>
        <p className="text-slate-500">{t('community.post.joinToRead', { name: community.name })}</p>
        <Button asChild>
          <Link to={`/communities/${slug}`}>{t('community.post.discoverCommunity')}</Link>
        </Button>
      </section>
    );
  }

  if (!post || !community || page.notFound) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{page.notFound || !page.error ? t('community.post.notFound') : t('community.post.loadFailed')}</h1>
        <p className="text-slate-500">{page.notFound || !page.error ? t('community.post.deleted') : parseApiError(page.error).message}</p>
        <Button asChild variant="outline">
          <Link to={community ? back : '/'}>{community ? t('community.post.backToFeed') : t('community.post.discoverCommunities')}</Link>
        </Button>
      </section>
    );
  }

  const count = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <div className="min-h-full bg-slate-50/60">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link to={back} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="size-4" /> {t('community.post.backToFeed')}
          </Link>
          <Link to={`/communities/${slug}`} className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
            <CommunityAvatar community={community} className="size-7 rounded-md text-[10px]" />
            {community.name}
          </Link>
        </div>

        <PostArticle post={post} page={page} />
        {/* The author and the team alone may ask mentors (the api writes the help at the first reading) */}
        {page.isQuestion && !post.is_resolved && page.isMember && (post.author.id === me?.id || ['owner', 'admin', 'moderator'].includes(community.user_membership?.role ?? '')) && (
          <HelpPanel postId={post.id} />
        )}

        <section aria-labelledby="answers-title" className="mt-8">
          <h2 id="answers-title" className="text-lg font-semibold text-slate-900">
            {page.isQuestion ? t('community.post.answers', { count }) : t('community.post.comments', { count })}
          </h2>
          {page.isQuestion && !post.is_resolved && post.author && page.isMember && (
            <p className="mt-1 text-sm text-slate-500">{t('community.post.authorCanAccept')}</p>
          )}

          <div className="mt-4">
            {page.canComment ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <CommentForm
                  label={page.isQuestion ? t('community.comments.yourAnswer') : t('community.comments.yourComment')}
                  placeholder={page.isQuestion ? t('community.comments.answerPlaceholder') : t('community.post.commentPlaceholder')}
                  submitLabel={t('community.comments.publish')}
                  isSending={page.isSending}
                  onSend={(content) => page.send(content)}
                />
              </div>
            ) : post.is_locked ? (
              <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <Lock className="size-4" /> {t('community.comments.closed')}
              </p>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                {page.membership === 'visitor' ? (
                  <>
                    <Link to={page.loginUrl} className="font-semibold text-blue-900 hover:underline">
                      {t('community.comments.login')}
                    </Link>{' '}
                    {t('community.post.loginThenJoin')}
                  </>
                ) : (
                  <>
                    <Link to={`/communities/${slug}`} className="font-semibold text-blue-900 hover:underline">
                      {t('community.post.join', { name: community.name })}
                    </Link>{' '}
                    {t('community.post.toAnswer')}
                  </>
                )}
              </p>
            )}
          </div>

          {page.isCommentsLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {page.isQuestion ? t('community.comments.loadingAnswers') : t('community.comments.loadingComments')}
            </p>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{page.isQuestion ? t('community.comments.noAnswer') : t('community.comments.noComment')}</p>
          ) : (
            <ul className="mt-6 flex flex-col gap-4" aria-label={page.isQuestion ? t('community.comments.answers') : t('community.comments.comments')}>
              {comments.map((c) => (
                <li key={c.id}>
                  <CommentItem comment={c} page={page} onDelete={setToDelete} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <DeleteCommentDialog comment={toDelete} onClose={() => setToDelete(null)} onDelete={page.remove} />
    </div>
  );
}

export default PostDetails;
