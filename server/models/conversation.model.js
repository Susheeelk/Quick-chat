import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    isGroup: { type: Boolean, default: false },
    name: { type: String, default: "" }, // sirf group ke liye
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // sirf group ke liye
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Conversation", conversationSchema);
