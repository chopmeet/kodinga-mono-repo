import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  SelectInput,
  TextareaInput,
} from '@kodinga-mono-repo/ui';
import { intervalLabel, xof } from '@/pages/shared/community-labels';
import type { CommunityPlan } from '@/utils/api/billing/billing.type';
import { MIN_PRICE, type PlanInput } from '../form/UseSpaceBilling';

const schema = z.object({
  name: z.string().trim().min(2, 'Donnez un nom à la formule'),
  price: z.coerce
    .number({ message: 'Saisissez un prix' })
    .int('Prix en FCFA, sans décimales')
    .min(MIN_PRICE, `Prix minimum : ${xof(MIN_PRICE)}`),
  billing_interval: z.enum(['month', 'year', 'one_time']),
  description: z.string().trim().max(200, '200 caractères maximum'),
  features: z.string(),
});

type Values = z.input<typeof schema>;

type Props = {
  open: boolean;
  plan: CommunityPlan | null;
  existingNames: string[];
  onOpenChange: (open: boolean) => void;
  /** true once the api accepted it: the dialog closes */
  onSave: (input: PlanInput, editing: CommunityPlan | null) => Promise<boolean>;
};

const toValues = (plan: CommunityPlan | null): Values => ({
  name: plan?.name ?? '',
  price: plan ? Number(plan.price) : 5000,
  billing_interval: plan?.billing_interval ?? 'month',
  description: plan?.description ?? '',
  features: plan?.features.join('\n') ?? '',
});

function PlanModal({ open, plan, existingNames, onOpenChange, onSave }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(plan) });

  useEffect(() => {
    if (open) reset(toValues(plan));
  }, [open, plan, reset]);

  const onSubmit = async (raw: Values) => {
    const values = schema.parse(raw);
    const name = values.name.trim();
    if (existingNames.some((n) => n.toLowerCase() === name.toLowerCase() && n !== plan?.name)) {
      setError('name', { message: 'Une formule porte déjà ce nom.' });
      return;
    }
    const saved = await onSave(
      {
        name,
        price: values.price,
        billing_interval: values.billing_interval,
        description: values.description,
        features: values.features.split('\n').map((f) => f.trim()).filter(Boolean),
      },
      plan
    );
    if (saved) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent position="top">
        <DialogHeader>
          <DialogTitle>{plan ? `Modifier « ${plan.name} »` : 'Nouvelle formule'}</DialogTitle>
          <DialogDescription>
            {plan
              ? 'Un changement de prix s’applique aux prochains paiements, pas aux abonnements en cours.'
              : 'Les membres choisissent leur formule au moment de rejoindre la communauté.'}
          </DialogDescription>
        </DialogHeader>
        <form id="plan-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-x-3 sm:grid-cols-2">
          <Input id="plan-name" label="Nom" required customClassContainer="sm:col-span-2" error={errors.name?.message} {...register('name')} />
          <Input
            id="plan-price"
            type="number"
            label="Prix (FCFA)"
            required
            min={MIN_PRICE}
            step={500}
            fieldHelp={`Minimum ${xof(MIN_PRICE)}`}
            error={errors.price?.message}
            {...register('price')}
          />
          <SelectInput
            label="Facturation"
            options={(Object.keys(intervalLabel) as (keyof typeof intervalLabel)[]).map((value) => ({
              value,
              label: intervalLabel[value].label,
            }))}
            {...register('billing_interval')}
          />
          <TextareaInput
            id="plan-description"
            label="Description"
            rows={2}
            customClassContainer="sm:col-span-2"
            error={errors.description?.message}
            {...register('description')}
          />
          <TextareaInput
            id="plan-features"
            label="Avantages inclus"
            rows={3}
            placeholder="Un avantage par ligne"
            customClassContainer="sm:col-span-2"
            {...register('features')}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" form="plan-form" isLoading={isSubmitting}>
            {plan ? 'Enregistrer' : 'Créer la formule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PlanModal;
