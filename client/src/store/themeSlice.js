import { createSlice } from "@reduxjs/toolkit";

// mode: "light" | "dark" | "system"
const readSaved = () => {
  try {
    return localStorage.getItem("theme") || "light";
  } catch {
    return "light";
  }
};

// <html> par dark class lagao ya hatao
export const applyTheme = (mode) => {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", dark);
};

const themeSlice = createSlice({
  name: "theme",
  initialState: { mode: readSaved() },
  reducers: {
    setTheme(state, { payload }) {
      state.mode = payload;
    },
  },
});

export const { setTheme } = themeSlice.actions;

// Component me use: dispatch(changeTheme("dark"))
export const changeTheme = (mode) => (dispatch) => {
  try {
    localStorage.setItem("theme", mode);
  } catch {
    // storage block ho to bhi theme badal jayegi, bas yaad nahi rahegi
  }

  applyTheme(mode);
  dispatch(setTheme(mode));
};

export default themeSlice.reducer;
