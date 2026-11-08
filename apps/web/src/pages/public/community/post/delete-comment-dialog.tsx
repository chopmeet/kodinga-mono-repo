import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kodinga/ui';
import type { PostComment } from '@/utils/api/community/community.type';

type Props = {
  comment: PostComment | null;
  onClose: () => void;
  /** true once deleted: the dialog closes */
  onDelete: (comment: PostComment) => Promise<boolean>;
};

/** Confirms the deletion of a comment (its replies go with it) */
export function DeleteCommentDialog({ comment, onClose, onDelete }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  return (
    <Dialog open={!!comment} onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer ce commentaire ?</DialogTitle>
          <DialogDescription>Ses réponses seront supprimées avec lui.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Annuler
          </Button>
          <Button
            variant="danger"
            isLoading={isDeleting}
            onClick={async () => {
              if (!comment) return;
              setIsDeleting(true);
              const ok = await onDelete(comment);
              setIsDeleting(false);
              if (ok) onClose();
            }}
          >
            <Trash2 /> Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
