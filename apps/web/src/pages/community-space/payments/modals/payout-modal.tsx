import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, SelectInput } from '@kodinga/ui';
import { payoutMethodLabel, xof } from '@/utils/Utils';
import type { PayoutMethod, PayoutRequest } from '@/utils/api/billing/billing.type';
import { MIN_PAYOUT } from '../form/UseSpaceBilling';

const methods = Object.keys(payoutMethodLabel) as PayoutMethod[];

const schemaFor = (balance: number) =>
  z
    .object({
      amount: z.coerce
        .number({ message: 'Saisissez un montant' })
        .int('Montant en FCFA, sans décimales')
        .min(MIN_PAYOUT, `Minimum ${xof(MIN_PAYOUT)}`)
        .max(balance, `Au plus votre solde disponible (${xof(balance)})`),
      payment_method: z.enum(['wave', 'orange_money', 'bank_transfer']),
      account_identifier: z.string().trim().min(6, 'Saisissez le numéro ou le RIB'),
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
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    if (open) reset({ amount: Math.floor(balance), payment_method: 'wave', account_identifier: '', account_name: '' });
  }, [open, balance, reset]);

  const bank = watch('payment_method') === 'bank_transfer';

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
          <DialogDescription>Solde disponible : {xof(balance)}. Le montant est retiré du solde dès la demande, traitée sous 24 à 48 h.</DialogDescription>
        </DialogHeader>
        <form id="payout-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-x-3 sm:grid-cols-2">
          <Input id="payout-amount" type="number" label="Montant (FCFA)" required min={MIN_PAYOUT} step={500} error={errors.amount?.message} {...register('amount')} />
          <SelectInput label="Moyen de reversement" options={methods.map((value) => ({ value, label: payoutMethodLabel[value] }))} {...register('payment_method')} />
          <Input
            id="payout-account"
            label={bank ? 'RIB / IBAN' : 'Numéro de téléphone'}
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
