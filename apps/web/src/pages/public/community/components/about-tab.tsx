import { CalendarDays, FileText, Globe, GraduationCap, Lock, Tag, Users } from 'lucide-react';

import { Avatar, AvatarFallback } from '@kodinga-mono-repo/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import type { CommunityDetail } from '@/utils/api/community/community.type';
import { formatCompact, getName, nameInitials } from '@/utils/Utils';

const privacyLabel = { public: 'Publique', private: 'Privée', secret: 'Secrète' } as const;

export function AboutTab({ community }: { community: CommunityDetail }) {
  const owner = getName(community.owner) || community.owner.username;
  const meta = [
    { icon: community.privacy_type === 'public' ? Globe : Lock, label: privacyLabel[community.privacy_type] },
    { icon: Users, label: `${formatCompact(community.members_count)} membres` },
    { icon: Tag, label: community.pricing_type === 'paid' ? 'Payante' : 'Gratuite' },
  ];
  // What a member finds inside, from the counts of the api
  const inside = [
    { icon: FileText, count: community.posts_count, label: (n: number) => `${formatCompact(n)} publication${n > 1 ? 's' : ''} dans le fil` },
    { icon: GraduationCap, count: community.courses_count, label: (n: number) => `${n} formation${n > 1 ? 's' : ''}` },
    { icon: CalendarDays, count: community.events_count, label: (n: number) => `${n} événement${n > 1 ? 's' : ''} organisé${n > 1 ? 's' : ''}` },
  ].filter((i) => i.count > 0);
  const rules = [...(community.rules ?? [])].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative aspect-video overflow-hidden rounded-xl" style={{ backgroundColor: community.brand_color || '#1D4ED8' }}>
        {community.banner_url ? (
          <img src={community.banner_url} alt={`Couverture de ${community.name}`} className="absolute inset-0 size-full object-cover" />
        ) : (
          <GlassBackdrop fade={false} />
        )}
        {community.category && (
          <span className="absolute top-4 left-4 rounded border border-white/20 bg-black/40 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-white uppercase backdrop-blur-md">
            {community.category.name}
          </span>
        )}
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
            <AvatarFallback className="text-[10px]">{nameInitials(owner)}</AvatarFallback>
          </Avatar>
          Par <strong className="font-semibold text-slate-900">{owner}</strong>
        </span>
      </div>

      <section className="text-[15px] leading-relaxed whitespace-pre-line text-slate-700">
        {community.description || community.tagline || 'Cette communauté n’a pas encore de présentation.'}
      </section>

      {inside.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900">Ce que vous y trouverez</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {inside.map(({ icon: Icon, count, label }) => (
              <li key={label(count)} className="flex items-center gap-2 text-sm text-slate-600">
                <Icon className="size-4 shrink-0 text-brand" />
                {label(count)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {rules.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-bold text-slate-900">Règles de la communauté</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600 marker:font-mono marker:text-slate-400">
            {rules.map((rule) => (
              <li key={rule.id}>
                <span className="font-medium text-slate-800">{rule.title}</span>
                {rule.description && <span className="block text-slate-500">{rule.description}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
