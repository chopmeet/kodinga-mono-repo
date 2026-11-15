import { Bookmark, CircleCheck, LoaderCircle, MessageCircle, MessagesSquare, PenLine, Pin, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Avatar, AvatarFallback, AvatarImage, Button, cn, customToast } from '@kodinga/ui';
import PostFormModal from '@/pages/community-space/posts/modals/post-form-modal';
import { WeeklyDigest } from '@/pages/shared/weekly-digest';
import { SemanticSearch } from './semantic-search';
import { CodeBlock } from '@/pages/shared/code-block';
import { useGetCommunityFeedQuery, useToggleBookmarkMutation, useTogglePostReactionMutation } from '@/utils/api/community/community.api';
import type { CommunityPostItem, PostType } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { useDebounced } from '@/utils/hooks/useDebounced';
import { ago, getName, nameInitials, plain, postHref, postTypeLabel, useUser } from '@/utils/Utils';
import type { CommunityPage } from '../form/UseCommunityPage';
import { MembershipActions } from './community-sidebar';
import { LockedPanel } from './locked-panel';
import { PollCard } from './poll-card';
import { PostComments } from './post-comments';
import { Pill } from './section-header';
import { useRealtime, useRealtimeCommunityFeed } from '@/utils/realtime/use-realtime';
import { PostMediaView } from './post-media';
import { ReactionBar } from './reaction-bar';

const PAGE_SIZE = 20;
// Labels: community.feed.filters.<id>
const FILTERS: (PostType | 'all')[] = ['all', 'announcement', 'discussion', 'question', 'project_showcase', 'poll'];

function PostCard({ post, canReact, href, page }: { post: CommunityPostItem; canReact: boolean; href: string; page: CommunityPage }) {
  const { t } = useTranslation();
  const [toggleReaction, { isLoading }] = useTogglePostReactionMutation();
  const [toggleBookmark, { isLoading: isSaving }] = useToggleBookmarkMutation();
  const signedIn = page.membership !== 'visitor';
  const [expanded, setExpanded] = useState(false);
  // The comments open under the card: no page change, the feed keeps its scroll
  const [showComments, setShowComments] = useState(false);
  const author = getName(post.author) || post.author.username;
  const text = plain(post.content);
  const long = text.length > 420;

  const react = async (reaction: string) => {
    try {
      await toggleReaction({ postId: post.id, reaction }).unwrap();
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  const save = async () => {
    try {
      await toggleBookmark(post.id).unwrap();
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return (
    <article className="rounded-xl border border-border bg-card p-7">
      {post.is_pinned && (
        <p className="mb-4 flex items-center gap-1.5 text-xs font-medium text-brand-strong">
          <Pin className="size-3.5" /> {t('community.feed.pinned')}
        </p>
      )}
      <header className="flex items-center gap-3">
        <Avatar className="size-12">
          {post.author.avatar && <AvatarImage src={post.author.avatar} alt="" />}
          <AvatarFallback className="bg-brand-subtle font-semibold text-brand-strong">{nameInitials(author)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{author}</p>
          <p className="text-xs text-muted-foreground">
            <time dateTime={post.created_at}>{ago(post.created_at)}</time> · {postTypeLabel[post.post_type]}
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!signedIn || isSaving}
          aria-pressed={!!post.is_bookmarked}
          aria-label={post.is_bookmarked ? t('community.feed.unsave') : t('community.feed.save')}
          title={signedIn ? undefined : t('community.feed.loginToSave')}
          className={cn('rounded-md p-1 transition-colors disabled:cursor-not-allowed disabled:text-slate-300', post.is_bookmarked ? 'text-brand-strong' : 'text-faint hover:text-body')}
        >
          <Bookmark className={cn('size-5', post.is_bookmarked && 'fill-brand-strong')} />
        </button>
      </header>

      {post.title && (
        <h3 className="mt-6 text-xl font-medium text-foreground">
          <Link to={href} className="hover:text-brand-strong">
            {post.title}
          </Link>
        </h3>
      )}
      <p className={cn('leading-relaxed whitespace-pre-line text-body', post.title ? 'mt-3' : 'mt-5')}>
        {expanded || !long ? text : `${text.slice(0, 420)}…`}
      </p>
      {long && (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-sm font-semibold text-brand-strong hover:underline">
          {expanded ? t('community.feed.less') : t('community.feed.readMore')}
        </button>
      )}
      <PostMediaView media={post.media} />
      {post.poll && <PollCard postId={post.id} poll={post.poll} canVote={canReact} />}
      {post.code_snippet && (
        <CodeBlock code={post.code_snippet} language={post.code_language} />
      )}

      <footer className="mt-6 flex items-center gap-6 border-t border-border pt-4 text-sm text-soft">
        <ReactionBar
          target={post}
          canReact={canReact}
          busy={isLoading}
          onToggle={react}
          likeLabel={(liked) => (liked ? t('community.feed.unlike') : t('community.feed.like'))}
        />
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          className={cn('flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:text-foreground', showComments && 'font-semibold text-brand-strong')}
        >
          <MessageCircle className="size-5" />
          {post.post_type === 'question'
            ? t('community.feed.answers', { count: post.comments_count })
            : t('community.feed.comments', { count: post.comments_count })}
        </button>
        {post.post_type === 'question' && post.is_resolved && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            <CircleCheck className="size-3.5" /> {t('community.feed.resolved')}
          </span>
        )}
        {post.is_locked && <span className="ml-auto text-xs text-muted-foreground">{t('community.feed.commentsClosed')}</span>}
      </footer>
      {showComments && <PostComments post={post} page={page} />}
    </article>
  );
}

/** Feed of the community (GET communities/<slug>/feed/, pinned posts first) */
export function FeedTab({ page }: { page: CommunityPage }) {
  const { t } = useTranslation();
  const { connected } = useRealtime();
  // New posts, reactions and comment counts of the others appear live
  useRealtimeCommunityFeed(page.canSee ? page.community?.id : undefined);
  const user = useUser();
  const [type, setType] = useState<PostType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [count, setCount] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [saved, setSaved] = useState(false);
  const [writing, setWriting] = useState(false);
  const q = useDebounced(search.trim(), 300);
  const isMember = page.membership === 'member';

  const { data, isLoading, isFetching } = useGetCommunityFeedQuery(
    {
      slug: page.slug,
      type: type === 'all' ? undefined : type,
      q: q || undefined,
      sort: sort === 'popular' ? 'popular' : undefined,
      bookmarked: saved || undefined,
      page: 1,
      page_size: count,
    },
    { skip: !page.canSee, pollingInterval: connected ? 0 : 30_000 },
  );

  const posts = data?.results ?? [];
  const total = data?.pagination.count ?? 0;
  const me = getName(user) || user?.username || '';
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll automatique sans restriction : charge la suite dès qu'on approche du bas de page
  useEffect(() => {
    if (!page.canSee) return;
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof window === 'undefined' || typeof (window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver !== 'function') {
      return;
    }

    const observer = new (window as unknown as { new(callback: IntersectionObserverCallback, options?: IntersectionObserverInit): IntersectionObserver }).IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && !isFetching && posts.length < total) {
          setCount((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isFetching, page.canSee, posts.length, total]);

  if (!page.canSee) {
    return <LockedPanel page={page}>{t('community.feed.locked')}</LockedPanel>;
  }

  // Tri : par défaut 'recent', le dernier post créé/publié se positionne en tête absolue
  const sortedPosts = [...posts].sort((a, b) => {
    if (sort === 'popular') {
      const popA = (a.reactions_count ?? 0) + (a.comments_count ?? 0);
      const popB = (b.reactions_count ?? 0) + (b.comments_count ?? 0);
      return popB - popA;
    }
    const timeA = new Date(a.created_at).getTime() || 0;
    const timeB = new Date(b.created_at).getTime() || 0;
    return timeB - timeA;
  });

  return (
    <div className="flex flex-col gap-6">
      {isMember && page.community && <WeeklyDigest slug={page.community.slug} />}
      {isMember ? (
        <button
          type="button"
          onClick={() => setWriting(true)}
          className="flex items-center gap-5 rounded-xl border border-border bg-card px-5 py-5 text-left shadow-2xs hover:border-border-strong"
        >
          <Avatar className="size-12">
            <AvatarFallback className="bg-brand-subtle font-semibold text-brand-strong">{nameInitials(me)}</AvatarFallback>
          </Avatar>
          <span className="flex-1 text-body">{t('community.feed.composer')}</span>
          <PenLine className="size-5 text-soft" aria-hidden />
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-5">
          <p className="flex-1 text-sm text-muted-foreground">{t('community.feed.joinToPost')}</p>
          {page.community?.pricing_type !== 'paid' && <MembershipActions page={page} className="w-full sm:w-auto" />}
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('community.feed.filterLabel')}>
        {FILTERS.map((f) => (
          <Pill
            key={f}
            active={type === f}
            onClick={() => {
              setType(f);
              setCount(PAGE_SIZE);
            }}
          >
            {t(`community.feed.filters.${f}`)}
          </Pill>
        ))}
        {page.membership !== 'visitor' && (
          <Pill
            active={saved}
            onClick={() => {
              setSaved((v) => !v);
              setCount(PAGE_SIZE);
            }}
          >
            <Bookmark className="size-4" aria-hidden /> {t('community.feed.saved')}
          </Pill>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Phones: the search takes the whole row, the sort goes under it */}
        <label className="relative min-w-0 flex-1 basis-full sm:basis-0">
          <span className="sr-only">{t('community.feed.searchLabel')}</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCount(PAGE_SIZE);
            }}
            placeholder={t('community.feed.searchPlaceholder')}
            className="h-12 w-full rounded-lg border border-border bg-card pr-4 pl-11 text-sm text-foreground placeholder:text-faint"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-body">
          <SlidersHorizontal className="size-4" aria-hidden />
          <select
            aria-label={t('community.feed.sortLabel')}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as 'recent' | 'popular');
              setCount(PAGE_SIZE);
            }}
            className="h-12 rounded-lg bg-transparent pr-2 font-medium"
          >
            <option value="recent">{t('community.feed.recent')}</option>
            <option value="popular">{t('community.feed.popular')}</option>
          </select>
        </label>
      </div>

      {isMember && <SemanticSearch slug={page.slug} query={search} />}

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('community.feed.loading')}</p>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-12 text-center">
          <MessagesSquare className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-foreground">{saved && !q && type === 'all' ? t('community.feed.noSaved') : q || type !== 'all' || saved ? t('community.feed.noMatch') : t('community.feed.noPost')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{saved ? t('community.feed.savedHint') : isMember ? t('community.feed.firstDiscussion') : t('community.feed.firstExchanges')}</p>
        </div>
      ) : (
        <ul className={cn('flex flex-col gap-6', isFetching && 'opacity-70 transition-opacity')} aria-label={t('community.feed.postsLabel')}>
          {sortedPosts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} canReact={isMember} href={postHref(page.slug, post.id)} page={page} />
            </li>
          ))}
        </ul>
      )}

      {/* Sentinelle invisible pour le déclenchement de l'infinite scroll automatique */}
      <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />

      {isFetching && sortedPosts.length > 0 && (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="mr-2 size-5 animate-spin text-brand-strong" />
          <span>{t('community.feed.loadingMore', 'Chargement des publications suivantes…')}</span>
        </div>
      )}

      {!isFetching && sortedPosts.length >= total && total > 0 && (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {t('community.feed.allLoaded', 'Toutes les publications sont affichées')} ({total})
        </p>
      )}

      {/* Bouton de secours manuel pour l'accessibilité */}
      {sortedPosts.length < total && !isFetching && (
        <Button variant="outline" className="self-center" onClick={() => setCount((n) => n + PAGE_SIZE)}>
          {t('common.actions.showMore')}
        </Button>
      )}

      {isMember && (
        <PostFormModal slug={page.slug} open={writing} post={null} defaultType={page.isTeam ? 'announcement' : 'discussion'} onClose={() => setWriting(false)} />
      )}
    </div>
  );
}
