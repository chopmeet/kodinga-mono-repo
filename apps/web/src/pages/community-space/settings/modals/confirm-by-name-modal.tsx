import { type ReactNode, useEffect, useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kodinga-mono-repo/ui';

type Props = {
  open: boolean;
  title: string;
  description: ReactNode;
  /** The user types this exact text to unlock the action */
  confirmText: string;
  actionLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
};

/** Irreversible actions: the button stays disabled until the community name is typed */
function ConfirmByNameModal({ open, title, description, confirmText, actionLabel, onCancel, onConfirm }: Props) {
  const [typed, setTyped] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const confirm = async () => {
    setIsLoading(true);
    await onConfirm();
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isLoading && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div>{description}</div>
          </DialogDescription>
        </DialogHeader>
        <div>
          <label htmlFor="confirm-by-name" className="custom-form-label mb-1 block">
            Tapez <span className="font-semibold text-slate-900">{confirmText}</span> pour confirmer
          </label>
          <input
            id="confirm-by-name"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="custom-form-control block w-full bg-background px-4 py-2"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Annuler
          </Button>
          <Button variant="danger" onClick={confirm} disabled={typed.trim() !== confirmText} isLoading={isLoading}>
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmByNameModal;
