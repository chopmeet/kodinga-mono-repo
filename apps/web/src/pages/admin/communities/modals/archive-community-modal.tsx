import { Archive } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kodinga/ui';
import type { CommunityListItem } from '@/utils/api/community/community.type';

type Props = {
  community: CommunityListItem | null;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function ArchiveCommunityModal({ community, isLoading, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={!!community} onOpenChange={(open) => !open && !isLoading && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archiver « {community?.name} » ?</DialogTitle>
          <DialogDescription>
            La communauté disparaîtra de l'annuaire et ne sera plus accessible à ses{' '}
            {community?.members_count ?? 0} membres. Ses données sont conservées.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Annuler
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={isLoading}>
            <Archive />
            Archiver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ArchiveCommunityModal;
