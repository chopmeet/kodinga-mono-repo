import { ArrowUpRight, BadgeCheck, Lock, Star, Users } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

import { CommunityAvatar } from '@/pages/shared/community-avatar';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import type { CommunityListItem } from '@/utils/api/community/community.type';
import { formatCompact } from '@/utils/Utils';

/** Free + public: join right away. Paid: subscription. Private / secret: the request is reviewed */
function accessOf(community: CommunityListItem) {
  if (community.pricing_type === 'paid') return { label: 'Payante', className: 'border-slate-200 bg-slate-50 text-slate-700' };
  if (community.privacy_type !== 'public') return { label: 'Sur demande', className: 'border-amber-200 bg-amber-50 text-amber-800' };
  return { label: 'Accès gratuit', className: 'border-blue-100 bg-blue-50 text-blue-800' };
}

export function CommunityCard({ community }: { community: CommunityListItem }) {
  const access = accessOf(community);
  const href = `/communities/${community.slug}`;
  const isPrivate = community.privacy_type !== 'public';
  const tags = [community.category?.name, community.pricing_type === 'paid' ? 'Payante' : 'Gratuite'].filter(Boolean) as string[];

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs transition-all hover:border-slate-300 hover:shadow-md">
      <div className="relative h-52 w-full overflow-hidden">
        {community.banner_url ? (
          <img
            src={community.banner_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <GlassBackdrop fade={false} />
        )}
        <div className="relative flex items-start justify-between gap-2 p-4">
          <span className="flex items-center gap-1.5 rounded-md bg-white/95 px-2.5 py-1 text-xs font-semibold tracking-wide text-slate-700 uppercase shadow-2xs">
            {isPrivate ? <Lock className="size-3.5" /> : <Users className="size-3.5" />}
            {isPrivate ? 'Privée' : 'Communauté'}
          </span>
          {community.is_featured && (
            <span className="flex shrink-0 items-center gap-1 rounded-md bg-amber-400/95 px-2 py-1 text-xs font-semibold text-amber-950">
              <Star className="size-3.5" />À la une
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <CommunityAvatar community={community} className="size-12 rounded-lg text-base" />
          <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ${access.className}`}>{access.label}</span>
        </div>

        <h3 className="mt-4 flex items-center gap-1.5 text-xl leading-tight font-bold text-slate-900">
          {/* Stretched link: the whole card opens the community */}
          <Link to={href} className="after:absolute after:inset-0 group-hover:text-primary">
            {community.name}
          </Link>
          {community.is_verified && <BadgeCheck className="size-5 shrink-0 text-primary" aria-label="Communauté vérifiée" />}
        </h3>
        {community.tagline && <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-slate-600">{community.tagline}</p>}

        {tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Keeps the footers aligned on a row of cards */}
        <div className="flex-1" />
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
          <span className="flex items-center gap-2 text-slate-600">
            <Users className="size-4.5 text-slate-500" />
            {formatCompact(community.members_count)} membre{community.members_count > 1 ? 's' : ''}
          </span>
          <NavLink
            to={href}
            className="relative z-10 flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-slate-900 transition-colors hover:text-primary"
          >
            {community.is_member ? 'Ouvrir' : 'Découvrir'}
            <ArrowUpRight className="size-4.5" />
          </NavLink>
        </div>
      </div>
    </article>
  );
}

/** `count` placeholders with the shape of a CommunityCard, shown while the directory loads */
export function CommunityCardSkeleton({ count = 4 }: { count?: number }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-hidden>
      <div className="h-52 animate-pulse bg-slate-100" />
      <div className="space-y-4 p-6">
        <div className="size-12 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  ));
}
