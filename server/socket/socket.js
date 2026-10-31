import { Server } from "socket.io";
import http from "http";
import express from "express";
import jwt from "jsonwebtoken";
import { parse } from "cookie";

import User from "../models/user.model.js";
import { registerCallHandlers } from "./call.js";

export const app = express();
export const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
});

// userId -> connected tabs/devices ki count
const onlineUsers = new Map();

export const isOnline = (userId) => onlineUsers.has(String(userId));

export const emitToUser = (userId, event, data) => {
  if (!userId) return;
  io.to(String(userId)).emit(event, data);
};

// Browser cookie se JWT verify karein.
io.use((socket, next) => {
  try {
    const cookies = parse(socket.handshake.headers.cookie || "");
    const token = cookies.token;

    if (!token) {
      return next(new Error("Not authenticated"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.userId) {
      return next(new Error("Invalid token"));
    }

    socket.userId = String(decoded.userId);
    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (socket) => {
  const userId = String(socket.userId);

  // Har user ka apna room, taaki uske saare devices ko event mile.
  socket.join(userId);

  onlineUsers.set(userId, (onlineUsers.get(userId) || 0) + 1);

  io.emit("onlineUsers", [...onlineUsers.keys()]);

  console.log("Socket connected:", socket.id, "User:", userId);

  // Typing event: { conversationId, to: [userId, ...] }
  socket.on("typing", ({ conversationId, to } = {}) => {
    if (!conversationId || !to) return;

    const recipients = Array.isArray(to) ? to : [to];

    recipients.forEach((recipientId) => {
      if (String(recipientId) === userId) return;

      emitToUser(recipientId, "typing", {
        conversationId: String(conversationId),
        from: userId,
      });
    });
  });

  socket.on("stopTyping", ({ conversationId, to } = {}) => {
    if (!conversationId || !to) return;

    const recipients = Array.isArray(to) ? to : [to];

    recipients.forEach((recipientId) => {
      if (String(recipientId) === userId) return;

      emitToUser(recipientId, "stopTyping", {
        conversationId: String(conversationId),
        from: userId,
      });
    });
  });

  // Existing voice/video signaling handlers ko preserve karein.
  registerCallHandlers(io, socket, isOnline);

  socket.on("disconnect", async () => {
    const currentCount = onlineUsers.get(userId) || 0;
    const remaining = currentCount - 1;

    // Doosra tab/device connected ho toh user online rahega.
    if (remaining > 0) {
      onlineUsers.set(userId, remaining);
      return;
    }

    onlineUsers.delete(userId);

    const lastSeen = new Date();

    io.emit("onlineUsers", [...onlineUsers.keys()]);
    io.emit("lastSeen", {
      userId,
      lastSeen,
    });

    try {
      await User.findByIdAndUpdate(userId, { lastSeen });
    } catch (error) {
      console.error("lastSeen save error:", error.message);
    }

    console.log("Socket disconnected:", socket.id, "User:", userId);
  });
});
