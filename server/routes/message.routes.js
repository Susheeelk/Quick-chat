import express from "express";
import isAuth from "../middleware/isAuth.js";
import upload from "../middleware/upload.js";
import { sendMessage, getMessages, markAsRead } from "../controllers/message.controller.js";

const router = express.Router();

router.post("/send/:conversationId", isAuth, upload.single("image"), sendMessage);
router.put("/read/:conversationId", isAuth, markAsRead);
router.get("/:conversationId", isAuth, getMessages);

export default router;
