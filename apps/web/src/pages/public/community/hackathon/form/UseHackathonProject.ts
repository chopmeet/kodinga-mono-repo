import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast } from '@kodinga/ui';
import {
  useAttachHackathonProjectFileMutation,
  useDeleteHackathonProjectFileMutation,
  useGetMyHackathonProjectQuery,
  useSubmitMyHackathonProjectMutation,
  useUpdateMyHackathonProjectMutation,
} from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { Hackathon, HackathonSubmission, SubmissionFileType } from '@/utils/api/hackathon/hackathon.type';

const link = z.string().trim().refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), 'Lien invalide (https://…)');

const projectSchema = z.object({
  title: z.string().trim().min(2, 'Donnez un nom au projet'),
  tagline: z.string().trim().max(255, '255 caractères au maximum'),
  description: z.string(),
  problem_statement: z.string(),
  solution_statement: z.string(),
  target_audience: z.string().trim().max(255, '255 caractères au maximum'),
  demo_url: link,
  video_url: link,
  repository_url: link,
  gitlab_url: link,
});

export type ProjectForm = z.infer<typeof projectSchema>;
type ProjectField = keyof ProjectForm;

const formOf = (p?: HackathonSubmission): ProjectForm => ({
  title: p?.title ?? '',
  tagline: p?.tagline ?? '',
  description: p?.description ?? '',
  problem_statement: p?.problem_statement ?? '',
  solution_statement: p?.solution_statement ?? '',
  target_audience: p?.target_audience ?? '',
  demo_url: p?.demo_url ?? '',
  video_url: p?.video_url ?? '',
  repository_url: p?.repository_url ?? '',
  gitlab_url: p?.gitlab_url ?? '',
});

/**
 * The project of a participant (or of their team): GET my-project creates the draft, PATCH saves
 * it, files are sent to UploadThing by the api, submit/ checks what the organizers require.
 */
function UseHackathonProject({ slug, hackathonSlug, hackathon }: { slug: string; hackathonSlug: string; hackathon: Hackathon }) {
  const ids = { slug, hackathonSlug };
  const project = useGetMyHackathonProjectQuery(ids);
  const [update, { isLoading: isSaving }] = useUpdateMyHackathonProjectMutation();
  const [submit, { isLoading: isSubmitting }] = useSubmitMyHackathonProjectMutation();
  const [attach, { isLoading: isAttaching }] = useAttachHackathonProjectFileMutation();
  const [removeFile] = useDeleteHackathonProjectFileMutation();

  const form = useForm<ProjectForm>({ resolver: zodResolver(projectSchema), defaultValues: formOf() });
  const { reset, setError } = form;
  useEffect(() => {
    if (project.data) reset(formOf(project.data));
  }, [project.data, reset]);

  /** Errors of the api under their field, the others in a toast */
  const report = (error: unknown) => {
    const parsed = parseApiError(error);
    const fields = Object.entries(parsed.fields).filter(([f]) => f in formOf());
    fields.forEach(([field, message]) => setError(field as ProjectField, { message }));
    customToast.error({ message: fields.length ? 'Complétez les champs signalés avant de soumettre.' : parsed.message });
  };

  const save = async (values: ProjectForm) => {
    try {
      await update({ ...ids, ...values }).unwrap();
      return true;
    } catch (error) {
      report(error);
      return false;
    }
  };

  const required: { field: ProjectField; label: string }[] = [
    { field: 'description', label: 'Description' },
    ...(hackathon.require_repo_url ? [{ field: 'repository_url' as const, label: 'Dépôt GitHub ou GitLab' }] : []),
    ...(hackathon.require_demo_url ? [{ field: 'demo_url' as const, label: 'Démo en ligne' }] : []),
    ...(hackathon.require_video_url ? [{ field: 'video_url' as const, label: 'Vidéo de présentation' }] : []),
  ];

  return {
    project: project.data,
    isLoading: project.isLoading,
    loadError: project.error ? parseApiError(project.error).message : null,
    form,
    required,
    isSaving,
    isSubmitting,
    isAttaching,
    isFinal: !!project.data?.is_final,
    canEdit: hackathon.is_submission_open,
    maxFiles: hackathon.max_files_count ?? 5,
    maxFileMb: hackathon.max_file_size_mb ?? 25,
    save: form.handleSubmit(async (values) => {
      if (await save(values)) customToast.success({ message: 'Projet enregistré.' });
    }),
    /** Saves, then submits officially: the organizers and the jury see it from now on */
    submit: form.handleSubmit(async (values) => {
      // The repository can be on GitHub or GitLab
      const missing = required.filter((r) => !values[r.field].trim() && !(r.field === 'repository_url' && values.gitlab_url.trim()));
      if (missing.length) {
        missing.forEach((r) => setError(r.field, { message: `${r.label} : obligatoire pour soumettre` }));
        return;
      }
      if (!(await save(values))) return;
      try {
        await submit(ids).unwrap();
        customToast.success({ message: 'Projet soumis ! Vous pouvez encore le modifier jusqu’à la date limite.' });
      } catch (error) {
        report(error);
      }
    }),
    attach: async (data: { file: File } | { file_url: string; file_name: string }, file_type: SubmissionFileType) => {
      try {
        await attach({ ...ids, file_type, ...data }).unwrap();
        customToast.success({ message: 'Fichier ajouté au projet.' });
        return true;
      } catch (error) {
        customToast.error({ message: parseApiError(error).message });
        return false;
      }
    },
    removeFile: async (fileId: string) => {
      try {
        await removeFile({ ...ids, fileId }).unwrap();
      } catch (error) {
        customToast.error({ message: parseApiError(error).message });
      }
    },
  };
}

export type HackathonProject = ReturnType<typeof UseHackathonProject>;

export default UseHackathonProject;
