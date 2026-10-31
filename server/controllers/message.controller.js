import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { uploadBuffer } from "../config/cloudinary.js";
import { emitToUser } from "../socket/socket.js";
import { isBlocked } from "../utils/block.js";

// conversation tabhi milegi jab user uska member ho
const findMyConversation = async (id, userId) => {
  if (!mongoose.isValidObjectId(id)) return null;
  return Conversation.findOne({ _id: id, participants: userId });
};

// POST /api/message/send/:conversationId   (text aur/ya image)
export const sendMessage = async (req, res) => {
  try {
    const text = String(req.body.text || "").trim();
    if (!text && !req.file)
      return res.status(400).json({ message: "Message cannot be empty" });
    if (text.length > 2000)
      return res.status(400).json({ message: "Message bahut lamba hai" });

    const conversation = await findMyConversation(
      req.params.conversationId,
      req.userId,
    );
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found" });

    // 1-1 chat me block check
    if (!conversation.isGroup) {
      const other = conversation.participants.find(
        (p) => String(p) !== req.userId,
      );
      if (await isBlocked(req.userId, other))
        return res
          .status(403)
          .json({ message: "Aap is user ko message nahi bhej sakte (block)" });
    }

    let image = "";
    if (req.file)
      image = await uploadBuffer(req.file.buffer, "chat-app/messages");

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.userId,
      text,
      image,
      readBy: [req.userId], // bhejne wale ne to dekha hi hai
    });

    await Conversation.updateOne(
      { _id: conversation._id },
      { lastMessage: message._id },
    );
    await message.populate("sender", "name profilePic");

    // chat ke saare members ko live bhejo (sender ke dusre tab ko bhi)
    // frontend me message._id se duplicate check kar lena
    conversation.participants.forEach((p) =>
      emitToUser(p, "newMessage", message),
    );

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: `Send message error: ${err.message}` });
  }
};

// GET /api/message/:conversationId?before=<messageId>&limit=30
// purane messages ke liye "before" me sabse purane message ki id bhejo
export const getMessages = async (req, res) => {
  try {
    const conversation = await findMyConversation(
      req.params.conversationId,
      req.userId,
    );
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found" });

    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const filter = { conversation: conversation._id };
    if (mongoose.isValidObjectId(req.query.before))
      filter._id = { $lt: req.query.before };

    const messages = await Message.find(filter)
      .sort({ _id: -1 }) // naye pehle
      .limit(limit)
      .populate("sender", "name profilePic")
      .lean();

    res.status(200).json({
      messages: messages.reverse(), // purane se naye order me
      hasMore: messages.length === limit,
    });
  } catch (err) {
    res.status(500).json({ message: `Get messages error: ${err.message}` });
  }
};

// PUT /api/message/read/:conversationId   (chat kholte hi call karo)
export const markAsRead = async (req, res) => {
  try {
    const conversation = await findMyConversation(
      req.params.conversationId,
      req.userId,
    );
    if (!conversation)
      return res.status(404).json({ message: "Conversation not found" });

    await Message.updateMany(
      { conversation: conversation._id, readBy: { $ne: req.userId } },
      { $addToSet: { readBy: req.userId } },
    );

    // baaki members ko batao ki is user ne messages dekh liye (blue tick ke liye)
    conversation.participants.forEach((p) =>
      emitToUser(p, "messagesRead", {
        conversationId: conversation._id,
        userId: req.userId,
      }),
    );

    res.status(200).json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ message: `Mark read error: ${err.message}` });
  }
};
