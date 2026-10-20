import { User, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button, cn, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kodinga-mono-repo/ui';
import type { HackathonQuestion, ParticipationMode } from '@/utils/api/hackathon/hackathon.type';
import type { HackathonPage } from '../form/UseHackathonPage';

/** Key and wording of a question of the organizers (free-form JSON on the api) */
export const questionKey = (q: HackathonQuestion, i: number) => q.id || q.key || `question_${i + 1}`;
export const questionLabel = (q: HackathonQuestion, i: number) => q.label || q.question || `Question ${i + 1}`;

/** Application: alone or in a team, the questions of the organizers, the rules */
function ApplyModal({ page, open, onClose }: { page: HackathonPage; open: boolean; onClose: () => void }) {
  const h = page.hackathon;
  const questions = h?.custom_registration_questions ?? [];
  const [mode, setMode] = useState<ParticipationMode>('individual');
  const [teamName, setTeamName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode('individual');
    setTeamName('');
    setAnswers({});
    setTerms(false);
    setError(null);
  }, [open]);

  if (!h) return null;

  const send = async () => {
    const missing = questions.findIndex((q, i) => q.required && !answers[questionKey(q, i)]?.trim());
    if (missing >= 0) return setError(`Répondez à : ${questionLabel(questions[missing], missing)}`);
    if (!terms) return setError('Acceptez le règlement pour candidater.');
    const ok = await page.apply({
      participation_mode: mode,
      team_name: mode === 'team' ? teamName.trim() : '',
      answers,
      accept_terms: true,
    });
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !page.isApplying && onClose()}>
      <DialogContent position="top" className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Candidater à {h.title}</DialogTitle>
          <DialogDescription>
            {h.auto_accept_applications ? 'Votre inscription est confirmée dès l’envoi.' : 'Les organisateurs examinent chaque candidature et vous répondent par notification.'}
          </DialogDescription>
        </DialogHeader>
        <form
          id="apply-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex flex-col gap-4"
        >
          {h.allow_teams && (
            <fieldset>
              <legend className="custom-form-label mb-2">Comment participez-vous ?</legend>
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { value: 'individual', label: 'En solo', help: 'Vous pourrez rejoindre une équipe plus tard.', icon: User },
                    { value: 'team', label: 'En équipe', help: `De ${h.min_team_size} à ${h.max_team_size} personnes.`, icon: Users },
                  ] as const
                ).map(({ value, label, help, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={mode === value}
                    onClick={() => setMode(value)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                      mode === value ? 'border-blue-900 bg-blue-50/60 ring-1 ring-blue-900' : 'border-slate-200 hover:border-slate-300',
                    )}
                  >
                    <Icon className="mt-0.5 size-5 shrink-0 text-blue-900" aria-hidden />
                    <span>
                      <span className="block font-semibold text-slate-900">{label}</span>
                      <span className="block text-xs text-slate-500">{help}</span>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {mode === 'team' && (
            <label className="flex flex-col gap-1">
              <span className="custom-form-label">Nom de l’équipe envisagé (optionnel)</span>
              <input value={teamName} onChange={(e) => setTeamName(e.target.value)} className="custom-form-control bg-background px-4 py-2" />
              <span className="text-xs text-slate-500">Vous créerez l’équipe et inviterez vos coéquipiers une fois inscrit.</span>
            </label>
          )}
          {questions.map((q, i) => {
            const key = questionKey(q, i);
            return (
              <label key={key} className="flex flex-col gap-1">
                <span className={cn('custom-form-label', q.required && "after:ml-0.5 after:text-red-500 after:content-['*']")}>{questionLabel(q, i)}</span>
                <textarea
                  rows={3}
                  value={answers[key] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
                  className="custom-form-control bg-background px-4 py-2"
                />
              </label>
            );
          })}
          {h.terms_and_conditions && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm whitespace-pre-line text-slate-600">{h.terms_and_conditions}</div>
          )}
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-(--primary)" />
            <span>
              J’accepte le règlement du hackathon
              {h.rules_url && (
                <>
                  {' '}
                  (
                  <a href={h.rules_url} target="_blank" rel="noreferrer" className="font-medium text-blue-900 underline">
                    lire le règlement
                  </a>
                  )
                </>
              )}
              .
            </span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={page.isApplying}>
            Annuler
          </Button>
          <Button type="submit" form="apply-form" isLoading={page.isApplying}>
            Envoyer ma candidature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ApplyModal;
