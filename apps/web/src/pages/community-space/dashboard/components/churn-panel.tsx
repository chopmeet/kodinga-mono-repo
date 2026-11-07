import { Check, Copy, RefreshCw, Send, Sparkles, UserRoundSearch } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button, cn, ColgateWrapper } from '@kodinga-mono-repo/ui';
import { MessageButton } from '@/pages/public/messages/components/message-button';
import { dateFormat } from '@/pages/shared/row-actions';
import type { ChurnRisk, ChurnRiskLevel } from '@/utils/api/ai/ai.type';
import { getName } from '@/utils/Utils';
import UseChurnRisks from '../form/UseChurnRisks';

const LEVELS: Record<ChurnRiskLevel, { label: string; className: string }> = {
  low: { label: 'Faible', className: 'border-slate-200 bg-slate-50 text-slate-600' },
  medium: { label: 'Moyen', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  high: { label: 'Élevé', className: 'border-orange-200 bg-orange-50 text-orange-800' },
  critical: { label: 'Critique', className: 'border-red-200 bg-red-50 text-red-700' },
};

const signalsOf = ({ signals }: ChurnRisk) =>
  [
    signals.days_inactive ? `Inactif depuis ${signals.days_inactive} j` : '',
    signals.total_recent_interactions === 0 ? 'aucune activité sur 14 j' : '',
    signals.activity_trend === 'declining' ? 'activité en baisse' : '',
  ]
    .filter(Boolean)
    .join(' · ');

/** /c/:slug/dashboard, owner and admins — who may leave, why, and a message to write to them */
export function ChurnPanel({ slug }: { slug: string }) {
  const churn = UseChurnRisks(slug);

  return (
    <ColgateWrapper className="mb-4 border border-neutral-200 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-zinc-700">Membres à relancer</h2>
          <p className="text-sm text-slate-500">Celles et ceux qui risquent de décrocher, d’après leur activité récente.</p>
        </div>
        {churn.isLoaded ? (
          <Button type="button" variant="outline" size="sm" onClick={churn.refresh} isLoading={churn.isFetching}>
            <RefreshCw /> Analyser de nouveau
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={churn.analyze} isLoading={churn.isFetching}>
            <UserRoundSearch /> Analyser les membres
          </Button>
        )}
      </div>
      {churn.isFetching && !churn.isLoaded && <p role="status" className="text-sm text-slate-500">L’analyse peut prendre un moment…</p>}
      {churn.loadError && <p className="text-sm text-red-700">{churn.loadError}</p>}
      {churn.isLoaded && churn.risks.length === 0 && <p className="text-sm text-slate-500">Aucun membre à relancer pour le moment.</p>}
      {churn.risks.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label="Membres à relancer">
          {churn.risks.map((r) => {
            const level = LEVELS[r.risk_level] ?? LEVELS.medium;
            const name = getName(r) || r.username;
            return (
              <li key={r.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/profiles/${r.username}`} className="font-medium text-slate-900 hover:underline">
                    {name}
                  </Link>
                  <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', level.className)}>Risque {level.label.toLowerCase()}</span>
                  <span className="text-xs text-slate-500">{signalsOf(r)}</span>
                </div>
                {r.suggested_nudge && <blockquote className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-sm whitespace-pre-line text-slate-700">{r.suggested_nudge}</blockquote>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {r.suggested_nudge && (
                    <Button type="button" variant="outline" size="sm" onClick={() => churn.copy(r)} aria-label={`Copier le message pour ${name}`}>
                      <Copy /> Copier le message
                    </Button>
                  )}
                  {!r.nudge_sent_at && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      isLoading={churn.writingId === r.id}
                      disabled={!!churn.writingId}
                      onClick={() => churn.write(r)}
                      aria-label={`Réécrire le message pour ${name} avec l’IA`}
                    >
                      <Sparkles /> Réécrire avec l’IA
                    </Button>
                  )}
                  <MessageButton userId={r.user_id} label="Écrire" size="sm" variant="outline" />
                  {r.nudge_sent_at ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <Check className="size-3.5" aria-hidden /> Relancé le {dateFormat.format(new Date(r.nudge_sent_at))}
                    </span>
                  ) : (
                    churn.confirmingId !== r.id && (
                      <Button type="button" size="sm" onClick={() => churn.askToSend(r)} aria-label={`Envoyer la relance à ${name}`}>
                        <Send /> Envoyer la relance
                      </Button>
                    )
                  )}
                </div>
                {!r.nudge_sent_at && churn.confirmingId === r.id && (
                  <div role="group" aria-label={`Confirmer la relance à ${name}`} className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-950">
                    <span className="min-w-0 flex-[1_1_14rem]">{name} recevra ce message en notification.</span>
                    <Button type="button" size="sm" isLoading={churn.isSending} onClick={() => churn.send(r, name)}>
                      Confirmer l’envoi
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={churn.isSending} onClick={churn.cancelSend}>
                      Annuler
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </ColgateWrapper>
  );
}
