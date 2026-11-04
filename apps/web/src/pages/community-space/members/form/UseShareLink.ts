import { useState } from 'react';

import { customToast } from '@kodinga-mono-repo/ui';
import { useCreateShareLinkMutation } from '@/utils/api/community/community.api';
import type { ShareableInviteLink } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';

/**
 * The shareable link of the community, asked on demand: the first call creates it, so opening the
 * modal creates nothing. Built on the address of this site, like the other links of the modal.
 */
function UseShareLink(slug: string) {
  const [createShareLink, { isLoading }] = useCreateShareLinkMutation();
  const [shareLink, setShareLink] = useState<ShareableInviteLink | null>(null);

  const reveal = async () => {
    try {
      setShareLink(await createShareLink({ slug, role: 'member' }).unwrap());
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return { shareLink, link: shareLink ? `${window.location.origin}/invite/${encodeURIComponent(shareLink.token)}` : '', isLoading, reveal };
}

export default UseShareLink;
