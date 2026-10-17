import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { customToast } from '@kodinga-mono-repo/ui';
import { useCreateInvitationMutation } from '@/utils/api/community/community.api';
import type { CommunityInvitation } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';

const schema = z.object({
  role: z.enum(['member', 'moderator', 'admin']),
  max_uses: z.string().refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 1000, 'Entre 1 et 1000'),
  expires_in_days: z.enum(['1', '7', '30', '90']),
  email: z.string().trim().refine((v) => !v || z.email().safeParse(v).success, 'Adresse email invalide'),
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
 * Creates an invitation link (POST communities/<slug>/invitations/). With an email, the api sends
 * the invitation; the link is also shown to be copied and shared.
 */
function UseInvitationForm(slug: string) {
  const [createInvitation] = useCreateInvitationMutation();
  const [created, setCreated] = useState<CommunityInvitation | null>(null);
  const form = useForm<InvitationFormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const { setError, handleSubmit, reset } = form;

  const onSubmit = async (v: InvitationFormValues) => {
    try {
      const invitation = await createInvitation({
        slug,
        role: v.role,
        max_uses: Number(v.max_uses),
        expires_in_days: Number(v.expires_in_days),
        ...(v.email ? { email: v.email } : {}),
      }).unwrap();
      setCreated(invitation);
      customToast.success({ message: 'Lien d’invitation créé.' });
    } catch (error) {
      const { message, fields } = parseApiError(error);
      if (fields.email) setError('email', { message: fields.email });
      else if (fields.max_uses) setError('max_uses', { message: fields.max_uses });
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
