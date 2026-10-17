import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { customToast } from '@kodinga-mono-repo/ui';
import { useAppSelector } from '@/redux/hook';
import { useAcceptInvitationMutation, useGetCommunityQuery } from '@/utils/api/community/community.api';
import { parseApiError } from '@/utils/api/errors';

/**
 * /invitations/:code?community=<slug> — the link made in the members tab. The community is only
 * there to be shown (the api has no endpoint to read an invitation by its code); a secret community
 * stays hidden until the guest has joined. Accepting: POST invitations/accept/ (signed-in users).
 */
function UseAcceptInvitation() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const slug = params.get('community') ?? '';
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const isSignedIn = !!useAppSelector((s) => s.user.token);

  const { data: community, isLoading } = useGetCommunityQuery(slug, { skip: !slug });
  const [acceptInvitation, { isLoading: isJoining }] = useAcceptInvitationMutation();

  const alreadyMember = !!community?.user_membership?.is_member && community.user_membership.status === 'active';
  const loginUrl = `/auth/login?next=${encodeURIComponent(pathname + search)}`;

  /** The team opens its space, the others the community page */
  const destination = (role: string | null | undefined) =>
    slug && role && ['owner', 'admin', 'moderator'].includes(role) ? `/c/${slug}/dashboard` : slug ? `/communities/${slug}` : '/';

  const accept = async () => {
    try {
      const member = await acceptInvitation(code).unwrap();
      customToast.success({ message: community ? `Bienvenue dans ${community.name} !` : 'Vous avez rejoint la communauté.' });
      navigate(destination(member.role), { replace: true });
    } catch (error) {
      customToast.error({ message: parseApiError(error).message });
    }
  };

  return {
    community,
    isLoading: !!slug && isLoading,
    isSignedIn,
    alreadyMember,
    loginUrl,
    memberUrl: destination(community?.user_membership?.role),
    isJoining,
    accept,
  };
}

export default UseAcceptInvitation;
