import { useNavigate } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '@/redux/hook';
import { onLogout } from '@/redux/slice/User.slice';
import { AuthApi, useLogoutUserMutation } from '@/utils/api/auth/auth.api';
import { UserApi } from '@/utils/api/user/user.api';

export function useLogout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const refresh = useAppSelector((s) => s.user.refresh);
  const [logoutUser] = useLogoutUserMutation();

  const logout = async () => {
    // Blacklist the refresh token server-side first: the call needs the access token we are about
    // to clear. Best effort, a failure (or the 5s timeout) never blocks the local logout.
    if (refresh) await logoutUser({ refresh }).catch(() => undefined);
    dispatch(onLogout());
    // Drop cached data of the previous user
    dispatch(AuthApi.util.resetApiState());
    dispatch(UserApi.util.resetApiState());
    navigate('/auth/login', { replace: true });
  };

  return { logout };
}
