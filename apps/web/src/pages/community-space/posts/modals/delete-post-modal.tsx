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
} from '@kodinga/ui';
import type { AdminPost } from '@/data/admin-community-details.data';

type DeletablePost = Pick<AdminPost, 'title' | 'author' | 'comments_count'>;

type Props<P extends DeletablePost> = {
  post: P | null;
  onCancel: () => void;
  onConfirm: (post: P) => void | Promise<void>;
};

function DeletePostModal<P extends DeletablePost = AdminPost>({ post, onCancel, onConfirm }: Props<P>) {
  const [isLoading, setIsLoading] = useState(false);

  const confirm = async () => {
    if (!post) return;
    setIsLoading(true);
    try {
      await onConfirm(post);
    } finally {
      setIsLoading(false);
    }
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
