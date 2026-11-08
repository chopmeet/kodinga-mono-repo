import { Controller } from 'react-hook-form';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  SelectInput,
  TextareaInput,
} from '@kodinga/ui';
import { BannerUploadField } from '@/pages/shared/banner-upload-field';
import SettingSwitch from '@/pages/shared/setting-switch';
import type { Course, CourseLevel } from '@/utils/api/course/course.type';
import { courseLevelLabel } from '../course-labels';
import UseCourseForm from '../form/UseCourseForm';

type Props = { slug: string; open: boolean; course: Course | null; onClose: () => void; onSaved?: (course: Course) => void };

function CourseModal({ slug, open, course, onClose, onSaved }: Props) {
  const { form, onSubmit } = UseCourseForm({
    slug,
    course,
    open,
    onDone: (saved) => {
      onSaved?.(saved);
      onClose();
    },
  });
  const {
    register,
    control,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent position="top" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{course ? 'Modifier la formation' : 'Nouvelle formation'}</DialogTitle>
          <DialogDescription>{course ? 'Les membres voient les changements tout de suite.' : 'Elle reste en brouillon tant que vous ne la publiez pas.'}</DialogDescription>
        </DialogHeader>
        <form id="course-form" onSubmit={onSubmit} noValidate>
          <Input id="course-title" label="Titre" required error={errors.title?.message} {...register('title')} />
          <TextareaInput id="course-description" label="Description" rows={4} {...register('description')} />
          <SelectInput
            label="Niveau"
            options={(Object.keys(courseLevelLabel) as CourseLevel[]).map((value) => ({ value, label: courseLevelLabel[value] }))}
            {...register('level')}
          />
          <Controller
            control={control}
            name="thumbnail_url"
            render={({ field }) => (
              <BannerUploadField
                id="course-thumbnail"
                label="Image de la formation (facultatif)"
                value={field.value}
                onChange={field.onChange}
                error={errors.thumbnail_url?.message}
                className="mb-4"
              />
            )}
          />
          <Controller
            control={control}
            name="is_sequential"
            render={({ field }) => (
              <SettingSwitch
                label="Parcours progressif"
                description="Chaque leçon se débloque une fois la précédente terminée."
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" form="course-form" isLoading={isSubmitting}>
            {course ? 'Enregistrer' : 'Créer la formation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CourseModal;
