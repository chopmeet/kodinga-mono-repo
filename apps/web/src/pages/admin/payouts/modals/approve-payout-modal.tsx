import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from '@kodinga/ui';
import { xof } from '@/utils/Utils';
import type { CommunityPayout } from '@/utils/api/billing/billing.type';

type Props = {
  payout: CommunityPayout | null;
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (payoutId: string, note?: string) => Promise<void>;
};

export default function ApprovePayoutModal({ payout, isOpen, isLoading, onClose, onConfirm }: Props) {
  const [note, setNote] = useState('');

  if (!payout) return null;

  const handleConfirm = async () => {
    await onConfirm(payout.id, note.trim() || undefined);
    setNote('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
      <DialogContent position="top">
        <DialogHeader>
          <DialogTitle>Approuver la demande de reversement</DialogTitle>
          <DialogDescription>
            Vous êtes sur le point d'approuver la demande de {xof(Number(payout.amount))} pour la communauté{' '}
            <strong className="text-foreground">{payout.community_name || 'Inconnue'}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-subtle p-3 text-sm space-y-1">
            <p className="text-muted-foreground">
              Demandeur : <span className="font-medium text-foreground">{payout.requested_by_username}</span>
            </p>
            <p className="text-muted-foreground">
              Moyen : <span className="font-medium uppercase text-foreground">{payout.payment_method}</span> ({payout.account_identifier})
            </p>
            <p className="text-muted-foreground">
              Net à percevoir : <span className="font-semibold text-foreground">{xof(Number(payout.net_amount || payout.amount))}</span>
            </p>
          </div>

          <Input
            id="admin-approve-note"
            label="Note interne (optionnelle)"
            placeholder="Ex : Identité vérifiée, virement en cours de préparation..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} isLoading={isLoading}>
            Confirmer l'approbation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

