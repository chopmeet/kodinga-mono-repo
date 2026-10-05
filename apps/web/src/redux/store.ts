import {
  configureStore,
  isRejectedWithValue,
  type Middleware,
} from '@reduxjs/toolkit';

import { AuthApi } from '@/utils/api/auth/auth.api';
import { UserApi } from '@/utils/api/user/user.api';
import { isDev } from '@/utils/http';
import { SearchSlice } from './slice/Search.slice';
import { onLogout, UserSlice } from './slice/User.slice';

// Any API call answered with 401 means the session is gone
const authMiddleware: Middleware = (store) => (next) => (action) => {
  if (
    isRejectedWithValue(action) &&
    (action.payload as { status?: number })?.status === 401
  ) {
    store.dispatch(onLogout());
  }
  return next(action);
};

export const store = configureStore({
  reducer: {
    [UserSlice.name]: UserSlice.reducer,
    [SearchSlice.name]: SearchSlice.reducer,
    [AuthApi.reducerPath]: AuthApi.reducer,
    [UserApi.reducerPath]: UserApi.reducer,
  },
  devTools: isDev,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(authMiddleware)
      .concat(AuthApi.middleware)
      .concat(UserApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
