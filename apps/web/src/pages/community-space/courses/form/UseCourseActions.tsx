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
  const [updateCourse, { isLoading: updating }] = useUpdateCourseMutation();
  const [deleteCourse, { isLoading: deleting }] = useDeleteCourseMutation();
  const [toDelete, setToDelete] = useState<Course | null>(null);
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishStep, setPublishStep] = useState('');
  const [publishingCourseId, setPublishingCourseId] = useState<string | null>(null);

  const togglePublished = async (course: Course) => {
    if (!course.is_published && course.lessons_count === 0) {
      customToast.error({ message: 'Ajoutez au moins une leçon avant de publier.' });
      return;
    }

    const isPublishAction = !course.is_published;
    let timer: NodeJS.Timeout | null = null;

    if (isPublishAction) {
      setPublishingCourseId(course.id);
      setPublishProgress(20);
      setPublishStep('Validation de la structure et des leçons…');

      let currentPct = 20;
      timer = setInterval(() => {
        if (currentPct < 85) {
          currentPct += currentPct < 50 ? 15 : 10;
          setPublishProgress(currentPct);
          if (currentPct >= 40 && currentPct < 70) {
            setPublishStep('Vérification des vidéos et ressources associées…');
          } else if (currentPct >= 70) {
            setPublishStep('Mise en ligne et notification des membres…');
          }
        }
      }, 180);
    }

    try {
      await updateCourse({ slug, courseSlug: course.slug, is_published: isPublishAction }).unwrap();
      if (timer) clearInterval(timer);
      if (isPublishAction) {
        setPublishProgress(100);
        setPublishStep('Formation publiée avec succès !');
        setTimeout(() => {
          setPublishProgress(0);
          setPublishStep('');
          setPublishingCourseId(null);
        }, 500);
      }
      customToast.success({
        message: course.is_published ? `« ${course.title} » repasse en brouillon.` : `« ${course.title} » est publiée avec succès.`,
      });
    } catch (error) {
      if (timer) clearInterval(timer);
      setPublishProgress(0);
      setPublishStep('');
      setPublishingCourseId(null);
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

  return {
    canManage,
    togglePublished,
    isPublishing: updating || publishProgress > 0,
    publishProgress,
    publishStep,
    publishingCourseId,
    actionsFor,
    confirmDialog,
  };
}

export default UseCourseActions;
