import { customToast } from '@kodinga-mono-repo/ui';
import {
  useChangeMemberRoleMutation,
  useDecideMemberMutation,
  useGetCommunityMembersQuery,
  useSanctionMemberMutation,
} from '@/utils/api/community/community.api';
import type { CommunityMemberItem, CommunityRole, MembershipStatus } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import { useDebounced } from '@/utils/hooks/useDebounced';
import { getName, memberRoleLabel } from '@/utils/Utils';

export type MemberStatusFilter = Extract<MembershipStatus, 'active' | 'pending' | 'suspended' | 'banned'> | 'all';
export type MemberRoleFilter = CommunityRole | 'all';
export type SanctionType = 'warning' | 'mute' | 'suspension' | 'ban';
export type Sanction = { type: SanctionType; reason: string; duration_days?: number };

/** An api member with its display name */
export type SpaceMember = CommunityMemberItem & { name: string };

const days = (n?: number) => `${n} jour${n && n > 1 ? 's' : ''}`;

const sanctionMessage = (name: string, s: Sanction) =>
  ({
    warning: `${name} a reçu un avertissement.`,
    mute: `${name} est en sourdine pour ${days(s.duration_days)}.`,
    suspension: `${name} est suspendu pour ${days(s.duration_days)}.`,
    ban: `${name} a été banni.`,
  })[s.type];

const STATUSES: Exclude<MemberStatusFilter, 'all'>[] = ['active', 'pending', 'suspended', 'banned'];

/** Number of members with a status: page_size=1 is enough, the api gives the total */
function useStatusCount(slug: string, status?: MembershipStatus) {
  const { data } = useGetCommunityMembersQuery({ slug, status, page: 1, page_size: 1 });
  return data?.pagination.count;
}

/**
 * Members of the community (GET communities/<slug>/members/, moderators and above): status, role
 * and search are filtered by the api. Approving / refusing and sanctions are open to moderators,
 * roles to the owner and admins (PATCH .../members/<id>/). Lifting a sanction has no endpoint yet.
 */
function UseSpaceMembers(slug: string, query: { search: string; status: MemberStatusFilter; role: MemberRoleFilter; page: number; size: number }) {
  const search = useDebounced(query.search.trim(), 300);
  const { data, isLoading, isFetching, error, refetch } = useGetCommunityMembersQuery({
    slug,
    status: query.status === 'all' ? undefined : query.status,
    role: query.role === 'all' ? undefined : query.role,
    search: search || undefined,
    page: query.page,
    page_size: query.size,
  });
  const [decideMember] = useDecideMemberMutation();
  const [sanctionMember] = useSanctionMemberMutation();
  const [changeMemberRole] = useChangeMemberRoleMutation();

  const counts: Record<MemberStatusFilter, number | undefined> = {
    all: useStatusCount(slug),
    active: useStatusCount(slug, STATUSES[0]),
    pending: useStatusCount(slug, STATUSES[1]),
    suspended: useStatusCount(slug, STATUSES[2]),
    banned: useStatusCount(slug, STATUSES[3]),
  };

  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      customToast.success({ message });
      return true;
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
      return false;
    }
  };

  const members: SpaceMember[] = (data?.results ?? []).map((m) => ({ ...m, name: getName(m.user) || m.user.email }));

  return {
    members,
    total: data?.pagination.count ?? 0,
    counts,
    isLoading,
    isFetching,
    error: data ? undefined : error,
    refetch,
    approve: (m: SpaceMember) => run(decideMember({ slug, memberId: m.id, approve: true }).unwrap(), `${m.name} a rejoint la communauté.`),
    reject: (m: SpaceMember) => run(decideMember({ slug, memberId: m.id, approve: false }).unwrap(), `La demande de ${m.name} a été refusée.`),
    sanction: (m: SpaceMember, s: Sanction) =>
      run(
        sanctionMember({ slug, memberId: m.id, sanction_type: s.type, reason: s.reason, duration_days: s.duration_days ?? null }).unwrap(),
        sanctionMessage(m.name, s),
      ),
    changeRole: (m: SpaceMember, role: CommunityRole) =>
      run(changeMemberRole({ slug, memberId: m.id, role }).unwrap(), `${m.name} est maintenant ${memberRoleLabel[role].toLowerCase()}.`),
  };
}

export default UseSpaceMembers;
