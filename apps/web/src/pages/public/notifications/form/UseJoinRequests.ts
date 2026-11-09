import { useMemo, useState } from 'react';

import { customToast } from '@kodinga/ui';
import i18n from '@/utils/i18n';
import { hasSpacePermission } from '@/pages/community-space/community-space-context';
import { isManaged, useDecideMemberMutation, useGetJoinRequestsQuery, useGetMyCommunitiesQuery } from '@/utils/api/community/community.api';
import type { JoinRequest } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { getName, useUser } from '@/utils/Utils';

/**
 * Join requests waiting in the communities where the user reviews them (owner, or a role with
 * can_review_requests): read from members?status=pending. They say which join_request notifications
 * can still be answered (by member id), and show the ones without a notification (older ones, a
 * deleted one). Accepted or refused like in /c/<slug>/members; read again after each decision.
 */
function UseJoinRequests({ skip = false }: { skip?: boolean } = {}) {
  const user = useUser();
  const { data: memberships } = useGetMyCommunitiesQuery(undefined, { skip: skip || !user });
  const reviewed = useMemo(
    () =>
      (memberships ?? [])
        .filter(isManaged)
        .filter((m) => hasSpacePermission(m, 'can_review_requests'))
        .map((m) => ({ slug: m.community.slug, name: m.community.name })),
    [memberships],
  );
  const { data = [], isLoading } = useGetJoinRequestsQuery(reviewed, { skip: skip || reviewed.length === 0 });
  const [decide, { isLoading: isDeciding, originalArgs }] = useDecideMemberMutation();
  /** Decisions taken here, by member id: what a notification says once answered */
  const [decided, setDecided] = useState<Record<string, 'accepted' | 'refused'>>({});

  const answer = async (r: JoinRequest, approve: boolean) => {
    const name = getName(r.member.user);
    try {
      await decide({ slug: r.community.slug, memberId: r.member.id, approve }).unwrap();
      setDecided((d) => ({ ...d, [r.member.id]: approve ? 'accepted' : 'refused' }));
      customToast.success({
        message: approve ? i18n.t('inbox.joinRequests.joined', { name, community: r.community.name }) : i18n.t('inbox.joinRequests.refusedToast', { name }),
      });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return {
    requests: data,
    decided,
    isLoading: !!memberships && reviewed.length > 0 && isLoading,
    /** The request being answered, for its buttons */
    busyId: isDeciding ? originalArgs?.memberId : undefined,
    accept: (r: JoinRequest) => answer(r, true),
    refuse: (r: JoinRequest) => answer(r, false),
  };
}

export type JoinRequests = ReturnType<typeof UseJoinRequests>;

export default UseJoinRequests;
