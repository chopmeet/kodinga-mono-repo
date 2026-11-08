import { Award, Check, ExternalLink, Gavel, ListChecks, Medal, Target } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@kodinga/ui';
import { formatDateTime } from '@/pages/community-space/hackathons/hackathon-labels';
import { Markdown } from '@/pages/shared/markdown';
import type { Hackathon, HackathonPerson } from '@/utils/api/hackathon/hackathon.type';
import { timelineOf } from '../form/UseHackathonPage';

const amountFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const person = (p: HackathonPerson) => [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username;

function Block({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        {icon}
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** About the hackathon: the challenge, the calendar, the prizes, how projects are judged */
function OverviewTab({ hackathon: h }: { hackathon: Hackathon }) {
  const prizes = [...h.prizes].sort((a, b) => a.rank - b.rank);
  const facts = [
    { label: 'Thème', value: h.theme },
    { label: 'Public visé', value: h.target_audience },
    { label: 'Équipes', value: h.allow_teams ? `De ${h.min_team_size} à ${h.max_team_size} personnes` : 'Participation individuelle' },
    { label: 'Places', value: h.max_participants ? `${h.max_participants} participants au maximum` : '' },
  ].filter((f) => f.value);
  const deliverables = [
    h.require_repo_url && 'un dépôt GitHub ou GitLab',
    h.require_demo_url && 'une démo en ligne',
    h.require_video_url && 'une vidéo de présentation',
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <Block title="Le défi" icon={<Target className="size-5 text-blue-900" />}>
        {h.description ? <Markdown source={h.description} /> : <p className="text-slate-500">Les organisateurs n’ont pas encore décrit le défi.</p>}
        {facts.length > 0 && (
          <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{f.label}</dt>
                <dd className="mt-1 text-slate-800">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {h.prerequisites && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <h3 className="text-sm font-semibold text-slate-900">Prérequis</h3>
            <p className="mt-1 whitespace-pre-line text-slate-600">{h.prerequisites}</p>
          </div>
        )}
        {deliverables.length > 0 && (
          <p className="mt-5 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-950">À rendre avec le projet : {deliverables.join(', ')}.</p>
        )}
        {h.rules_url && (
          <a href={h.rules_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-900 hover:underline">
            Lire le règlement complet <ExternalLink className="size-3.5" />
          </a>
        )}
      </Block>

      <Block title="Calendrier" icon={<ListChecks className="size-5 text-blue-900" />}>
        <ol aria-label="Calendrier" className="relative ml-2 border-l border-slate-200">
          {timelineOf(h).map((step) => (
            <li key={step.label} className="relative pb-5 pl-6 last:pb-0" aria-current={step.state === 'next' ? 'step' : undefined}>
              <span
                className={cn(
                  'absolute top-0.5 -left-2.25 flex size-4.5 items-center justify-center rounded-full border-2 bg-white',
                  step.state === 'done' && 'border-blue-900 bg-blue-900 text-white',
                  step.state === 'next' && 'border-blue-900',
                  step.state === 'later' && 'border-slate-300',
                )}
              >
                {step.state === 'done' && <Check className="size-2.5" strokeWidth={4} />}
              </span>
              <p className={cn('font-medium', step.state === 'later' ? 'text-slate-500' : 'text-slate-900')}>{step.label}</p>
              <p className="text-sm text-slate-500">{formatDateTime(step.at)}</p>
            </li>
          ))}
        </ol>
      </Block>

      {prizes.length > 0 && (
        <Block title="Prix à gagner" icon={<Award className="size-5 text-amber-600" />}>
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="Prix">
            {prizes.map((p) => (
              <li key={p.id} className="flex gap-3 rounded-lg border border-slate-200 p-4">
                <Medal className={cn('size-6 shrink-0', p.rank === 1 ? 'text-amber-500' : p.rank === 2 ? 'text-slate-400' : 'text-orange-700')} />
                <div>
                  <p className="font-semibold text-slate-900">{p.title}</p>
                  {p.reward_amount && Number(p.reward_amount) > 0 && (
                    <p className="text-sm font-semibold text-blue-900">
                      {amountFormat.format(Number(p.reward_amount))} {p.reward_currency === 'XOF' ? 'FCFA' : p.reward_currency}
                    </p>
                  )}
                  {(p.reward_description || p.description) && <p className="mt-1 text-sm text-slate-600">{p.reward_description || p.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {(h.criteria.length > 0 || h.judges.length > 0) && (
        <Block title="Évaluation" icon={<Gavel className="size-5 text-blue-900" />}>
          {h.criteria.length > 0 && (
            <ul className="flex flex-col divide-y divide-slate-100" aria-label="Critères">
              {h.criteria.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-4 py-3 first:pt-0">
                  <div>
                    <p className="font-medium text-slate-900">{c.name}</p>
                    {c.description && <p className="text-sm text-slate-500">{c.description}</p>}
                  </div>
                  {Number(c.weight) !== 1 && <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">× {Number(c.weight)}</span>}
                </li>
              ))}
            </ul>
          )}
          {h.judges.length > 0 && (
            <div className={cn(h.criteria.length > 0 && 'mt-5 border-t border-slate-100 pt-5')}>
              <h3 className="text-sm font-semibold text-slate-900">Le jury</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {h.judges.map((j) => (
                  <li key={j.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
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
