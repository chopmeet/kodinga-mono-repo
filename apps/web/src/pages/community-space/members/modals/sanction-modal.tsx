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
import type { Sanction, SanctionType } from '../form/UseSpaceMembers';

const schema = z.object({
  reason: z.string().trim().min(5, 'Indiquez le motif (5 caractères minimum)'),
  duration_days: z.string(),
});

type Values = z.infer<typeof schema>;

/** Any member shape with a display name (mock AdminMember, or an api member mapped by the caller) */
export type SanctionTarget<M extends { name: string } = AdminMember> = { member: M; type: Sanction['type'] };

type Props<M extends { name: string }> = {
  target: SanctionTarget<M> | null;
  onCancel: () => void;
  onConfirm: (member: M, sanction: Sanction) => void | Promise<void>;
};

const COPY: Record<SanctionType, { title: (name?: string) => string; description: string; submit: string; withDuration: boolean }> = {
  warning: {
    title: (name) => `Avertir ${name}`,
    description: 'Le membre garde ses accès ; l’avertissement reste dans l’historique de modération.',
    submit: 'Avertir',
    withDuration: false,
  },
  mute: {
    title: (name) => `Mettre ${name} en sourdine`,
    description: 'Le membre reste dans la communauté mais ne doit plus publier ni commenter pendant la durée choisie.',
    submit: 'Mettre en sourdine',
    withDuration: true,
  },
  suspension: {
    title: (name) => `Suspendre ${name}`,
    description: 'Le membre ne peut plus publier ni commenter pendant la durée choisie.',
    submit: 'Suspendre',
    withDuration: true,
  },
  ban: {
    title: (name) => `Bannir ${name} ?`,
    description: 'Le membre perd définitivement l’accès à la communauté et ne pourra plus la rejoindre.',
    submit: 'Bannir',
    withDuration: false,
  },
};

/** The api requires a reason for every sanction; a mute or a suspension also has a duration */
function SanctionModal<M extends { name: string } = AdminMember>({ target, onCancel, onConfirm }: Props<M>) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: '', duration_days: '7' } });

  useEffect(() => {
    if (target) reset({ reason: '', duration_days: '7' });
  }, [target, reset]);

  const copy = COPY[target?.type ?? 'warning'];
  const isBan = target?.type === 'ban';

  const onSubmit = async (values: Values) => {
    if (!target) return;
    await onConfirm(target.member, {
      type: target.type,
      reason: values.reason,
      duration_days: copy.withDuration ? Number(values.duration_days) : undefined,
    });
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !isSubmitting && onCancel()}>
      <DialogContent position="top">
        <DialogHeader>
          <DialogTitle>{copy.title(target?.member.name)}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form id="sanction-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {copy.withDuration && (
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
            {copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SanctionModal;
