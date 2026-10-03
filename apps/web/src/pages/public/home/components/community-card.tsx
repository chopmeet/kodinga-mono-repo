import { Users } from 'lucide-react';

import type { Community } from '@/data/home.data';

const accessClassName: Record<Community['access']['kind'], string> = {
  free: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  paid: 'text-slate-700 bg-slate-100 border-slate-200',
  application: 'text-amber-800 bg-amber-50 border-amber-200',
};

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

export function CommunityCard({ community }: { community: Community }) {
  const { access } = community;
  const cta = community.cta ?? (access.kind === 'application' ? 'Postuler' : 'Rejoindre');

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md">
      <div
        className={`relative flex h-24 w-full items-start justify-between bg-gradient-to-r p-3 ${community.coverClassName}`}
      >
        <span className="rounded border border-white/20 bg-black/40 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-white uppercase backdrop-blur-md">
          {community.badge}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          {community.online} en ligne
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4 pt-0">
        <div>
          <div className="-mt-7 mb-3 flex items-end justify-between">
            <div className="h-14 w-14 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
              <div
                className={`flex h-full w-full items-center justify-center rounded-lg font-mono text-lg font-bold ${community.avatarClassName}`}
              >
                {community.initials}
              </div>
            </div>
            <span
              className={`rounded border px-2 py-0.5 font-mono text-xs font-semibold ${accessClassName[access.kind]}`}
            >
              {access.label}
            </span>
          </div>

          <h3 className="text-base leading-tight font-bold text-slate-900 transition-colors group-hover:text-brand">
            {community.name}
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
            <span>{compact.format(community.members)} membres</span>
          </div>
          <button
            type="button"
            className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 transition-colors hover:bg-brand hover:text-white"
          >
            {cta}
          </button>
        </div>
      </div>
    </article>
  );
}
