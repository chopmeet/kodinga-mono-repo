import { ExternalLink, FileText, Gauge, GitBranch, PlayCircle } from 'lucide-react';
import { useState } from 'react';

import { Badge, Button, EmptyAlert, Pagination, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@kodinga-mono-repo/ui';
import { FilterChip } from '@/pages/shared/filter-chip';
import { useGetHackathonSubmissionQuery, useGetHackathonSubmissionsQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { Hackathon, HackathonSubmission } from '@/utils/api/hackathon/hackathon.type';
import { formatDateTime } from '../hackathon-labels';
import { EvaluationModal } from './evaluation-modal';
import { getName } from '@/utils/Utils';

function Links({ s }: { s: HackathonSubmission }) {
  const links = [
    { url: s.repository_url || s.gitlab_url, label: 'Code', icon: GitBranch },
    { url: s.demo_url, label: 'Démo', icon: ExternalLink },
    { url: s.video_url, label: 'Vidéo', icon: PlayCircle },
  ].filter((l) => l.url);
  if (links.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-3">
      {links.map(({ url, label, icon: Icon }) => (
        <a key={label} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <Icon className="size-3.5" aria-hidden />
          {label}
        </a>
      ))}
    </span>
  );
}

/** Detail of a project (description and files) in a side sheet */
function SubmissionSheet({ slug, hackathonSlug, submission, onClose }: { slug: string; hackathonSlug: string; submission: HackathonSubmission | null; onClose: () => void }) {
  const { data } = useGetHackathonSubmissionQuery({ slug, hackathonSlug, submissionSlug: submission?.slug ?? '' }, { skip: !submission });
  const s = data ?? submission;
  return (
    <Sheet open={!!submission} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {s && (
          <>
            <SheetHeader>
              <SheetTitle>{s.title}</SheetTitle>
              <SheetDescription>{s.team_name ? `Équipe ${s.team_name}` : getName(s.applicant)}</SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6">
              {s.tagline && <p className="text-slate-700">{s.tagline}</p>}
              {s.description && <p className="whitespace-pre-line text-sm text-slate-700">{s.description}</p>}
              <Links s={s} />
              {(s.files ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {s.files?.map((f) => (
                    <li key={f.id}>
                      <a href={f.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                        <FileText className="size-4" aria-hidden />
                        {f.file_name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {s.submitted_at && <p className="text-xs text-slate-500">Soumis le {formatDateTime(s.submitted_at)}</p>}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Projects of a hackathon (organizers and judges); judges evaluate them from here */
export function ProjectsTab({ slug, hackathon, isJudge }: { slug: string; hackathon: Hackathon; isJudge: boolean }) {
  const [finalOnly, setFinalOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [opened, setOpened] = useState<HackathonSubmission | null>(null);
  const [evaluating, setEvaluating] = useState<HackathonSubmission | null>(null);
  const { data, isLoading, error } = useGetHackathonSubmissionsQuery({ slug, hackathonSlug: hackathon.slug, final_only: finalOnly, page, page_size: size });
  const projects = data?.results ?? [];
  const total = data?.pagination.count ?? 0;
  const canEvaluate = isJudge && (hackathon.status === 'judging' || hackathon.status === 'submission_closed');

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="group" aria-label="Filtrer les projets">
          <FilterChip
            active={finalOnly}
            onClick={() => {
              setFinalOnly(true);
              setPage(1);
            }}
          >
            Soumis
          </FilterChip>
          <FilterChip
            active={!finalOnly}
            onClick={() => {
              setFinalOnly(false);
              setPage(1);
            }}
          >
            Avec les brouillons
          </FilterChip>
        </div>
        {isJudge && !canEvaluate && <p className="text-sm text-slate-500">L'évaluation s'ouvre à la clôture des soumissions.</p>}
      </div>

      {error && !data ? (
        <EmptyAlert text={parseApiError(error).message} />
      ) : isLoading ? (
        <p className="py-8 text-center text-sm text-slate-500">Chargement des projets…</p>
      ) : projects.length === 0 ? (
        <EmptyAlert text={finalOnly ? 'Aucun projet soumis pour le moment.' : 'Aucun projet, même en brouillon.'} />
      ) : (
        <>
          <ul className="divide-y divide-slate-100" aria-label="Projets">
            {projects.map((s) => (
              <li key={s.id} className="flex flex-wrap items-start gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => setOpened(s)} className="truncate text-left font-semibold text-slate-900 hover:text-primary">
                      {s.title}
                    </button>
                    {!s.is_final && <Badge variant="outline" className="text-slate-500">Brouillon</Badge>}
                  </div>
                  <p className="text-sm text-slate-600">{s.team_name ? `Équipe ${s.team_name}` : getName(s.applicant)}</p>
                  <div className="mt-1.5">
                    <Links s={s} />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <span className="flex items-center gap-1.5" title="Score pondéré">
                    <Gauge className="size-4 text-slate-400" aria-hidden />
                    {s.total_score ? Number(s.total_score).toFixed(1) : '—'}
                    <span className="text-xs text-slate-400">({s.evaluations_count} éval.)</span>
                  </span>
                  {canEvaluate && s.is_final && (
                    <Button size="sm" variant="outline" onClick={() => setEvaluating(s)} aria-label={`Évaluer ${s.title}`}>
                      Évaluer
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {total > size && (
            <Pagination
              totalItems={total}
              currentPage={page}
              perPage={size}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setSize(n);
                setPage(1);
              }}
            />
          )}
        </>
      )}

      <SubmissionSheet slug={slug} hackathonSlug={hackathon.slug} submission={opened} onClose={() => setOpened(null)} />
      <EvaluationModal slug={slug} hackathon={hackathon} submission={evaluating} onClose={() => setEvaluating(null)} />
    </div>
  );
}
