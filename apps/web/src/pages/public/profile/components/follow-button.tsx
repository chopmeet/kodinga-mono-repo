import { UserCheck, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

import { Button, cn, customToast } from '@kodinga/ui';
import { useAppSelector } from '@/redux/hook';
import type { PublicProfile } from '@/utils/api/profile/profile.type';
import { parseApiError } from '@/utils/api/errors';
import { useToggleFollowMutation } from '@/utils/api/user/user.api';
import { useUser } from '@/utils/Utils';

const className = 'h-13 w-full text-base';

/**
 * Suivre / Abonné on a public profile. The api toggles, so the button needs the current state
 * (is_following): without it, nothing is shown. Visitors sign in first; nothing on one's own profile.
 */
export function FollowButton({ profile, name }: { profile: PublicProfile; name: string }) {
  const { t } = useTranslation();
  const signedIn = !!useAppSelector((s) => s.user.token);
  const me = useUser();
  const { pathname } = useLocation();
  const [toggleFollow, { isLoading }] = useToggleFollowMutation();
  const following = profile.is_following;

  if (me?.id === profile.user.id) return null;
  if (!signedIn) {
    return (
      <Button asChild size="lg" variant="outline" className={className}>
        <Link to={`/auth/login?next=${encodeURIComponent(pathname)}`}>
          <UserPlus /> {t('profile.follow.follow')}
        </Link>
      </Button>
    );
  }
  if (following === undefined) return null;

  const toggle = async () => {
    try {
      const state = await toggleFollow(profile.user.username).unwrap();
      customToast.success({ message: state.is_following ? t('profile.follow.nowFollowing', { name }) : t('profile.follow.noLongerFollowing', { name }) });
    } catch (err) {
      customToast.error({ message: parseApiError(err).message });
    }
  };

  return (
    <Button
      size="lg"
      variant="outline"
      aria-pressed={following}
      title={following ? t('profile.follow.unfollowTitle', { name }) : undefined}
      className={cn(className, following && 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary')}
      isLoading={isLoading}
      onClick={toggle}
    >
      {following ? <UserCheck /> : <UserPlus />}
      {following ? t('profile.follow.following') : t('profile.follow.follow')}
    </Button>
  );
}
