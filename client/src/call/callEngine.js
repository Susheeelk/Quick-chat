import socket from "../socket";
import { store } from "../store";
import {
  setActive,
  patchActive,
  setIncoming,
  setSeconds,
  setMuted,
  setCamOff,
  setNotice,
  setRemoteReady,
  endCall,
  resetCall,
} from "../store/callSlice";

const { dispatch } = store;

// Sirf free STUN. Alag networks / mobile data par call ke liye TURN server bhi chahiye.
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

// Itni der (30 sec) me koi na uthaye to call apne aap kat jaye
const RING_TIMEOUT_MS = 30000;

// ---------- Engine ki apni cheezein (Redux me nahi rakh sakte) ----------
let pc = null; // RTCPeerConnection
let localStream = null; // apna mic/camera
let remoteStream = null; // samne wale ka stream
let callInfo = null; // chalti call ki info
let incomingInfo = null; // aati call ki info
let pendingIce = []; // jawab aane se pehle aaye ICE candidates
let ringTimer = null;
let noticeTimer = null;
let secondsTimer = null;
let connectedAt = null;
let starting = false; // call lagne ki process chal rahi hai
let attached = false;

// CallOverlay ko batane ke liye ki stream badla hai (video element me lagane ke liye)
const streamListeners = new Set();
const notifyStreams = () => streamListeners.forEach((fn) => fn());

export const subscribeStreams = (fn) => {
  streamListeners.add(fn);
  return () => streamListeners.delete(fn);
};

export const getStreams = () => ({ local: localStream, remote: remoteStream });

// ---------- Chhote helpers ----------
const mediaErrorText = (err) => {
  if (err?.name === "NotAllowedError")
    return "Mic/camera ki permission do (browser ke address bar me Allow karo).";
  if (err?.name === "NotFoundError") return "Mic ya camera nahi mila.";
  if (err?.name === "NotReadableError")
    return "Mic/camera kisi aur app ya tab me chal raha hai.";
  return "Mic/camera shuru nahi ho paya (localhost ya HTTPS chahiye).";
};

const getMedia = (type) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("unsupported"));
  }

  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === "video",
  });
};

// Chhota message (4 second ke liye)
const showNotice = (message) => {
  dispatch(setNotice(message));
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => dispatch(setNotice("")), 4000);
};

const updateIncoming = (value) => {
  incomingInfo = value;
  dispatch(setIncoming(value));
};

// Mic/camera/connection band karo (Redux ko ye nahi chhuta)
const cleanupMedia = () => {
  clearTimeout(ringTimer);
  clearInterval(secondsTimer);
  ringTimer = null;
  secondsTimer = null;

  localStream?.getTracks().forEach((track) => track.stop());

  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.close();
  }

  pc = null;
  localStream = null;
  remoteStream = null;
  callInfo = null;
  connectedAt = null;
  pendingIce = [];

  notifyStreams();
};

// Call khatam: chat me record likho, sab saaf karo, message dikhao
const finish = (message) => {
  const info = callInfo;
  const connected = connectedAt !== null;
  const duration = connected
    ? Math.floor((Date.now() - connectedAt) / 1000)
    : 0;

  if (info?.chatId) {
    dispatch(
      endCall({
        chatId: info.chatId,
        type: info.type,
        seconds: duration,
        connected,
      }),
    );
  } else {
    dispatch(resetCall());
  }

  cleanupMedia();

  if (message) showNotice(message);
};

// Peer connection banao aur apna stream usme daalo
const makePeer = (peerId) => {
  const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  connection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("call:ice", { to: peerId, candidate: event.candidate });
    }
  };

  connection.ontrack = (event) => {
    remoteStream = event.streams[0];
    dispatch(setRemoteReady(true));
    notifyStreams();
  };

  connection.onconnectionstatechange = () => {
    if (connection.connectionState === "connected") {
      if (!connectedAt) {
        connectedAt = Date.now();

        secondsTimer = setInterval(() => {
          if (connectedAt) {
            dispatch(setSeconds(Math.floor((Date.now() - connectedAt) / 1000)));
          }
        }, 1000);
      }

      dispatch(patchActive({ status: "connected" }));
    }

    if (connection.connectionState === "failed") {
      socket.emit("call:end", { to: peerId });
      finish("Connection fail ho gayi.");
    }
  };

  localStream
    .getTracks()
    .forEach((track) => connection.addTrack(track, localStream));

  pc = connection;
  return connection;
};

const addPendingIce = async () => {
  for (const candidate of pendingIce) {
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      // ek candidate kharab ho to baaki chalne do
    }
  }
  pendingIce = [];
};

// ---------- Buttons ke liye functions ----------

// Call lagao: startCall({ chatId, to, name, avatar, type: "audio" | "video" })
export const startCall = async ({ chatId, to, name, avatar, type }) => {
  if (callInfo || incomingInfo || starting || !to) return;

  if (!socket.connected) {
    showNotice("Server se connection nahi hai. Thodi der baad try karo.");
    return;
  }

  starting = true;

  try {
    localStream = await getMedia(type);
    notifyStreams();
  } catch (err) {
    starting = false;
    showNotice(mediaErrorText(err));
    return;
  }

  socket.emit("call:invite", { to, type }, (res) => {
    starting = false;

    if (res?.error) {
      cleanupMedia();
      showNotice(res.error);
      return;
    }

    const peerId = String(to);

    callInfo = { peerId, chatId, type, name, avatar };
    dispatch(
      setActive({
        peerId,
        chatId,
        type,
        name,
        avatar,
        direction: "out",
        status: "ringing",
      }),
    );

    // Koi na uthaye to 30 second baad kaat do
    ringTimer = setTimeout(() => {
      socket.emit("call:end", { to: peerId });
      finish("Koi jawab nahi mila.");
    }, RING_TIMEOUT_MS);
  });
};

// Aati call utha lo
export const acceptCall = async () => {
  const inc = incomingInfo;
  if (!inc) return;

  let stream;

  try {
    stream = await getMedia(inc.type);
  } catch (err) {
    socket.emit("call:reject", { to: inc.from });
    updateIncoming(null);
    showNotice(mediaErrorText(err));
    return;
  }

  // Permission dete-dete caller ne call kaat di ho to
  if (incomingInfo !== inc) {
    stream.getTracks().forEach((track) => track.stop());
    return;
  }

  localStream = stream;
  notifyStreams();

  callInfo = {
    peerId: inc.from,
    chatId: inc.chatId,
    type: inc.type,
    name: inc.name,
    avatar: inc.avatar,
  };

  dispatch(
    setActive({
      peerId: inc.from,
      chatId: inc.chatId,
      type: inc.type,
      name: inc.name,
      avatar: inc.avatar,
      direction: "in",
      status: "connecting",
    }),
  );

  updateIncoming(null);
  socket.emit("call:accept", { to: inc.from });
};

export const rejectCall = () => {
  if (incomingInfo) socket.emit("call:reject", { to: incomingInfo.from });
  updateIncoming(null);
};

// Call kaato (ringing me ho to cancel)
export const hangUp = () => {
  if (callInfo) socket.emit("call:end", { to: callInfo.peerId });
  finish();
};

export const toggleMute = () => {
  const tracks = localStream?.getAudioTracks() || [];
  tracks.forEach((track) => (track.enabled = !track.enabled));
  dispatch(setMuted(tracks.length > 0 && !tracks[0].enabled));
};

export const toggleCamera = () => {
  const tracks = localStream?.getVideoTracks() || [];
  tracks.forEach((track) => (track.enabled = !track.enabled));
  dispatch(setCamOff(tracks.length > 0 && !tracks[0].enabled));
};

// ---------- Server se aane wale events ----------
// Dashboard khulte hi ek baar chalao: useEffect(() => initCallEngine(), []);
export const initCallEngine = () => {
  if (attached) return () => {};
  attached = true;

  // Kisi ki call aa rahi hai
  const onIncoming = (data) => {
    const from = String(data.from);

    // Main khud call me hoon ya doosri call ring ho rahi hai -> naye ko reject
    if (callInfo || incomingInfo) {
      socket.emit("call:reject", { to: from });
      return;
    }

    // Is user ke saath meri chat kaunsi hai (call ka record us chat me likhne ke liye)
    const chat = store
      .getState()
      .chat.chats.find((item) => item.otherUserId === from);

    updateIncoming({
      from,
      type: data.type,
      name: data.caller?.name || chat?.name || "Unknown",
      avatar: data.caller?.profilePic || chat?.avatar || "",
      chatId: chat?.id || "",
    });
  };

  // Samne wale ne utha li -> hum (caller) offer bhejte hain
  const onAccepted = async ({ from }) => {
    const peerId = String(from);
    if (callInfo?.peerId !== peerId) return;

    clearTimeout(ringTimer);
    dispatch(patchActive({ status: "connecting" }));

    try {
      const connection = makePeer(peerId);
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      socket.emit("call:offer", {
        to: peerId,
        sdp: connection.localDescription,
      });
    } catch {
      socket.emit("call:end", { to: peerId });
      finish("Call connect nahi ho payi.");
    }
  };

  // Offer aaya -> answer bhejo (receiver side)
  const onOffer = async ({ from, sdp }) => {
    const peerId = String(from);
    if (callInfo?.peerId !== peerId) return; // hum is call me nahi hain

    try {
      const connection = makePeer(peerId);
      await connection.setRemoteDescription(sdp);
      await addPendingIce();
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      socket.emit("call:answer", {
        to: peerId,
        sdp: connection.localDescription,
      });
    } catch {
      socket.emit("call:end", { to: peerId });
      finish("Call connect nahi ho payi.");
    }
  };

  // Answer aaya (caller side)
  const onAnswer = async ({ sdp }) => {
    if (!pc) return;

    try {
      await pc.setRemoteDescription(sdp);
      await addPendingIce();
    } catch {
      finish("Call connect nahi ho payi.");
    }
  };

  const onIce = async ({ candidate }) => {
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // ignore
      }
    } else {
      pendingIce.push(candidate); // abhi connection ready nahi, baad me add karenge
    }
  };

  const onRejected = ({ from }) => {
    if (callInfo?.peerId !== String(from)) return;
    finish("Call reject ho gayi.");
  };

  const onEnded = ({ from }) => {
    const peerId = String(from);

    // Chalti call samne wale ne kaat di
    if (callInfo?.peerId === peerId) {
      finish("Call khatam ho gayi.");
      return;
    }

    // Caller ne ringing me hi kaat di
    if (incomingInfo?.from === peerId) {
      const missed = incomingInfo;
      updateIncoming(null);
      showNotice(`${missed.name} ki missed call`);
    }
  };

  // Apna internet / socket toota
  const onDisconnect = () => {
    if (callInfo) finish("Connection toot gaya.");
    if (incomingInfo) updateIncoming(null);
  };

  socket.on("call:incoming", onIncoming);
  socket.on("call:accepted", onAccepted);
  socket.on("call:offer", onOffer);
  socket.on("call:answer", onAnswer);
  socket.on("call:ice", onIce);
  socket.on("call:rejected", onRejected);
  socket.on("call:ended", onEnded);
  socket.on("disconnect", onDisconnect);

  // Dashboard band ho (jaise logout) to listeners hatao aur mic/camera chhod do
  return () => {
    socket.off("call:incoming", onIncoming);
    socket.off("call:accepted", onAccepted);
    socket.off("call:offer", onOffer);
    socket.off("call:answer", onAnswer);
    socket.off("call:ice", onIce);
    socket.off("call:rejected", onRejected);
    socket.off("call:ended", onEnded);
    socket.off("disconnect", onDisconnect);

    clearTimeout(noticeTimer);
    cleanupMedia();
    dispatch(resetCall());
    updateIncoming(null);
    attached = false;
  };
};
