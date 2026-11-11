import { Archive, BadgeCheck, CalendarDays, ExternalLink, EyeOff, Globe, Lock, RotateCw, Star, Tag, UserRound } from 'lucide-react';
import { Link, Outlet, useNavigate } from 'react-router-dom';

import {
  Badge,
  Button,
  ColgateWrapper,
  CustomBreadcrumb,
  DetailsPageSkeleton,
  EmptyAlert,
  NavTabs,
  type Tab,
} from '@kodinga/ui';
import type { CommunityPrivacy } from '@/utils/api/community/community.type';
import { formatLongDate } from '@/utils/format';
import CommunityOverview from './components/community-overview';
import UseArchiveCommunity from './form/UseArchiveCommunity';
import { UseCommunityFromParams } from './form/UseCommunityFromParams';
import ArchiveCommunityModal from './modals/archive-community-modal';
import { parseApiError } from '@/utils/api/errors';
import { nameInitials } from '@/utils/Utils';

const tabs: Tab[] = [
  { id: 'members', title: 'Membres', link: 'members' },
  { id: 'posts', title: 'Publications', link: 'posts' },
  { id: 'events', title: 'Événements', link: 'events' },
  { id: 'opportunities', title: 'Opportunités', link: 'opportunities' },
  { id: 'hackathons', title: 'Hackathons', link: 'hackathons' },
  { id: 'projects', title: 'Projets', link: 'projects' },
  { id: 'payments', title: 'Paiements', link: 'payments' },
  { id: 'settings', title: 'Règles & paramètres', link: 'settings' },
];

const privacyLabel: Record<CommunityPrivacy, { label: string; icon: typeof Globe }> = {
  public: { label: 'Publique', icon: Globe },
  private: { label: 'Privée', icon: Lock },
  secret: { label: 'Secrète', icon: EyeOff },
};


function CommunityDetails() {
  const { community, isLoading, error, refetch } = UseCommunityFromParams();
  const navigate = useNavigate();
  // Archived: back to the list (it no longer shows the community)
  const archiveFlow = UseArchiveCommunity(() => navigate('/admin/communities'));

  if (isLoading) return <DetailsPageSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-start gap-4">
        <EmptyAlert text={parseApiError(error).message} />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCw />
          Réessayer
        </Button>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="flex flex-col items-start gap-4">
        <EmptyAlert text="Cette communauté est introuvable ou a été archivée." />
        <Button asChild variant="outline" size="sm">
          <Link to="/admin/communities">Retour aux communautés</Link>
        </Button>
      </div>
    );
  }

  const privacy = privacyLabel[community.privacy_type];
  const PrivacyIcon = privacy.icon;

  return (
    <div className="community__details">
      <CustomBreadcrumb
        items={[
          { label: 'Tableau de bord', to: '/admin/dashboard' },
          { label: 'Communautés', to: '/admin/communities' },
          { label: community.name },
        ]}
      />

      <ColgateWrapper className="my-6 border border-neutral-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-4">
            {community.avatar_url ? (
              <img src={community.avatar_url} alt="" className="size-20 shrink-0 rounded-xl object-cover" />
            ) : (
              <div
                className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-slate-900 font-mono text-2xl font-bold text-white"
                style={community.brand_color ? { backgroundColor: community.brand_color } : undefined}
                aria-hidden
              >
                {nameInitials(community.name)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-slate-900 lg:text-2xl">
                {community.name}
                {community.is_verified && <BadgeCheck className="size-5 text-primary" aria-label="Vérifiée" />}
                {community.is_featured && <Star className="size-5 fill-amber-400 text-amber-500" aria-label="À la une" />}
              </h1>
              <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-slate-500">{community.tagline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                <Badge variant="outline" className="gap-1 text-slate-700">
                  <PrivacyIcon />
                  {privacy.label}
                </Badge>
                {community.pricing_type === 'paid' ? (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Payante</Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Gratuite</Badge>
                )}
                <span className="flex items-center gap-1.5">
                  <UserRound className="size-4 text-slate-400" />
                  {community.owner.full_name}
                </span>
                {community.category && (
                  <span className="flex items-center gap-1.5">
                    <Tag className="size-4 text-slate-400" />
                    {community.category.name}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-slate-400" />
                  Créée le {formatLongDate(community.created_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {community.privacy_type !== 'secret' && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/communities/${community.slug}`}>
                  <ExternalLink />
                  Page publique
                </Link>
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={() => archiveFlow.askArchive(community)}>
              <Archive />
              Archiver
            </Button>
          </div>
        </div>
      </ColgateWrapper>

      <section aria-label="Indicateurs de la communauté" className="mb-6">
        <CommunityOverview community={community} />
      </section>

      <NavTabs tabs={tabs} />
      <Outlet context={{ community }} />

      <ArchiveCommunityModal
        community={archiveFlow.target}
        isLoading={archiveFlow.isLoading}
        onCancel={archiveFlow.cancel}
        onConfirm={archiveFlow.archive}
      />
    </div>
  );
}

export default CommunityDetails;
