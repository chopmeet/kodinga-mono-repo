import { Link } from 'react-router-dom';

import { cn } from '@kodinga-mono-repo/ui';
import type { CommunityDetails } from '@/data/community.data';

export const communityTabs = [
  { id: 'feed', label: 'Communauté' },
  { id: 'classroom', label: 'Formations' },
  { id: 'events', label: 'Calendrier' },
  { id: 'about', label: 'À propos' },
] as const;

export type CommunityTabId = (typeof communityTabs)[number]['id'];

type Props = {
  community: CommunityDetails;
  activeTab: CommunityTabId;
};

export function CommunityTabs({ community, activeTab }: Props) {
  return (
    <div className="sticky top-[72px] z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1140px] flex-col gap-3 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold',
              community.avatarClassName
            )}
          >
            {community.initials}
          </div>
          <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            {community.name}
          </h1>
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
                  active
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
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
