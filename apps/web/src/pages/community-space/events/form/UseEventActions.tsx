import { Ban, CircleStop, Eye, Pencil, Radio, Trash2 } from 'lucide-react';
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
import { useDeleteEventMutation, useUpdateEventStatusMutation } from '@/utils/api/community/community.api';
import type { CommunityEvent, EventStatus } from '@/utils/api/event/event.type';
import { parseApiError } from '@/utils/api/errors';
import { canManageEvents, canStartLive, useCommunitySpace } from '../../community-space-context';

type Confirm = { event: CommunityEvent; kind: 'cancel' | 'delete' } | null;

/**
 * Actions on an event for the list and the detail page. Managing (status, edit, delete) follows
 * the api: owner and admins (canManageEvents); the others only open the event.
 */
function UseEventActions({ onEdit, afterDelete }: { onEdit: (event: CommunityEvent) => void; afterDelete?: () => void }) {
  const space = useCommunitySpace();
  const slug = space.community.slug;
  const canManage = canManageEvents(space);
  const canLive = canStartLive(space);
  const navigate = useNavigate();
  const [updateStatus] = useUpdateEventStatusMutation();
  const [deleteEvent, { isLoading: isDeleting }] = useDeleteEventMutation();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const changeStatus = async (event: CommunityEvent, status: EventStatus, message: string) => {
    try {
      await updateStatus({ slug, eventId: event.id, status }).unwrap();
      customToast.success({ message });
      return true;
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
      return false;
    }
  };

  const actionsFor = (event: CommunityEvent, { withView = true } = {}): RowAction[] => {
    const actions: RowAction[] = withView
      ? [{ label: 'Voir le détail', icon: <Eye />, onSelect: () => navigate(`/c/${slug}/events/${event.id}`) }]
      : [];
    if (event.format === 'livekit' && (event.status === 'scheduled' || event.status === 'live')) {
      actions.push({ label: 'Ouvrir le salon live', icon: <Radio />, onSelect: () => navigate(`/communities/${slug}/events/${event.id}/live`) });
    }
    if (!canManage) return actions;
    if (event.status === 'scheduled') {
      actions.push({ label: 'Modifier', icon: <Pencil />, onSelect: () => onEdit(event) });
      if (canLive) {
        actions.push({ label: 'Démarrer le direct', icon: <Radio />, onSelect: () => changeStatus(event, 'live', `« ${event.title} » est en direct.`) });
      }
      actions.push({ label: 'Annuler', icon: <Ban />, danger: true, onSelect: () => setConfirm({ event, kind: 'cancel' }) });
    }
    if (event.status === 'live') {
      actions.push({ label: 'Terminer', icon: <CircleStop />, onSelect: () => changeStatus(event, 'completed', `« ${event.title} » est terminé.`) });
    }
    actions.push({ label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => setConfirm({ event, kind: 'delete' }) });
    return actions;
  };

  const runConfirm = async () => {
    if (!confirm) return;
    if (confirm.kind === 'cancel') {
      setIsCancelling(true);
      const ok = await changeStatus(confirm.event, 'cancelled', `« ${confirm.event.title} » est annulé.`);
      setIsCancelling(false);
      if (ok) setConfirm(null);
      return;
    }
    try {
      await deleteEvent({ slug, eventId: confirm.event.id }).unwrap();
      customToast.success({ message: `« ${confirm.event.title} » a été supprimé.` });
      setConfirm(null);
      afterDelete?.();
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  const busy = isDeleting || isCancelling;
  const confirmDialog = (
    <Dialog open={!!confirm} onOpenChange={(open) => !open && !busy && setConfirm(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {confirm?.kind === 'cancel' ? `Annuler « ${confirm?.event.title} » ?` : `Supprimer « ${confirm?.event.title} » ?`}
          </DialogTitle>
          <DialogDescription>
            {confirm?.kind === 'cancel'
              ? `Ses ${confirm?.event.attendees_count ?? 0} inscrits verront l'événement comme annulé.`
              : "L'événement et ses inscriptions seront supprimés définitivement."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
            Retour
          </Button>
          <Button variant="danger" onClick={runConfirm} isLoading={busy}>
            {confirm?.kind === 'cancel' ? <Ban /> : <Trash2 />}
            {confirm?.kind === 'cancel' ? "Annuler l'événement" : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { canManage, actionsFor, confirmDialog };
}

export default UseEventActions;
