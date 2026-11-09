import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  return (
    <Dialog open={!!comment} onOpenChange={(open) => !open && !isDeleting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('community.comment.deleteTitle')}</DialogTitle>
          <DialogDescription>{t('community.comment.deleteText')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            {t('common.actions.cancel')}
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
            <Trash2 /> {t('community.comment.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
