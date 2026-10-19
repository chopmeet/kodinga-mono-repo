import { CircleCheck, FileText, LoaderCircle, Paperclip, Send, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, useState } from 'react';

import { Button, Input, Loader, TextareaInput } from '@kodinga-mono-repo/ui';
import { formatDateTime } from '@/pages/community-space/hackathons/hackathon-labels';
import type { Hackathon, SubmissionFileType } from '@/utils/api/hackathon/hackathon.type';
import UseHackathonProject, { type HackathonProject } from '../form/UseHackathonProject';

const fileTypes: { value: SubmissionFileType; label: string }[] = [
  { value: 'presentation_pdf', label: 'Présentation (PDF)' },
  { value: 'screenshot', label: 'Capture d’écran' },
  { value: 'technical_doc', label: 'Documentation technique' },
  { value: 'archive', label: 'Archive ZIP' },
  { value: 'other', label: 'Autre' },
];
const DEFAULT_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'zip', 'mp4', 'webm', 'gif'];
const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);

/** Attachments of the project: the api sends the file to UploadThing and checks the rules */
function ProjectFiles({ project, hackathon }: { project: HackathonProject; hackathon: Hackathon }) {
  const [type, setType] = useState<SubmissionFileType>('presentation_pdf');
  const [error, setError] = useState<string | null>(null);
  const files = project.project?.files ?? [];
  const extensions = hackathon.allowed_file_types?.length ? hackathon.allowed_file_types : DEFAULT_EXTENSIONS;
  const full = files.length >= project.maxFiles;

  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!extensions.includes(ext)) return setError(`Format non accepté. Formats : ${extensions.join(', ')}.`);
    if (file.size > project.maxFileMb * 1024 * 1024) return setError(`Fichier trop lourd : ${project.maxFileMb} Mo au maximum.`);
    setError(null);
    await project.attach({ file }, type);
  };

  return (
    <fieldset className="flex flex-col gap-3 border-t border-slate-100 pt-5">
      <legend className="flex items-center gap-2 font-semibold text-slate-900">
        <Paperclip className="size-4 text-blue-900" /> Pièces jointes ({files.length} / {project.maxFiles})
      </legend>
      {files.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Pièces jointes">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <a href={f.file_url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-medium text-blue-900 hover:underline">
                <FileText className="size-4 shrink-0" />
                <span className="truncate">{f.file_name}</span>
                {f.file_size > 1 && <span className="shrink-0 text-xs font-normal text-slate-500">{size(f.file_size)}</span>}
              </a>
              {project.canEdit && (
                <button type="button" aria-label={`Retirer ${f.file_name}`} onClick={() => project.removeFile(f.id)} className="text-slate-400 hover:text-red-600">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {project.canEdit && !full && (
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Type de pièce jointe" value={type} onChange={(e) => setType(e.target.value as SubmissionFileType)} className="custom-form-control bg-background px-3 py-2 text-sm">
            {fileTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-600 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
            {project.isAttaching ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Ajouter un fichier
            <input type="file" aria-label="Fichier à joindre" accept={extensions.map((x) => `.${x}`).join(',')} onChange={choose} disabled={project.isAttaching} className="sr-only" />
          </label>
          <span className="text-xs text-slate-500">
            {extensions.join(', ')} · {project.maxFileMb} Mo max.
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** The project of the participant or of their team, from the draft to the official submission */
function ProjectPanel({ slug, hackathonSlug, hackathon, inTeam }: { slug: string; hackathonSlug: string; hackathon: Hackathon; inTeam: boolean }) {
  const project = UseHackathonProject({ slug, hackathonSlug, hackathon });
  const {
    register,
    formState: { errors },
  } = project.form;
  const isRequired = (field: string) => project.required.some((r) => r.field === field);

  return (
    <section aria-labelledby="project-title" className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{inTeam ? 'Projet de l’équipe' : 'Mon projet'}</p>
          <h2 id="project-title" className="mt-1 text-lg font-semibold text-slate-900">
            {project.project?.title || 'Projet'}
          </h2>
        </div>
        {project.project &&
          (project.isFinal ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
              <CircleCheck className="size-4" /> Soumis {project.project.submitted_at ? `le ${formatDateTime(project.project.submitted_at)}` : ''}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">Brouillon</span>
          ))}
      </div>

      {project.isLoading ? (
        <Loader inline size="sm" className="py-8" message="Chargement du projet…" />
      ) : project.loadError ? (
        <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{project.loadError}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600">
            {project.canEdit
              ? `Modifiable jusqu’au ${formatDateTime(hackathon.submission_deadline)}${inTeam ? ', par tous les membres de l’équipe' : ''}.`
              : 'La période de soumission est terminée : le projet n’est plus modifiable.'}
          </p>
          <form noValidate onSubmit={project.save} className="mt-5">
            <fieldset disabled={!project.canEdit} className="flex flex-col gap-1">
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Input id="project-title-input" label="Nom du projet" required error={errors.title?.message} {...register('title')} />
                <Input id="project-tagline" label="En une phrase" error={errors.tagline?.message} {...register('tagline')} />
              </div>
              <TextareaInput id="project-description" label="Description" rows={6} required error={errors.description?.message} {...register('description')} fieldHelp="Ce que fait le projet, comment il marche. Markdown accepté." />
              <div className="grid gap-x-4 sm:grid-cols-2">
                <TextareaInput id="project-problem" label="Le problème" rows={4} {...register('problem_statement')} />
                <TextareaInput id="project-solution" label="La solution" rows={4} {...register('solution_statement')} />
              </div>
              <Input id="project-audience" label="Pour qui ?" error={errors.target_audience?.message} {...register('target_audience')} />
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Input id="project-repo" type="url" label="Dépôt GitHub" placeholder="https://github.com/…" required={isRequired('repository_url')} error={errors.repository_url?.message} {...register('repository_url')} />
                <Input id="project-gitlab" type="url" label="ou dépôt GitLab" placeholder="https://gitlab.com/…" error={errors.gitlab_url?.message} {...register('gitlab_url')} />
                <Input id="project-demo" type="url" label="Démo en ligne" placeholder="https://…" required={isRequired('demo_url')} error={errors.demo_url?.message} {...register('demo_url')} />
                <Input id="project-video" type="url" label="Vidéo de présentation" placeholder="YouTube, Loom…" required={isRequired('video_url')} error={errors.video_url?.message} {...register('video_url')} />
              </div>
            </fieldset>
            <ProjectFiles project={project} hackathon={hackathon} />
            {project.canEdit && (
              <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-5">
                <Button type="submit" variant={project.isFinal ? 'default' : 'outline'} isLoading={project.isSaving && !project.isSubmitting}>
                  {project.isFinal ? 'Enregistrer les modifications' : 'Enregistrer le brouillon'}
                </Button>
                {!project.isFinal && (
                  <Button type="button" onClick={project.submit} isLoading={project.isSubmitting}>
                    <Send /> Soumettre le projet
                  </Button>
                )}
              </div>
            )}
          </form>
        </>
      )}
    </section>
  );
}

export default ProjectPanel;
