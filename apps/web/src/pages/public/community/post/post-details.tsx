import { ArrowLeft, CircleCheck, LoaderCircle, Lock, MessageCircle, Pin, ThumbsUp, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kodinga-mono-repo/ui';
import { CommunityAvatar } from '@/pages/shared/community-avatar';
import { postTypeLabel } from '@/pages/shared/community-labels';
import type { CommunityPostItem, PostComment } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { ago, getName, nameInitials, plain } from '@/utils/Utils';
import { PollCard } from '../components/poll-card';
import UsePostDetails, { type PostDetailsPage } from '../form/UsePostDetails';
import { CommentForm } from './comment-form';
import { CommentItem } from './comment-item';

function PostArticle({ post, page }: { post: CommunityPostItem; page: PostDetailsPage }) {
  const author = getName(post.author) || post.author.username;
  const liked = !!post.user_reactions?.includes('like');
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-7">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium">
        {post.is_pinned && (
          <span className="flex items-center gap-1.5 text-blue-900">
            <Pin className="size-3.5" /> Épinglé par l’équipe
          </span>
        )}
        {page.isQuestion && post.is_resolved && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
            <CircleCheck className="size-3.5" /> Question résolue
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
      {post.code_snippet && (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
          {post.code_language && <span className="mb-2 block text-xs text-slate-400">{post.code_language}</span>}
          <code>{post.code_snippet}</code>
        </pre>
      )}
      {post.poll && <PollCard postId={post.id} poll={post.poll} canVote={page.isMember} />}

      <footer className="mt-6 flex items-center gap-6 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <button
          type="button"
          onClick={page.likePost}
          disabled={!page.isMember || page.isLiking}
          aria-pressed={liked}
          aria-label={liked ? 'Retirer mon j’aime' : 'J’aime'}
          title={page.isMember ? undefined : 'Réservé aux membres'}
          className={cn('flex items-center gap-2 disabled:cursor-not-allowed', liked ? 'font-semibold text-blue-900' : 'hover:text-slate-900')}
        >
          <ThumbsUp className="size-5" /> {post.reactions_count}
        </button>
        <span className="flex items-center gap-2">
          <MessageCircle className="size-5" /> {post.comments_count}
        </span>
      </footer>
    </article>
  );
}

/** /communities/:slug/posts/:postId — one post, its answers and the accepted one */
function PostDetails() {
  const page = UsePostDetails();
  const { community, post, comments, slug } = page;
  const [toDelete, setToDelete] = useState<PostComment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const back = `/communities/${slug}?tab=feed`;

  if (page.isLoading) {
    return (
      <p className="flex items-center justify-center gap-2 py-24 text-slate-600" role="status">
        <LoaderCircle className="size-5 animate-spin text-brand" /> Chargement de la publication…
      </p>
    );
  }

  if (community && !page.canSee) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <Lock className="size-8 text-slate-400" />
        <h1 className="text-2xl font-bold text-slate-900">Réservé aux membres</h1>
        <p className="text-slate-500">Rejoignez {community.name} pour lire et répondre aux publications.</p>
        <Button asChild>
          <Link to={`/communities/${slug}`}>Découvrir la communauté</Link>
        </Button>
      </section>
    );
  }

  if (!post || !community || page.notFound) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{page.notFound || !page.error ? 'Publication introuvable' : 'Impossible de charger la publication'}</h1>
        <p className="text-slate-500">{page.notFound || !page.error ? 'Elle a peut-être été supprimée.' : parseApiError(page.error).message}</p>
        <Button asChild variant="outline">
          <Link to={community ? back : '/'}>{community ? 'Retour au fil' : 'Découvrir les communautés'}</Link>
        </Button>
      </section>
    );
  }

  const noun = page.isQuestion ? 'réponse' : 'commentaire';
  const count = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <div className="min-h-full bg-slate-50/60">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link to={back} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="size-4" /> Retour au fil
          </Link>
          <Link to={`/communities/${slug}`} className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
            <CommunityAvatar community={community} className="size-7 rounded-md text-[10px]" />
            {community.name}
          </Link>
        </div>

        <PostArticle post={post} page={page} />

        <section aria-labelledby="answers-title" className="mt-8">
          <h2 id="answers-title" className="text-lg font-semibold text-slate-900">
            {count} {noun}
            {count > 1 ? 's' : ''}
          </h2>
          {page.isQuestion && !post.is_resolved && post.author && page.isMember && (
            <p className="mt-1 text-sm text-slate-500">L’auteur de la question peut accepter la réponse qui l’a aidé.</p>
          )}

          <div className="mt-4">
            {page.canComment ? (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <CommentForm
                  label={page.isQuestion ? 'Votre réponse' : 'Votre commentaire'}
                  placeholder={page.isQuestion ? 'Partagez une solution, un lien, un extrait de code…' : 'Réagissez, posez une question…'}
                  submitLabel="Publier"
                  isSending={page.isSending}
                  onSend={(content) => page.send(content)}
                />
              </div>
            ) : post.is_locked ? (
              <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <Lock className="size-4" /> Les commentaires sont fermés sur cette publication.
              </p>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                {page.membership === 'visitor' ? (
                  <>
                    <Link to={page.loginUrl} className="font-semibold text-blue-900 hover:underline">
                      Connectez-vous
                    </Link>{' '}
                    et rejoignez la communauté pour répondre.
                  </>
                ) : (
                  <>
                    <Link to={`/communities/${slug}`} className="font-semibold text-blue-900 hover:underline">
                      Rejoignez {community.name}
                    </Link>{' '}
                    pour répondre.
                  </>
                )}
              </p>
            )}
          </div>

          {page.isCommentsLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Chargement des {noun}s…</p>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{page.isQuestion ? 'Pas encore de réponse : soyez le premier à aider !' : 'Pas encore de commentaire.'}</p>
          ) : (
            <ul className="mt-6 flex flex-col gap-4" aria-label={page.isQuestion ? 'Réponses' : 'Commentaires'}>
              {comments.map((c) => (
                <li key={c.id}>
                  <CommentItem comment={c} page={page} onDelete={setToDelete} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={!!toDelete} onOpenChange={(open) => !open && !isDeleting && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce commentaire ?</DialogTitle>
            <DialogDescription>Ses réponses seront supprimées avec lui.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={isDeleting}>
              Annuler
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              onClick={async () => {
                if (!toDelete) return;
                setIsDeleting(true);
                const ok = await page.remove(toDelete);
                setIsDeleting(false);
                if (ok) setToDelete(null);
              }}
            >
              <Trash2 /> Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PostDetails;
