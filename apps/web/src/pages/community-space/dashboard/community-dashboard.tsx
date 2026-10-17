import { CalendarDays, ChevronRight, Heart, MessageCircle, UserRoundCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { ColgateWrapper, TopTitle } from '@kodinga-mono-repo/ui';
import { useUser } from '@/utils/Utils';
import { useCommunitySpace } from '../community-space-context';
import { formatEventWhen } from '../events/event-labels';
import MembersGrowthChart from './components/members-growth-chart';
import SpaceOverview from './components/space-overview';
import WelcomeChecklist from './components/welcome-checklist';
import UseCommunityDashboard, { RECENT_POSTS } from './form/UseCommunityDashboard';

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

const Placeholder = ({ children, className = 'h-64' }: { children: ReactNode; className?: string }) => (
  <div className={`flex items-center justify-center rounded-lg bg-slate-50 px-4 text-center text-sm text-slate-500 ${className}`}>{children}</div>
);

/** /c/:slug/dashboard — overview of the community for its team */
function CommunityDashboardPage() {
  const space = useCommunitySpace();
  const user = useUser();
  const base = `/c/${space.community.slug}`;
  const stats = UseCommunityDashboard(space.community.slug);
  const pending = stats.pendingRequests ?? 0;

  return (
    <div className="community__dashboard">
      <TopTitle
        title="Tableau de bord"
        paragraph={`${user?.first_name ? `Bienvenue ${user.first_name} ! ` : ''}Voici l'activité de ${space.community.name}.`}
      />

      <WelcomeChecklist />

      <section aria-label="Indicateurs de la communauté" className="mb-6">
        <SpaceOverview stats={stats} />
      </section>

      <div className="grid gap-3.5 pb-4 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <Panel
            title="Croissance"
            description={
              stats.growth && !stats.growth.complete
                ? `Nouveaux membres par mois, calculé sur les 500 membres les plus actifs (sur ${stats.growth.total.toLocaleString('fr-FR')})`
                : 'Nouveaux membres par mois, 12 derniers mois'
            }
          >
            {stats.isGrowthLoading ? (
              <Placeholder>Chargement…</Placeholder>
            ) : stats.growth ? (
              <MembersGrowthChart data={stats.growth.data} />
            ) : (
              <Placeholder>Impossible de charger la croissance des membres.</Placeholder>
            )}
          </Panel>
        </div>
        <div className="min-w-0 lg:col-span-2">
          <Panel title="À traiter">
            <ul className="divide-y divide-slate-100">
              <li>
                <Link to={`${base}/members?status=pending`} className="flex items-center gap-3 py-3 text-sm hover:text-primary">
                  <span className={`flex size-8 items-center justify-center rounded-full ${pending > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    <UserRoundCheck className="size-4" />
                  </span>
                  <span className={`flex-1 ${pending > 0 ? 'font-medium text-slate-900' : 'text-slate-500'}`}>
                    {stats.pendingRequests === undefined
                      ? 'Demandes d’adhésion…'
                      : pending > 1
                        ? `${pending} demandes d'adhésion à traiter`
                        : pending === 1
                          ? "1 demande d'adhésion à traiter"
                          : "Aucune demande d'adhésion"}
                  </span>
                  <ChevronRight className="size-4 text-slate-400" />
                </Link>
              </li>
              {stats.nextEvents.length === 0 ? (
                <li>
                  <Link to={`${base}/events`} className="flex items-center gap-3 py-3 text-sm text-slate-500 hover:text-primary">
                    <span className="flex size-8 items-center justify-center rounded-full bg-slate-100">
                      <CalendarDays className="size-4" />
                    </span>
                    <span className="flex-1">Aucun événement à venir</span>
                    <ChevronRight className="size-4 text-slate-400" />
                  </Link>
                </li>
              ) : (
                stats.nextEvents.map((event) => (
                  <li key={event.id}>
                    <Link to={`${base}/events/${event.id}`} className="flex items-center gap-3 py-3 text-sm hover:text-primary">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700">
                        <CalendarDays className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900">{event.title}</span>
                        <span className="block text-xs text-slate-500">{formatEventWhen(event)}</span>
                      </span>
                      <ChevronRight className="size-4 text-slate-400" />
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </Panel>
        </div>
        <div className="min-w-0 lg:col-span-5">
          <Panel title="Publications les plus populaires" description={`Par nombre de réactions, parmi les ${RECENT_POSTS} dernières publications`}>
            {stats.isPostsLoading ? (
              <Placeholder className="h-24">Chargement…</Placeholder>
            ) : stats.topPosts.length === 0 ? (
              <Placeholder className="h-24">
                <span>
                  Aucune publication pour le moment.{' '}
                  <Link to={`${base}/posts`} className="font-semibold text-brand hover:underline">
                    Publier un message
                  </Link>
                </span>
              </Placeholder>
            ) : (
              <ol className="divide-y divide-slate-100" aria-label="Publications les plus populaires">
                {stats.topPosts.map((post, i) => (
                  <li key={post.id} className="flex items-center gap-3 py-3">
                    <span className="w-5 text-center font-mono text-sm font-semibold text-slate-400">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{post.title}</p>
                      <p className="text-xs text-slate-500">par {post.author}</p>
                    </div>
                    <span className="flex items-center gap-3 text-sm text-slate-600 tabular-nums">
                      <span className="flex items-center gap-1" title="Réactions">
                        <Heart className="size-3.5" />
                        {post.reactions}
                      </span>
                      <span className="flex items-center gap-1" title="Commentaires">
                        <MessageCircle className="size-3.5" />
                        {post.comments}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default CommunityDashboardPage;
