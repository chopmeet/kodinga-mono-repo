import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { customToast } from '@kodinga-mono-repo/ui';
import { useAppSelector } from '@/redux/hook';
import { useAcceptInvitationMutation, useGetCommunityQuery, useGetPublicInvitationQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';

/** Why an invitation can no longer be used */
const closedLabel: Record<string, string> = {
  accepted: 'Cette invitation a déjà été acceptée.',
  revoked: 'Cette invitation a été révoquée par la communauté.',
  expired: 'Cette invitation a expiré : demandez-en une nouvelle.',
};

/**
 * Two kinds of links: /invitations/:code?community=<slug> (made in the members tab) and
 * /invite/:code (sent by email by the api). The second has no slug: the public details of the
 * invitation give the community, the invited address and the status. Accepting: POST
 * invitations/accept/ (signed-in users; an invitation by email needs the invited address).
 */
function UseAcceptInvitation() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const slugParam = params.get('community') ?? '';
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const isSignedIn = !!useAppSelector((s) => s.user.token);

  // A shareable link has no public details (404): its community comes from the url
  const details = useGetPublicInvitationQuery(code, { skip: !code || !!slugParam });
  const invitation = details.data;
  const slug = slugParam || invitation?.workspace_slug || '';
  const { data: community, isLoading } = useGetCommunityQuery(slug, { skip: !slug });
  const [acceptInvitation, { isLoading: isJoining }] = useAcceptInvitationMutation();

  const alreadyMember = !!community?.user_membership?.is_member && community.user_membership.status === 'active';
  const loginUrl = `/auth/login?next=${encodeURIComponent(pathname + search)}`;
  const closed = invitation && !invitation.is_valid ? (closedLabel[invitation.status] ?? closedLabel.expired) : null;

  /** The team opens its space, the others the community page */
  const destination = (role: string | null | undefined) =>
    slug && role && ['owner', 'admin', 'moderator'].includes(role) ? `/c/${slug}/dashboard` : slug ? `/communities/${slug}` : '/';

  const accept = async () => {
    try {
      const member = await acceptInvitation(code).unwrap();
      const name = community?.name ?? invitation?.workspace_name;
      customToast.success({ message: name ? `Bienvenue dans ${name} !` : 'Vous avez rejoint la communauté.' });
      navigate(destination(member.role), { replace: true });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return {
    community,
    /** Shown while the community itself is hidden (secret, not a member yet) */
    invitedTo: invitation ? { name: invitation.workspace_name, avatar_url: invitation.workspace_avatar_url } : null,
    invitedEmail: invitation?.masked_email ?? '',
    closed,
    isLoading: details.isLoading || (!!slug && isLoading),
    isSignedIn,
    alreadyMember,
    loginUrl,
    memberUrl: destination(community?.user_membership?.role),
    isJoining,
    accept,
  };
}

export default UseAcceptInvitation;
