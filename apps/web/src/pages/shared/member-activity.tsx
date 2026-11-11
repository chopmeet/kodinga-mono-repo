import { BookOpen, Briefcase, CalendarDays, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@kodinga/ui';
import type { ActivityCommunity, HackathonResult, MemberActivity } from '@/utils/api/analytics/member-activity.type';
import { formatDayMonth } from '@/utils/format';

const percent = (n: number) => `${Math.round(n)} %`;
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

const resultLabel: Record<HackathonResult, { label: string; className: string }> = {
  won: { label: 'Primé', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  podium: { label: 'Podium', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  submitted: { label: 'Projet soumis', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  in_progress: { label: 'En cours', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  pending: { label: 'Candidature en attente', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  rejected: { label: 'Candidature refusée', className: 'border-red-200 bg-red-50 text-red-700' },
  withdrawn: { label: 'Retiré', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  failed: { label: 'Non classé', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

const applicationStyle = (a: { is_successful: boolean; is_failed: boolean }) =>
  a.is_successful ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : a.is_failed ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800';

function Kpi({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="flex items-center gap-2 text-sm text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Block({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <section aria-label={title} className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {children.length === 0 ? <p className="mt-2 text-sm text-slate-500">{empty}</p> : <ul className="mt-3 space-y-3">{children}</ul>}
    </section>
  );
}

const Badge = ({ className, children }: { className: string; children: ReactNode }) => (
  <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold', className)}>{children}</span>
);

type Props = {
  activity: MemberActivity;
  /** In one community: its slug (links), and the community is not repeated on each line */
  communitySlug?: string;
};

/**
 * What the signed-in member did in the events, courses, opportunities and hackathons: four figures,
 * then the latest of each (analytics/member/dashboard/ or communities/<slug>/me/dashboard/)
 */
export function MemberActivityView({ activity, communitySlug }: Props) {
  const { kpis, highlights } = activity;
  const slugOf = (c: ActivityCommunity | null) => c?.slug ?? communitySlug;
  const where = (c: ActivityCommunity | null) => (!communitySlug && c ? ` · ${c.name}` : '');

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Mes indicateurs" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<CalendarDays className="size-4 text-blue-900" aria-hidden />}
          label="Événements suivis"
          value={String(kpis.events.attended_count)}
          detail={`${kpis.events.upcoming_count} à venir · présence ${percent(kpis.events.attendance_rate)}`}
        />
        <Kpi
          icon={<BookOpen className="size-4 text-blue-900" aria-hidden />}
          label="Formations en cours"
          value={String(kpis.courses.in_progress_count)}
          detail={`${plural(kpis.courses.completed_count, 'terminée', 'terminées')} · ${percent(kpis.courses.average_progress_percent)} en moyenne`}
        />
        <Kpi
          icon={<Briefcase className="size-4 text-blue-900" aria-hidden />}
          label="Candidatures"
          value={String(kpis.opportunities.total_applied)}
          detail={`${plural(kpis.opportunities.accepted_count, 'acceptée', 'acceptées')} · ${kpis.opportunities.in_review_count} en cours d’examen`}
        />
        <Kpi
          icon={<Trophy className="size-4 text-blue-900" aria-hidden />}
          label="Hackathons"
          value={String(kpis.hackathons.total_participated)}
          detail={`${plural(kpis.hackathons.prizes_won_count, 'prix', 'prix')} · réussite ${percent(kpis.hackathons.success_rate)}`}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Block title="Mes événements" empty="Aucun événement : inscrivez-vous à un live ou un atelier.">
          {highlights.upcoming_or_recent_events.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0">
                <Link to={`/communities/${slugOf(e.community)}?tab=events`} className="block truncate font-medium text-slate-900 hover:underline">
                  {e.title}
                </Link>
                <span className="text-xs text-slate-500">
                  {formatDayMonth(e.start_time)} · {e.event_type_display}
                  {where(e.community)}
                </span>
              </span>
              {e.is_in_progress ? (
                <Badge className="border-red-200 bg-red-50 text-red-700">En direct</Badge>
              ) : e.is_upcoming ? (
                <Badge className="border-sky-200 bg-sky-50 text-sky-800">À venir</Badge>
              ) : (
                <Badge className={e.is_checked_in ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}>
                  {e.is_checked_in ? 'Présent' : 'Absent'}
                </Badge>
              )}
            </li>
          ))}
        </Block>

        <Block title="Mes formations" empty="Aucune formation commencée.">
          {highlights.active_courses.map((c) => (
            <li key={c.id} className="text-sm">
              <Link to={`/communities/${slugOf(c.community)}/courses/${c.slug}`} className="block truncate font-medium text-slate-900 hover:underline">
                {c.title}
              </Link>
              <span className="text-xs text-slate-500">
                {c.completed_lessons} / {plural(c.total_lessons, 'leçon', 'leçons')}
                {where(c.community)}
              </span>
              <span
                role="progressbar"
                aria-label={`Progression de ${c.title}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(c.overall_progress_percent)}
                className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100"
              >
                <span className="block h-full rounded-full bg-blue-900" style={{ width: `${Math.min(100, c.overall_progress_percent)}%` }} />
              </span>
            </li>
          ))}
        </Block>

        <Block title="Mes candidatures" empty="Aucune candidature envoyée.">
          {highlights.recent_opportunity_applications.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0">
                <Link to={`/opportunities/${a.opportunity.slug}`} className="block truncate font-medium text-slate-900 hover:underline">
                  {a.opportunity.title}
                </Link>
                <span className="text-xs text-slate-500">
                  {a.opportunity.company_name} · {formatDayMonth(a.applied_at)}
                </span>
              </span>
              <Badge className={applicationStyle(a)}>{a.status_display}</Badge>
            </li>
          ))}
        </Block>

        <Block title="Mes hackathons" empty="Aucune participation à un hackathon.">
          {highlights.recent_hackathons.map((h) => {
            const result = resultLabel[h.member_result] ?? resultLabel.pending;
            return (
              <li key={h.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <Link to={`/communities/${slugOf(h.community)}/hackathons/${h.slug}`} className="block truncate font-medium text-slate-900 hover:underline">
                    {h.title}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {h.team ? `Équipe ${h.team.name}` : 'En solo'}
                    {where(h.community)}
                  </span>
                </span>
                <Badge className={result.className}>{result.label}</Badge>
              </li>
            );
          })}
        </Block>
      </div>
    </div>
  );
}
