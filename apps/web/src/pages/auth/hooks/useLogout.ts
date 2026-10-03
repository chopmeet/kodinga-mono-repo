import { useNavigate } from 'react-router-dom';

import { useAppDispatch } from '@/redux/hook';
import { onLogout } from '@/redux/slice/User.slice';
import { AuthApi } from '@/utils/api/auth/auth.api';
import { UserApi } from '@/utils/api/user/user.api';

export function useLogout() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const logout = () => {
    dispatch(onLogout());
    // Drop cached data of the previous user
    dispatch(AuthApi.util.resetApiState());
    dispatch(UserApi.util.resetApiState());
    navigate('/login', { replace: true });
  };

  return { logout };
}
