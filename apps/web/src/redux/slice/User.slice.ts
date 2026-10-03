import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { AuthState } from '@/utils/api/user/user.type';
import { AppStorage } from '@/utils/storage';

const initialState: AuthState = AppStorage.getItem<AuthState>('user') ?? {
  user: null,
  token: null,
};

export const UserSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    onSetUser: (state, action: PayloadAction<AuthState['user']>) => {
      state.user = action.payload;
      AppStorage.setItem('user', state);
    },
    onSetToken: (state, action: PayloadAction<AuthState['token']>) => {
      state.token = action.payload;
      AppStorage.setItem('user', state);
    },
    onSetUserToken: (state, action: PayloadAction<AuthState>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      AppStorage.setItem('user', state);
    },
    onLogout: (state) => {
      state.user = null;
      state.token = null;
      AppStorage.removeItem('user');
    },
  },
});

export const { onSetUser, onSetToken, onSetUserToken, onLogout } =
  UserSlice.actions;

export default UserSlice.reducer;
