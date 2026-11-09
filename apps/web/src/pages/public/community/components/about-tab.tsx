import { ArrowUpRight, BookOpen, CalendarDays, Code2, Globe, GraduationCap, Image, Lock, MessageCircle, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { cn } from '@kodinga/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import type { CommunityDetail } from '@/utils/api/community/community.type';
import { formatCompact } from '@/utils/Utils';
import { accessBadge } from './community-hero';
import { MembersPanel } from './members-panel';

type SubTab = 'about' | 'members';

export function AboutTab({ community, isTeam }: { community: CommunityDetail; isTeam: boolean }) {
  const { t } = useTranslation();
  const [sub, setSub] = useState<SubTab>('about');
  const n = community.members_count;
  const rules = [...(community.rules ?? [])].sort((a, b) => a.order - b.order);
  const meta = [
    { icon: community.privacy_type === 'public' ? Globe : Lock, label: community.category?.name ?? t('community.about.community') },
    { icon: Users, label: t('community.hero.members', { count: n, formatted: formatCompact(n) }) },
    { icon: ShieldCheck, label: accessBadge(community).label },
  ];
  // What a member finds inside, from the counts of the api
  const chips = [
    { icon: Code2, label: community.category?.name, show: !!community.category },
    { icon: MessageCircle, label: t('community.about.exchanges'), show: true },
    { icon: GraduationCap, label: t('community.about.courses'), show: community.courses_count > 0 },
    { icon: CalendarDays, label: t('community.about.events'), show: community.events_count > 0 },
  ].filter((c) => c.show && c.label);

  return (
    <div className="flex flex-col">
      <figure className="relative aspect-[16/8] overflow-hidden rounded-2xl" style={{ backgroundColor: community.brand_color || '#1D4ED8' }}>
        {community.banner_url ? (
          <img src={community.banner_url} alt={t('community.about.illustrationOf', { name: community.name })} className="absolute inset-0 size-full object-cover" />
        ) : (
          <GlassBackdrop fade={false} />
        )}
        <figcaption className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border border-white/60 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs backdrop-blur">
          <Image className="size-3.5" aria-hidden />
          {t('community.about.illustration')}
        </figcaption>
      </figure>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-slate-600">
        {meta.map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-2">
            <Icon className="size-4 text-slate-500" />
            {label}
          </span>
        ))}
      </div>

      <div role="tablist" aria-label={t('community.about.tabsLabel')} className="mt-6 flex gap-6 border-y border-slate-200">
        {(
          [
            { id: 'about', label: t('community.about.about') },
            { id: 'members', label: t('community.about.members'), count: n },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={sub === tab.id}
            onClick={() => setSub(tab.id)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-1 py-4 text-[15px] transition-colors',
              sub === tab.id ? 'border-blue-900 font-semibold text-blue-900' : 'border-transparent text-slate-700 hover:text-slate-900',
            )}
          >
            {tab.label}
            {'count' in tab && <span className="rounded border border-slate-200 bg-slate-50 px-1.5 text-xs font-medium text-slate-600 tabular-nums">{formatCompact(tab.count)}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="pt-8">
        {sub === 'members' ? (
          <MembersPanel community={community} isTeam={isTeam} />
        ) : (
          <>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">{t('community.about.startingPoint')}</h2>
            {community.tagline && <p className="mt-5 text-[17px] text-slate-900">{community.tagline}</p>}
            <p className="mt-4 leading-relaxed whitespace-pre-line text-slate-500">
              {community.description || t('community.about.defaultDescription', { name: community.name })}
            </p>

            {chips.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2" aria-label={t('community.about.themes')}>
                {chips.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100/70 px-3 py-2 text-sm text-slate-700">
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
            )}

            {rules.length > 0 && (
              <section aria-labelledby="community-rules" className="mt-10">
                <h3 id="community-rules" className="font-semibold text-slate-900">
                  {t('community.about.rules')}
                </h3>
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

            <Link to="?tab=feed" replace className="group mt-10 flex items-start gap-4 border-t border-slate-200 pt-8">
              <BookOpen className="mt-0.5 size-6 shrink-0 text-blue-900" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-medium text-slate-900">{t('community.about.curious')}</span>
                <span className="mt-1 block text-sm text-slate-500">{t('community.about.discover')}</span>
              </span>
              <ArrowUpRight className="mt-1 size-5 shrink-0 text-slate-700 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
