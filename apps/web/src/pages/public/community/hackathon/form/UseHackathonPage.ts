import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { useEffect, useState } from 'react';
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
import { useRealtimeRegistrations } from '@/utils/realtime/use-realtime';

export type HackathonTabId = 'overview' | 'teams' | 'space' | 'results';

/**
 * Where the signed-in user stands: what the page offers them
 * - visitor / not_member: sign in, join the community (the api only takes active members)
 * - can_apply / closed: registrations open or not
 * - pending, waitlisted, rejected, withdrawn, accepted: their application
 */
export type Participation = 'visitor' | 'not_member' | 'can_apply' | 'closed' | 'pending' | 'waitlisted' | 'rejected' | 'withdrawn' | 'accepted';

/**
 * True once the registration deadline is behind: a timer set to that moment closes the
 * applications of a page left open, without waiting for a reload
 */
export type ApplyOutcome = { ok: true } | { ok: false; closed: boolean; message: string };

function useDeadlinePassed(deadline: string | undefined) {
  const at = deadline ? new Date(deadline).getTime() : NaN;
  const [passed, setPassed] = useState(() => at <= Date.now());
  useEffect(() => {
    if (Number.isNaN(at)) return;
    const left = at - Date.now();
    setPassed(left <= 0);
    if (left <= 0) return;
    // setTimeout holds 24.8 days at most: further, it is set again by the next render
    const timer = setTimeout(() => setPassed(true), Math.min(left, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [at]);
  return passed;
}

function participationOf(hackathon: Hackathon | undefined, membership: string, deadlinePassed = false): Participation {
  if (membership === 'visitor') return 'visitor';
  const status = hackathon?.user_status?.application_status ?? null;
  if (status === 'accepted' || status === 'pending' || status === 'waitlisted') return status;
  if (membership !== 'member') return 'not_member';
  // Applying again after a withdrawal or a refusal, while the registrations are open
  if (hackathon?.is_registration_open && !deadlinePassed) return 'can_apply';
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
  const pollingInterval = useRealtimeRegistrations(community.data?.id);
  const query = useGetHackathonQuery({ slug, hackathonSlug }, { skip: !slug || !hackathonSlug, pollingInterval });
  const hackathon = query.data;
  const deadlinePassed = useDeadlinePassed(hackathon?.registration_end);
  const [spaceRequest, setSpaceRequest] = useState(0);
  const participation = participationOf(hackathon, membership, deadlinePassed);
  // Closed here before the api said so: read it again to follow the server
  const openOnServer = !!hackathon?.is_registration_open;
  const { refetch } = query;
  useEffect(() => {
    if (deadlinePassed && openOnServer) void refetch();
  }, [deadlinePassed, openOnServer, refetch]);
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
    /** Asks the page to bring the space into view (counted: a second click scrolls again) */
    spaceRequest,
    /** "Ouvrir mon espace": its tab, then the page scrolls to it (on a phone it is under the card) */
    openSpace: () => {
      setParams({ tab: 'space' });
      setSpaceRequest((n) => n + 1);
    },
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
    /** The applications close here (deadline behind, or closed by the api) */
    registrationClosed: !!hackathon && (deadlinePassed || !hackathon.is_registration_open),
    /**
     * Accepted at once when the organizers accept automatically, pending otherwise. A refusal says
     * why for the form (it keeps what was typed): the api names the hackathon field when the
     * applications are closed, the hackathon is then read again.
     */
    apply: async (data: HackathonApplyData): Promise<ApplyOutcome> => {
      try {
        const created = await apply({ ...ids, ...data }).unwrap();
        customToast.success({
          message: created.status === 'accepted' ? 'Inscription confirmée : bienvenue dans le hackathon !' : 'Candidature envoyée : les organisateurs vont l’examiner.',
        });
        return { ok: true };
      } catch (error) {
        const { message, fields } = parseApiError(error);
        if (fields.hackathon) {
          void refetch();
          return { ok: false, closed: true, message: fields.hackathon };
        }
        const fieldMessage = Object.values(fields)[0];
        return { ok: false, closed: false, message: fieldMessage ?? message };
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
