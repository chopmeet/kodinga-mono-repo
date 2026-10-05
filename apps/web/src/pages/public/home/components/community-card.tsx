import { Users } from 'lucide-react';

import { Link } from 'react-router-dom';

import type { Community } from '@/data/home.data';
import { formatCompact } from '@/utils/Utils';

const accessClassName: Record<Community['access']['kind'], string> = {
  free: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  paid: 'text-slate-700 bg-slate-100 border-slate-200',
  application: 'text-amber-800 bg-amber-50 border-amber-200',
};


export function CommunityCard({ community }: { community: Community }) {
  const { access } = community;
  const cta = community.cta ?? (access.kind === 'application' ? 'Postuler' : 'Rejoindre');

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md">
      {/* Gradient shows while the photo loads (or if it fails) */}
      <div className={`relative h-40 w-full overflow-hidden bg-linear-to-r ${community.coverClassName}`}>
        <img
          src={community.image}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Darkens the top so the badges stay readable on any photo */}
        <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/0 to-black/0" />
        <div className="relative flex items-start justify-between p-3">
          <span className="rounded border border-white/20 bg-black/40 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-white uppercase backdrop-blur-md">
            {community.badge}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            {community.online} en ligne
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl font-mono text-base font-bold ${community.avatarClassName}`}
            >
              {community.initials}
            </div>
            <span
              className={`rounded border px-2 py-0.5 font-mono text-xs font-semibold ${accessClassName[access.kind]}`}
            >
              {access.label}
            </span>
          </div>

          <h3 className="text-base leading-tight font-bold text-slate-900 transition-colors group-hover:text-brand">
            {/* Stretched link: the whole card opens the community */}
            <Link to={`/communities/${community.id}`} className="after:absolute after:inset-0">
              {community.name}
            </Link>
          </h3>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
            {community.description}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {community.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-slate-500">
            <Users className="size-4 text-slate-400" />
            <span>{formatCompact(community.members)} membres</span>
          </div>
          <Link
            to={`/communities/${community.id}`}
            className="relative z-10 rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 transition-colors hover:bg-brand hover:text-white"
          >
            {cta}
          </Link>
        </div>
      </div>
    </article>
  );
}
