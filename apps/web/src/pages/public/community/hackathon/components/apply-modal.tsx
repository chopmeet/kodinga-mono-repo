import { User, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, cn, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kodinga/ui';
import type { HackathonQuestion, ParticipationMode } from '@/utils/api/hackathon/hackathon.type';
import { formatDateTime } from '@/pages/community-space/hackathons/hackathon-labels';
import i18n from '@/utils/i18n';
import type { HackathonPage } from '../form/UseHackathonPage';

/** Key and wording of a question of the organizers (free-form JSON on the api) */
export const questionKey = (q: HackathonQuestion, i: number) => q.id || q.key || `question_${i + 1}`;
export const questionLabel = (q: HackathonQuestion, i: number) => q.label || q.question || i18n.t('hackathon.apply.question', { n: i + 1 });

/** Application: alone or in a team, the questions of the organizers, the rules */
function ApplyModal({ page, open, onClose }: { page: HackathonPage; open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const h = page.hackathon;
  const questions = h?.custom_registration_questions ?? [];
  const [mode, setMode] = useState<ParticipationMode>('individual');
  const [teamName, setTeamName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What the api said when it refused for the closing of the applications */
  const [closedByApi, setClosedByApi] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode('individual');
    setTeamName('');
    setAnswers({});
    setTerms(false);
    setError(null);
    setClosedByApi(null);
  }, [open]);

  if (!h) return null;
  // Past the deadline (the page timer) or refused by the api: nothing more to send, what was typed stays
  const closed = page.registrationClosed || !!closedByApi;

  const send = async () => {
    const missing = questions.findIndex((q, i) => q.required && !answers[questionKey(q, i)]?.trim());
    if (missing >= 0) return setError(t('hackathon.apply.answerTo', { question: questionLabel(questions[missing], missing) }));
    if (!terms) return setError(t('hackathon.apply.acceptRules'));
    setError(null);
    const outcome = await page.apply({
      participation_mode: mode,
      team_name: mode === 'team' ? teamName.trim() : '',
      answers,
      accept_terms: true,
    });
    if (outcome.ok) return onClose();
    if (outcome.closed) setClosedByApi(outcome.message);
    else setError(outcome.message);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !page.isApplying && onClose()}>
      <DialogContent position="top" className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('hackathon.apply.title', { title: h.title })}</DialogTitle>
          <DialogDescription>
            {h.auto_accept_applications ? t('hackathon.apply.autoAccept') : t('hackathon.apply.reviewed')}
          </DialogDescription>
        </DialogHeader>
        {closed && (
          <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">{t('hackathon.apply.closed')}</p>
            <p className="mt-0.5">{closedByApi ?? t('hackathon.apply.wereOpen', { date: formatDateTime(h.registration_end) })}</p>
          </div>
        )}
        <form
          id="apply-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!closed) send();
          }}
          className="flex flex-col gap-4"
        >
          <fieldset disabled={closed} className="contents">
          {h.allow_teams && (
            <fieldset>
              <legend className="custom-form-label mb-2">{t('hackathon.apply.how')}</legend>
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { value: 'individual', label: t('hackathon.apply.solo'), help: t('hackathon.apply.soloHelp'), icon: User },
                    { value: 'team', label: t('hackathon.apply.team'), help: t('hackathon.apply.teamHelp', { min: h.min_team_size, max: h.max_team_size }), icon: Users },
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
              <span className="custom-form-label">{t('hackathon.apply.teamName')}</span>
              <input value={teamName} onChange={(e) => setTeamName(e.target.value)} className="custom-form-control bg-background px-4 py-2" />
              <span className="text-xs text-slate-500">{t('hackathon.apply.teamNameHelp')}</span>
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
              {t('hackathon.apply.acceptBefore')}
              {h.rules_url && (
                <>
                  {' '}
                  (
                  <a href={h.rules_url} target="_blank" rel="noreferrer" className="font-medium text-blue-900 underline">
                    {t('hackathon.apply.readRules')}
                  </a>
                  )
                </>
              )}
              .
            </span>
          </label>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={page.isApplying}>
            {closed ? t('common.actions.close') : t('common.actions.cancel')}
          </Button>
          <Button type="submit" form="apply-form" isLoading={page.isApplying} disabled={closed}>
            {t('hackathon.apply.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ApplyModal;
