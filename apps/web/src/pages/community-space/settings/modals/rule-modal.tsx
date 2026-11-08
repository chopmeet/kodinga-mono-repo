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
  TextareaInput,
} from '@kodinga/ui';
import type { CommunityRule } from '../form/UseSpaceSettings';

const schema = z.object({
  title: z.string().trim().min(3, 'Au moins 3 caractères').max(200, '200 caractères maximum'),
  description: z.string().trim(),
});

type Values = z.infer<typeof schema>;

type Props = {
  open: boolean;
  rule: CommunityRule | null;
  onOpenChange: (open: boolean) => void;
  /** true once the api accepted it: the dialog closes */
  onSave: (values: Values, editing: CommunityRule | null) => Promise<boolean>;
};

function RuleModal({ open, rule, onOpenChange, onSave }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) reset({ title: rule?.title ?? '', description: rule?.description ?? '' });
  }, [open, rule, reset]);

  const onSubmit = async (values: Values) => {
    if (await onSave(values, rule)) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent position="top">
        <DialogHeader>
          <DialogTitle>{rule ? 'Modifier la règle' : 'Nouvelle règle'}</DialogTitle>
          <DialogDescription>Les règles sont affichées aux membres avant qu'ils rejoignent la communauté.</DialogDescription>
        </DialogHeader>
        <form id="rule-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input id="rule-title" label="Règle" required error={errors.title?.message} {...register('title')} />
          <TextareaInput id="rule-description" label="Explication" rows={3} {...register('description')} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" form="rule-form" isLoading={isSubmitting}>
            {rule ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RuleModal;
