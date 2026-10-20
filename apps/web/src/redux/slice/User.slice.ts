import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthState } from '@/utils/api/user/user.type';
import { AppStorage } from '@/utils/storage';

/** Session saved in localStorage (token, refresh token, user) */
export const USER_STORAGE_KEY = 'kodingaUser';

const initialState: AuthState = AppStorage.getItem<AuthState>(USER_STORAGE_KEY) ?? {
  user: null,
  token: null,
  refresh: null,
};

export const UserSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    onSetUser: (state, action: PayloadAction<AuthState['user']>) => {
      state.user = action.payload;
      AppStorage.setItem(USER_STORAGE_KEY, state);
    },
    onSetToken: (state, action: PayloadAction<AuthState['token']>) => {
      state.token = action.payload;
      AppStorage.setItem(USER_STORAGE_KEY, state);
    },
    onSetUserToken: (state, action: PayloadAction<AuthState>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.refresh = action.payload.refresh ?? null;
      AppStorage.setItem(USER_STORAGE_KEY, state);
    },
    /** After a refresh: new access token, and the new refresh token (rotated by the api) */
    onRefreshTokens: (state, action: PayloadAction<{ token: string; refresh?: string | null }>) => {
      state.token = action.payload.token;
      if (action.payload.refresh) state.refresh = action.payload.refresh;
      AppStorage.setItem(USER_STORAGE_KEY, state);
    },
    onLogout: (state) => {
      state.user = null;
      state.token = null;
      state.refresh = null;
      AppStorage.removeItem(USER_STORAGE_KEY);
    },
  },
});

export const { onSetUser, onSetToken, onSetUserToken, onRefreshTokens, onLogout } =
  UserSlice.actions;

export default UserSlice.reducer;
