import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kodinga-mono-repo/ui';
import type { AdminPost } from '@/data/admin-community-details.data';

type Props = {
  post: AdminPost | null;
  onCancel: () => void;
  onConfirm: (post: AdminPost) => void;
};

function DeletePostModal({ post, onCancel, onConfirm }: Props) {
  const [isLoading, setIsLoading] = useState(false);

  const confirm = async () => {
    if (!post) return;
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsLoading(false);
    onConfirm(post);
  };

  return (
    <Dialog open={!!post} onOpenChange={(open) => !open && !isLoading && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer cette publication ?</DialogTitle>
          <DialogDescription>
            « {post?.title} » de {post?.author} sera retirée du fil avec ses {post?.comments_count ?? 0} commentaires.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Annuler
          </Button>
          <Button variant="danger" onClick={confirm} isLoading={isLoading}>
            <Trash2 />
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeletePostModal;
