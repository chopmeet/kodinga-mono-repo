import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// Community search shared by the home hero and the header (shown once the hero scrolls away)
type SearchState = {
  query: string;
  heroSearchVisible: boolean;
};

const initialState: SearchState = {
  query: '',
  heroSearchVisible: true,
};

export const SearchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    onSetSearchQuery: (state, action: PayloadAction<string>) => {
      state.query = action.payload;
    },
    onSetHeroSearchVisible: (state, action: PayloadAction<boolean>) => {
      state.heroSearchVisible = action.payload;
    },
  },
});

export const { onSetSearchQuery, onSetHeroSearchVisible } = SearchSlice.actions;

export default SearchSlice.reducer;
