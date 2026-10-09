import { useState } from 'react';

import { customToast } from '@kodinga-mono-repo/ui';
import type { CommunityListItem } from '@/utils/api/community/community.type';

const FAKE_LATENCY_MS = 400;

/**
 * Archive flow: the table opens the confirm modal, the modal calls archive().
 * Mock for now: marks the community as archived locally. With the api, call
 * useArchiveCommunityMutation (DELETE communities/<slug>/) instead of `onArchived`.
 */
function UseArchiveCommunity(onArchived: (community: CommunityListItem) => void) {
  const [target, setTarget] = useState<CommunityListItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const archive = async () => {
    if (!target) return;
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, FAKE_LATENCY_MS));
    onArchived(target);
    customToast.success({ message: `« ${target.name} » a été archivée.` });
    setIsLoading(false);
    setTarget(null);
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
