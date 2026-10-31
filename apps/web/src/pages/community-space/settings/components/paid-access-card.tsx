import { zodResolver } from '@hookform/resolvers/zod';
import { Wallet } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { Button, Input, SelectInput } from '@kodinga-mono-repo/ui';
import { intervalLabel, xof } from '@/utils/Utils';
import { useCommunitySpace } from '../../community-space-context';
import { useSpaceSettings } from '../form/UseSpaceSettings';

/** Lowest membership price the api accepts */
const MIN_PRICE = 500;

const schema = z.object({
  membership_price: z.coerce.number({ message: 'Saisissez un prix' }).int('Prix en FCFA, sans décimales').min(MIN_PRICE, `Prix minimum : ${xof(MIN_PRICE)}`),
  membership_interval: z.enum(['month', 'year', 'one_time']),
  membership_plan_name: z.string().trim().max(120, '120 caractères maximum'),
});

type Values = z.input<typeof schema>;

/**
 * Owner only: a free community becomes paid with its first plan (PATCH communities/<slug>/, the api
 * requires Kodinga Pro). A paid one sends to its plans.
 */
function PaidAccessCard() {
  const { community, role } = useCommunitySpace();
  const { pricingType, makePaid } = useSpaceSettings();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { membership_price: 5000, membership_interval: 'month', membership_plan_name: '' } });

  if (role !== 'owner') return null;

  if (pricingType === 'paid') {
    return (
      <section aria-label="Adhésion payante" className="mt-8 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <Wallet className="size-5 text-blue-900" aria-hidden />
        <span className="flex-1">Communauté payante : les membres choisissent une formule pour la rejoindre.</span>
        <Link to={`/c/${community.slug}/payments/plans`} className="font-semibold text-blue-900 hover:underline">
          Gérer les formules
        </Link>
      </section>
    );
  }

  const onSubmit = async (raw: Values) => {
    const values = schema.parse(raw);
    await makePaid({
      membership_price: values.membership_price,
      membership_interval: values.membership_interval,
      ...(values.membership_plan_name ? { membership_plan_name: values.membership_plan_name } : {}),
    });
  };

  return (
    <section aria-labelledby="paid-access-title" className="mt-8 rounded-xl border border-slate-200 p-4">
      <h3 id="paid-access-title" className="flex items-center gap-2 font-semibold text-slate-900">
        <Wallet className="size-5 text-blue-900" aria-hidden />
        Rendre la communauté payante
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Réservé aux membres Kodinga Pro. Les nouveaux membres paieront par Mobile Money ou carte via PayDunya ; les membres actuels gardent leur accès.
      </p>
      {!open ? (
        <Button variant="outline" className="mt-3" onClick={() => setOpen(true)}>
          Fixer un prix d'adhésion
        </Button>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 grid gap-x-3 sm:grid-cols-2">
          <Input
            id="paid-price"
            type="number"
            label="Prix (FCFA)"
            required
            min={MIN_PRICE}
            step={500}
            fieldHelp={`Minimum ${xof(MIN_PRICE)}`}
            error={errors.membership_price?.message}
            {...register('membership_price')}
          />
          <SelectInput
            label="Facturation"
            options={(Object.keys(intervalLabel) as (keyof typeof intervalLabel)[]).map((value) => ({ value, label: intervalLabel[value].label }))}
            {...register('membership_interval')}
          />
          <Input
            id="paid-plan-name"
            label="Nom de la formule"
            placeholder={`Pass ${community.name}`}
            customClassContainer="sm:col-span-2"
            error={errors.membership_plan_name?.message}
            {...register('membership_plan_name')}
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" isLoading={isSubmitting}>
              Rendre payante
            </Button>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

export default PaidAccessCard;
