import { useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { customToast } from '@kodinga/ui';
import { useAppSelector } from '@/redux/hook';
import { useAcceptInvitationByTokenMutation, useAcceptInvitationMutation, useDeclineInvitationMutation, useGetCommunityQuery, useGetPublicInvitationQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';

/** Why an invitation can no longer be used */
const closedLabel: Record<string, string> = {
  accepted: 'Cette invitation a déjà été acceptée.',
  declined: 'Cette invitation a été refusée.',
  revoked: 'Cette invitation a été révoquée par la communauté.',
  expired: 'Cette invitation a expiré : demandez-en une nouvelle.',
};

/**
 * Two kinds of links: /invitations/:code?community=<slug> (made in the members tab) and
 * /invite/:code (sent by email, or the shareable link of the community). The second has no slug: the
 * public details give the community, the invited address and the status. Accepting needs a signed-in
 * user, with the invited address for an invitation by email, the only kind that can be declined.
 */
function UseAcceptInvitation() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const slugParam = params.get('community') ?? '';
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const isSignedIn = !!useAppSelector((s) => s.user.token);

  // The community of a link of the members tab comes from the url
  const details = useGetPublicInvitationQuery(code, { skip: !code || !!slugParam });
  const invitation = details.data;
  const slug = slugParam || invitation?.workspace_slug || '';
  const { data: community, isLoading } = useGetCommunityQuery(slug, { skip: !slug });
  const [acceptWithCode, { isLoading: isJoiningWithCode }] = useAcceptInvitationMutation();
  const [acceptWithToken, { isLoading: isJoiningWithToken }] = useAcceptInvitationByTokenMutation();
  const [declineInvitation, { isLoading: isDeclining }] = useDeclineInvitationMutation();
  const [declined, setDeclined] = useState(false);

  const alreadyMember = !!community?.user_membership?.is_member && community.user_membership.status === 'active';
  const loginUrl = `/auth/login?next=${encodeURIComponent(pathname + search)}`;
  const registerUrl = `/auth/register?next=${encodeURIComponent(pathname + search)}`;
  const closed = declined ? 'Vous avez refusé cette invitation.' : invitation && !invitation.is_valid ? (closedLabel[invitation.status] ?? closedLabel.expired) : null;
  // The api masks an empty address as "***": a shareable link, addressed to nobody
  const invitedEmail = invitation?.masked_email && invitation.masked_email !== '***' ? invitation.masked_email : '';

  /** The team opens its space, the others the community page */
  const destination = (role: string | null | undefined) =>
    slug && role && ['owner', 'admin', 'moderator'].includes(role) ? `/c/${slug}/dashboard` : slug ? `/communities/${slug}` : '/';

  const accept = async () => {
    try {
      const member = await (slugParam ? acceptWithCode(code) : acceptWithToken(code)).unwrap();
      const name = community?.name ?? invitation?.workspace_name;
      customToast.success({ message: name ? `Bienvenue dans ${name} !` : 'Vous avez rejoint la communauté.' });
      navigate(destination(member.role), { replace: true });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  const decline = async () => {
    try {
      await declineInvitation(code).unwrap();
      setDeclined(true);
      customToast.success({ message: 'Invitation refusée.' });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return {
    community,
    /** Shown while the community itself is hidden (secret, not a member yet) */
    invitedTo: invitation ? { name: invitation.workspace_name, avatar_url: invitation.workspace_avatar_url } : null,
    invitedEmail,
    closed,
    isLoading: details.isLoading || (!!slug && isLoading),
    isSignedIn,
    alreadyMember,
    loginUrl,
    registerUrl,
    memberUrl: destination(community?.user_membership?.role),
    isJoining: isJoiningWithCode || isJoiningWithToken,
    accept,
    canDecline: !!invitedEmail,
    isDeclining,
    decline,
  };
}

export default UseAcceptInvitation;
