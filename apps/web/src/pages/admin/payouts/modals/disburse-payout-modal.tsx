import { useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from '@kodinga/ui';
import { payoutMethodLabel, xof } from '@/utils/Utils';
import type { CommunityPayout } from '@/utils/api/billing/billing.type';

type Props = {
  payout: CommunityPayout | null;
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (payoutId: string, note?: string) => Promise<void>;
};

export default function DisbursePayoutModal({ payout, isOpen, isLoading, onClose, onConfirm }: Props) {
  const [note, setNote] = useState('');

  if (!payout) return null;

  const grossAmount = Number(payout.amount || 0);
  const feeAmount = Number(payout.fee_amount || grossAmount * 0.02);
  const netAmount = Number(payout.net_amount || grossAmount - feeAmount);

  const handleConfirm = async () => {
    await onConfirm(payout.id, note.trim() || undefined);
    setNote('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && !open && onClose()}>
      <DialogContent position="top" className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="size-5" />
            <DialogTitle>Exécuter le virement PayDunya</DialogTitle>
          </div>
          <DialogDescription>
            Cette opération initie le transfert bancaire ou mobile money direct vers le compte du créateur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Financial Breakdown Card */}
          <div className="rounded-xl border border-border bg-subtle p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Communauté :</span>
              <span className="font-semibold text-foreground">{payout.community_name || 'N/A'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Bénéficiaire :</span>
              <span className="font-medium text-foreground">
                {payout.account_name ? `${payout.account_name} (${payout.account_identifier})` : payout.account_identifier}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Canal de versement :</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase text-primary">
                {payoutMethodLabel[payout.payment_method] || payout.payment_method}
              </span>
            </div>

            <div className="border-t border-border pt-2 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Montant brut demandé :</span>
                <span className="tabular-nums font-medium text-foreground">{xof(grossAmount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Commission Kodinga (2%) :</span>
                <span className="tabular-nums font-medium text-emerald-600">- {xof(feeAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 text-base font-bold text-foreground">
                <span>Net à décaisser :</span>
                <span className="tabular-nums text-primary">{xof(netAmount)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span>Le statut passera à <strong>Effectué</strong> et une référence PayDunya sera enregistrée.</span>
          </div>

          <Input
            id="admin-disburse-note"
            label="Note interne administrative (optionnelle)"
            placeholder="Ex : Virement direct Wave validé par le superadmin..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} isLoading={isLoading}>
            <span>Envoyer le virement</span>
            <ArrowRight className="size-4 ml-1" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

