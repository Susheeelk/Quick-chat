import express from "express";
import isAuth from "../middleware/isAuth.js";
import {
  signup,
  login,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/logout", logout);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.put("/change-password", isAuth, changePassword);

export default router;
