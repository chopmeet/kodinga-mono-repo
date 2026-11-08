import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast } from '@kodinga/ui';
import { useCreateCourseMutation, useUpdateCourseMutation } from '@/utils/api/community/community.api';
import type { Course } from '@/utils/api/course/course.type';
import { parseApiError } from '@/utils/api/errors';

const schema = z.object({
  title: z.string().trim().min(3, 'Au moins 3 caractères').max(255, '255 caractères maximum'),
  description: z.string().trim(),
  level: z.enum(['all_levels', 'beginner', 'intermediate', 'advanced']),
  thumbnail_url: z.string().trim().refine((v) => !v || /^https?:\/\/\S+\.\S+/.test(v), 'Lien invalide (https://…)'),
  is_sequential: z.boolean(),
});

export type CourseFormValues = z.infer<typeof schema>;

const toValues = (c: Course | null): CourseFormValues => ({
  title: c?.title ?? '',
  description: c?.description ?? '',
  level: c?.level ?? 'all_levels',
  thumbnail_url: c?.thumbnail_url ?? '',
  is_sequential: c?.is_sequential ?? true,
});

/** Create (as a draft) or edit a course: POST / PATCH communities/<slug>/courses/ */
function UseCourseForm({ slug, course, open, onDone }: { slug: string; course: Course | null; open: boolean; onDone: (saved: Course) => void }) {
  const [createCourse] = useCreateCourseMutation();
  const [updateCourse] = useUpdateCourseMutation();
  const form = useForm<CourseFormValues>({ resolver: zodResolver(schema), defaultValues: toValues(null) });

  useEffect(() => {
    if (open) form.reset(toValues(course));
  }, [open, course, form]);

  const onSubmit = async (values: CourseFormValues) => {
    try {
      const saved = course
        ? await updateCourse({ slug, courseSlug: course.slug, ...values }).unwrap()
        : await createCourse({ slug, ...values, is_published: false }).unwrap();
      customToast.success({ message: course ? 'Formation mise à jour.' : 'Formation créée en brouillon.' });
      onDone(saved);
    } catch (error) {
      const { message, fields } = parseApiError(error);
      if (fields.title) form.setError('title', { message: fields.title });
      else customToast.error({ message });
    }
  };

  return { form, onSubmit: form.handleSubmit(onSubmit) };
}

export default UseCourseForm;
