import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from '@kodinga/ui';
import { xof } from '@/utils/Utils';
import type { CommunityPayout } from '@/utils/api/billing/billing.type';

type Props = {
  payout: CommunityPayout | null;
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (payoutId: string, reason: string, note?: string) => Promise<void>;
};

export default function RejectPayoutModal({ payout, isOpen, isLoading, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  if (!payout) return null;

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setError('Le motif du refus est obligatoire pour informer le créateur.');
      return;
    }
    setError('');
    await onConfirm(payout.id, reason.trim(), note.trim() || undefined);
    setReason('');
    setNote('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
      <DialogContent position="top">
        <DialogHeader>
          <DialogTitle className="text-red-600">Rejeter la demande de reversement</DialogTitle>
          <DialogDescription>
            Cette action refusera la demande de {xof(Number(payout.amount))} pour la communauté{' '}
            <strong className="text-foreground">{payout.community_name || 'Inconnue'}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Remboursement automatique</p>
              <p className="text-xs mt-0.5">
                Le montant total réservé ({xof(Number(payout.amount))}) sera immédiatement réinjecté dans le solde disponible du créateur.
              </p>
            </div>
          </div>

          <Input
            id="admin-reject-reason"
            label="Motif du refus (visible par le créateur)"
            required
            placeholder="Ex : Numéro Wave erroné, informations du compte non conformes..."
            value={reason}
            error={error}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
          />

          <Input
            id="admin-reject-note"
            label="Note interne réservée aux admins (optionnelle)"
            placeholder="Ex : Contacté par téléphone, demande de réémission avec nouveau numéro..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button variant="danger" onClick={handleConfirm} isLoading={isLoading}>
            Confirmer le rejet et rembourser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

