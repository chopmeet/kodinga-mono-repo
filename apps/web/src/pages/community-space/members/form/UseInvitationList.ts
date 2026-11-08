import { useState } from 'react';

import { customToast } from '@kodinga/ui';
import { useGetCommunityInvitationsQuery, useResendInvitationMutation, useRevokeInvitationMutation } from '@/utils/api/community/community.api';
import type { CommunityInvitation } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';

/**
 * Invitations of the community (owner and admins): the pending ones first. A pending one can be
 * revoked; one sent by email can be sent again (new link, 7 more days), the new link is then shown.
 */
function UseInvitationList(slug: string) {
  const { data = [], isLoading, error } = useGetCommunityInvitationsQuery(slug);
  const [revoke, { isLoading: isRevoking, originalArgs: revoking }] = useRevokeInvitationMutation();
  const [resend, { isLoading: isResending, originalArgs: resending }] = useResendInvitationMutation();
  /** The new link of an invitation sent again, by invitation */
  const [renewed, setRenewed] = useState<Record<string, string>>({});

  const pending = data.filter((i) => i.status === 'pending' && i.is_valid);
  const others = data.filter((i) => !(i.status === 'pending' && i.is_valid));

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      customToast.success({ message });
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };

  return {
    isLoading,
    loadError: error ? parseApiError(error).message : null,
    pending,
    others,
    renewed,
    busyId: isRevoking ? revoking?.invitationId : isResending ? resending?.invitationId : undefined,
    revoke: (i: CommunityInvitation) => run(() => revoke({ slug, invitationId: i.id }).unwrap(), 'Invitation révoquée : son lien ne fonctionne plus.'),
    resend: (i: CommunityInvitation) =>
      run(async () => {
        const again = await resend({ slug, invitationId: i.id }).unwrap();
        if (again.raw_token) setRenewed((r) => ({ ...r, [i.id]: again.raw_token }));
      }, `Invitation renvoyée à ${i.email}.`),
  };
}

export type InvitationList = ReturnType<typeof UseInvitationList>;

export default UseInvitationList;
