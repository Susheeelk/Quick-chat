import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },
    profilePic: { type: String, default: "" },
    lastSeen: { type: Date, default: null },

    // ye fields kisi query me by default nahi aati (select: false),
    // isse doosre users ko block list ya OTP kabhi leak nahi hoga
    blockedUsers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      select: false,
    },
    otp: { type: String, select: false }, // OTP ka hash
    otpExpires: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
