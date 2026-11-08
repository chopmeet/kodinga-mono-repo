import { Eye, EyeOff, Pencil, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Button,
  customToast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kodinga/ui';
import type { RowAction } from '@/pages/shared/row-actions';
import { useDeleteCourseMutation, useUpdateCourseMutation } from '@/utils/api/community/community.api';
import type { Course } from '@/utils/api/course/course.type';
import { parseApiError } from '@/utils/api/errors';
import { canManageCourses, useCommunitySpace } from '../../community-space-context';

/** Publish, unpublish, edit and delete a course (owner and admins, like the api) */
function UseCourseActions({ onEdit, afterDelete }: { onEdit: (course: Course) => void; afterDelete?: () => void }) {
  const space = useCommunitySpace();
  const slug = space.community.slug;
  const canManage = canManageCourses(space);
  const navigate = useNavigate();
  const [updateCourse] = useUpdateCourseMutation();
  const [deleteCourse, { isLoading: deleting }] = useDeleteCourseMutation();
  const [toDelete, setToDelete] = useState<Course | null>(null);

  const togglePublished = async (course: Course) => {
    if (!course.is_published && course.lessons_count === 0) {
      customToast.error({ message: 'Ajoutez au moins une leçon avant de publier.' });
      return;
    }
    try {
      await updateCourse({ slug, courseSlug: course.slug, is_published: !course.is_published }).unwrap();
      customToast.success({ message: course.is_published ? `« ${course.title} » repasse en brouillon.` : `« ${course.title} » est publiée.` });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  const actionsFor = (course: Course, { withOpen = true } = {}): RowAction[] => {
    const actions: RowAction[] = withOpen ? [{ label: 'Ouvrir', icon: <Eye />, onSelect: () => navigate(`/c/${slug}/courses/${course.slug}`) }] : [];
    if (!canManage) return actions;
    actions.push(
      course.is_published
        ? { label: 'Repasser en brouillon', icon: <EyeOff />, onSelect: () => togglePublished(course) }
        : { label: 'Publier', icon: <Send />, onSelect: () => togglePublished(course) },
      { label: 'Modifier', icon: <Pencil />, onSelect: () => onEdit(course) },
      { label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => setToDelete(course) }
    );
    return actions;
  };

  const confirmDialog = (
    <Dialog open={!!toDelete} onOpenChange={(open) => !open && !deleting && setToDelete(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer « {toDelete?.title} » ?</DialogTitle>
          <DialogDescription>Ses {toDelete?.modules_count ?? 0} modules et {toDelete?.lessons_count ?? 0} leçons seront supprimés, ainsi que la progression des membres.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
            Retour
          </Button>
          <Button
            variant="danger"
            isLoading={deleting}
            onClick={async () => {
              if (!toDelete) return;
              try {
                await deleteCourse({ slug, courseSlug: toDelete.slug }).unwrap();
                customToast.success({ message: `« ${toDelete.title} » a été supprimée.` });
                setToDelete(null);
                afterDelete?.();
              } catch (error) {
                customToast.error({ message: parseApiError(error).message });
              }
            }}
          >
            <Trash2 />
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { canManage, togglePublished, actionsFor, confirmDialog };
}

export default UseCourseActions;
