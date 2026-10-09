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
  SelectInput,
  TextareaInput,
} from '@kodinga-mono-repo/ui';
import type { AdminMember } from '@/data/admin-community-details.data';
import type { Sanction } from '../form/UseSpaceMembers';

const schema = z.object({
  reason: z.string().trim().min(5, 'Indiquez le motif (5 caractères minimum)'),
  duration_days: z.string(),
});

type Values = z.infer<typeof schema>;

export type SanctionTarget = { member: AdminMember; type: Sanction['type'] };

type Props = {
  target: SanctionTarget | null;
  onCancel: () => void;
  onConfirm: (member: AdminMember, sanction: Sanction) => void;
};

/** The api requires a reason for every sanction; a suspension also has a duration */
function SanctionModal({ target, onCancel, onConfirm }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: '', duration_days: '7' } });

  useEffect(() => {
    if (target) reset({ reason: '', duration_days: '7' });
  }, [target, reset]);

  const isBan = target?.type === 'ban';

  const onSubmit = async (values: Values) => {
    if (!target) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
    onConfirm(target.member, {
      type: target.type,
      reason: values.reason,
      duration_days: isBan ? undefined : Number(values.duration_days),
    });
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !isSubmitting && onCancel()}>
      <DialogContent position="top">
        <DialogHeader>
          <DialogTitle>{isBan ? `Bannir ${target?.member.name} ?` : `Suspendre ${target?.member.name}`}</DialogTitle>
          <DialogDescription>
            {isBan
              ? 'Le membre perd définitivement l’accès à la communauté et ne pourra plus la rejoindre.'
              : 'Le membre ne peut plus publier ni commenter pendant la durée choisie.'}
          </DialogDescription>
        </DialogHeader>
        <form id="sanction-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {!isBan && (
            <SelectInput
              label="Durée"
              options={[
                { label: '1 jour', value: '1' },
                { label: '7 jours', value: '7' },
                { label: '30 jours', value: '30' },
              ]}
              {...register('duration_days')}
            />
          )}
          <TextareaInput
            id="sanction-reason"
            label="Motif"
            required
            rows={3}
            placeholder="Visible par l’équipe de modération"
            error={errors.reason?.message}
            {...register('reason')}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" form="sanction-form" variant={isBan ? 'danger' : 'default'} isLoading={isSubmitting}>
            {isBan ? 'Bannir' : 'Suspendre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SanctionModal;
