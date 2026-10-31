import { createSlice, nanoid } from "@reduxjs/toolkit";
import { endCall } from "./callSlice";
import { logout } from "./authSlice";
import { getId, formatTime } from "../utils/chatFormat";

const now = () =>
  new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const initialState = {
  chats: [],
  messages: {},
  activeChatId: null,
  search: "",
  onlineUsers: [], // abhi online users ki ids (server se aati hain)
};

// Block hone par (kisi bhi taraf se) online/last seen nahi dikhana
const statusHidden = (chat) => chat.blocked || chat.blockedByOther;

const chatSlice = createSlice({
  name: "chat",

  initialState,

  reducers: {
    // Backend se aayi chats save karo
    setChats(state, { payload }) {
      const old = new Map(state.chats.map((c) => [c.id, c]));

      state.chats = payload.map((chat) => {
        const hidden = statusHidden(chat);

        return {
          muted: false,
          ...chat,
          // mute abhi sirf frontend me hai, refresh par na ud jaye
          ...(old.has(chat.id) ? { muted: old.get(chat.id).muted } : {}),
          lastSeen: hidden ? null : chat.lastSeen,
          online:
            !chat.isGroup &&
            !hidden &&
            state.onlineUsers.includes(chat.otherUserId),
        };
      });

      // Jo chat ab list me nahi hai, uska selection hata do
      if (
        state.activeChatId &&
        !state.chats.some((chat) => chat.id === state.activeChatId)
      ) {
        state.activeChatId = null;
      }
    },

    // Kisi ne chat padh li -> us chat ke saare messages ke readBy me uski id jodo
    markMessagesRead(state, { payload: { chatId, userId } }) {
      const id = String(userId);

      (state.messages[chatId] || []).forEach((m) => {
        if (m.from === "system") return;

        const readBy = (m.readBy ||= []);
        if (!readBy.some((r) => String(r?._id ?? r) === id)) readBy.push(id);
      });
    },
    // Server ne bataya abhi kaun-kaun online hai
    setOnlineUsers(state, { payload }) {
      state.onlineUsers = payload;

      state.chats.forEach((chat) => {
        chat.online =
          !chat.isGroup &&
          !statusHidden(chat) &&
          payload.includes(chat.otherUserId);
      });
    },

    // Koi user offline hua -> uska last seen update karo
    setUserLastSeen(state, { payload: { userId, lastSeen } }) {
      state.chats.forEach((chat) => {
        if (chat.otherUserId === String(userId) && !statusHidden(chat)) {
          chat.lastSeen = lastSeen;
        }
      });
    },

    setActiveChat(state, { payload }) {
      state.activeChatId = payload;

      const chat = state.chats.find((chat) => chat.id === payload);

      if (chat) chat.unread = 0;
    },

    // Sirf unread badge hatao (setActiveChat mobile par screen bhi badal deta hai)
    clearUnread(state, { payload }) {
      const chat = state.chats.find((c) => c.id === payload);

      if (chat) chat.unread = 0;
    },

    setSearch(state, { payload }) {
      state.search = payload;
    },

    sendMessage(state, { payload: { chatId, text } }) {
      (state.messages[chatId] ||= []).push({
        id: nanoid(),
        from: "me",
        text,
        time: now(),
      });

      const chat = state.chats.find((chat) => chat.id === chatId);

      if (chat) {
        chat.last = text;
        chat.time = now();
      }
    },

    receiveMessage(state, { payload: { chatId, text, message } }) {
      const chat = state.chats.find((chat) => chat.id === chatId);

      if (!chat || chat.blocked) return;

      const list = (state.messages[chatId] ||= []);

      // Same message dobara aaye (socket + API dono se) to mat jodo
      if (message?.id && list.some((item) => item.id === message.id)) return;

      list.push(
        message || {
          id: nanoid(),
          from: "them",
          text,
          time: now(),
        },
      );

      chat.last = text || message?.text || "";
      chat.time = now();

      if (state.activeChatId !== chatId) {
        chat.unread = (chat.unread || 0) + 1;
      }
    },

    // Kisi bhi chat ka naya message aaya -> sidebar ka last message,
    // time aur unread update karo, aur chat ko sabse upar le aao
    updateChatFromSocket(state, { payload: { message, currentUserId } }) {
      const chatId = getId(message.conversation);
      const index = state.chats.findIndex((c) => c.id === chatId);

      if (index === -1) return;

      const chat = state.chats[index];
      const mine = getId(message.sender) === String(currentUserId);

      chat.last = message.text || (message.image ? "📷 Photo" : "");
      chat.time = formatTime(message.createdAt);

      if (!mine && state.activeChatId !== chatId) {
        chat.unread = (chat.unread || 0) + 1;
      }

      state.chats.splice(index, 1);
      state.chats.unshift(chat);
    },

    setMessages(state, { payload: { chatId, messages } }) {
      state.messages[chatId] = messages;
    },

    sendAttachment(state, { payload: { chatId, name, size, url, isImage } }) {
      (state.messages[chatId] ||= []).push({
        id: nanoid(),
        from: "me",
        time: now(),
        ...(isImage ? { imageUrl: url } : { file: { name, size } }),
      });

      const chat = state.chats.find((chat) => chat.id === chatId);

      if (chat) {
        chat.last = isImage ? "📷 Photo" : `📄 ${name}`;
        chat.time = now();
      }
    },

    createGroup(state, { payload: { name, members } }) {
      const id = Date.now();

      state.chats.unshift({
        id,
        name,
        members,
        isGroup: true,
        last: "Group created",
        time: now(),
        unread: 0,
        blocked: false,
        muted: false,
      });

      state.activeChatId = id;
    },

    // Server par block/unblock hone ke baad screen ka status set karo
    setBlocked(state, { payload: { chatId, blocked } }) {
      const chat = state.chats.find((item) => item.id === chatId);

      if (!chat) return;

      chat.blocked = blocked;

      // block par online band; unblock par list dekh ke wapas set
      chat.online =
        !chat.isGroup &&
        !statusHidden(chat) &&
        state.onlineUsers.includes(chat.otherUserId);

      if (blocked) chat.lastSeen = null;
    },

    toggleBlock(state, { payload }) {
      const chat = state.chats.find((item) => item.id === payload);

      if (chat) chat.blocked = !chat.blocked;
    },

    toggleMute(state, { payload }) {
      const chat = state.chats.find((item) => item.id === payload);

      if (chat) chat.muted = !chat.muted;
    },
  },

  extraReducers: (builder) => {
    // logout par purane user ki chats aur messages saaf
    builder.addCase(logout, () => initialState);

    builder.addCase(endCall, (state, { payload }) => {
      if (!payload) return;

      const { chatId, type, seconds, connected } = payload;

      const duration =
        `${Math.floor(seconds / 60)}:` + String(seconds % 60).padStart(2, "0");

      (state.messages[chatId] ||= []).push({
        id: nanoid(),
        from: "system",
        time: now(),
        text: `${type === "video" ? "📹 Video" : "📞 Voice"} call • ${
          connected ? duration : "No answer"
        }`,
      });
    });
  },
});

export const {
  setChats,
  setOnlineUsers,
  setUserLastSeen,
  setActiveChat,
  clearUnread,
  setSearch,
  sendMessage,
  receiveMessage,
  updateChatFromSocket,
  setMessages,
  sendAttachment,
  createGroup,
  setBlocked,
  toggleBlock,
  toggleMute,
  markMessagesRead,
} = chatSlice.actions;

export default chatSlice.reducer;
