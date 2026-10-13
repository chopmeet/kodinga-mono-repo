import { Check, Globe, Lock, Tag, Users } from 'lucide-react';

import { Avatar, AvatarFallback, cn } from '@kodinga-mono-repo/ui';
import type { CommunityDetails } from '@/data/community.data';
import { formatCompact, nameInitials } from '@/utils/Utils';


export function AboutTab({ community }: { community: CommunityDetails }) {
  const isPrivate = community.access.kind === 'application';
  const meta = [
    { icon: isPrivate ? Lock : Globe, label: isPrivate ? 'Privée' : 'Publique' },
    { icon: Users, label: `${formatCompact(community.members)} membres` },
    { icon: Tag, label: community.access.kind === 'free' ? 'Gratuite' : community.access.label },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Gradient shows while the photo loads; the logo lives in the tabs bar above */}
      <div
        className={cn(
          'relative aspect-video overflow-hidden rounded-xl bg-linear-to-br',
          community.coverClassName
        )}
      >
        <img
          src={community.image}
          alt={`Couverture de ${community.name}`}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-b from-black/40 via-black/0 to-black/0" />
        <span className="absolute top-4 left-4 rounded border border-white/20 bg-black/40 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-white uppercase backdrop-blur-md">
          {community.badge}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
        {meta.map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <Icon className="size-4 text-slate-400" />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-2">
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px]">{nameInitials(community.owner.name)}</AvatarFallback>
          </Avatar>
          Par <strong className="font-semibold text-slate-900">{community.owner.name}</strong>
        </span>
      </div>

      <section className="space-y-3 text-[15px] leading-relaxed text-slate-700">
        {community.about.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900">Ce que vous obtenez</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {community.perks.map((perk) => (
            <li key={perk} className="flex items-start gap-2 text-sm text-slate-600">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              {perk}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-slate-900">Règles de la communauté</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-600 marker:font-mono marker:text-slate-400">
          {community.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap gap-1.5">
        {community.tags.map((tag) => (
          <span key={tag} className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-700">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
