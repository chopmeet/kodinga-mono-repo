import { useState } from 'react';

import { customToast } from '@kodinga-mono-repo/ui';
import { useArchiveCommunityMutation } from '@/utils/api/community/community.api';
import type { CommunityListItem } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';

/**
 * Archive flow: the table opens the confirm modal, the modal calls archive().
 * DELETE communities/<slug>/ (the api sets is_active = false; owner or superuser only), then the
 * lists refresh by themselves (cache tag "communities").
 */
function UseArchiveCommunity(onArchived?: (community: CommunityListItem) => void) {
  const [target, setTarget] = useState<CommunityListItem | null>(null);
  const [archiveCommunity, { isLoading }] = useArchiveCommunityMutation();

  const archive = async () => {
    if (!target) return;
    try {
      await archiveCommunity(target.slug).unwrap();
      customToast.success({ message: `« ${target.name} » a été archivée.` });
      onArchived?.(target);
      setTarget(null);
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return {
    target,
    askArchive: setTarget,
    cancel: () => setTarget(null),
    archive,
    isLoading,
  };
}

export default UseArchiveCommunity;
