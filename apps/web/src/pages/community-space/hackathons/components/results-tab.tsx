import { Award, Megaphone } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  customToast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyAlert,
} from '@kodinga/ui';
import { useGetHackathonResultsQuery, usePublishHackathonResultsMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { Hackathon } from '@/utils/api/hackathon/hackathon.type';
import { formatDateTime } from '../hackathon-labels';

/** Ranking by weighted score; the organizers assign the prizes and publish the results */
export function ResultsTab({ slug, hackathon, canManage }: { slug: string; hackathon: Hackathon; canManage: boolean }) {
  const { data: results = [], isLoading, error } = useGetHackathonResultsQuery({ slug, hackathonSlug: hackathon.slug });
  const [publish, { isLoading: publishing }] = usePublishHackathonResultsMutation();
  const prizes = [...hackathon.prizes].sort((a, b) => a.rank - b.rank);
  // Prize -> project: suggested from the ranking (1st prize to the 1st project…)
  const [winners, setWinners] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const winnerOf = (prizeId: string, rank: number) => winners[prizeId] ?? results[rank - 1]?.id ?? '';
  const editable = canManage && !hackathon.results_published && hackathon.status !== 'cancelled';

  const runPublish = async () => {
    try {
      await publish({
        slug,
        hackathonSlug: hackathon.slug,
        winners: prizes.map((p) => ({ prize_id: p.id, submission_id: winnerOf(p.id, p.rank) })).filter((w) => w.submission_id),
      }).unwrap();
      customToast.success({ message: 'Résultats publiés : le hackathon est terminé.' });
      setConfirming(false);
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };

  if (error) return <EmptyAlert text={parseApiError(error).message} />;
  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Chargement du classement…</p>;

  return (
    <div className="flex flex-col gap-6">
      {hackathon.results_published ? (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Megaphone className="size-4" aria-hidden />
          Résultats publiés{hackathon.results_published_at ? ` le ${formatDateTime(hackathon.results_published_at)}` : ''}.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Classement provisoire, visible par les organisateurs tant que les résultats ne sont pas publiés.</p>
      )}

      {results.length === 0 ? (
        <EmptyAlert text="Aucun projet classé pour le moment : il faut des projets soumis et évalués." />
      ) : (
        <ol className="divide-y divide-border-soft rounded-xl border border-border" aria-label="Classement">
          {results.map((r, i) => (
            <li key={r.id} className="flex items-center gap-4 px-4 py-3">
              <span className={`w-8 text-center text-lg font-bold ${i < 3 ? 'text-amber-600' : 'text-faint'}`}>{r.rank ?? i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{r.title}</p>
                <p className="truncate text-sm text-muted-foreground">{r.team_name ? `Équipe ${r.team_name}` : `@${r.applicant_username}`}</p>
              </div>
              {r.won_prizes.map((p) => (
                <Badge key={p.id} variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-800">
                  <Award className="size-3.5" />
                  {p.title}
                </Badge>
              ))}
              <span className="text-right text-sm text-soft tabular-nums">
                <span className="block font-semibold text-foreground">{r.total_score ? Number(r.total_score).toFixed(2) : '—'}</span>
                <span className="text-xs">{r.evaluations_count} éval.</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {editable && results.length > 0 && (
        <section className="rounded-xl border border-border p-4">
          <h2 className="font-semibold text-foreground">Attribuer les prix</h2>
          <p className="mt-1 text-sm text-muted-foreground">Proposé d'après le classement : vous pouvez changer.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {prizes.map((p) => (
              <label key={p.id} className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-body">
                  #{p.rank} {p.title}
                </span>
                <select
                  value={winnerOf(p.id, p.rank)}
                  onChange={(e) => setWinners((w) => ({ ...w, [p.id]: e.target.value }))}
                  className="custom-form-control bg-background px-3 py-2"
                >
                  <option value="">Non attribué</option>
                  {results.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <Button className="mt-4" onClick={() => setConfirming(true)}>
            <Megaphone />
            Publier les résultats
          </Button>
        </section>
      )}

      <Dialog open={confirming} onOpenChange={(open) => !open && !publishing && setConfirming(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publier les résultats ?</DialogTitle>
            <DialogDescription>Le classement et les prix deviennent publics, et le hackathon passe à « Terminé ». Ce n'est pas réversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={publishing}>
              Retour
            </Button>
            <Button onClick={runPublish} isLoading={publishing}>
              Publier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
