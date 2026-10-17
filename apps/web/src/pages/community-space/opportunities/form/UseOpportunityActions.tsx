import { Eye, Lock, Pencil, Users } from 'lucide-react';
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
} from '@kodinga-mono-repo/ui';
import type { RowAction } from '@/pages/shared/row-actions';
import { useCloseOpportunityMutation } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { OpportunityListItem } from '@/utils/api/opportunity/opportunity.type';
import { isAdmin, useUser } from '@/utils/Utils';
import { useCommunitySpace } from '../../community-space-context';

/**
 * Actions on an offer for the list and the detail page. The api keeps editing, closing and the
 * applications for the poster (or the platform staff): the rest of the team only opens it.
 */
function UseOpportunityActions({ onEdit, afterClose }: { onEdit: (o: OpportunityListItem) => void; afterClose?: () => void }) {
  const slug = useCommunitySpace().community.slug;
  const user = useUser();
  const navigate = useNavigate();
  const [closeOpportunity, { isLoading: isClosing }] = useCloseOpportunityMutation();
  const [confirm, setConfirm] = useState<OpportunityListItem | null>(null);

  const isPoster = (o: Pick<OpportunityListItem, 'poster'>) => !!user && o.poster.id === user.id;
  /** OpportunityService: the poster, or the platform staff */
  const canHandle = (o: Pick<OpportunityListItem, 'poster'>) => isPoster(o) || isAdmin(user);
  const href = (o: OpportunityListItem) => `/c/${slug}/opportunities/${o.slug}`;

  const actionsFor = (o: OpportunityListItem, { withView = true } = {}): RowAction[] => {
    const actions: RowAction[] = withView ? [{ label: 'Voir le détail', icon: <Eye />, onSelect: () => navigate(href(o)) }] : [];
    if (!canHandle(o) || o.status !== 'open') return actions;
    if (withView) actions.push({ label: 'Candidatures', icon: <Users />, onSelect: () => navigate(`${href(o)}#candidatures`) });
    actions.push({ label: 'Modifier', icon: <Pencil />, onSelect: () => onEdit(o) });
    actions.push({ label: 'Clôturer', icon: <Lock />, danger: true, onSelect: () => setConfirm(o) });
    return actions;
  };

  const runClose = async () => {
    if (!confirm) return;
    try {
      await closeOpportunity(confirm.slug).unwrap();
      customToast.success({ message: `« ${confirm.title} » est clôturée.` });
      setConfirm(null);
      afterClose?.();
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  const confirmDialog = (
    <Dialog open={!!confirm} onOpenChange={(open) => !open && !isClosing && setConfirm(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clôturer « {confirm?.title} » ?</DialogTitle>
          <DialogDescription>
            L'offre ne sera plus visible et n'acceptera plus de candidatures. Les {confirm?.applications_count ?? 0} candidatures reçues sont conservées.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirm(null)} disabled={isClosing}>
            Retour
          </Button>
          <Button variant="danger" onClick={runClose} isLoading={isClosing}>
            <Lock />
            Clôturer l'offre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { isPoster, canHandle, actionsFor, confirmDialog };
}

export default UseOpportunityActions;
