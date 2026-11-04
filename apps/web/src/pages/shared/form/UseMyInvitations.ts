import { customToast } from '@kodinga-mono-repo/ui';
import {
  useAcceptInvitationByTokenMutation,
  useDeclineInvitationMutation,
  useGetMyInvitationsQuery,
  useGetMyTeamInvitationsQuery,
  useRespondMyTeamInvitationMutation,
} from '@/utils/api/community/community.api';
import type { MyInvitation } from '@/utils/api/community/community.type';
import { parseApiError } from '@/utils/api/errors';
import type { MyTeamInvitation } from '@/utils/api/hackathon/hackathon.type';

/** Invitations waiting for the answer of the user: to a community, and to a hackathon team */
function UseMyInvitations() {
  const { data: received = [] } = useGetMyInvitationsQuery();
  const { data: teams = [] } = useGetMyTeamInvitationsQuery();
  const [accept, { isLoading: isAccepting, originalArgs: accepting }] = useAcceptInvitationByTokenMutation();
  const [decline, { isLoading: isDeclining, originalArgs: declining }] = useDeclineInvitationMutation();
  const [respond, { isLoading: isResponding, originalArgs: responding }] = useRespondMyTeamInvitationMutation();

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      customToast.success({ message });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return {
    // A pending invitation past its date stays listed by the api
    invitations: received.filter((i) => i.is_valid),
    teams,
    /** The invitation being answered, for its buttons */
    busyId: isAccepting ? accepting : isDeclining ? declining : isResponding ? responding?.invitation_id : undefined,
    acceptInvitation: (i: MyInvitation) => run(() => accept(i.id).unwrap(), `Bienvenue dans ${i.community_name} !`),
    declineInvitation: (i: MyInvitation) => run(() => decline(i.id).unwrap(), 'Invitation refusée.'),
    answerTeam: (t: MyTeamInvitation, answer: boolean) =>
      run(() => respond({ invitation_id: t.id, accept: answer }).unwrap(), answer ? `Vous avez rejoint l’équipe ${t.team_name}.` : 'Invitation refusée.'),
  };
}

export default UseMyInvitations;
