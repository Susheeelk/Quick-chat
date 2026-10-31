// Ek hi jagah chat ko frontend ke format me badalne ka code.

// value object ({_id}) ho ya seedha string, dono se id nikalta hai
export const getId = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value._id ?? value.id ?? "");
  return String(value);
};

export const formatTime = (date) => {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// "Last seen today at 10:24 AM" jaisa text
export const formatLastSeen = (date) => {
  if (!date) return "Offline";

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "Offline";

  const time = formatTime(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return `Last seen today at ${time}`;
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return `Last seen yesterday at ${time}`;
  }
  return `Last seen ${d.toLocaleDateString()} at ${time}`;
};

// Backend ki chat -> frontend ki chat
export const formatChat = (chat, myId) => {
  const others = (chat.participants || []).filter(
    (p) => getId(p) !== String(myId),
  );
  const other = chat.isGroup ? null : others[0];
  const last = chat.lastMessage;

  // Group ka admin kaun hai
  const adminId = chat.isGroup ? getId(chat.admin) : "";

  // Group ke saare members (admin sabse upar)
  const memberList = (chat.participants || [])
    .filter(Boolean)
    .map((p) => ({
      id: getId(p),
      name: p.name || "User",
      avatar: p.profilePic || "",
      isMe: getId(p) === String(myId),
      isAdmin: getId(p) === adminId,
    }))
    .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin));

  return {
    ...chat,
    id: getId(chat),
    isGroup: Boolean(chat.isGroup),
    name: chat.isGroup ? chat.name || "Group" : other?.name || "Unknown user",
    avatar: other?.profilePic || "",
    email: other?.email || "",
    otherUserId: other ? getId(other) : "", // samne wale user ki id
    lastSeen: other?.lastSeen || null, // samne wale ka last seen
    adminId,
    iAmAdmin: Boolean(chat.isGroup) && adminId === String(myId),
    memberList,
    members: others.map((p) => p?.name).filter(Boolean),
    last: last ? last.text || (last.image ? "📷 Photo" : "") : "",
    time: formatTime(last?.createdAt),
    unread: chat.unreadCount ?? 0,
    online: false, // asli value chatSlice me onlineUsers se set hoti hai
  };
};
