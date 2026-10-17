import { useEffect, useState } from 'react';

import {
  Button,
  customToast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kodinga-mono-repo/ui';
import { useEvaluateHackathonSubmissionMutation, useGetHackathonEvaluationQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { Hackathon, HackathonSubmission } from '@/utils/api/hackathon/hackathon.type';

type Props = { slug: string; hackathon: Hackathon; submission: HackathonSubmission | null; onClose: () => void };

/** A judge scores a project on each criterion (draft or final), like judging/projects/<id>/evaluate/ */
export function EvaluationModal({ slug, hackathon, submission, onClose }: Props) {
  const { data: existing, isFetching } = useGetHackathonEvaluationQuery(
    { slug, hackathonSlug: hackathon.slug, submissionId: submission?.id ?? '' },
    { skip: !submission }
  );
  const [evaluate, { isLoading }] = useEvaluateHackathonSubmissionMutation();
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Start from the judge's previous evaluation (draft or submitted)
  useEffect(() => {
    if (!submission) return;
    setScores(Object.fromEntries((existing?.scores ?? []).map((s) => [s.criterion, String(Number(s.score))])));
    setFeedback(existing?.general_feedback ?? '');
    setNotes(existing?.private_notes ?? '');
    setError(null);
  }, [submission, existing]);

  const save = async (final: boolean) => {
    if (!submission) return;
    for (const c of hackathon.criteria) {
      const raw = scores[c.id];
      const value = Number(raw);
      if (final && (raw === undefined || raw === '')) return setError(`Notez « ${c.name} ».`);
      if (raw && (Number.isNaN(value) || value < Number(c.min_score) || value > Number(c.max_score))) {
        return setError(`« ${c.name} » : note entre ${Number(c.min_score)} et ${Number(c.max_score)}.`);
      }
    }
    setError(null);
    try {
      await evaluate({
        slug,
        hackathonSlug: hackathon.slug,
        submissionId: submission.id,
        scores: hackathon.criteria.filter((c) => scores[c.id]).map((c) => ({ criterion_id: c.id, score: Number(scores[c.id]) })),
        general_feedback: feedback.trim(),
        private_notes: notes.trim(),
        is_submitted: final,
      }).unwrap();
      customToast.success({ message: final ? 'Évaluation envoyée.' : 'Brouillon enregistré.' });
      onClose();
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  return (
    <Dialog open={!!submission} onOpenChange={(open) => !open && !isLoading && onClose()}>
      <DialogContent position="top" className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Évaluer « {submission?.title} »</DialogTitle>
          <DialogDescription>
            {existing?.is_submitted ? 'Vous avez déjà envoyé cette évaluation : vous pouvez la corriger.' : 'Notez le projet sur chaque critère.'}
          </DialogDescription>
        </DialogHeader>

        {isFetching ? (
          <p className="text-sm text-slate-500">Chargement de votre évaluation…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {hackathon.criteria.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <label htmlFor={`score-${c.id}`} className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{c.name}</span>
                    <span className="block text-xs text-slate-500">
                      sur {Number(c.max_score)} · poids {Number(c.weight)}
                    </span>
                  </label>
                  <input
                    id={`score-${c.id}`}
                    type="number"
                    min={Number(c.min_score)}
                    max={Number(c.max_score)}
                    step="0.5"
                    value={scores[c.id] ?? ''}
                    onChange={(e) => setScores((s) => ({ ...s, [c.id]: e.target.value }))}
                    className="custom-form-control w-24 bg-background px-3 py-2 text-right"
                  />
                </li>
              ))}
            </ul>
            <div>
              <label htmlFor="eval-feedback" className="custom-form-label mb-1 block">
                Retour à l'équipe
              </label>
              <textarea id="eval-feedback" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} className="custom-form-control block w-full bg-background px-4 py-2" />
            </div>
            <div>
              <label htmlFor="eval-notes" className="custom-form-label mb-1 block">
                Notes privées (jury et organisateurs)
              </label>
              <textarea id="eval-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="custom-form-control block w-full bg-background px-4 py-2" />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => save(false)} disabled={isLoading || isFetching}>
            Enregistrer le brouillon
          </Button>
          <Button onClick={() => save(true)} isLoading={isLoading} disabled={isFetching}>
            Envoyer l'évaluation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
