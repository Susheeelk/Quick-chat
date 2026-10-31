import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import User from "../models/user.model.js";
import { setAuthCookie } from "../utils/token.js";
import { sendMail } from "../config/mailer.js";

const isEmail = (email) => /^\S+@\S+\.\S+$/.test(email);

// body se aaya data hamesha string bana lo, warna object bhejne par server crash hota hai
const getText = (value) => String(value || "").trim();

const safeUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  profilePic: u.profilePic,
});

export const signup = async (req, res) => {
  try {
    const name = getText(req.body.name);
    const email = getText(req.body.email).toLowerCase();
    const password = String(req.body.password || "");

    if (name.length < 2 || name.length > 50)
      return res
        .status(400)
        .json({ message: "Name 2 se 50 characters ka hona chahiye" });
    if (!isEmail(email))
      return res.status(400).json({ message: "Valid email do" });
    if (password.length < 6 || password.length > 72)
      return res
        .status(400)
        .json({ message: "Password 6 se 72 characters ka hona chahiye" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });

    setAuthCookie(res, user._id);
    res.status(201).json(safeUser(user));
  } catch (err) {
    res.status(500).json({ message: `Signup error: ${err.message}` });
  }
};

export const login = async (req, res) => {
  try {
    const email = getText(req.body.email).toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    setAuthCookie(res, user._id);
    res.status(200).json(safeUser(user));
  } catch (err) {
    res.status(500).json({ message: `Login error: ${err.message}` });
  }
};

export const logout = async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("token", {
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
  });
  res.status(200).json({ message: "Logged out" });
};

// ---------- Forgot password ----------

// Step 1: email do, OTP mail pe aayega
export const forgotPassword = async (req, res) => {
  try {
    const email = getText(req.body.email).toLowerCase();
    if (!isEmail(email))
      return res.status(400).json({ message: "Valid email do" });

    // email registered ho ya na ho, reply same rakho (taaki koi email check na kar sake)
    const reply = {
      message: "Agar ye email registered hai to OTP bhej diya gaya hai",
    };

    const user = await User.findOne({ email });
    if (!user) return res.status(200).json(reply);

    const otp = String(randomInt(100000, 1000000)); // 6 digit
    user.otp = await bcrypt.hash(otp, 10); // DB me hash save hota hai, asli OTP nahi
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minute
    user.otpAttempts = 0;
    await user.save();

    await sendMail(
      email,
      "Password reset OTP",
      `Aapka OTP ${otp} hai. Ye 10 minute me expire ho jayega.`,
    );
    res.status(200).json(reply);
  } catch (err) {
    res.status(500).json({ message: `Forgot password error: ${err.message}` });
  }
};

// Step 2: email + otp + newPassword
export const resetPassword = async (req, res) => {
  try {
    const email = getText(req.body.email).toLowerCase();
    const otp = getText(req.body.otp);
    const newPassword = String(req.body.newPassword || "");

    if (!isEmail(email) || !otp)
      return res.status(400).json({ message: "Email and OTP required" });
    if (newPassword.length < 6 || newPassword.length > 72)
      return res
        .status(400)
        .json({ message: "Password 6 se 72 characters ka hona chahiye" });

    // select:false wali fields ko "+" lagake mangna padta hai
    const user = await User.findOne({ email }).select(
      "+otp +otpExpires +otpAttempts",
    );
    if (!user || !user.otp || user.otpExpires < Date.now())
      return res
        .status(400)
        .json({ message: "OTP galat hai ya expire ho gaya" });

    // 5 se zyada galat try par naya OTP mangwana padega
    if (user.otpAttempts >= 5)
      return res
        .status(400)
        .json({ message: "Bahut zyada galat attempts, naya OTP mangwao" });

    const ok = await bcrypt.compare(otp, user.otp);
    if (!ok) {
      user.otpAttempts += 1;
      await user.save();
      return res
        .status(400)
        .json({ message: "OTP galat hai ya expire ho gaya" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    await user.save();

    res.status(200).json({ message: "Password reset ho gaya, ab login karo" });
  } catch (err) {
    res.status(500).json({ message: `Reset password error: ${err.message}` });
  }
};

// ---------- Change password (login ke baad) ----------
export const changePassword = async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = String(req.body.newPassword || "");

    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: "Dono passwords chahiye" });
    if (newPassword.length < 6 || newPassword.length > 72)
      return res
        .status(400)
        .json({ message: "Password 6 se 72 characters ka hona chahiye" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok)
      return res.status(400).json({ message: "Current password galat hai" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.status(200).json({ message: "Password change ho gaya" });
  } catch (err) {
    res.status(500).json({ message: `Change password error: ${err.message}` });
  }
};
