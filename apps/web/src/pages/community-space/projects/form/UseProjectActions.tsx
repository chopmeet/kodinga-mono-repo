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
} from '@kodinga-mono-repo/ui';
import type { RowAction } from '@/pages/shared/row-actions';
import { useDeleteProjectMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { ProjectListItem } from '@/utils/api/project/project.type';
import { isAdmin, useUser } from '@/utils/Utils';
import { canManageEvents, useCommunitySpace } from '../../community-space-context';

/**
 * Actions on a project. The api lets only its owner (or the platform staff) edit and delete it;
 * featuring a project or taking it out of the community are not in the api yet ("Bientôt").
 */
function UseProjectActions({ onEdit, afterDelete }: { onEdit: (p: ProjectListItem) => void; afterDelete?: () => void }) {
  const space = useCommunitySpace();
  const user = useUser();
  const [deleteProject, { isLoading: isDeleting }] = useDeleteProjectMutation();
  const [confirm, setConfirm] = useState<ProjectListItem | null>(null);

  const isOwner = (p: Pick<ProjectListItem, 'owner'>) => !!user && p.owner.id === user.id;
  const canHandle = (p: Pick<ProjectListItem, 'owner'>) => isOwner(p) || isAdmin(user);

  /** `withEdit: false` when the page shows its own "Modifier" button */
  const actionsFor = (p: ProjectListItem, { withEdit = true } = {}): RowAction[] => {
    const actions: RowAction[] = [];
    if (withEdit && canHandle(p)) {
      actions.push({ label: 'Modifier', icon: <Pencil />, onSelect: () => onEdit(p) });
    }
    if (canManageEvents(space)) {
      actions.push({ label: p.is_featured ? 'Ne plus mettre en avant' : 'Mettre en avant', icon: <Star />, soon: true, onSelect: () => undefined });
      if (!isOwner(p)) actions.push({ label: 'Retirer de la communauté', icon: <EyeOff />, soon: true, onSelect: () => undefined });
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

  const confirmDialog = (
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
  );

  return { isOwner, canHandle, actionsFor, confirmDialog };
}

export default UseProjectActions;
