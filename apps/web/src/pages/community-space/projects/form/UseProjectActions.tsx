import { EyeOff, Pencil, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';

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
import { useDeleteProjectMutation, useFeatureProjectMutation, useUpdateProjectMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { ProjectListItem } from '@/utils/api/project/project.type';
import { isAdmin, useUser } from '@/utils/Utils';
import { isCommunityManager, useCommunitySpace } from '../../community-space-context';

/**
 * Actions on a project. The api lets only its owner (or the platform staff) edit and delete it;
 * the owner and admins of the community feature it, and take it out of the community (it stays
 * on the profile of its owner).
 */
function UseProjectActions({ onEdit, afterDelete }: { onEdit: (p: ProjectListItem) => void; afterDelete?: () => void }) {
  const space = useCommunitySpace();
  const user = useUser();
  const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation();
  const [featureProject] = useFeatureProjectMutation();
  const [updateProject, { isLoading: isRemoving }] = useUpdateProjectMutation();
  /** The project to take out of the community, waiting for the confirmation */
  const [removing, setRemoving] = useState<ProjectListItem | null>(null);
  const [confirm, setConfirm] = useState<ProjectListItem | null>(null);

  const toggleFeatured = async (p: ProjectListItem) => {
    try {
      await featureProject({ projectSlug: p.slug, is_featured: !p.is_featured }).unwrap();
      customToast.success({ message: p.is_featured ? `« ${p.title} » n’est plus mis en avant.` : `« ${p.title} » est mis en avant.` });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  const isOwner = (p: Pick<ProjectListItem, 'owner'>) => !!user && p.owner.id === user.id;
  const canHandle = (p: Pick<ProjectListItem, 'owner'>) => isOwner(p) || isAdmin(user);

  /** `withEdit: false` when the page shows its own "Modifier" button */
  const actionsFor = (p: ProjectListItem, { withEdit = true } = {}): RowAction[] => {
    const actions: RowAction[] = [];
    if (withEdit && canHandle(p)) {
      actions.push({ label: 'Modifier', icon: <Pencil />, onSelect: () => onEdit(p) });
    }
    if (isCommunityManager(space)) {
      actions.push({ label: p.is_featured ? 'Ne plus mettre en avant' : 'Mettre en avant', icon: <Star />, onSelect: () => toggleFeatured(p) });
      if (!isOwner(p)) actions.push({ label: 'Retirer de la communauté', icon: <EyeOff />, onSelect: () => setRemoving(p) });
    }
    if (canHandle(p)) {
      actions.push({ label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => setConfirm(p) });
    }
    return actions;
  };

  const runDelete = async () => {
    if (!confirm) return;
    try {
      await deleteProject(confirm.slug).unwrap();
      customToast.success({ message: `« ${confirm.title} » a été supprimé.` });
      setConfirm(null);
      afterDelete?.();
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  const runRemove = async () => {
    if (!removing) return;
    try {
      await updateProject({ projectSlug: removing.slug, community_id: null }).unwrap();
      customToast.success({ message: `« ${removing.title} » a été retiré de ${space.community.name}.` });
      setRemoving(null);
      afterDelete?.();
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  const removeDialog = (
    <Dialog open={!!removing} onOpenChange={(open) => !open && !isRemoving && setRemoving(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retirer « {removing?.title} » de la communauté ?</DialogTitle>
          <DialogDescription>
            Il n’apparaîtra plus dans {space.community.name}. Le projet n’est pas supprimé : il reste sur le profil de son auteur, qui pourra le rattacher de nouveau.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRemoving(null)} disabled={isRemoving}>
            Retour
          </Button>
          <Button onClick={runRemove} isLoading={isRemoving}>
            <EyeOff />
            Retirer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const confirmDialog = (
    <>
    {removeDialog}
    <Dialog open={!!confirm} onOpenChange={(open) => !open && !isDeleting && setConfirm(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer « {confirm?.title} » ?</DialogTitle>
          <DialogDescription>Le projet, ses votes et ses commentaires seront supprimés définitivement.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirm(null)} disabled={isDeleting}>
            Retour
          </Button>
          <Button variant="danger" onClick={runDelete} isLoading={isDeleting}>
            <Trash2 />
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );

  return { 
    isOwner, 
    canHandle, 
    actionsFor, 
    confirmDialog 
  };
}

export default UseProjectActions;
