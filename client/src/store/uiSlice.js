import { createSlice } from '@reduxjs/toolkit';
import { setActiveChat } from './chatSlice';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    showInfo: false,        // right info panel (desktop: inline, tablet/mobile: overlay)
    mobileView: 'list',     // 'list' | 'chat' (single page navigation on mobile)
    profileOpen: false,     // edit profile modal / full screen
  },
  reducers: {
    setShowInfo: (s, { payload }) => { s.showInfo = payload; },
    toggleInfo: (s) => { s.showInfo = !s.showInfo; },
    setMobileView: (s, { payload }) => { s.mobileView = payload; },
    setProfileOpen: (s, { payload }) => { s.profileOpen = payload; },
  },
  extraReducers: (b) => {
    b.addCase(setActiveChat, (s) => { s.mobileView = 'chat'; });
  },
});

export const { setShowInfo, toggleInfo, setMobileView, setProfileOpen } = uiSlice.actions;
export default uiSlice.reducer;
