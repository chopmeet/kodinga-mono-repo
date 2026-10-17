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
import { useCreateModuleMutation, useUpdateModuleMutation } from '@/utils/api/community/community.api';
import type { CourseModule } from '@/utils/api/course/course.type';
import { parseApiError } from '@/utils/api/errors';

type Props = { slug: string; courseSlug: string; open: boolean; module: CourseModule | null; nextOrder: number; onClose: () => void };

/** Create (at the end) or rename a module */
function ModuleModal({ slug, courseSlug, open, module, nextOrder, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createModule, { isLoading: creating }] = useCreateModuleMutation();
  const [updateModule, { isLoading: updating }] = useUpdateModuleMutation();
  const busy = creating || updating;

  useEffect(() => {
    if (!open) return;
    setTitle(module?.title ?? '');
    setDescription(module?.description ?? '');
    setError(null);
  }, [open, module]);

  const save = async () => {
    if (title.trim().length < 2) return setError('Donnez un titre au module');
    try {
      if (module) await updateModule({ slug, courseSlug, moduleId: module.id, title: title.trim(), description: description.trim() }).unwrap();
      else await createModule({ slug, courseSlug, title: title.trim(), description: description.trim(), order: nextOrder }).unwrap();
      customToast.success({ message: module ? 'Module mis à jour.' : 'Module ajouté.' });
      onClose();
    } catch (err) {
      setError(parseApiError(err).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{module ? 'Modifier le module' : 'Nouveau module'}</DialogTitle>
          <DialogDescription>Un module regroupe des leçons sur un même thème.</DialogDescription>
        </DialogHeader>
        <form
          id="module-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex flex-col gap-3"
        >
          <label className="flex flex-col gap-1">
            <span className="custom-form-label">Titre</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="custom-form-control bg-background px-4 py-2" autoFocus />
          </label>
          <label className="flex flex-col gap-1">
            <span className="custom-form-label">Description (facultatif)</span>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="custom-form-control bg-background px-4 py-2" />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button type="submit" form="module-form" isLoading={busy}>
            {module ? 'Enregistrer' : 'Ajouter le module'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ModuleModal;
