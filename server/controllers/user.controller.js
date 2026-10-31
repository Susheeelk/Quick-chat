import mongoose from "mongoose";
import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";
import { uploadBuffer } from "../config/cloudinary.js";
import { emitToUser } from "../socket/socket.js";

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: `Current user error: ${err.message}` });
  }
};

export const editProfile = async (req, res) => {
  try {
    const update = {};

    const name = String(req.body.name || "").trim();
    if (name) {
      if (name.length < 2 || name.length > 50)
        return res
          .status(400)
          .json({ message: "Name 2 se 50 characters ka hona chahiye" });
      update.name = name;
    }
    if (req.file)
      update.profilePic = await uploadBuffer(
        req.file.buffer,
        "chat-app/profiles",
      );

    const user = await User.findByIdAndUpdate(req.userId, update, {
      new: true,
    }).select("-password");

    // Jinke saath meri chat hai unki screen par bhi naya naam/photo aa jaye
    const chats = await Conversation.find({ participants: req.userId })
      .select("participants")
      .lean();
    const ids = new Set(chats.flatMap((c) => c.participants.map(String)));
    ids.forEach((id) => emitToUser(id, "chatUpdated", {}));

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: `Edit profile error: ${err.message}` });
  }
};

export const getOtherUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select(
      "-password",
    );
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: `Get users error: ${err.message}` });
  }
};

// search me special characters (. * + etc) ko safe bana dete hain
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const searchUsers = async (req, res) => {
  try {
    const q = String(req.query.query || "").trim();
    if (!q) return res.status(200).json([]);

    const rx = new RegExp(escapeRegex(q), "i");
    const users = await User.find({
      _id: { $ne: req.userId },
      $or: [{ name: rx }, { email: rx }],
    })
      .select("-password")
      .limit(20);

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: `Search error: ${err.message}` });
  }
};

// ---------- Block / Unblock ----------

export const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId) || userId === req.userId)
      return res.status(400).json({ message: "Invalid user" });

    // $addToSet: ek user do baar add nahi hota
    await User.updateOne(
      { _id: req.userId },
      { $addToSet: { blockedUsers: userId } },
    );

    // Dono users ki screen ko batao, taaki wo apni chats dobara laayein
    emitToUser(userId, "blockChanged", {});
    emitToUser(req.userId, "blockChanged", {});

    res.status(200).json({ message: "User block ho gaya" });
  } catch (err) {
    res.status(500).json({ message: `Block error: ${err.message}` });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId))
      return res.status(400).json({ message: "Invalid user" });

    await User.updateOne(
      { _id: req.userId },
      { $pull: { blockedUsers: userId } },
    );

    emitToUser(userId, "blockChanged", {});
    emitToUser(req.userId, "blockChanged", {});

    res.status(200).json({ message: "User unblock ho gaya" });
  } catch (err) {
    res.status(500).json({ message: `Unblock error: ${err.message}` });
  }
};

// frontend is list se check karta hai ki kaun block hai
export const getBlockedUsers = async (req, res) => {
  try {
    const me = await User.findById(req.userId)
      .select("+blockedUsers")
      .populate("blockedUsers", "name email profilePic");
    res.status(200).json(me.blockedUsers);
  } catch (err) {
    res.status(500).json({ message: `Blocked list error: ${err.message}` });
  }
};

// Dono taraf ka block status:
// blockedByMe = jinko maine block kiya, blockedMe = jinhone mujhe block kiya
export const getBlockStatus = async (req, res) => {
  try {
    const me = await User.findById(req.userId).select("+blockedUsers");
    const blockedMe = await User.find({ blockedUsers: req.userId }).select(
      "_id",
    );

    res.status(200).json({
      blockedByMe: (me?.blockedUsers || []).map(String),
      blockedMe: blockedMe.map((u) => String(u._id)),
    });
  } catch (err) {
    res.status(500).json({ message: `Block status error: ${err.message}` });
  }
};
