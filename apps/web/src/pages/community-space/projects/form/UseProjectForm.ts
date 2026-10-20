import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast } from '@kodinga-mono-repo/ui';
import { useCreateProjectMutation, useUpdateProjectMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { Technology } from '@/utils/api/opportunity/opportunity.type';
import type { Project, ProjectWriteData } from '@/utils/api/project/project.type';

const optionalUrl = z.string().trim().refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), 'Lien invalide (https://…)');

const schema = z
  .object({
    title: z.string().trim().min(2, 'Au moins 2 caractères').max(255, '255 caractères maximum'),
    tagline: z.string().trim().max(255, '255 caractères maximum'),
    description: z.string().trim(),
    repository_url: optionalUrl,
    demo_url: optionalUrl,
    cover_image_url: optionalUrl,
    demo_images: z.array(z.string().trim()).default([]),
    technologies: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string() })),
  })
  // A showcase needs something to look at
  .refine((v) => !!v.repository_url || !!v.demo_url, {
    path: ['repository_url'],
    message: 'Indiquez le dépôt ou la démo',
  });

export type ProjectFormValues = z.infer<typeof schema>;

const FIELDS = ['title', 'tagline', 'description', 'repository_url', 'demo_url', 'cover_image_url', 'demo_images'] as const;

const DEFAULTS: ProjectFormValues = {
  title: '',
  tagline: '',
  description: '',
  repository_url: '',
  demo_url: '',
  cover_image_url: '',
  demo_images: [],
  technologies: [],
};

const fromProject = (p: Project): ProjectFormValues => ({
  title: p.title,
  tagline: p.tagline,
  description: p.description,
  repository_url: p.repository_url,
  demo_url: p.demo_url,
  cover_image_url: p.cover_image_url,
  demo_images: p.demo_images ?? [],
  technologies: p.technologies.map(({ id, name, slug }) => ({ id, name, slug })),
});

/**
 * Share a project in the community (POST projects/ with community_id) or edit it (PATCH by slug).
 * Projects are published: the community list of the api only returns published ones.
 */
function UseProjectForm({ communityId, project, open, onDone }: { communityId: string; project: Project | null; open: boolean; onDone: (saved: Project) => void }) {
  const [createProject] = useCreateProjectMutation();
  const [updateProject] = useUpdateProjectMutation();
  const form = useForm<ProjectFormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const { reset, setError, setValue, getValues, watch, handleSubmit } = form;

  useEffect(() => {
    if (open) reset(project ? fromProject(project) : DEFAULTS);
  }, [open, project, reset]);

  const addTechnology = (tech: Technology) => {
    const current = getValues('technologies');
    if (current.some((t) => t.id === tech.id)) return;
    setValue('technologies', [...current, { id: tech.id, name: tech.name, slug: tech.slug }], { shouldDirty: true });
  };
  const removeTechnology = (id: string) =>
    setValue(
      'technologies',
      getValues('technologies').filter((t) => t.id !== id),
      { shouldDirty: true },
    );

  const setCoverImageUrl = (url: string) => setValue('cover_image_url', url, { shouldDirty: true, shouldValidate: true });
  const setDemoImages = (images: string[]) => setValue('demo_images', images, { shouldDirty: true, shouldValidate: true });

  const onSubmit = async (v: ProjectFormValues) => {
    const body: ProjectWriteData = {
      title: v.title,
      tagline: v.tagline,
      description: v.description,
      repository_url: v.repository_url,
      demo_url: v.demo_url,
      cover_image_url: v.cover_image_url,
      demo_images: v.demo_images,
      community_id: communityId,
      status: 'published',
      technology_ids: v.technologies.map((t) => t.id),
    };
    try {
      const saved = project ? await updateProject({ projectSlug: project.slug, ...body }).unwrap() : await createProject(body).unwrap();
      customToast.success({ message: project ? 'Projet mis à jour.' : 'Projet partagé avec la communauté.' });
      onDone(saved);
    } catch (error) {
      const { message, fields } = parseApiError(error);
      let onField = false;
      for (const field of FIELDS) {
        if (fields[field]) {
          setError(field, { message: fields[field] });
          onField = true;
        }
      }
      if (!onField) customToast.error({ message });
    }
  };

  return {
    form,
    technologies: watch('technologies'),
    coverImageUrl: watch('cover_image_url'),
    demoImages: watch('demo_images'),
    addTechnology,
    removeTechnology,
    setCoverImageUrl,
    setDemoImages,
    onSubmit: handleSubmit(onSubmit),
  };
}

export default UseProjectForm;
