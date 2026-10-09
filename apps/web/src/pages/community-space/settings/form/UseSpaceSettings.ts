import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import {
  type CommunityAccess,
  type CommunityProfile,
  type CommunityRule,
  getCommunityAccess,
  getCommunityProfile,
  getCommunityRuleList,
} from '@/data/community-settings.data';
import type { CommunityListItem } from '@/utils/api/community/community.type';

/** Settings of one community, shared by the tabs (mock: local state, lost when leaving the page) */
function UseSpaceSettings(community: CommunityListItem) {
  const [profile, saveProfile] = useState<CommunityProfile>(() => getCommunityProfile(community));
  const [access, saveAccess] = useState<CommunityAccess>(() => getCommunityAccess(community));
  const [rules, setRules] = useState<CommunityRule[]>(() => getCommunityRuleList(community));

  return { profile, saveProfile, access, saveAccess, rules, setRules };
}

export type SpaceSettings = ReturnType<typeof UseSpaceSettings>;

export const useSpaceSettings = () => useOutletContext<SpaceSettings>();

export default UseSpaceSettings;
