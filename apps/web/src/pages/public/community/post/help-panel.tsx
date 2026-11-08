import { Bell, Check, Sparkles } from 'lucide-react';

import { Button, cn } from '@kodinga/ui';
import { getName } from '@/utils/Utils';
import UseHelpAssistance from '../form/UseHelpAssistance';

/** Under an unsolved question, for its author and the team: get help sooner */
export function HelpPanel({ postId }: { postId: string }) {
  const h = UseHelpAssistance(postId, true);
  if (h.isLoading) return <p className="mt-4 text-sm text-slate-500">L’IA prépare des pistes pour cette question…</p>;
  if (h.failed || !h.help) return null;

  return (
    <section aria-labelledby="help-title" className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-5">
      <h2 id="help-title" className="flex items-center gap-2 font-semibold text-blue-950">
        <Sparkles className="size-4" aria-hidden />
        Obtenir de l’aide plus vite
      </h2>
      {h.help.ai_comment_draft && (
        <div className="mt-3">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Ce qui aiderait à répondre</p>
          <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{h.help.ai_comment_draft}</p>
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Membres qui connaissent le sujet</p>
        {h.mentors.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">Aucun membre n’a encore renseigné de compétence liée à cette question.</p>
        ) : (
          <>
            <ul className="mt-2 flex flex-col gap-2" aria-label="Mentors suggérés">
              {h.mentors.map((m) => {
                const name = getName(m) || m.username;
                const checked = h.chosen.includes(m.user_id);
                return (
                  <li key={m.user_id}>
                    <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 text-sm', checked ? 'border-blue-200' : 'border-slate-200 opacity-70')}>
                      <input type="checkbox" checked={checked} onChange={() => h.toggle(m.user_id)} disabled={h.notified} className="mt-0.5 size-4 accent-blue-900" />
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900">{name}</span>
                        <span className="text-xs text-slate-500">{m.matching_skills.join(' · ')}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {h.notified ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <Check className="size-4" aria-hidden /> Mentors prévenus
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-slate-700">Message (facultatif)</span>
                  <textarea
                    rows={2}
                    value={h.message}
                    onChange={(e) => h.setMessage(e.target.value)}
                    maxLength={500}
                    placeholder="Un mot pour expliquer ce qui vous bloque"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <Button type="button" size="sm" className="self-start" disabled={h.chosen.length === 0} isLoading={h.isSending} onClick={h.send}>
                  <Bell />
                  {h.chosen.length > 1 ? `Prévenir ${h.chosen.length} mentors` : 'Prévenir le mentor'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
