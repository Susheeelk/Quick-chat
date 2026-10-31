import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { emitToUser } from "../socket/socket.js";
import { isBlocked } from "../utils/block.js";

const USER_FIELDS = "name email profilePic lastSeen";

// ek chat ko users aur last message ke saath laao
const getChat = (id) =>
  Conversation.findById(id)
    .populate("participants", USER_FIELDS)
    .populate("lastMessage", "sender text image createdAt");

// chat ke saare members ko socket event bhejo
const notifyAll = (chat, event, data) => {
  chat.participants.forEach((p) => emitToUser(p._id, event, data));
};

// group dhundo jisme ye user member ho
const findMyGroup = async (id, userId) => {
  if (!mongoose.isValidObjectId(id)) return null;
  return Conversation.findOne({ _id: id, isGroup: true, participants: userId });
};

const isAdmin = (chat, userId) => String(chat.admin) === String(userId);

// ---------- Chat list (last message + unread count) ----------
// ---------- Chat list (last message + unread count) ----------
export const getMyChats = async (req, res) => {
  try {
    const chats = await Conversation.find({ participants: req.userId })
      .sort({ updatedAt: -1 })
      .populate("participants", USER_FIELDS)
      .populate("lastMessage", "sender text image createdAt")
      .lean();

    // Jin users ne mujhe block kiya hai, unka last seen mujhe nahi dikhana
    const blockedMe = await User.find({ blockedUsers: req.userId })
      .select("_id")
      .lean();
    const blockedMeIds = new Set(blockedMe.map((u) => String(u._id)));

    // har chat ke unread messages ginte hain
    const result = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          conversation: chat._id,
          sender: { $ne: req.userId },
          readBy: { $ne: req.userId },
        });

        const participants = chat.participants.map((p) =>
          blockedMeIds.has(String(p._id)) ? { ...p, lastSeen: null } : p,
        );

        return { ...chat, participants, unreadCount };
      }),
    );

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: `Get chats error: ${err.message}` });
  }
};

// ---------- 1-1 chat kholo (nahi hai to bana do) ----------
export const openChat = async (req, res) => {
  try {
    const otherId = req.params.userId;
    if (!mongoose.isValidObjectId(otherId) || otherId === req.userId)
      return res.status(400).json({ message: "Invalid user" });
    if (!(await User.exists({ _id: otherId })))
      return res.status(404).json({ message: "User not found" });
    if (await isBlocked(req.userId, otherId))
      return res.status(403).json({ message: "Chat nahi khul sakti" });

    let chat = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.userId, otherId] },
    });
    if (!chat)
      chat = await Conversation.create({ participants: [req.userId, otherId] });

    res.status(200).json(await getChat(chat._id));
  } catch (err) {
    res.status(500).json({ message: `Open chat error: ${err.message}` });
  }
};

// ---------- Group chat ----------

// body: { name: "Friends", members: ["id1", "id2"] }
export const createGroup = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name || name.length > 50)
      return res
        .status(400)
        .json({ message: "Group name 1 se 50 characters ka hona chahiye" });

    // duplicate hatao, galat id hatao, apni id hatao
    const members = [
      ...new Set([].concat(req.body.members || []).map(String)),
    ].filter((id) => mongoose.isValidObjectId(id) && id !== req.userId);
    if (members.length < 2)
      return res
        .status(400)
        .json({ message: "Group me kam se kam 2 aur members chahiye" });

    const count = await User.countDocuments({ _id: { $in: members } });
    if (count !== members.length)
      return res.status(400).json({ message: "Kuch users exist nahi karte" });

    const created = await Conversation.create({
      isGroup: true,
      name,
      admin: req.userId,
      participants: [req.userId, ...members],
    });

    const chat = await getChat(created._id);
    notifyAll(chat, "newChat", chat);
    res.status(201).json(chat);
  } catch (err) {
    res.status(500).json({ message: `Create group error: ${err.message}` });
  }
};

// body: { userId }
export const addMember = async (req, res) => {
  try {
    const chat = await findMyGroup(req.params.id, req.userId);
    if (!chat) return res.status(404).json({ message: "Group not found" });
    if (!isAdmin(chat, req.userId))
      return res
        .status(403)
        .json({ message: "Sirf admin member add kar sakta hai" });

    const { userId } = req.body;
    if (
      !mongoose.isValidObjectId(userId) ||
      !(await User.exists({ _id: userId }))
    )
      return res.status(400).json({ message: "Invalid user" });
    if (chat.participants.some((p) => String(p) === String(userId)))
      return res.status(400).json({ message: "User pehle se group me hai" });

    chat.participants.push(userId);
    await chat.save();

    const updated = await getChat(chat._id);
    notifyAll(updated, "chatUpdated", updated);
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: `Add member error: ${err.message}` });
  }
};

export const removeMember = async (req, res) => {
  try {
    const chat = await findMyGroup(req.params.id, req.userId);
    if (!chat) return res.status(404).json({ message: "Group not found" });
    if (!isAdmin(chat, req.userId))
      return res
        .status(403)
        .json({ message: "Sirf admin member hata sakta hai" });

    const { userId } = req.params;
    if (userId === req.userId)
      return res
        .status(400)
        .json({ message: "Khud ke liye 'leave group' use karo" });
    if (!chat.participants.some((p) => String(p) === userId))
      return res.status(404).json({ message: "User is group me nahi hai" });

    chat.participants.pull(userId);
    await chat.save();

    emitToUser(userId, "removedFromChat", { conversationId: chat._id });
    const updated = await getChat(chat._id);
    notifyAll(updated, "chatUpdated", updated);
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: `Remove member error: ${err.message}` });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const chat = await findMyGroup(req.params.id, req.userId);
    if (!chat) return res.status(404).json({ message: "Group not found" });

    chat.participants.pull(req.userId);

    // koi nahi bacha to group delete kar do
    if (chat.participants.length === 0) {
      await Message.deleteMany({ conversation: chat._id });
      await chat.deleteOne();
      return res.status(200).json({ message: "Group chhod diya" });
    }

    // admin chala gaya to pehle bache member ko admin bana do
    if (isAdmin(chat, req.userId)) chat.admin = chat.participants[0];
    await chat.save();

    emitToUser(req.userId, "removedFromChat", { conversationId: chat._id });
    const updated = await getChat(chat._id);
    notifyAll(updated, "chatUpdated", updated);
    res.status(200).json({ message: "Group chhod diya" });
  } catch (err) {
    res.status(500).json({ message: `Leave group error: ${err.message}` });
  }
};
