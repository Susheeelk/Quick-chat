// ye line sabse upar honi chahiye, taaki .env baaki files se pehle load ho
import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDb from "./config/db.js";
import { app, server } from "./socket/socket.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import messageRoutes from "./routes/message.routes.js";

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => res.send("Chat API running"));
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// koi route na mile to
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// multer ke errors 400, baaki 500
app.use((err, req, res, next) => {
  const isUploadError =
    err.name === "MulterError" || err.message === "Only images allowed";
  res
    .status(isUploadError ? 400 : 500)
    .json({ message: err.message || "Something went wrong" });
});

const PORT = process.env.PORT || 8000;
connectDb().then(() => {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
