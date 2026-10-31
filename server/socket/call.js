import mongoose from "mongoose";
import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";
import { isBlocked } from "../utils/block.js";

// Audio/video call ka server ka kaam sirf "signaling" hai:
// dono users ke beech offer / answer / ice messages pahunchana.
// Asli audio/video seedha dono browsers ke beech (WebRTC) chalta hai.

// jo users abhi call me hain: userId -> { peer, socketId }
const inCall = new Map();

// jab tak call ring ho rahi hai: callerId -> { socketId, to }
const ringing = new Map();

export const registerCallHandlers = (io, socket, isOnline) => {
  const me = socket.userId;
  const send = (to, event, data) => io.to(String(to)).emit(event, data);

  // call khatam: dono ko free karo aur samne wale ko batao
  const endCall = (peer) => {
    inCall.delete(me);
    inCall.delete(peer);
    send(peer, "call:ended", { from: me });
  };

  // 1) Call lagao. data: { to, type: "audio" | "video" }
  socket.on("call:invite", async ({ to, type } = {}, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    try {
      if (
        !["audio", "video"].includes(type) ||
        !mongoose.isValidObjectId(to) ||
        String(to) === me
      )
        return reply({ error: "Invalid request" });

      const callee = String(to);

      // sirf unko call lag sakti hai jinke saath 1-1 chat ho
      const hasChat = await Conversation.exists({
        isGroup: false,
        participants: { $all: [me, callee] },
      });
      if (!hasChat) return reply({ error: "Pehle chat shuru karo" });

      if (await isBlocked(me, callee))
        return reply({ error: "Call nahi lag sakti" });
      if (!isOnline(callee)) return reply({ error: "User offline hai" });
      if (inCall.has(me) || ringing.has(me))
        return reply({ error: "Aap pehle se call me ho" });
      if (inCall.has(callee)) return reply({ error: "User busy hai" });

      const caller = await User.findById(me).select("name profilePic").lean();
      ringing.set(me, { socketId: socket.id, to: callee });
      send(callee, "call:incoming", { from: me, type, caller });
      reply({ ok: true });
    } catch {
      reply({ error: "Call start nahi ho payi" });
    }
  });

  // 2) Call utha li. data: { to: callerId }
  socket.on("call:accept", ({ to } = {}) => {
    const caller = String(to);
    const ring = ringing.get(caller);

    // caller ne cancel kar diya ho ya ye call mere liye na ho to ignore
    if (!ring || ring.to !== me) return;
    if (inCall.has(me) || inCall.has(caller)) return;

    inCall.set(me, { peer: caller, socketId: socket.id });
    inCall.set(caller, { peer: me, socketId: ring.socketId });
    ringing.delete(caller);
    send(caller, "call:accepted", { from: me });
  });

  // 3) Call reject. data: { to: callerId }
  socket.on("call:reject", ({ to } = {}) => {
    const caller = String(to);
    const ring = ringing.get(caller);

    if (!ring || ring.to !== me) return;

    ringing.delete(caller);
    send(caller, "call:rejected", { from: me });
  });

  // 4) Call kaat di (ya ringing me cancel). data: { to }
  socket.on("call:end", ({ to } = {}) => {
    const peer = String(to);

    // caller ne ringing me hi cancel kar di
    if (ringing.get(me)?.to === peer) {
      ringing.delete(me);
      send(peer, "call:ended", { from: me });
      return;
    }

    // chalti call tabhi katni hai jab peer wahi ho
    if (inCall.get(me)?.peer === peer) endCall(peer);
  });

  // 5) WebRTC ka data seedha samne wale ko pahuncha do (sirf call ke peer ko)
  ["call:offer", "call:answer", "call:ice"].forEach((event) => {
    socket.on(event, ({ to, ...payload } = {}) => {
      if (inCall.get(me)?.peer !== String(to)) return;
      send(to, event, { from: me, ...payload });
    });
  });

  // internet gaya ya tab band hua to call khatam karo
  socket.on("disconnect", () => {
    // sirf wahi socket call khatam kare jo call me tha (dusra tab ho to call chalti rahe)
    const call = inCall.get(me);
    if (call && call.socketId === socket.id) endCall(call.peer);

    // ringing ke dauran caller gaya to saamne wale ka popup band karo
    const ring = ringing.get(me);
    if (ring && ring.socketId === socket.id) {
      ringing.delete(me);
      send(ring.to, "call:ended", { from: me });
    }
  });
};
