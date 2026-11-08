import type { ReactNode } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kodinga/ui';

export type ConfirmAction = {
  title: string;
  description: string;
  confirmLabel: string;
  icon: ReactNode;
  run: () => Promise<boolean>;
};

type Props = {
  action: ConfirmAction | null;
  isLoading: boolean;
  onCancel: () => void;
};

/** Confirmation of a destructive action of the details tabs (cancel, delete, close) */
function ConfirmActionModal({ action, isLoading, onCancel }: Props) {
  const confirm = async () => {
    if (action && (await action.run())) onCancel();
  };

  return (
    <Dialog open={!!action} onOpenChange={(open) => !open && !isLoading && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action?.title}</DialogTitle>
          <DialogDescription>{action?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Retour
          </Button>
          <Button variant="danger" onClick={confirm} isLoading={isLoading}>
            {action?.icon}
            {action?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmActionModal;
