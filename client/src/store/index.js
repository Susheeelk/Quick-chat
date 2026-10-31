import { configureStore } from "@reduxjs/toolkit";
import auth from "./authSlice";
import chat from "./chatSlice";
import ui from "./uiSlice";
import call from "./callSlice";
import themeReducer from "./themeSlice";

export const store = configureStore({
  reducer: { auth, chat, ui, call, theme: themeReducer },
});
