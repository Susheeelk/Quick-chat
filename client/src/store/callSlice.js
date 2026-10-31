import { createSlice } from "@reduxjs/toolkit";
import { logout } from "./authSlice";

const initialState = {
  active: null, // chalti call: { peerId, chatId, type, name, avatar, direction, status }
  incoming: null, // aati call: { from, type, name, avatar, chatId }
  muted: false,
  camOff: false,
  seconds: 0,
  notice: "", // upar dikhne wala chhota message
  remoteReady: false, // samne wale ka stream aa gaya
};

// Chalti call ka sab kuch saaf
const resetActive = (state) => {
  state.active = null;
  state.muted = false;
  state.camOff = false;
  state.seconds = 0;
  state.remoteReady = false;
};

const callSlice = createSlice({
  name: "call",
  initialState,
  reducers: {
    setActive(state, { payload }) {
      state.active = payload;
    },
    patchActive(state, { payload }) {
      if (state.active) Object.assign(state.active, payload);
    },
    setIncoming(state, { payload }) {
      state.incoming = payload;
    },
    setSeconds(state, { payload }) {
      state.seconds = payload;
    },
    setMuted(state, { payload }) {
      state.muted = payload;
    },
    setCamOff(state, { payload }) {
      state.camOff = payload;
    },
    setNotice(state, { payload }) {
      state.notice = payload;
    },
    setRemoteReady(state, { payload }) {
      state.remoteReady = payload;
    },

    // payload: { chatId, type, seconds, connected }
    // chatSlice ise sunke chat me "📞 Voice call • 0:42" likh deta hai
    endCall(state) {
      resetActive(state);
    },

    // Bina chat record likhe call saaf karo
    resetCall(state) {
      resetActive(state);
    },
  },

  extraReducers: (builder) => {
    builder.addCase(logout, () => initialState);
  },
});

export const {
  setActive,
  patchActive,
  setIncoming,
  setSeconds,
  setMuted,
  setCamOff,
  setNotice,
  setRemoteReady,
  endCall,
  resetCall,
} = callSlice.actions;

export default callSlice.reducer;
