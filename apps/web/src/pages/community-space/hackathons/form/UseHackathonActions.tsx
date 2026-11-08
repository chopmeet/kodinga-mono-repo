import { ArrowRight, Ban, Eye, Pencil, Send, Trash2 } from 'lucide-react';
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
import {
  useDeleteHackathonMutation,
  usePublishHackathonMutation,
  useTransitionHackathonMutation,
} from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { HackathonListItem } from '@/utils/api/hackathon/hackathon.type';
import { canManageHackathons, useCommunitySpace } from '../../community-space-context';
import { isFinal, NEXT_STEP } from '../hackathon-labels';

type Confirm = { hackathon: HackathonListItem; kind: 'cancel' | 'delete' } | null;

/** Lifecycle of a hackathon for the list and the detail page (owner and admins, like the api) */
function UseHackathonActions({ afterDelete }: { afterDelete?: () => void } = {}) {
  const space = useCommunitySpace();
  const slug = space.community.slug;
  const canManage = canManageHackathons(space);
  const navigate = useNavigate();
  const [publish] = usePublishHackathonMutation();
  const [transition] = useTransitionHackathonMutation();
  const [remove] = useDeleteHackathonMutation();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  /** Moves to the usual next step (publish for a draft) */
  const nextStep = async (h: HackathonListItem) => {
    const step = NEXT_STEP[h.status];
    if (!step) return;
    try {
      if (h.status === 'draft') await publish({ slug, hackathonSlug: h.slug }).unwrap();
      else await transition({ slug, hackathonSlug: h.slug, status: step.status }).unwrap();
      customToast.success({ message: h.status === 'draft' ? `« ${h.title} » est publié.` : `« ${h.title} » : ${step.label.toLowerCase()}.` });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  const actionsFor = (h: HackathonListItem, { withView = true } = {}): RowAction[] => {
    const actions: RowAction[] = withView
      ? [{ label: 'Voir le détail', icon: <Eye />, onSelect: () => navigate(`/c/${slug}/hackathons/${h.slug}`) }]
      : [];
    if (!canManage) return actions;
    const step = NEXT_STEP[h.status];
    if (step) actions.push({ label: step.label, icon: h.status === 'draft' ? <Send /> : <ArrowRight />, onSelect: () => nextStep(h) });
    if (!isFinal(h.status)) {
      actions.push({ label: 'Modifier', icon: <Pencil />, onSelect: () => navigate(`/c/${slug}/hackathons/${h.slug}/edit`) });
      actions.push({ label: 'Annuler le hackathon', icon: <Ban />, danger: true, onSelect: () => setConfirm({ hackathon: h, kind: 'cancel' }) });
    }
    actions.push({ label: 'Supprimer', icon: <Trash2 />, danger: true, onSelect: () => setConfirm({ hackathon: h, kind: 'delete' }) });
    return actions;
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { hackathon: h, kind } = confirm;
    setBusy(true);
    try {
      if (kind === 'cancel') {
        await transition({ slug, hackathonSlug: h.slug, status: 'cancelled' }).unwrap();
        customToast.success({ message: `« ${h.title} » est annulé.` });
      } else {
        await remove({ slug, hackathonSlug: h.slug }).unwrap();
        customToast.success({ message: `« ${h.title} » a été supprimé.` });
        afterDelete?.();
      }
      setConfirm(null);
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    } finally {
      setBusy(false);
    }
  };

  const confirmDialog = (
    <Dialog open={!!confirm} onOpenChange={(open) => !open && !busy && setConfirm(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {confirm?.kind === 'cancel' ? `Annuler « ${confirm?.hackathon.title} » ?` : `Supprimer « ${confirm?.hackathon.title} » ?`}
          </DialogTitle>
          <DialogDescription>
            {confirm?.kind === 'cancel'
              ? 'Les participants verront le hackathon comme annulé. Il ne pourra pas revenir en brouillon.'
              : 'Le hackathon, ses candidatures, équipes et soumissions seront supprimés définitivement.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
            Retour
          </Button>
          <Button variant="danger" onClick={runConfirm} isLoading={busy}>
            {confirm?.kind === 'cancel' ? <Ban /> : <Trash2 />}
            {confirm?.kind === 'cancel' ? 'Annuler le hackathon' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { canManage, nextStep, actionsFor, confirmDialog };
}

export default UseHackathonActions;
