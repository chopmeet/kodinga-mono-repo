import { Heart, MessageCircle, Pin } from 'lucide-react';

import { Avatar, AvatarFallback } from '@kodinga-mono-repo/ui';
import type { CommunityDetails } from '@/data/community.data';
import { JoinButton } from './community-sidebar';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function FeedTab({ community }: { community: CommunityDetails }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="flex-1 text-sm text-slate-500">Rejoignez la communauté pour publier et commenter.</p>
        <JoinButton community={community} className="w-auto" />
      </div>

      {community.posts.map((post) => (
        <article key={post.id} className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm">
          <header className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarFallback className="text-xs">{initials(post.author)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{post.author}</p>
              <p className="text-xs text-slate-500">
                {post.city} • {post.postedAt} • <span className="text-slate-700">{post.category}</span>
              </p>
            </div>
            {post.pinned && (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                <Pin className="size-3" /> Épinglé
              </span>
            )}
          </header>

          <h3 className="mt-3 font-bold text-slate-900">{post.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{post.excerpt}</p>

          <footer className="mt-4 flex items-center gap-5 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-1.5">
              <Heart className="size-4" /> {post.likes}
            </span>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="size-4" /> {post.comments} commentaires
            </span>
          </footer>
        </article>
      ))}
    </div>
  );
}
