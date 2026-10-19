import { Link } from 'react-router-dom';

import { cn } from '@kodinga-mono-repo/ui';

export const communityTabs = [
  { id: 'feed', label: 'Communauté' },
  { id: 'classroom', label: 'Formations' },
  { id: 'members', label: 'Membres' },
  { id: 'events', label: 'Événements' },
  { id: 'hackathons', label: 'Hackathons' },
  { id: 'opportunities', label: 'Opportunités' },
  { id: 'projects', label: 'Projets' },
  { id: 'leaderboard', label: 'Classement' },
  { id: 'about', label: 'À propos' },
] as const;

export type CommunityTabId = (typeof communityTabs)[number]['id'];

/** Sections of the community, kept in the url (?tab=) */
export function CommunityTabs({ activeTab }: { activeTab: CommunityTabId }) {
  return (
    <div className="sticky top-18 z-40 border-b border-slate-200 bg-white">
      <nav aria-label="Sections de la communauté" className="no-scrollbar mx-auto flex max-w-285 gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {communityTabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              to={`?tab=${tab.id}`}
              replace
              aria-current={active ? 'page' : undefined}
              className={cn(
                'border-b-2 px-2 py-5 text-[15px] whitespace-nowrap transition-colors sm:px-3',
                active ? 'border-blue-900 font-semibold text-blue-900' : 'border-transparent text-slate-600 hover:text-slate-900',
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
