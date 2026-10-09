import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Button,
  customToast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@kodinga-mono-repo/ui';
import type { AdminUser } from '@/data/admin-users.data';

const schema = z.object({
  first_name: z.string().trim().min(1, 'Saisissez le prénom'),
  last_name: z.string().trim().min(1, 'Saisissez le nom'),
  email: z.string().trim().min(1, "Saisissez l'email").email('Adresse email invalide'),
});

type Values = z.infer<typeof schema>;

type Props = {
  title?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingEmails: string[];
  onInvited: (user: AdminUser) => void;
};

/** Mock: creates a staff account awaiting email verification. With the api: POST an invitation. */
function InviteAdminModal({ title = 'Inviter un administrateur', open, onOpenChange, existingEmails, onInvited }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onSubmit = async (values: Values) => {
    const email = values.email.toLowerCase();
    if (existingEmails.includes(email)) {
      setError('email', { message: 'Un compte existe déjà avec cet email.' });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
    const now = new Date().toISOString();
    onInvited({
      id: `invited-${Date.now()}`,
      email,
      username: email.split('@')[0],
      first_name: values.first_name,
      last_name: values.last_name,
      full_name: `${values.first_name} ${values.last_name}`,
      is_active: true,
      is_email_verified: false,
      preferred_language: 'fr',
      timezone: 'Africa/Dakar',
      date_joined: now,
      last_login: null,
      is_staff: true,
      city: '—',
      communities_owned: 0,
      communities_joined: 0,
      posts_count: 0,
    });
    customToast.success({ message: `Invitation envoyée à ${email}.` });
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent position="top">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            La personne recevra un email pour activer son compte. Elle aura accès à toute l'administration.
          </DialogDescription>
        </DialogHeader>
        <form id="invite-admin-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-1 sm:grid-cols-2 sm:gap-x-3">
          <Input id="invite-first-name" label="Prénom" required error={errors.first_name?.message} {...register('first_name')} />
          <Input id="invite-last-name" label="Nom" required error={errors.last_name?.message} {...register('last_name')} />
          <Input
            id="invite-email"
            type="email"
            label="Adresse email"
            required
            customClassContainer="sm:col-span-2"
            error={errors.email?.message}
            {...register('email')}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" form="invite-admin-form" isLoading={isSubmitting}>
            Envoyer l'invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InviteAdminModal;
