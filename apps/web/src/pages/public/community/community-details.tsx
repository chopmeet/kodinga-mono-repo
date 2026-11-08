import { CircleCheck, CircleX, Clock, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button, Loader } from '@kodinga/ui';
import type { CommunityDetail } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { AboutTab } from './components/about-tab';
import { ClassroomTab } from './components/classroom-tab';
import { CommunitySidebar } from './components/community-sidebar';
import { CommunityHero } from './components/community-hero';
import { CommunityTabs } from './components/community-tabs';
import { EventsTab } from './components/events-tab';
import { OpportunitiesTab } from './components/opportunities-tab';
import { ProjectsTab } from './components/projects-tab';
import { FeedTab } from './components/feed-tab';
import { HackathonsTab } from './components/hackathons-tab';
import { LeaderboardTab } from './components/leaderboard-tab';
import { ActivityTab } from './components/activity-tab';
import { LiveBanner } from './components/live-banner';
import { MembersTab } from './components/members-tab';
import UseCommunityPage from './form/UseCommunityPage';
import UsePaymentReturn from './form/UsePaymentReturn';

/** Back from PayDunya (?payment=done|cancelled): the real status of the payment */
function PaymentNotice({ community, param }: { community: CommunityDetail | undefined; param: string | null }) {
  const state = UsePaymentReturn(community && { slug: community.slug, communityId: community.id }, param);
  if (!state) return null;
  const notices = {
    checking: { icon: <LoaderCircle className="size-4 shrink-0 animate-spin" />, className: 'border-blue-200 bg-blue-50 text-blue-950', text: 'Vérification de votre paiement auprès de PayDunya…' },
    paid: { icon: <CircleCheck className="size-4 shrink-0" />, className: 'border-emerald-200 bg-emerald-50 text-emerald-900', text: 'Paiement confirmé : bienvenue, votre accès est actif !' },
    pending: {
      icon: <Clock className="size-4 shrink-0" />,
      className: 'border-amber-200 bg-amber-50 text-amber-900',
      text: 'Paiement en attente de confirmation : votre accès s’activera dès que PayDunya l’aura validé. Suivez-le dans Mon compte > Abonnements.',
    },
    failed: { icon: <CircleX className="size-4 shrink-0" />, className: 'border-red-200 bg-red-50 text-red-900', text: 'Le paiement n’a pas abouti : vous n’avez pas été débité. Vous pouvez réessayer.' },
    cancelled: { icon: <CircleX className="size-4 shrink-0" />, className: 'border-slate-200 bg-white text-slate-700', text: 'Paiement annulé : vous n’avez pas été débité.' },
  } as const;
  const notice = notices[state];
  return (
    <p className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${notice.className}`} role="status">
      {notice.icon}
      {notice.text}
      {state === 'pending' && (
        <Link to="/dashboard/billing" className="ml-auto shrink-0 font-semibold underline">
          Voir
        </Link>
      )}
    </p>
  );
}

/** /communities/:slug — public page of a community */
function CommunityDetails() {
  const page = UseCommunityPage();
  const { community, isLoading, activeTab } = page;

  if (isLoading) {
    return (
      <Loader inline className="py-24" message="Chargement de la communauté…" />
    );
  }

  if (!community) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{page.notFound ? 'Communauté introuvable' : 'Impossible de charger la communauté'}</h1>
        <p className="text-slate-500">
          {page.notFound ? 'Elle a peut-être été renommée, supprimée, ou n’est visible que sur invitation.' : parseApiError(page.error).message}
        </p>
        <Button asChild variant="outline">
          <Link to="/">Découvrir d'autres communautés</Link>
        </Button>
      </section>
    );
  }

  const fullWidth = activeTab === 'members';

  return (
    <div className="min-h-full bg-slate-50/60">
      <CommunityHero page={page} />
      <CommunityTabs activeTab={activeTab} slug={community.slug} isMember={page.membership === 'member'} />

      {/* The member cards take the whole width (no side column) */}
      <div className={`mx-auto grid max-w-285 items-start gap-10 px-4 py-10 sm:px-6 lg:px-8 ${fullWidth ? '' : 'lg:grid-cols-[1fr_400px]'}`}>
        <div className="flex min-w-0 flex-col gap-4">
          <LiveBanner slug={community.slug} />
          <PaymentNotice community={community} param={page.payment} />
          {activeTab === 'about' && <AboutTab community={community} isTeam={page.isTeam} />}
          {activeTab === 'feed' && <FeedTab page={page} />}
          {activeTab === 'classroom' && <ClassroomTab page={page} />}
          {activeTab === 'members' && <MembersTab community={community} isTeam={page.isTeam} />}
          {activeTab === 'events' && <EventsTab page={page} />}
          {activeTab === 'hackathons' && <HackathonsTab slug={community.slug} communityId={community.id} />}
          {activeTab === 'opportunities' && <OpportunitiesTab page={page} />}
          {activeTab === 'projects' && <ProjectsTab page={page} />}
          {activeTab === 'leaderboard' && <LeaderboardTab slug={community.slug} />}
          {activeTab === 'activity' && <ActivityTab slug={community.slug} />}
        </div>

        {!fullWidth && (
          <aside className="lg:sticky lg:top-40">
            <CommunitySidebar page={page} />
          </aside>
        )}
      </div>
    </div>
  );
}

export default CommunityDetails;
