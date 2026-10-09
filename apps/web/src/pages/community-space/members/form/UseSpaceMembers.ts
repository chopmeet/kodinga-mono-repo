import { useMemo, useState } from 'react';

import { customToast } from '@kodinga-mono-repo/ui';
import { type AdminMember, getCommunityMembers, type MemberRole, type MemberStatus } from '@/data/admin-community-details.data';
import type { CommunityListItem } from '@/utils/api/community/community.type';
import { memberRoleLabel } from '@/pages/shared/community-labels';

export type MemberStatusFilter = Extract<MemberStatus, 'active' | 'pending' | 'suspended' | 'banned'> | 'all';
export type MemberRoleFilter = 'all' | 'team' | 'member';
export type Sanction = { type: 'suspension' | 'ban'; reason: string; duration_days?: number };

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Mock of the members endpoints of a community. Changes live in local state.
 * With the api: GET communities/<slug>/members/, PATCH .../members/<id>/ (approve, role)
 * and POST .../members/<id>/sanctions/.
 */
function UseSpaceMembers(community: CommunityListItem, query: { search: string; status: MemberStatusFilter; role: MemberRoleFilter }) {
  const [members, setMembers] = useState<AdminMember[]>(() => getCommunityMembers(community));

  const filtered = useMemo(() => {
    const needle = normalize(query.search.trim());
    return members.filter(
      (m) =>
        (!needle || normalize(`${m.name} ${m.username} ${m.city}`).includes(needle)) &&
        (query.status === 'all' || m.status === query.status) &&
        (query.role === 'all' || (query.role === 'team' ? m.role !== 'member' : m.role === 'member'))
    );
  }, [members, query.search, query.status, query.role]);

  const patch = (member: AdminMember, changes: Partial<AdminMember>, message: string) => {
    setMembers((list) => list.map((m) => (m.id === member.id ? { ...m, ...changes } : m)));
    customToast.success({ message });
  };

  const countBy = (status: MemberStatus) => members.filter((m) => m.status === status).length;

  return {
    members,
    filtered,
    counts: {
      all: members.length,
      active: countBy('active'),
      pending: countBy('pending'),
      suspended: countBy('suspended'),
      banned: countBy('banned'),
    } satisfies Record<MemberStatusFilter, number>,
    approve: (m: AdminMember) => patch(m, { status: 'active' }, `${m.name} a rejoint la communauté.`),
    // A refused request leaves the list (the api keeps it as "rejected")
    reject: (m: AdminMember) => {
      setMembers((list) => list.filter((x) => x.id !== m.id));
      customToast.success({ message: `La demande de ${m.name} a été refusée.` });
    },
    reactivate: (m: AdminMember) => patch(m, { status: 'active' }, `${m.name} est de nouveau actif.`),
    sanction: (m: AdminMember, s: Sanction) =>
      s.type === 'ban'
        ? patch(m, { status: 'banned' }, `${m.name} a été banni.`)
        : patch(m, { status: 'suspended' }, `${m.name} est suspendu pour ${s.duration_days} jours.`),
    changeRole: (m: AdminMember, role: MemberRole) =>
      patch(m, { role }, `${m.name} est maintenant ${memberRoleLabel[role].toLowerCase()}.`),
  };
}

export default UseSpaceMembers;
