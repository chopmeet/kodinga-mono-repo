import { Link, useParams, useSearchParams } from 'react-router-dom';

import { Button } from '@kodinga-mono-repo/ui';
import { getCommunityDetails } from '@/data/community.data';
import { AboutTab } from './components/about-tab';
import { ClassroomTab } from './components/classroom-tab';
import { CommunitySidebar } from './components/community-sidebar';
import { communityTabs, CommunityTabs, type CommunityTabId } from './components/community-tabs';
import { EventsTab } from './components/events-tab';
import { FeedTab } from './components/feed-tab';

const isTab = (value: string | null): value is CommunityTabId =>
  communityTabs.some((t) => t.id === value);

function CommunityDetails() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const community = getCommunityDetails(id);

  if (!community) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Communauté introuvable</h1>
        <p className="text-slate-500">Elle a peut-être été renommée ou supprimée.</p>
        <Button asChild variant="outline">
          <Link to="/">Découvrir d'autres communautés</Link>
        </Button>
      </section>
    );
  }

  // Like Skool, visitors land on "About" unless a tab is requested
  const tab = params.get('tab');
  const activeTab: CommunityTabId = isTab(tab) ? tab : 'about';

  return (
    <div className="min-h-full bg-slate-50">
      <CommunityTabs community={community} activeTab={activeTab} />

      <div className="mx-auto grid max-w-[1140px] items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
        <div className="min-w-0">
          {activeTab === 'about' && <AboutTab community={community} />}
          {activeTab === 'feed' && <FeedTab community={community} />}
          {activeTab === 'classroom' && <ClassroomTab community={community} />}
          {activeTab === 'events' && <EventsTab community={community} />}
        </div>

        <aside className="lg:sticky lg:top-44">
          <CommunitySidebar community={community} />
        </aside>
      </div>
    </div>
  );
}

export default CommunityDetails;
