import { ArrowLeft, CalendarDays, Laptop, MapPin, Trophy, Users } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button, cn, Loader } from '@kodinga/ui';
import { formatDay, hackathonFormatLabel, hackathonStatusStyle } from '@/pages/community-space/hackathons/hackathon-labels';
import { GlassBackdrop } from '@/pages/shared/glass-backdrop';
import OverviewTab from './components/overview-tab';
import ParticipationCard from './components/participation-card';
import ProjectPanel from './components/project-panel';
import ResultsTab from './components/results-tab';
import TeamPanel from './components/team-panel';
import TeamsTab from './components/teams-tab';
import UseHackathonPage from './form/UseHackathonPage';

/** /communities/:slug/hackathons/:hackathonSlug — discover a hackathon, apply, team up, submit */
function HackathonPageView() {
  const { t } = useTranslation();
  const page = UseHackathonPage();
  // "Ouvrir mon espace": once the tab is shown, the page scrolls to it and the focus follows
  const content = useRef<HTMLDivElement>(null);
  const { spaceRequest, tab } = page;
  useEffect(() => {
    if (!spaceRequest || tab !== 'space' || !content.current) return;
    content.current.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    content.current.focus({ preventScroll: true });
  }, [spaceRequest, tab]);
  const h = page.hackathon;
  const back = `/communities/${page.slug}?tab=hackathons`;

  if (page.isLoading) {
    return (
      <Loader inline className="py-24" message={t('hackathon.page.loading')} />
    );
  }
  if (!h) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{page.notFound ? t('hackathon.page.notFound') : t('hackathon.page.loadFailed')}</h1>
        <Button asChild variant="outline">
          <Link to={back}>{t('hackathon.page.back')}</Link>
        </Button>
      </section>
    );
  }

  const place = h.format === 'online' ? t('hackathon.page.online') : [h.venue_name, h.venue_city, h.venue_country].filter(Boolean).join(', ') || hackathonFormatLabel[h.format];
  const status = hackathonStatusStyle[h.status];

  return (
    <div className="min-h-full bg-slate-50/60">
      <header className="border-b border-slate-200 bg-white">
        <div className="relative h-40 sm:h-56">
          {h.cover_image_url ? <img src={h.cover_image_url} alt="" className="absolute inset-0 size-full object-cover" /> : <GlassBackdrop fade={false} />}
        </div>
        <div className="mx-auto max-w-285 px-4 py-6 sm:px-6 lg:px-8">
          <Link to={back} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="size-4" /> {page.community?.name ?? h.community.name} · Hackathons
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold', status.className)}>{status.label}</span>
            {h.theme && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{h.theme}</span>}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{h.title}</h1>
          {h.tagline && <p className="mt-1 text-lg text-slate-600">{h.tagline}</p>}
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-600">
            <span className="flex items-center gap-1.5">
              {h.format === 'online' ? <Laptop className="size-4 text-slate-400" /> : <MapPin className="size-4 text-slate-400" />} {place}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4 text-slate-400" /> {t('hackathon.page.dates', { start: formatDay(h.start_time), end: formatDay(h.submission_deadline) })}
            </span>
            {/* Given by the list of hackathons, not by the detail */}
            {typeof h.participants_count === 'number' && (
              <span className="flex items-center gap-1.5">
                <Users className="size-4 text-slate-400" /> {t('hackathon.page.participants', { count: h.participants_count })}
              </span>
            )}
            {h.prizes.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Trophy className="size-4 text-slate-400" /> {t('hackathon.page.prizes', { count: h.prizes.length })}
              </span>
            )}
          </p>
          <nav aria-label={t('hackathon.page.sections')} className="-mb-6 mt-6 flex gap-1 overflow-x-auto">
            {page.tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-current={page.tab === tab.id ? 'page' : undefined}
                onClick={() => page.openTab(tab.id)}
                className={cn(
                  'shrink-0 border-b-2 px-3 py-3 text-sm font-semibold transition-colors',
                  page.tab === tab.id ? 'border-blue-900 text-blue-900' : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-285 items-start gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
        <div ref={content} tabIndex={-1} aria-label={t('hackathon.page.content')} className="flex min-w-0 scroll-mt-24 flex-col gap-6 outline-none">
          {page.tab === 'overview' && <OverviewTab hackathon={h} />}
          {page.tab === 'teams' && <TeamsTab teams={page.teams} maxSize={h.max_team_size} />}
          {page.tab === 'space' && (
            <>
              {h.allow_teams && <TeamPanel page={page} />}
              {h.is_submission_open || h.user_status?.has_submission ? (
                <ProjectPanel slug={page.slug} hackathonSlug={page.hackathonSlug} hackathon={h} inTeam={!!page.myTeam} />
              ) : (
                <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
                  {new Date(h.start_time).getTime() > Date.now()
                    ? t('hackathon.page.submissionOpensAt', { date: formatDay(h.start_time) })
                    : t('hackathon.page.submissionClosed')}
                </p>
              )}
            </>
          )}
          {page.tab === 'results' && <ResultsTab results={page.results} />}
        </div>
        <aside className="order-first lg:sticky lg:top-24 lg:order-none">
          <ParticipationCard page={page} />
        </aside>
      </div>
    </div>
  );
}

export default HackathonPageView;
