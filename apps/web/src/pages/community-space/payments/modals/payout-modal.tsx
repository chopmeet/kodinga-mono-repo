import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, SelectInput } from '@kodinga/ui';
import { payoutMethodLabel, xof } from '@/utils/Utils';
import type { PayoutMethod, PayoutRequest } from '@/utils/api/billing/billing.type';
import { MIN_PAYOUT, PAYOUT_FEE_RATE } from '../form/UseSpaceBilling';

const methods = Object.keys(payoutMethodLabel) as PayoutMethod[];

const schemaFor = (balance: number) =>
  z
    .object({
      amount: z.coerce
        .number({ message: 'Saisissez un montant' })
        .int('Montant en FCFA, sans décimales')
        .min(MIN_PAYOUT, `Minimum ${xof(MIN_PAYOUT)}`)
        .max(balance, `Au plus votre solde disponible (${xof(balance)})`),
      payment_method: z.enum(['wave', 'orange_money', 'paydunya', 'bank_transfer']),
      account_identifier: z.string().trim().min(6, 'Saisissez le numéro, le compte ou le RIB'),
      account_name: z.string().trim().max(150),
    })
    .refine((v) => v.payment_method !== 'bank_transfer' || v.account_name.length > 0, {
      message: 'Le titulaire du compte est requis pour un virement',
      path: ['account_name'],
    });

type Values = z.input<ReturnType<typeof schemaFor>>;

type Props = {
  open: boolean;
  /** Available balance, in FCFA */
  balance: number;
  onOpenChange: (open: boolean) => void;
  /** true once the api accepted it: the dialog closes */
  onRequest: (input: PayoutRequest) => Promise<boolean>;
};

function PayoutModal({ open, balance, onOpenChange, onRequest }: Props) {
  const schema = schemaFor(balance);
  const defaults: Values = { amount: Math.floor(balance), payment_method: 'wave', account_identifier: '', account_name: '' };
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    if (open) reset({ amount: Math.floor(balance), payment_method: 'wave', account_identifier: '', account_name: '' });
  }, [open, balance, reset]);

  const method = watch('payment_method');
  const bank = method === 'bank_transfer';
  // What the creator receives: the amount less the 2 % Kodinga fee, rounded like the api (cents)
  const amount = Number(watch('amount'));
  const fee = Number.isFinite(amount) && amount > 0 ? Math.round(amount * PAYOUT_FEE_RATE * 100) / 100 : 0;
  const net = Math.max(0, (Number.isFinite(amount) ? amount : 0) - fee);
  const accountLabel = bank ? 'RIB / IBAN' : method === 'paydunya' ? 'Compte PayDunya (e-mail ou numéro)' : 'Numéro de téléphone';

  const onSubmit = async (raw: Values) => {
    const values = schema.parse(raw);
    const sent = await onRequest({
      amount: values.amount,
      payment_method: values.payment_method,
      account_identifier: values.account_identifier,
      account_name: values.account_name,
    });
    if (sent) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent position="top">
        <DialogHeader>
          <DialogTitle>Demander un reversement</DialogTitle>
          <DialogDescription>
            Solde disponible : {xof(balance)}. Le montant est réservé dès la demande, traitée sous 24 à 48 h. Kodinga retient {PAYOUT_FEE_RATE * 100} % de frais de service.
          </DialogDescription>
        </DialogHeader>
        <form id="payout-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-x-3 sm:grid-cols-2">
          <div>
            <Input
              id="payout-amount"
              type="number"
              label="Montant (FCFA)"
              required
              min={MIN_PAYOUT}
              step={500}
              customClassContainer="mb-1"
              error={errors.amount?.message}
              {...register('amount')}
            />
            <button
              type="button"
              onClick={() => setValue('amount', Math.floor(balance), { shouldDirty: true, shouldValidate: true })}
              className="mb-3 text-xs font-semibold text-primary hover:underline"
            >
              Tout retirer ({xof(Math.floor(balance))})
            </button>
          </div>
          <SelectInput label="Moyen de reversement" options={methods.map((value) => ({ value, label: payoutMethodLabel[value] }))} {...register('payment_method')} />
          <Input
            id="payout-account"
            label={accountLabel}
            required
            customClassContainer="sm:col-span-2"
            error={errors.account_identifier?.message}
            {...register('account_identifier')}
          />
          <Input
            id="payout-name"
            label="Titulaire du compte"
            required={bank}
            customClassContainer="sm:col-span-2"
            error={errors.account_name?.message}
            {...register('account_name')}
          />
          {/* What the creator will receive, updated as the amount is typed */}
          <dl aria-label="Détail du reversement" aria-live="polite" className="mb-1 rounded-lg border border-border bg-subtle px-4 py-3 text-sm sm:col-span-2">
            <div className="flex justify-between gap-3">
              <dt className="text-soft">Frais de service Kodinga ({PAYOUT_FEE_RATE * 100} %)</dt>
              <dd className="text-soft tabular-nums">− {xof(fee)}</dd>
            </div>
            <div className="mt-1 flex justify-between gap-3 font-semibold text-foreground">
              <dt>Montant net que vous recevrez</dt>
              <dd className="tabular-nums">{xof(net)}</dd>
            </div>
          </dl>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" form="payout-form" isLoading={isSubmitting}>
            Demander le reversement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PayoutModal;
