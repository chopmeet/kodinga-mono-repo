import { PauseCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kodinga/ui';
import type { User } from '@/utils/api/user/user.type';
import { getName } from '@/utils/Utils';

type Props = {
  user: User | null;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

/** The reason is optional for the api, but it lands in the audit log: worth asking */
function SuspendUserModal({ user, isLoading, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (user) setReason('');
  }, [user]);
  const name = user ? getName(user) || user.email : '';

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && !isLoading && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspendre le compte de {name} ?</DialogTitle>
          <DialogDescription>Il ne pourra plus se connecter tant que le compte n'est pas réactivé.</DialogDescription>
        </DialogHeader>
        <div>
          <label htmlFor="suspend-reason" className="custom-form-label mb-1 block">
            Motif (facultatif)
          </label>
          <textarea
            id="suspend-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Visible dans le journal d'audit"
            className="custom-form-control block w-full bg-background px-4 py-2"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Annuler
          </Button>
          <Button variant="danger" onClick={() => onConfirm(reason.trim())} isLoading={isLoading}>
            <PauseCircle />
            Suspendre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SuspendUserModal;
