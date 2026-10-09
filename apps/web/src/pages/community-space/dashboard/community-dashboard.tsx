import { ChevronRight, Heart, Lock, MessageCircle, UserRoundCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ColgateWrapper, TopTitle } from '@kodinga-mono-repo/ui';
import { getCommunityDashboard } from '@/data/community-space.data';
import { useUser } from '@/utils/Utils';
import { useCommunitySpace } from '../community-space-context';
import MembersGrowthChart from './components/members-growth-chart';
import SpaceOverview from './components/space-overview';

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <ColgateWrapper className="h-full min-w-0 border border-neutral-200 p-4">
      <div className="mb-4">
        <h2 className="text-lg font-medium text-zinc-700">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </ColgateWrapper>
  );
}

function CommunityDashboardPage() {
  const space = useCommunitySpace();
  const user = useUser();
  const stats = getCommunityDashboard(space.community);
  const base = `/c/${space.community.slug}`;

  const todo = [
    {
      id: 'pending',
      icon: <UserRoundCheck className="size-4" />,
      count: stats.pendingRequests,
      label: (n: number) => (n > 1 ? `${n} demandes d'adhésion à traiter` : n === 1 ? "1 demande d'adhésion à traiter" : "Aucune demande d'adhésion"),
      to: `${base}/members?status=pending`,
    },
    {
      id: 'locked',
      icon: <Lock className="size-4" />,
      count: stats.lockedPosts,
      label: (n: number) => (n > 1 ? `${n} publications verrouillées` : n === 1 ? '1 publication verrouillée' : 'Aucune publication verrouillée'),
      to: `${base}/posts?filter=locked`,
    },
  ];

  return (
    <div className="community__dashboard">
      <TopTitle
        title="Tableau de bord"
        paragraph={`${user?.first_name ? `Bienvenue ${user.first_name} ! ` : ''}Voici l'activité de ${space.community.name}.`}
      />

      <section aria-label="Indicateurs de la communauté" className="mb-6">
        <SpaceOverview stats={stats} />
      </section>

      <div className="grid gap-3.5 pb-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <Panel title="Croissance" description="Nouveaux membres par mois, 12 derniers mois">
            <MembersGrowthChart data={stats.monthlyNewMembers} />
          </Panel>
        </div>
        <div className="min-w-0 lg:col-span-2">
          <Panel title="À traiter">
            <ul className="divide-y divide-slate-100">
              {todo.map((item) => (
                <li key={item.id}>
                  <Link to={item.to} className="flex items-center gap-3 py-3 text-sm hover:text-primary">
                    <span
                      className={`flex size-8 items-center justify-center rounded-full ${item.count > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {item.icon}
                    </span>
                    <span className={`flex-1 ${item.count > 0 ? 'font-medium text-slate-900' : 'text-slate-500'}`}>{item.label(item.count)}</span>
                    <ChevronRight className="size-4 text-slate-400" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <div className="min-w-0 lg:col-span-5">
          <Panel title="Publications les plus populaires" description="Par nombre de réactions">
            <ol className="divide-y divide-slate-100">
              {stats.topPosts.map((post, i) => (
                <li key={post.id} className="flex items-center gap-3 py-3">
                  <span className="w-5 text-center font-mono text-sm font-semibold text-slate-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{post.title}</p>
                    <p className="text-xs text-slate-500">par {post.author}</p>
                  </div>
                  <span className="flex items-center gap-3 text-sm text-slate-600 tabular-nums">
                    <span className="flex items-center gap-1" title="Réactions"><Heart className="size-3.5" />{post.reactions}</span>
                    <span className="flex items-center gap-1" title="Commentaires"><MessageCircle className="size-3.5" />{post.comments}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default CommunityDashboardPage;
