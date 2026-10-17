import { CircleCheck, CircleX, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@kodinga-mono-repo/ui';
import { parseApiError } from '@/utils/api/errors';
import { AboutTab } from './components/about-tab';
import { ClassroomTab } from './components/classroom-tab';
import { CommunitySidebar } from './components/community-sidebar';
import { CommunityTabs } from './components/community-tabs';
import { EventsTab } from './components/events-tab';
import { FeedTab } from './components/feed-tab';
import UseCommunityPage from './form/UseCommunityPage';

/** Back from PayDunya (?payment=done|cancelled) */
function PaymentNotice({ status }: { status: string | null }) {
  if (status === 'done') {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
        <CircleCheck className="size-4 shrink-0" />
        Paiement reçu : votre accès s'active dès sa confirmation par PayDunya (quelques instants). Rechargez la page si besoin.
      </p>
    );
  }
  if (status === 'cancelled') {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" role="status">
        <CircleX className="size-4 shrink-0" />
        Paiement annulé : vous n'avez pas été débité.
      </p>
    );
  }
  return null;
}

/** /communities/:slug — public page of a community */
function CommunityDetails() {
  const page = UseCommunityPage();
  const { community, isLoading, activeTab } = page;

  if (isLoading) {
    return (
      <p className="flex items-center justify-center gap-2 py-24 text-slate-600" role="status">
        <LoaderCircle className="size-5 animate-spin text-brand" />
        Chargement de la communauté…
      </p>
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

  return (
    <div className="min-h-full bg-slate-50">
      <CommunityTabs community={community} activeTab={activeTab} />

      <div className="mx-auto grid max-w-285 items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
        <div className="flex min-w-0 flex-col gap-4">
          <PaymentNotice status={page.payment} />
          {activeTab === 'about' && <AboutTab community={community} />}
          {activeTab === 'feed' && <FeedTab page={page} />}
          {activeTab === 'classroom' && <ClassroomTab page={page} />}
          {activeTab === 'events' && <EventsTab slug={community.slug} />}
        </div>

        <aside className="lg:sticky lg:top-44">
          <CommunitySidebar page={page} />
        </aside>
      </div>
    </div>
  );
}

export default CommunityDetails;
