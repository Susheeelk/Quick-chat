import express from "express";
import isAuth from "../middleware/isAuth.js";
import {
  getMyChats,
  openChat,
  createGroup,
  addMember,
  removeMember,
  leaveGroup,
} from "../controllers/chat.controller.js";

const router = express.Router();

router.get("/", isAuth, getMyChats);
router.post("/direct/:userId", isAuth, openChat);

router.post("/group", isAuth, createGroup);
router.post("/group/:id/members", isAuth, addMember);
router.delete("/group/:id/members/:userId", isAuth, removeMember);
router.post("/group/:id/leave", isAuth, leaveGroup);

export default router;
