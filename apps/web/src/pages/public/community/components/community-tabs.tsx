import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { cn } from '@kodinga/ui';
import { useGetCommunityEventsQuery } from '@/utils/api/community/community.api';

// Labels: community.tabs.<id>
export const communityTabs = [
  { id: 'feed' },
  { id: 'classroom' },
  { id: 'members' },
  { id: 'events' },
  { id: 'hackathons' },
  { id: 'opportunities' },
  { id: 'projects' },
  { id: 'leaderboard' },
  { id: 'activity' },
  { id: 'about' },
] as const;

export type CommunityTabId = (typeof communityTabs)[number]['id'];

/** Tabs about the signed-in member: members only */
export const MEMBER_TABS: CommunityTabId[] = ['activity'];

/** Sections of the community, kept in the url (?tab=) */
export function CommunityTabs({ activeTab, slug, isMember = false }: { activeTab: CommunityTabId; slug?: string; isMember?: boolean }) {
  const { t } = useTranslation();
  const { data } = useGetCommunityEventsQuery({ slug: slug || '', status: 'live' }, { skip: !slug, pollingInterval: 30_000 });
  const hasLive = (data?.results?.length ?? 0) > 0;

  return (
    <div className="sticky top-18 z-40 border-b border-slate-200 bg-white">
      <nav aria-label={t('community.tabs.label')} className="no-scrollbar mx-auto flex max-w-285 gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8">
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
              <span>{t(`community.tabs.${tab.id}`)}</span>
              {isEventsTab && hasLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  <span className="size-1.5 animate-pulse rounded-full bg-white" />
                  {t('community.tabs.live')}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
