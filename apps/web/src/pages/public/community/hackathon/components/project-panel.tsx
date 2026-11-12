import { CircleCheck, FileText, LoaderCircle, Paperclip, Send, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Loader, TextareaInput } from '@kodinga/ui';
import { formatDateTime } from '@/pages/community-space/hackathons/hackathon-labels';
import i18n from '@/utils/i18n';
import type { Hackathon, SubmissionFileType } from '@/utils/api/hackathon/hackathon.type';
import UseHackathonProject, { type HackathonProject } from '../form/UseHackathonProject';

// Labels: hackathon.project.fileTypes.<type>
const fileTypes: SubmissionFileType[] = ['presentation_pdf', 'screenshot', 'technical_doc', 'archive', 'other'];
const DEFAULT_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'zip', 'mp4', 'webm', 'gif'];
const size = (bytes: number) =>
  bytes >= 1024 * 1024
    ? i18n.t('hackathon.project.mb', { size: (bytes / (1024 * 1024)).toFixed(1) })
    : i18n.t('hackathon.project.kb', { size: Math.max(1, Math.round(bytes / 1024)) });

/** Attachments of the project: the api sends the file to UploadThing and checks the rules */
function ProjectFiles({ project, hackathon }: { project: HackathonProject; hackathon: Hackathon }) {
  const { t } = useTranslation();
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
    if (!extensions.includes(ext)) return setError(t('hackathon.project.badFormat', { formats: extensions.join(', ') }));
    if (file.size > project.maxFileMb * 1024 * 1024) return setError(t('hackathon.project.tooHeavy', { max: project.maxFileMb }));
    setError(null);
    await project.attach({ file }, type);
  };

  return (
    <fieldset className="flex flex-col gap-3 border-t border-border-soft pt-5">
      <legend className="flex items-center gap-2 font-semibold text-foreground">
        <Paperclip className="size-4 text-brand-strong" /> {t('hackathon.project.attachments', { count: files.length, max: project.maxFiles })}
      </legend>
      {files.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={t('hackathon.project.attachmentsLabel')}>
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <a href={f.file_url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 font-medium text-brand-strong hover:underline">
                <FileText className="size-4 shrink-0" />
                <span className="truncate">{f.file_name}</span>
                {f.file_size > 1 && <span className="shrink-0 text-xs font-normal text-muted-foreground">{size(f.file_size)}</span>}
              </a>
              {project.canEdit && (
                <button type="button" aria-label={t('hackathon.project.removeFile', { name: f.file_name })} onClick={() => project.removeFile(f.id)} className="text-faint hover:text-red-600">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {project.canEdit && !full && (
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label={t('hackathon.project.fileType')} value={type} onChange={(e) => setType(e.target.value as SubmissionFileType)} className="custom-form-control bg-background px-3 py-2 text-sm">
            {fileTypes.map((type) => (
              <option key={type} value={type}>
                {t(`hackathon.project.fileTypes.${type}`)}
              </option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-600 bg-brand-subtle px-3.5 py-2 text-sm font-semibold text-blue-700 hover:bg-brand-muted">
            {project.isAttaching ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {t('hackathon.project.addFile')}
            <input type="file" aria-label={t('hackathon.project.fileToAttach')} accept={extensions.map((x) => `.${x}`).join(',')} onChange={choose} disabled={project.isAttaching} className="sr-only" />
          </label>
          <span className="text-xs text-muted-foreground">
            {t('hackathon.project.maxSize', { formats: extensions.join(', '), max: project.maxFileMb })}
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
  const { t } = useTranslation();
  const project = UseHackathonProject({ slug, hackathonSlug, hackathon });
  const {
    register,
    formState: { errors },
  } = project.form;
  const isRequired = (field: string) => project.required.some((r) => r.field === field);

  return (
    <section aria-labelledby="project-title" className="rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{inTeam ? t('hackathon.project.team') : t('hackathon.project.mine')}</p>
          <h2 id="project-title" className="mt-1 text-lg font-semibold text-foreground">
            {project.project?.title || t('hackathon.project.project')}
          </h2>
        </div>
        {project.project &&
          (project.isFinal ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800">
              <CircleCheck className="size-4" />{' '}
              {project.project.submitted_at
                ? t('hackathon.project.submittedOn', { date: formatDateTime(project.project.submitted_at) })
                : t('hackathon.project.submitted')}
            </span>
          ) : (
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-soft">{t('hackathon.project.draft')}</span>
          ))}
      </div>

      {project.isLoading ? (
        <Loader inline size="sm" className="py-8" message={t('hackathon.project.loading')} />
      ) : project.loadError ? (
        <p className="mt-4 rounded-lg bg-subtle p-4 text-sm text-soft">{project.loadError}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-soft">
            {project.canEdit
              ? t(inTeam ? 'hackathon.project.editableUntilTeam' : 'hackathon.project.editableUntil', { date: formatDateTime(hackathon.submission_deadline) })
              : t('hackathon.project.closed')}
          </p>
          <form noValidate onSubmit={project.save} className="mt-5">
            <fieldset disabled={!project.canEdit} className="flex flex-col gap-1">
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Input id="project-title-input" label={t('hackathon.project.name')} required error={errors.title?.message} {...register('title')} />
                <Input id="project-tagline" label={t('hackathon.project.tagline')} error={errors.tagline?.message} {...register('tagline')} />
              </div>
              <TextareaInput
                id="project-description"
                label={t('hackathon.project.description')}
                rows={6}
                required
                error={errors.description?.message}
                {...register('description')}
                fieldHelp={t('hackathon.project.descriptionHelp')}
              />
              <div className="grid gap-x-4 sm:grid-cols-2">
                <TextareaInput id="project-problem" label={t('hackathon.project.problem')} rows={4} {...register('problem_statement')} />
                <TextareaInput id="project-solution" label={t('hackathon.project.solution')} rows={4} {...register('solution_statement')} />
              </div>
              <Input id="project-audience" label={t('hackathon.project.audience')} error={errors.target_audience?.message} {...register('target_audience')} />
              <div className="grid gap-x-4 sm:grid-cols-2">
                <Input id="project-repo" type="url" label={t('hackathon.project.github')} placeholder="https://github.com/…" required={isRequired('repository_url')} error={errors.repository_url?.message} {...register('repository_url')} />
                <Input id="project-gitlab" type="url" label={t('hackathon.project.gitlab')} placeholder="https://gitlab.com/…" error={errors.gitlab_url?.message} {...register('gitlab_url')} />
                <Input id="project-demo" type="url" label={t('hackathon.project.demo')} placeholder="https://…" required={isRequired('demo_url')} error={errors.demo_url?.message} {...register('demo_url')} />
                <Input id="project-video" type="url" label={t('hackathon.project.video')} placeholder={t('hackathon.project.videoPlaceholder')} required={isRequired('video_url')} error={errors.video_url?.message} {...register('video_url')} />
              </div>
            </fieldset>
            <ProjectFiles project={project} hackathon={hackathon} />
            {project.canEdit && (
              <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border-soft pt-5">
                <Button type="submit" variant={project.isFinal ? 'default' : 'outline'} isLoading={project.isSaving && !project.isSubmitting}>
                  {project.isFinal ? t('hackathon.project.saveChanges') : t('hackathon.project.saveDraft')}
                </Button>
                {!project.isFinal && (
                  <Button type="button" onClick={project.submit} isLoading={project.isSubmitting}>
                    <Send /> {t('hackathon.project.submit')}
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
