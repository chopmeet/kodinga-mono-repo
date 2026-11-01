import { Link } from 'react-router-dom';

import { cn } from '@kodinga-mono-repo/ui';
import { useGetCommunityEventsQuery } from '@/utils/api/community/community.api';

export const communityTabs = [
  { id: 'feed', label: 'Communauté' },
  { id: 'classroom', label: 'Formations' },
  { id: 'members', label: 'Membres' },
  { id: 'events', label: 'Événements' },
  { id: 'hackathons', label: 'Hackathons' },
  { id: 'opportunities', label: 'Opportunités' },
  { id: 'projects', label: 'Projets' },
  { id: 'leaderboard', label: 'Classement' },
  { id: 'activity', label: 'Mon activité' },
  { id: 'about', label: 'À propos' },
] as const;

export type CommunityTabId = (typeof communityTabs)[number]['id'];

/** Tabs about the signed-in member: members only */
export const MEMBER_TABS: CommunityTabId[] = ['activity'];

/** Sections of the community, kept in the url (?tab=) */
export function CommunityTabs({ activeTab, slug, isMember = false }: { activeTab: CommunityTabId; slug?: string; isMember?: boolean }) {
  const { data } = useGetCommunityEventsQuery({ slug: slug || '', status: 'live' }, { skip: !slug, pollingInterval: 30_000 });
  const hasLive = (data?.results?.length ?? 0) > 0;

  return (
    <div className="sticky top-18 z-40 border-b border-slate-200 bg-white">
      <nav aria-label="Sections de la communauté" className="no-scrollbar mx-auto flex max-w-285 gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {communityTabs.filter((tab) => isMember || !MEMBER_TABS.includes(tab.id)).map((tab) => {
          const active = tab.id === activeTab;
          const isEventsTab = tab.id === 'events';
          return (
            <Link
              key={tab.id}
              to={`?tab=${tab.id}`}
              replace
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 border-b-2 px-2 py-5 text-[15px] whitespace-nowrap transition-colors sm:px-3',
                active ? 'border-blue-900 font-semibold text-blue-900' : 'border-transparent text-slate-600 hover:text-slate-900',
              )}
            >
              <span>{tab.label}</span>
              {isEventsTab && hasLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  <span className="size-1.5 animate-pulse rounded-full bg-white" />
                  Live
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
