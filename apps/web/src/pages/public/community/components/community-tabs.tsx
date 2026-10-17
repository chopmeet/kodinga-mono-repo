import { BadgeCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@kodinga-mono-repo/ui';
import { CommunityAvatar } from '@/pages/shared/community-avatar';
import type { CommunityDetail } from '@/utils/api/community/community.type';

export const communityTabs = [
  { id: 'feed', label: 'Communauté' },
  { id: 'classroom', label: 'Formations' },
  { id: 'events', label: 'Calendrier' },
  { id: 'about', label: 'À propos' },
] as const;

export type CommunityTabId = (typeof communityTabs)[number]['id'];

type Props = {
  community: CommunityDetail;
  activeTab: CommunityTabId;
};

export function CommunityTabs({ community, activeTab }: Props) {
  return (
    <div className="sticky top-18 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-285 flex-col gap-3 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <CommunityAvatar community={community} className="size-10 rounded-lg text-sm" />
          <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{community.name}</h1>
          {community.is_verified && <BadgeCheck className="size-5 shrink-0 text-brand" aria-label="Communauté vérifiée" />}
        </div>

        <nav aria-label="Sections de la communauté" className="no-scrollbar -mb-px flex gap-1 overflow-x-auto">
          {communityTabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <Link
                key={tab.id}
                to={`?tab=${tab.id}`}
                replace
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'border-b-2 px-3 pb-3 text-sm font-semibold whitespace-nowrap transition-colors',
                  active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
