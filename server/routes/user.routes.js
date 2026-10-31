import express from "express";
import isAuth from "../middleware/isAuth.js";
import upload from "../middleware/upload.js";
import {
  getCurrentUser,
  editProfile,
  getOtherUsers,
  searchUsers,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getBlockStatus,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/current", isAuth, getCurrentUser);
router.put("/profile", isAuth, upload.single("profilePic"), editProfile);
router.get("/others", isAuth, getOtherUsers);
router.get("/search", isAuth, searchUsers);

router.get("/blocked", isAuth, getBlockedUsers);
router.get("/block-status", isAuth, getBlockStatus);
router.post("/block/:userId", isAuth, blockUser);
router.delete("/block/:userId", isAuth, unblockUser);

export default router;
