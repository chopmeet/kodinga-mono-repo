import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast } from '@kodinga-mono-repo/ui';
import { useCreateInvitationMutation } from '@/utils/api/community/community.api';
import type { CreatedInvitation } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';

/** Days an invitation sent by email can last (CreateWorkspaceInvitationSerializer: 30 at most) */
export const EMAIL_MAX_DAYS = 30;

const schema = z
  .object({
    role: z.enum(['member', 'moderator', 'admin']),
    max_uses: z.string(),
    expires_in_days: z.enum(['1', '7', '30', '90']),
    email: z.string().trim().refine((v) => !v || z.email().safeParse(v).success, 'Adresse email invalide'),
  })
  .superRefine((v, ctx) => {
    // By email: one person, 30 days at most; a shareable link: up to 1000 uses
    if (v.email && Number(v.expires_in_days) > EMAIL_MAX_DAYS) {
      ctx.addIssue({ code: 'custom', path: ['expires_in_days'], message: `${EMAIL_MAX_DAYS} jours au plus pour une invitation par email` });
    }
    if (!v.email && !(/^\d+$/.test(v.max_uses) && Number(v.max_uses) >= 1 && Number(v.max_uses) <= 1000)) {
      ctx.addIssue({ code: 'custom', path: ['max_uses'], message: 'Entre 1 et 1000' });
    }
  });

export type InvitationFormValues = z.infer<typeof schema>;

const DEFAULTS: InvitationFormValues = { role: 'member', max_uses: '1', expires_in_days: '7', email: '' };

/** Link to give to the guest: the code, and the community to show it before joining */
export const invitationLink = (slug: string, code: string) =>
  `${window.location.origin}/invitations/${encodeURIComponent(code)}?community=${encodeURIComponent(slug)}`;

/** Copies a text; false when the browser refuses (no clipboard, http) */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates an invitation (POST communities/<slug>/invitations/): a link to share (one or more uses),
 * or an invitation sent by email to one person. Its link is shown once, to be copied.
 */
function UseInvitationForm(slug: string) {
  const [createInvitation] = useCreateInvitationMutation();
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const form = useForm<InvitationFormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const { setError, handleSubmit, reset } = form;

  const onSubmit = async (v: InvitationFormValues) => {
    try {
      const invitation = await createInvitation({
        slug,
        role: v.role,
        expires_in_days: Number(v.expires_in_days),
        ...(v.email ? { email: v.email } : { max_uses: Number(v.max_uses) }),
      }).unwrap();
      setCreated(invitation);
      customToast.success({ message: v.email ? `Invitation envoyée à ${v.email}.` : 'Lien d’invitation créé.' });
    } catch (error) {
      // Under the field when the api names it, else in a toast
      const { message, fields } = parseApiError(error);
      const field = (['email', 'max_uses', 'expires_in_days', 'role'] as const).find((f) => fields[f]);
      if (field) setError(field, { message: fields[field] });
      else customToast.error({ message });
    }
  };

  /** Back to an empty form (closing the modal, or "Créer un autre lien") */
  const restart = () => {
    reset(DEFAULTS);
    setCreated(null);
  };

  return { form, created, restart, onSubmit: handleSubmit(onSubmit) };
}

export default UseInvitationForm;
