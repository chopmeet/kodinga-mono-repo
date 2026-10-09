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
} from '@kodinga-mono-repo/ui';
import type { AdminCategory } from '@/data/admin-settings.data';

export const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const schema = z.object({
  name: z.string().trim().min(2, 'Au moins 2 caractères').max(100, '100 caractères maximum'),
  description: z.string().trim().max(300, '300 caractères maximum'),
});

type Values = z.infer<typeof schema>;

type Props = {
  /** null: closed, 'new': creation, otherwise the category to edit */
  category: AdminCategory | 'new' | null;
  existingSlugs: string[];
  onClose: () => void;
  onSave: (values: { name: string; slug: string; description: string }) => void;
};

function CategoryModal({ category, existingSlugs, onClose, onSave }: Props) {
  const editing = category && category !== 'new' ? category : null;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', description: '' } });

  useEffect(() => {
    if (category) reset({ name: editing?.name ?? '', description: editing?.description ?? '' });
  }, [category, editing, reset]);

  const slug = slugify(watch('name') ?? '');

  const onSubmit = async (values: Values) => {
    if (existingSlugs.filter((s) => s !== editing?.slug).includes(slug)) {
      setError('name', { message: 'Une catégorie porte déjà ce nom.' });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    onSave({ ...values, slug });
  };

  return (
    <Dialog open={!!category} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
          <DialogDescription>Les catégories aident les membres à trouver des communautés.</DialogDescription>
        </DialogHeader>
        <form id="category-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Input
            id="category-name"
            label="Nom"
            required
            fieldHelp={slug ? `Adresse : /communautes?categorie=${slug}` : undefined}
            error={errors.name?.message}
            {...register('name')}
          />
          <TextareaInput id="category-description" label="Description" rows={3} error={errors.description?.message} {...register('description')} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" form="category-form" isLoading={isSubmitting}>
            {editing ? 'Enregistrer' : 'Créer la catégorie'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CategoryModal;
