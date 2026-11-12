import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { ArrowLeft, Banknote, CalendarClock, ExternalLink, Eye, Globe, GraduationCap, Mail, MapPin, Pencil, UserRound, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { Badge, Button, ColgateWrapper, DetailsPageSkeleton, EmptyAlert } from '@kodinga/ui';
import { getName } from '@/utils/Utils';
import { dateFormat, RowActions } from '@/pages/shared/row-actions';
import { useGetOpportunityQuery } from '@/utils/api/community/community.api';
import { useCommunitySpace } from '../community-space-context';
import { ApplicationsSection } from './components/applications-section';
import { CompanyLogo } from './components/opportunity-row';
import UseOpportunityActions from './form/UseOpportunityActions';
import OpportunityFormModal from './modals/opportunity-form-modal';
import {
  experienceLabel,
  formatSalary,
  isExpired,
  opportunityStatusStyle,
  opportunityTypeLabel,
  workplaceLabel,
} from './opportunity-labels';

/** /c/:slug/opportunities/:opportunitySlug — one offer; its poster also follows the applications */
function OpportunityDetails() {
  const { community } = useCommunitySpace();
  const { opportunitySlug = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const back = `/c/${community.slug}/opportunities`;
  const { data: o, isLoading, error } = useGetOpportunityQuery(opportunitySlug, { skip: !opportunitySlug });
  const [editing, setEditing] = useState(false);
  const { canHandle, actionsFor, confirmDialog } = UseOpportunityActions({ onEdit: () => setEditing(true), afterClose: () => navigate(back) });

  // "Modifier" from the list lands here with { edit: true }
  const openEdit = (location.state as { edit?: boolean } | null)?.edit === true && !!o && canHandle(o) && o.status === 'open';
  useEffect(() => {
    if (!openEdit) return;
    setEditing(true);
    navigate(location.pathname + location.hash, { replace: true, state: null });
  }, [openEdit, navigate, location.pathname, location.hash]);

  if (isLoading) return <DetailsPageSkeleton />;
  // An offer of another community is not shown here
  if (!o || o.community_id !== community.id) {
    const notFound = !!o || (error as FetchBaseQueryError | undefined)?.status === 404;
    return (
      <div className="flex flex-col items-start gap-4">
        <EmptyAlert text={notFound ? "Cette offre est introuvable dans la communauté." : "Impossible de charger l'offre."} />
        <Button asChild variant="outline" size="sm">
          <Link to={back}>Retour aux opportunités</Link>
        </Button>
      </div>
    );
  }

  const status = opportunityStatusStyle[o.status];
  const salary = formatSalary(o);
  const handles = canHandle(o);
  const facts = [
    { icon: MapPin, label: 'Lieu', value: `${workplaceLabel[o.workplace_type]}${o.location && o.location !== 'Remote' ? ` · ${o.location}` : ''}` },
    { icon: GraduationCap, label: 'Niveau', value: experienceLabel[o.experience_level] },
    { icon: Banknote, label: 'Rémunération', value: salary || 'Non communiquée' },
    { icon: Users, label: 'Candidatures', value: String(o.applications_count) },
    { icon: Eye, label: 'Vues', value: String(o.views_count) },
    { icon: CalendarClock, label: 'Publiée le', value: dateFormat.format(new Date(o.created_at)) },
    ...(o.expires_at ? [{ icon: CalendarClock, label: isExpired(o) ? 'Expirée le' : 'Expire le', value: dateFormat.format(new Date(o.expires_at)) }] : []),
    { icon: UserRound, label: 'Publiée par', value: getName(o.poster) },
  ];

  return (
    <div className="community__opportunity">
      <Link to={back} className="mb-4 inline-flex items-center gap-2 text-sm text-soft hover:text-foreground">
        <ArrowLeft className="size-4" />
        Opportunités
      </Link>

      <ColgateWrapper className="border border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <CompanyLogo name={o.company_name} url={o.company_logo_url} size="size-14" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={status.className}>
                  {status.label}
                </Badge>
                <Badge variant="outline" className="text-soft">
                  {opportunityTypeLabel[o.opportunity_type]}
                </Badge>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{o.title}</h1>
              <p className="mt-1 text-soft">
                {o.company_website ? (
                  <a href={o.company_website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary hover:underline">
                    {o.company_name}
                    <Globe className="size-3.5" aria-hidden />
                  </a>
                ) : (
                  o.company_name
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {handles && o.status === 'open' && (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil />
                Modifier
              </Button>
            )}
            <RowActions label={`Actions pour ${o.title}`} actions={actionsFor(o, { withView: false })} />
          </div>
        </div>
        {o.technologies.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Technologies">
            {o.technologies.map((t) => (
              <li key={t.id} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-soft">
                {t.name}
              </li>
            ))}
          </ul>
        )}
      </ColgateWrapper>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ColgateWrapper className="border border-border p-5 lg:col-span-2">
          <h2 className="font-semibold text-foreground">Description</h2>
          <p className="mt-3 whitespace-pre-line text-body">{o.description}</p>
          {o.requirements && (
            <>
              <h2 className="mt-6 font-semibold text-foreground">Profil recherché</h2>
              <p className="mt-3 whitespace-pre-line text-body">{o.requirements}</p>
            </>
          )}
          {(o.apply_url || o.apply_email) && (
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              {o.apply_url && (
                <a href={o.apply_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
                  <ExternalLink className="size-4" />
                  Candidature externe
                </a>
              )}
              {o.apply_email && (
                <a href={`mailto:${o.apply_email}`} className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
                  <Mail className="size-4" />
                  {o.apply_email}
                </a>
              )}
            </div>
          )}
        </ColgateWrapper>
        <ColgateWrapper className="border border-border p-5">
          <dl className="space-y-4">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden />
                <div>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-medium text-foreground">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </ColgateWrapper>
      </div>

      <div className="mt-6">
        {handles ? (
          <ApplicationsSection opportunitySlug={o.slug} />
        ) : (
          <ColgateWrapper className="border border-border p-4 text-sm text-soft">
            Les candidatures sont visibles par {getName(o.poster)}, qui a publié l'offre.
          </ColgateWrapper>
        )}
      </div>

      <OpportunityFormModal communityId={community.id} open={editing} opportunity={o} onClose={() => setEditing(false)} />
      {confirmDialog}
    </div>
  );
}

export default OpportunityDetails;
