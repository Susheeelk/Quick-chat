import { createSlice } from "@reduxjs/toolkit";

const authSlice = createSlice({
  name: "auth",

  initialState: {
    user: null,
  },

  reducers: {
    login(state, { payload }) {
      state.user = payload;
    },

    signup(state, { payload }) {
      state.user = payload;
    },

    updateProfile(state, { payload }) {
      if (state.user) {
        Object.assign(state.user, payload);
      }
    },

    logout(state) {
      state.user = null;
    },
  },
});

export const { login, signup, updateProfile, logout } = authSlice.actions;

export default authSlice.reducer;
