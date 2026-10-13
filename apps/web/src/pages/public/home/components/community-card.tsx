import { BadgeCheck, Star, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { CommunityAvatar } from '@/pages/shared/community-avatar';
import type { CommunityListItem } from '@/utils/api/community/community.type';
import { formatCompact } from '@/utils/Utils';

type Access = { label: string; className: string; cta: string };

/** Free + public: join right away. Paid: subscription. Private / secret: the request is reviewed */
function accessOf(community: CommunityListItem): Access {
  if (community.pricing_type === 'paid') {
    return { label: 'PAYANT', className: 'text-slate-700 bg-slate-100 border-slate-200', cta: 'Rejoindre' };
  }
  if (community.privacy_type !== 'public') {
    return { label: 'SUR DEMANDE', className: 'text-amber-800 bg-amber-50 border-amber-200', cta: 'Postuler' };
  }
  return { label: 'GRATUIT', className: 'text-emerald-800 bg-emerald-50 border-emerald-200', cta: 'Rejoindre' };
}

export function CommunityCard({ community }: { community: CommunityListItem }) {
  const access = accessOf(community);
  const color = community.brand_color || '#1D4ED8';
  const href = `/communities/${community.slug}`;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md">
      {/* The community color shows behind the banner (and replaces it when there is none) */}
      <div className="relative h-36 w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}>
        {community.banner_url && (
          <img
            src={community.banner_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-b from-black/40 via-black/0 to-black/0" />
        <div className="relative flex items-start justify-between gap-2 p-3">
          <span className="truncate rounded border border-white/20 bg-black/40 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-white uppercase backdrop-blur-md">
            {community.category?.name ?? 'Communauté'}
          </span>
          {community.is_featured && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-semibold text-amber-950">
              <Star className="size-3" />À la une
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <CommunityAvatar community={community} className="size-11 rounded-xl font-mono text-base" />
            <span className={`rounded border px-2 py-0.5 font-mono text-xs font-semibold ${access.className}`}>{access.label}</span>
          </div>

          <h3 className="flex items-center gap-1.5 text-base leading-tight font-bold text-slate-900 transition-colors group-hover:text-brand">
            {/* Stretched link: the whole card opens the community */}
            <Link to={href} className="after:absolute after:inset-0">
              {community.name}
            </Link>
            {community.is_verified && <BadgeCheck className="size-4 shrink-0 text-brand" aria-label="Communauté vérifiée" />}
          </h3>
          {community.tagline && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{community.tagline}</p>}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-slate-500">
            <Users className="size-4 text-slate-400" />
            <span>
              {formatCompact(community.members_count)} membre{community.members_count > 1 ? 's' : ''}
            </span>
          </div>
          <Link
            to={href}
            className="relative z-10 rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 transition-colors hover:bg-brand hover:text-white"
          >
            {community.is_member ? 'Ouvrir' : access.cta}
          </Link>
        </div>
      </div>
    </article>
  );
}

/** `count` placeholders with the shape of a CommunityCard, shown while the directory loads */
export function CommunityCardSkeleton({ count = 6 }: { count?: number }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-hidden>
      <div className="h-36 animate-pulse bg-slate-100" />
      <div className="space-y-3 p-4">
        <div className="size-11 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  ));
}
