import { Heart, MessageCircle, MessagesSquare, Pin } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback, Button } from '@kodinga-mono-repo/ui';
import { postTypeLabel } from '@/pages/shared/community-labels';
import { useGetCommunityFeedQuery } from '@/utils/api/community/community.api';
import { getName, nameInitials } from '@/utils/Utils';
import type { CommunityPage } from '../form/UseCommunityPage';
import { MembershipActions } from './community-sidebar';
import { LockedPanel } from './locked-panel';

const PAGE_SIZE = 10;
const when = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** First lines of a Markdown post, as plain text */
const excerpt = (content: string) => {
  const text = content.replace(/[#*_`>[\]]/g, '').replace(/\s+/g, ' ').trim();
  return text.length > 280 ? `${text.slice(0, 280)}…` : text;
};

/** Feed of the community (GET communities/<slug>/feed/, pinned posts first) */
export function FeedTab({ page }: { page: CommunityPage }) {
  const [count, setCount] = useState(PAGE_SIZE);
  const { data, isLoading, isFetching } = useGetCommunityFeedQuery({ slug: page.slug, page: 1, page_size: count }, { skip: !page.canSee });

  if (!page.canSee) {
    return <LockedPanel page={page}>Rejoignez la communauté pour lire les échanges, publier et commenter.</LockedPanel>;
  }
  if (isLoading) return <p className="py-12 text-center text-sm text-slate-500">Chargement du fil…</p>;

  const posts = data?.results ?? [];
  const total = data?.pagination.count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {page.membership !== 'member' && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex-1 text-sm text-slate-500">Rejoignez la communauté pour publier et commenter.</p>
          {page.community?.pricing_type !== 'paid' && <MembershipActions page={page} className="w-auto sm:w-48" />}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
          <MessagesSquare className="size-8 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900">Pas encore de publication</p>
          <p className="mt-1 text-sm text-slate-500">Les premiers échanges apparaîtront ici.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4" aria-label="Publications">
          {posts.map((post) => {
            const author = getName(post.author) || post.author.username;
            return (
              <li key={post.id}>
                <article className="rounded-xl border border-slate-200 bg-white p-5">
                  <header className="flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback className="text-xs">{nameInitials(author)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{author}</p>
                      <p className="text-xs text-slate-500">
                        {when.format(new Date(post.created_at))} • <span className="text-slate-700">{postTypeLabel[post.post_type]}</span>
                      </p>
                    </div>
                    {post.is_pinned && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        <Pin className="size-3" /> Épinglé
                      </span>
                    )}
                  </header>

                  {post.title && <h3 className="mt-3 font-bold text-slate-900">{post.title}</h3>}
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{excerpt(post.content)}</p>

                  <footer className="mt-4 flex items-center gap-5 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Heart className="size-4" /> {post.reactions_count}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MessageCircle className="size-4" /> {post.comments_count} commentaire{post.comments_count > 1 ? 's' : ''}
                    </span>
                  </footer>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {posts.length < total && (
        <Button variant="outline" className="self-center" isLoading={isFetching} onClick={() => setCount((n) => n + PAGE_SIZE)}>
          Afficher plus
        </Button>
      )}
    </div>
  );
}
