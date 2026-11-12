import { Award, Check, ExternalLink, Gavel, ListChecks, Medal, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@kodinga/ui';
import { formatDateTime } from '@/pages/community-space/hackathons/hackathon-labels';
import { Markdown } from '@/pages/shared/markdown';
import type { Hackathon, HackathonPerson } from '@/utils/api/hackathon/hackathon.type';
import { numberFormat } from '@/utils/format';
import { timelineOf } from '../form/UseHackathonPage';

const person = (p: HackathonPerson) => [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username;

function Block({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        {icon}
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** About the hackathon: the challenge, the calendar, the prizes, how projects are judged */
function OverviewTab({ hackathon: h }: { hackathon: Hackathon }) {
  const { t } = useTranslation();
  const prizes = [...h.prizes].sort((a, b) => a.rank - b.rank);
  const facts = [
    { label: t('hackathon.overview.theme'), value: h.theme },
    { label: t('hackathon.overview.audience'), value: h.target_audience },
    {
      label: t('hackathon.overview.teams'),
      value: h.allow_teams ? t('hackathon.overview.teamSize', { min: h.min_team_size, max: h.max_team_size }) : t('hackathon.overview.solo'),
    },
    { label: t('hackathon.overview.seats'), value: h.max_participants ? t('hackathon.overview.maxParticipants', { count: h.max_participants }) : '' },
  ].filter((f) => f.value);
  const deliverables = [
    h.require_repo_url && t('hackathon.overview.repo'),
    h.require_demo_url && t('hackathon.overview.demo'),
    h.require_video_url && t('hackathon.overview.video'),
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <Block title={t('hackathon.overview.challenge')} icon={<Target className="size-5 text-brand-strong" />}>
        {h.description ? <Markdown source={h.description} /> : <p className="text-muted-foreground">{t('hackathon.overview.noDescription')}</p>}
        {facts.length > 0 && (
          <dl className="mt-6 grid gap-4 border-t border-border-soft pt-5 sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{f.label}</dt>
                <dd className="mt-1 text-foreground">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {h.prerequisites && (
          <div className="mt-5 border-t border-border-soft pt-5">
            <h3 className="text-sm font-semibold text-foreground">{t('hackathon.overview.prerequisites')}</h3>
            <p className="mt-1 whitespace-pre-line text-soft">{h.prerequisites}</p>
          </div>
        )}
        {deliverables.length > 0 && (
          <p className="mt-5 rounded-lg bg-brand-subtle px-4 py-3 text-sm text-brand-strong">{t('hackathon.overview.deliverables', { list: deliverables.join(', ') })}</p>
        )}
        {h.rules_url && (
          <a href={h.rules_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-strong hover:underline">
            {t('hackathon.overview.rules')} <ExternalLink className="size-3.5" />
          </a>
        )}
      </Block>

      <Block title={t('hackathon.overview.calendar')} icon={<ListChecks className="size-5 text-brand-strong" />}>
        <ol aria-label={t('hackathon.overview.calendar')} className="relative ml-2 border-l border-border">
          {timelineOf(h).map((step) => (
            <li key={step.label} className="relative pb-5 pl-6 last:pb-0" aria-current={step.state === 'next' ? 'step' : undefined}>
              <span
                className={cn(
                  'absolute top-0.5 -left-2.25 flex size-4.5 items-center justify-center rounded-full border-2 bg-card',
                  step.state === 'done' && 'border-blue-900 bg-blue-900 text-white',
                  step.state === 'next' && 'border-blue-900',
                  step.state === 'later' && 'border-border-strong',
                )}
              >
                {step.state === 'done' && <Check className="size-2.5" strokeWidth={4} />}
              </span>
              <p className={cn('font-medium', step.state === 'later' ? 'text-muted-foreground' : 'text-foreground')}>{step.label}</p>
              <p className="text-sm text-muted-foreground">{formatDateTime(step.at)}</p>
            </li>
          ))}
        </ol>
      </Block>

      {prizes.length > 0 && (
        <Block title={t('hackathon.overview.prizes')} icon={<Award className="size-5 text-amber-600" />}>
          <ul className="grid gap-3 sm:grid-cols-2" aria-label={t('hackathon.overview.prizesLabel')}>
            {prizes.map((p) => (
              <li key={p.id} className="flex gap-3 rounded-lg border border-border p-4">
                <Medal className={cn('size-6 shrink-0', p.rank === 1 ? 'text-amber-500' : p.rank === 2 ? 'text-faint' : 'text-orange-700')} />
                <div>
                  <p className="font-semibold text-foreground">{p.title}</p>
                  {p.reward_amount && Number(p.reward_amount) > 0 && (
                    <p className="text-sm font-semibold text-brand-strong">
                      {numberFormat({ maximumFractionDigits: 0 }).format(Number(p.reward_amount))} {p.reward_currency === 'XOF' ? 'FCFA' : p.reward_currency}
                    </p>
                  )}
                  {(p.reward_description || p.description) && <p className="mt-1 text-sm text-soft">{p.reward_description || p.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {(h.criteria.length > 0 || h.judges.length > 0) && (
        <Block title={t('hackathon.overview.judging')} icon={<Gavel className="size-5 text-brand-strong" />}>
          {h.criteria.length > 0 && (
            <ul className="flex flex-col divide-y divide-border-soft" aria-label={t('hackathon.overview.criteria')}>
              {h.criteria.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-4 py-3 first:pt-0">
                  <div>
                    <p className="font-medium text-foreground">{c.name}</p>
                    {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                  </div>
                  {Number(c.weight) !== 1 && <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-soft">× {Number(c.weight)}</span>}
                </li>
              ))}
            </ul>
          )}
          {h.judges.length > 0 && (
            <div className={cn(h.criteria.length > 0 && 'mt-5 border-t border-border-soft pt-5')}>
              <h3 className="text-sm font-semibold text-foreground">{t('hackathon.overview.jury')}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {h.judges.map((j) => (
                  <li key={j.id} className="rounded-full bg-muted px-3 py-1 text-sm text-body">
                    {person(j.user)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Block>
      )}
    </div>
  );
}

export default OverviewTab;
