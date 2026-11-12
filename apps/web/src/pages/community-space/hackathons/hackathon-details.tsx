import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { ArrowLeft, ArrowRight, Check, ExternalLink, Pencil, Send } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Badge, Button, type CardType, cn, ColgateWrapper, DetailsPageSkeleton, EmptyAlert, OverviewCardItem } from '@kodinga/ui';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import { RowActions } from '@/pages/shared/row-actions';
import { useGetHackathonDashboardQuery, useGetHackathonQuery } from '@/utils/api/community/community.api';
import type { Hackathon } from '@/utils/api/hackathon/hackathon.type';
import { useUser } from '@/utils/Utils';
import { useCommunitySpace } from '../community-space-context';
import { ApplicationsTab } from './components/applications-tab';
import { JuryTab } from './components/jury-tab';
import { ProjectsTab } from './components/projects-tab';
import { ResultsTab } from './components/results-tab';
import { TeamsTab } from './components/teams-tab';
import UseHackathonActions from './form/UseHackathonActions';
import { formatDateTime, hackathonFormatLabel, hackathonStatusStyle, NEXT_STEP } from './hackathon-labels';
import { useRealtimeRegistrations } from '@/utils/realtime/use-realtime';

const TABS = [
  ['overview', 'Aperçu'],
  ['applications', 'Candidatures'],
  ['teams', 'Équipes'],
  ['projects', 'Projets'],
  ['jury', 'Jury'],
  ['results', 'Résultats'],
] as const;
type TabId = (typeof TABS)[number][0];

const ORDER = ['draft', 'published', 'registration_open', 'registration_closed', 'in_progress', 'submission_closed', 'judging', 'completed'];

function Timeline({ h }: { h: Hackathon }) {
  const steps = [
    { label: 'Ouverture des inscriptions', at: h.registration_start, from: 'registration_open' },
    { label: 'Clôture des inscriptions', at: h.registration_end, from: 'registration_closed' },
    { label: 'Début du hackathon', at: h.start_time, from: 'in_progress' },
    { label: 'Date limite de soumission', at: h.submission_deadline, from: 'submission_closed' },
    { label: "Fin de l'évaluation", at: h.judging_end, from: 'completed' },
  ];
  const current = ORDER.indexOf(h.status);
  return (
    <ol className="space-y-4">
      {steps.map((s) => {
        const done = h.status !== 'cancelled' && current >= ORDER.indexOf(s.from);
        return (
          <li key={s.label} className="flex gap-3">
            <span
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                done ? 'border-primary bg-primary text-white' : 'border-border-strong bg-card'
              )}
            >
              {done && <Check className="size-3" />}
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">{s.label}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(s.at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Overview({ h, slug, canManage }: { h: Hackathon; slug: string; canManage: boolean }) {
  // Metrics are for the organizers
  const { data: metrics } = useGetHackathonDashboardQuery({ slug, hackathonSlug: h.slug }, { skip: !canManage });
  const cards: CardType[] = metrics
    ? [
        { id: 'apps', label: 'Candidatures', value: metrics.total_applications, color: '#1D4ED8' },
        { id: 'pending', label: 'En attente', value: metrics.pending_applications, color: '#b45309' },
        { id: 'teams', label: 'Équipes', value: metrics.total_teams, color: '#0f766e' },
        { id: 'subs', label: 'Projets soumis', value: metrics.final_submissions, color: '#7c3aed' },
      ]
    : [];
  const place = [h.venue_name, h.venue_city, h.venue_country].filter(Boolean).join(', ');
  const requirements = [h.require_repo_url && 'dépôt de code', h.require_demo_url && 'démo en ligne', h.require_video_url && 'vidéo'].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      {cards.length > 0 && (
        <section aria-label="Indicateurs du hackathon" className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
          {cards.map((c) => (
            <OverviewCardItem key={c.id} item={c} />
          ))}
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <ColgateWrapper className="border border-border p-5 lg:col-span-2">
          <h2 className="font-semibold text-foreground">Le défi</h2>
          <p className="mt-3 whitespace-pre-line text-body">{h.description}</p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Format</dt>
              <dd className="font-medium text-foreground">{hackathonFormatLabel[h.format]}{place ? ` · ${place}` : ''}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Participation</dt>
              <dd className="font-medium text-foreground">
                {h.allow_teams ? `Équipes de ${h.min_team_size} à ${h.max_team_size}` : 'Individuelle'}
                {h.max_participants ? ` · ${h.max_participants} places` : ''}
                {h.is_member_only ? ' · membres uniquement' : ''}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Candidatures</dt>
              <dd className="font-medium text-foreground">{h.auto_accept_applications ? 'Acceptées automatiquement' : 'Validées par l’équipe'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">À soumettre</dt>
              <dd className="font-medium text-foreground">{requirements.length ? requirements.join(', ') : 'Libre'}</dd>
            </div>
          </dl>
          {(h.location_url || h.rules_url) && (
            <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
              {h.location_url && (
                <a href={h.location_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                  <ExternalLink className="size-4" />
                  Lien en ligne
                </a>
              )}
              {h.rules_url && (
                <a href={h.rules_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                  <ExternalLink className="size-4" />
                  Règlement
                </a>
              )}
            </div>
          )}
        </ColgateWrapper>
        <ColgateWrapper className="border border-border p-5">
          <h2 className="mb-4 font-semibold text-foreground">Calendrier</h2>
          <Timeline h={h} />
        </ColgateWrapper>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ColgateWrapper className="border border-border p-5">
          <h2 className="mb-3 font-semibold text-foreground">Prix</h2>
          {h.prizes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun prix défini.</p>
          ) : (
            <ol className="divide-y divide-border-soft">
              {[...h.prizes]
                .sort((a, b) => a.rank - b.rank)
                .map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="font-medium text-foreground">
                      #{p.rank} {p.title}
                    </span>
                    <span className="text-soft">
                      {p.reward_amount ? `${Number(p.reward_amount).toLocaleString('fr-FR')} ${p.reward_currency === 'XOF' ? 'FCFA' : p.reward_currency}` : p.reward_description || '—'}
                    </span>
                  </li>
                ))}
            </ol>
          )}
        </ColgateWrapper>
        <ColgateWrapper className="border border-border p-5">
          <h2 className="mb-3 font-semibold text-foreground">Critères d'évaluation</h2>
          {h.criteria.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun critère défini.</p>
          ) : (
            <ul className="divide-y divide-border-soft">
              {h.criteria.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-medium text-foreground">{c.name}</span>
                  <span className="text-soft">
                    sur {Number(c.max_score)} · poids {Number(c.weight)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ColgateWrapper>
      </div>
    </div>
  );
}

/** /c/:slug/hackathons/:hackathonSlug — overview, applications, teams, projects, jury and results */
function HackathonDetails() {
  const { community } = useCommunitySpace();
  const { hackathonSlug = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const user = useUser();
  const tab = (TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'overview') as TabId;
  const back = `/c/${community.slug}/hackathons`;
  const pollingInterval = useRealtimeRegistrations(community.id);
  const { data: h, isLoading, error } = useGetHackathonQuery({ slug: community.slug, hackathonSlug }, { pollingInterval });
  const { canManage, nextStep, actionsFor, confirmDialog } = UseHackathonActions({ afterDelete: () => navigate(back) });

  if (isLoading) return <DetailsPageSkeleton />;
  if (!h) {
    const notFound = (error as FetchBaseQueryError | undefined)?.status === 404;
    return (
      <div className="flex flex-col items-start gap-4">
        <EmptyAlert text={notFound ? 'Ce hackathon est introuvable ou a été supprimé.' : 'Impossible de charger le hackathon.'} />
        <Button asChild variant="outline" size="sm">
          <Link to={back}>Retour aux hackathons</Link>
        </Button>
      </div>
    );
  }

  const status = hackathonStatusStyle[h.status];
  const step = NEXT_STEP[h.status];
  const isJudge = !!user && h.judges.some((j) => j.user.id === user.id);

  return (
    <div className="community__hackathon">
      <Link to={back} className="mb-4 inline-flex items-center gap-2 text-sm text-soft hover:text-foreground">
        <ArrowLeft className="size-4" />
        Hackathons
      </Link>

      <ColgateWrapper className="overflow-hidden border border-border p-0">
        <div className="relative h-36">
          {h.cover_image_url ? <img src={h.cover_image_url} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={status.className}>
                {status.label}
              </Badge>
              {h.theme && <Badge variant="outline" className="text-soft">{h.theme}</Badge>}
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{h.title}</h1>
            {h.tagline && <p className="mt-1 text-soft">{h.tagline}</p>}
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              {step && (
                <Button size="sm" onClick={() => nextStep(h)}>
                  {h.status === 'draft' ? <Send /> : <ArrowRight />}
                  {step.label}
                </Button>
              )}
              {h.status !== 'completed' && h.status !== 'cancelled' && (
                <Button asChild size="sm" variant="outline">
                  <Link to={`/c/${community.slug}/hackathons/${h.slug}/edit`}>
                    <Pencil />
                    Modifier
                  </Link>
                </Button>
              )}
              <RowActions label={`Actions pour ${h.title}`} actions={actionsFor(h, { withView: false }).filter((a) => a.label !== step?.label && a.label !== 'Modifier')} />
            </div>
          )}
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-border-soft px-5" role="tablist">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setParams(id === 'overview' ? {} : { tab: id }, { replace: true })}
              className={cn('-mb-px shrink-0 border-b-2 px-2 py-3 text-sm font-medium whitespace-nowrap', tab === id ? 'border-primary text-primary' : 'border-transparent text-soft hover:text-foreground')}
            >
              {label}
            </button>
          ))}
        </div>
      </ColgateWrapper>

      <div className="mt-6">
        {tab === 'overview' ? (
          <Overview h={h} slug={community.slug} canManage={canManage} />
        ) : (
          <ColgateWrapper className="border border-border p-5">
            {tab === 'applications' && <ApplicationsTab slug={community.slug} hackathonSlug={h.slug} canManage={canManage} />}
            {tab === 'teams' && <TeamsTab slug={community.slug} hackathonSlug={h.slug} />}
            {tab === 'projects' && <ProjectsTab slug={community.slug} hackathon={h} isJudge={isJudge} />}
            {tab === 'jury' && <JuryTab slug={community.slug} hackathon={h} canManage={canManage} />}
            {tab === 'results' && <ResultsTab slug={community.slug} hackathon={h} canManage={canManage} />}
          </ColgateWrapper>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}

export default HackathonDetails;
