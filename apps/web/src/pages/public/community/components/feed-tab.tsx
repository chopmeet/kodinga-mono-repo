import { Bookmark, CircleCheck, MessageCircle, MessagesSquare, PenLine, Pin, Search, SlidersHorizontal, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage, Button, cn, customToast } from '@kodinga-mono-repo/ui';
import PostFormModal from '@/pages/community-space/posts/modals/post-form-modal';
import { postTypeLabel } from '@/pages/shared/community-labels';
import { useGetCommunityFeedQuery, useTogglePostLikeMutation } from '@/utils/api/community/community.api';
import type { CommunityPostItem, PostType } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { useDebounced } from '@/utils/hooks/useDebounced';
import { getName, nameInitials, useUser } from '@/utils/Utils';
import type { CommunityPage } from '../form/UseCommunityPage';
import { MembershipActions } from './community-sidebar';
import { LockedPanel } from './locked-panel';
import { PollCard } from './poll-card';
import { ago, plain, postHref } from './post-format';
import { Pill } from './section-header';

const PAGE_SIZE = 10;
const FILTERS: { id: PostType | 'all'; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'announcement', label: 'Annonces' },
  { id: 'discussion', label: 'Discussions' },
  { id: 'question', label: 'Questions' },
  { id: 'project_showcase', label: 'Projets' },
  { id: 'poll', label: 'Sondages' },
];

function PostCard({ post, canReact, href }: { post: CommunityPostItem; canReact: boolean; href: string }) {
  const [toggleLike, { isLoading }] = useTogglePostLikeMutation();
  const [expanded, setExpanded] = useState(false);
  const author = getName(post.author) || post.author.username;
  const liked = !!post.user_reactions?.includes('like');
  const text = plain(post.content);
  const long = text.length > 420;

  const like = async () => {
    try {
      await toggleLike(post.id).unwrap();
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-7">
      {post.is_pinned && (
        <p className="mb-4 flex items-center gap-1.5 text-xs font-medium text-blue-900">
          <Pin className="size-3.5" /> Épinglé par l’équipe
        </p>
      )}
      <header className="flex items-center gap-3">
        <Avatar className="size-12">
          {post.author.avatar && <AvatarImage src={post.author.avatar} alt="" />}
          <AvatarFallback className="bg-blue-50 font-semibold text-blue-900">{nameInitials(author)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{author}</p>
          <p className="text-xs text-slate-500">
            <time dateTime={post.created_at}>{ago(post.created_at)}</time> · {postTypeLabel[post.post_type]}
          </p>
        </div>
        <button type="button" disabled title="Enregistrer : bientôt disponible" aria-label="Enregistrer (bientôt disponible)" className="cursor-not-allowed p-1 text-slate-400">
          <Bookmark className="size-5" />
        </button>
      </header>

      {post.title && (
        <h3 className="mt-6 text-xl font-medium text-slate-900">
          <Link to={href} className="hover:text-blue-900">
            {post.title}
          </Link>
        </h3>
      )}
      <p className={cn('leading-relaxed whitespace-pre-line text-slate-700', post.title ? 'mt-3' : 'mt-5')}>
        {expanded || !long ? text : `${text.slice(0, 420)}…`}
      </p>
      {long && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-sm font-semibold text-blue-900 hover:underline">
          {expanded ? 'Réduire' : 'Lire la suite'}
        </button>
      )}
      {post.poll && <PollCard postId={post.id} poll={post.poll} canVote={canReact} />}
      {post.code_snippet && (
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
          <code>{post.code_snippet}</code>
        </pre>
      )}

      <footer className="mt-6 flex items-center gap-6 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <button
          type="button"
          onClick={like}
          disabled={!canReact || isLoading}
          aria-pressed={liked}
          aria-label={liked ? 'Retirer mon j’aime' : 'J’aime'}
          title={canReact ? undefined : 'Réservé aux membres'}
          className={cn('flex items-center gap-2 rounded-md px-2 py-1 transition-colors disabled:cursor-not-allowed', liked ? 'font-semibold text-blue-900' : 'hover:text-slate-900')}
        >
          <ThumbsUp className={cn('size-5', liked && 'fill-blue-900/15')} /> {post.reactions_count}
        </button>
        <Link to={href} className="flex items-center gap-2 hover:text-slate-900">
          <MessageCircle className="size-5" />
          {post.post_type === 'question'
            ? `${post.comments_count} réponse${post.comments_count > 1 ? 's' : ''}`
            : `${post.comments_count} commentaire${post.comments_count > 1 ? 's' : ''}`}
        </Link>
        {post.post_type === 'question' && post.is_resolved && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            <CircleCheck className="size-3.5" /> Résolue
          </span>
        )}
        {post.is_locked && <span className="ml-auto text-xs text-slate-500">Commentaires fermés</span>}
      </footer>
    </article>
  );
}

/** Feed of the community (GET communities/<slug>/feed/, pinned posts first) */
export function FeedTab({ page }: { page: CommunityPage }) {
  const user = useUser();
  const [type, setType] = useState<PostType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [count, setCount] = useState(PAGE_SIZE);
  const [writing, setWriting] = useState(false);
  const q = useDebounced(search.trim(), 300);
  const isMember = page.membership === 'member';

  const { data, isLoading, isFetching } = useGetCommunityFeedQuery(
    { slug: page.slug, type: type === 'all' ? undefined : type, q: q || undefined, page: 1, page_size: count },
    { skip: !page.canSee },
  );

  if (!page.canSee) {
    return <LockedPanel page={page}>Rejoignez la communauté pour lire les échanges, publier et commenter.</LockedPanel>;
  }

  const posts = data?.results ?? [];
  const total = data?.pagination.count ?? 0;
  const me = getName(user) || user?.username || '';

  return (
    <div className="flex flex-col gap-6">
      {isMember ? (
        <button
          type="button"
          onClick={() => setWriting(true)}
          className="flex items-center gap-5 rounded-xl border border-slate-200 bg-white px-5 py-5 text-left shadow-2xs hover:border-slate-300"
        >
          <Avatar className="size-12">
            <AvatarFallback className="bg-blue-50 font-semibold text-blue-900">{nameInitials(me)}</AvatarFallback>
          </Avatar>
          <span className="flex-1 text-slate-700">Une question, une idée, un projet ?</span>
          <PenLine className="size-5 text-slate-600" aria-hidden />
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
          <p className="flex-1 text-sm text-slate-500">Rejoignez la communauté pour publier et commenter.</p>
          {page.community?.pricing_type !== 'paid' && <MembershipActions page={page} className="w-full sm:w-auto" />}
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par type">
        {FILTERS.map((f) => (
          <Pill
            key={f.id}
            active={type === f.id}
            onClick={() => {
              setType(f.id);
              setCount(PAGE_SIZE);
            }}
          >
            {f.label}
          </Pill>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Phones: the search takes the whole row, the sort goes under it */}
        <label className="relative min-w-0 flex-1 basis-full sm:basis-0">
          <span className="sr-only">Rechercher une discussion</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCount(PAGE_SIZE);
            }}
            placeholder="Rechercher une discussion…"
            className="h-12 w-full rounded-lg border border-slate-200 bg-white pr-4 pl-11 text-sm text-slate-800 placeholder:text-slate-400"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <SlidersHorizontal className="size-4" aria-hidden />
          {/* The api serves the feed by date (pinned first) */}
          <select aria-label="Trier les publications" defaultValue="recent" className="h-12 rounded-lg bg-transparent pr-2 font-medium">
            <option value="recent">Récentes</option>
            <option value="popular" disabled>
              Populaires (bientôt)
            </option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Chargement du fil…</p>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <MessagesSquare className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">{q || type !== 'all' ? 'Aucune publication ne correspond' : 'Pas encore de publication'}</p>
          <p className="mt-1 text-sm text-slate-500">{isMember ? 'Lancez la première discussion !' : 'Les premiers échanges apparaîtront ici.'}</p>
        </div>
      ) : (
        <ul className={cn('flex flex-col gap-6', isFetching && 'opacity-70 transition-opacity')} aria-label="Publications">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} canReact={isMember} href={postHref(page.slug, post.id)} />
            </li>
          ))}
        </ul>
      )}

      {posts.length < total && (
        <Button variant="outline" className="self-center" isLoading={isFetching} onClick={() => setCount((n) => n + PAGE_SIZE)}>
          Afficher plus
        </Button>
      )}

      {isMember && (
        <PostFormModal slug={page.slug} open={writing} post={null} defaultType={page.isTeam ? 'announcement' : 'discussion'} onClose={() => setWriting(false)} />
      )}
    </div>
  );
}
