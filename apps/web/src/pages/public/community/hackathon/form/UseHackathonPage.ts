import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';

import { customToast } from '@kodinga-mono-repo/ui';
import { useAppSelector } from '@/redux/hook';
import {
  useApplyToHackathonMutation,
  useCreateHackathonTeamMutation,
  useGetCommunityQuery,
  useGetHackathonQuery,
  useGetHackathonResultsQuery,
  useGetHackathonTeamsQuery,
  useGetMyHackathonApplicationQuery,
  useInviteToHackathonTeamMutation,
  useLeaveHackathonTeamMutation,
  useRespondHackathonTeamInviteMutation,
  useWithdrawHackathonApplicationMutation,
} from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';
import type { Hackathon, HackathonApplyData } from '@/utils/api/hackathon/hackathon.type';
import { membershipOf } from '../../form/UseCommunityPage';

export type HackathonTabId = 'overview' | 'teams' | 'space' | 'results';

/**
 * Where the signed-in user stands: what the page offers them
 * - visitor / not_member: sign in, join the community (the api only takes active members)
 * - can_apply / closed: registrations open or not
 * - pending, waitlisted, rejected, withdrawn, accepted: their application
 */
export type Participation = 'visitor' | 'not_member' | 'can_apply' | 'closed' | 'pending' | 'waitlisted' | 'rejected' | 'withdrawn' | 'accepted';

function participationOf(hackathon: Hackathon | undefined, membership: string): Participation {
  if (membership === 'visitor') return 'visitor';
  const status = hackathon?.user_status?.application_status ?? null;
  if (status === 'accepted' || status === 'pending' || status === 'waitlisted') return status;
  if (membership !== 'member') return 'not_member';
  // Applying again after a withdrawal or a refusal, while the registrations are open
  if (hackathon?.is_registration_open) return 'can_apply';
  return status ?? 'closed';
}

/** Steps of the hackathon, for the calendar: done, current, to come */
export function timelineOf(h: Hackathon) {
  const now = Date.now();
  const steps = [
    { label: 'Ouverture des candidatures', at: h.registration_start },
    { label: 'Clôture des candidatures', at: h.registration_end },
    { label: 'Début du hackathon', at: h.start_time },
    { label: 'Date limite des projets', at: h.submission_deadline },
    { label: 'Fin des évaluations', at: h.judging_end },
  ];
  const nextIndex = steps.findIndex((s) => new Date(s.at).getTime() > now);
  return steps.map((s, i) => ({ ...s, state: nextIndex === -1 || i < nextIndex ? ('done' as const) : i === nextIndex ? ('next' as const) : ('later' as const) }));
}

/**
 * /communities/:slug/hackathons/:hackathonSlug(?tab=) — a member discovers a hackathon, applies,
 * forms a team and submits a project. The api checks every rule (dates, membership, team size).
 */
function UseHackathonPage() {
  const { slug = '', hackathonSlug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { pathname, search } = useLocation();
  const signedIn = !!useAppSelector((s) => s.user.token);
  const meId = useAppSelector((s) => s.user.user?.id);

  const community = useGetCommunityQuery(slug, { skip: !slug });
  const membership = membershipOf(community.data, signedIn);
  const query = useGetHackathonQuery({ slug, hackathonSlug }, { skip: !slug || !hackathonSlug });
  const hackathon = query.data;
  const participation = participationOf(hackathon, membership);
  const accepted = participation === 'accepted';

  const application = useGetMyHackathonApplicationQuery({ slug, hackathonSlug }, { skip: !hackathon?.user_status?.has_applied });
  const teams = useGetHackathonTeamsQuery({ slug, hackathonSlug, page_size: 100 }, { skip: !hackathon?.allow_teams });
  const results = useGetHackathonResultsQuery({ slug, hackathonSlug }, { skip: !hackathon?.results_published });

  const teamList = teams.data?.results ?? [];
  const myTeam = teamList.find((t) => t.id === hackathon?.user_status?.team_id) ?? null;
  // Invitations waiting for the user's answer
  const invitations = myTeam ? [] : teamList.filter((t) => t.members.some((m) => m.user.id === meId && m.status === 'invited'));

  const tabs: { id: HackathonTabId; label: string }[] = [
    { id: 'overview', label: 'Présentation' },
    ...(hackathon?.allow_teams ? [{ id: 'teams' as const, label: `Équipes${teams.data ? ` (${teams.data.pagination?.count ?? teamList.length})` : ''}` }] : []),
    ...(accepted ? [{ id: 'space' as const, label: 'Mon espace' }] : []),
    ...(hackathon?.results_published ? [{ id: 'results' as const, label: 'Résultats' }] : []),
  ];
  const requested = params.get('tab') as HackathonTabId | null;
  const tab = tabs.some((t) => t.id === requested) ? (requested as HackathonTabId) : 'overview';

  const [apply, { isLoading: isApplying }] = useApplyToHackathonMutation();
  const [withdraw, { isLoading: isWithdrawing }] = useWithdrawHackathonApplicationMutation();
  const [createTeam, { isLoading: isCreatingTeam }] = useCreateHackathonTeamMutation();
  const [invite, { isLoading: isInviting }] = useInviteToHackathonTeamMutation();
  const [respond, { isLoading: isResponding }] = useRespondHackathonTeamInviteMutation();
  const [leave, { isLoading: isLeaving }] = useLeaveHackathonTeamMutation();

  const run = async (action: Promise<unknown>, message: string) => {
    try {
      await action;
      customToast.success({ message });
      return true;
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
      return false;
    }
  };
  const ids = { slug, hackathonSlug };

  return {
    ...ids,
    community: community.data,
    hackathon,
    membership,
    participation,
    application: application.data ?? null,
    isLoading: query.isLoading || community.isLoading,
    notFound: [403, 404].includes((query.error as FetchBaseQueryError | undefined)?.status as number),
    loginUrl: `/auth/login?next=${encodeURIComponent(pathname + search)}`,
    tabs,
    tab,
    openTab: (id: HackathonTabId) => setParams(id === 'overview' ? {} : { tab: id }),
    teams: teamList,
    myTeam,
    isLeader: !!myTeam && myTeam.leader.id === meId,
    invitations,
    results: results.data ?? [],
    isApplying,
    isWithdrawing,
    isCreatingTeam,
    isInviting,
    isResponding,
    isLeaving,
    /** Accepted at once when the organizers accept automatically, pending otherwise */
    apply: async (data: HackathonApplyData) => {
      try {
        const created = await apply({ ...ids, ...data }).unwrap();
        customToast.success({
          message: created.status === 'accepted' ? 'Inscription confirmée : bienvenue dans le hackathon !' : 'Candidature envoyée : les organisateurs vont l’examiner.',
        });
        return true;
      } catch (error) {
        customToast.error({ message: parseApiError(error).message });
        return false;
      }
    },
    withdraw: () => run(withdraw(ids).unwrap(), 'Votre candidature a été retirée.'),
    createTeam: (name: string, tagline: string) => run(createTeam({ ...ids, name, tagline }).unwrap(), `Équipe « ${name} » créée.`),
    invite: (identifier: string) => (myTeam ? run(invite({ ...ids, teamId: myTeam.id, identifier }).unwrap(), 'Invitation envoyée.') : Promise.resolve(false)),
    respond: (teamId: string, accept: boolean) =>
      run(respond({ ...ids, team_id: teamId, accept }).unwrap(), accept ? 'Vous avez rejoint l’équipe.' : 'Invitation déclinée.'),
    leaveTeam: () => {
      if (!myTeam) return Promise.resolve(false);
      const alone = myTeam.members.filter((m) => m.status === 'accepted').length <= 1;
      return run(leave({ ...ids, teamId: myTeam.id }).unwrap(), alone ? 'Équipe dissoute.' : 'Vous avez quitté l’équipe.');
    },
  };
}

export type HackathonPage = ReturnType<typeof UseHackathonPage>;

export default UseHackathonPage;
