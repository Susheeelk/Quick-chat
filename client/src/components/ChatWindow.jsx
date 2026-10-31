import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import {
  Phone,
  Video,
  Info,
  MoreVertical,
  Smile,
  Paperclip,
  Send,
  ArrowLeft,
  Ban,
  CircleCheck,
  MessageSquare,
  FileText,
  Check,
  CheckCheck,
} from "lucide-react";

import Avatar from "./Avatar";
import EmojiPicker from "./EmojiPicker";
import socket from "../socket";

import {
  receiveMessage,
  updateChatFromSocket,
  setMessages,
  clearUnread,
  markMessagesRead,
} from "../store/chatSlice";

import { toggleInfo, setMobileView } from "../store/uiSlice";
import { startCall } from "../call/callEngine";
import api from "../api";
import { getId, formatTime, formatLastSeen } from "../utils/chatFormat";
import { loadChats } from "../utils/loadChats";
import { setBlockedStatus } from "../utils/blockUser";

// Backend ke message ko screen ke format me badlo
const formatMessage = (message, currentUserId) => ({
  ...message,
  id: getId(message._id ?? message.id),
  from: getId(message.sender) === String(currentUserId) ? "me" : "them",
  text: message.text || "",
  image: message.image || "",
  imageUrl: message.image || "",
  time: formatTime(message.createdAt),
});

export default function ChatWindow() {
  const dispatch = useDispatch();
  const store = useStore();

  const { chats, messages, activeChatId } = useSelector((state) => state.chat);

  const user = useSelector((state) => state.auth.user);

  // Chalti ya aati call ho to call buttons band
  const inCall = useSelector((state) =>
    Boolean(state.call.active || state.call.incoming),
  );

  const userId = getId(user?._id ?? user?.id);

  const chatId = getId(activeChatId);

  const chat = chats.find((item) => getId(item.id ?? item._id) === chatId);

  const list = messages[chatId] || [];

  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const endRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const seenMessageIds = useRef(new Set());

  // Typing event in logon ko bhejna hai (chat ke baaki participants)
  const typingTo = (chat?.participants || [])
    .map((participant) => getId(participant))
    .filter((participantId) => participantId && participantId !== userId);

  const typingToKey = typingTo.join(",");

  // Active conversation ki message history load karo
  useEffect(() => {
    if (!chatId || !userId) return undefined;

    let cancelled = false;
    setMessageError("");

    const loadMessages = async () => {
      try {
        const { data } = await api.get(`/api/message/${chatId}`);

        if (cancelled) return;

        const rows = Array.isArray(data) ? data : (data?.messages ?? []);

        const formattedRows = rows.map((message) =>
          formatMessage(message, userId),
        );

        formattedRows.forEach((message) => {
          if (message.id) seenMessageIds.current.add(String(message.id));
        });

        dispatch(setMessages({ chatId, messages: formattedRows }));

        // Backend par messages read mark karo
        await api.put(`/api/message/read/${chatId}`);

        if (!cancelled) dispatch(clearUnread(chatId));
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Messages load error:",
            error.response?.data || error.message,
          );

          setMessageError(
            error.response?.data?.message ||
              "Messages load nahi hue. Chat dobara kholkar try karein.",
          );
        }
      }
    };

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [chatId, userId, dispatch]);

  // Sabhi conversations ke messages suno.
  // Ye listener active chat na hone par bhi chalta rehta hai,
  // taaki Sidebar ka last message aur unread count update ho.
  useEffect(() => {
    const handleNewMessage = (payload = {}) => {
      const rawMessage = payload?.message || payload;

      const incomingConversationId = getId(
        payload?.conversationId ??
          payload?.chatId ??
          rawMessage?.conversation ??
          rawMessage?.conversationId ??
          rawMessage?.chatId,
      );

      if (!incomingConversationId) return;

      // Ye chat meri list me nahi hai (kisi ne pehli baar message kiya)
      // -> chats dobara laao, wo list me aa jayegi
      const known = store
        .getState()
        .chat.chats.some((c) => c.id === incomingConversationId);

      if (!known) {
        loadChats(dispatch, userId).catch(() => {});
        return;
      }

      // Sidebar ko har conversation ke message ki information do
      dispatch(
        updateChatFromSocket({
          message: {
            ...rawMessage,
            conversation: rawMessage?.conversation ?? incomingConversationId,
          },
          currentUserId: userId,
        }),
      );

      // Message list me sirf khuli hui chat ka message jodo
      if (!chatId || incomingConversationId !== String(chatId)) return;

      const formatted = formatMessage(rawMessage, userId);

      // Socket aur API dono se message aaye to duplicate na ho
      if (formatted.id && seenMessageIds.current.has(String(formatted.id))) {
        return;
      }

      if (formatted.id) seenMessageIds.current.add(String(formatted.id));

      setIsTyping(false);

      dispatch(
        receiveMessage({
          chatId: String(chatId),
          text: formatted.text || (formatted.image ? "📷 Photo" : ""),
          message: formatted,
        }),
      );

      // Khuli chat me aaya message read mark karo
      api.put(`/api/message/read/${chatId}`).catch((error) => {
        console.error(
          "Mark message read error:",
          error.response?.data || error.message,
        );
      });
    };

    const handleTyping = (payload = {}) => {
      if (
        chatId &&
        String(payload.conversationId ?? "") === String(chatId) &&
        String(payload.from ?? "") !== String(userId)
      ) {
        setIsTyping(true);
      }
    };

    const handleStopTyping = (payload = {}) => {
      if (
        chatId &&
        String(payload.conversationId ?? "") === String(chatId) &&
        String(payload.from ?? "") !== String(userId)
      ) {
        setIsTyping(false);
      }
    };

    // Server bhejta hai: { conversationId, userId }  (userId = jisne chat padhi)
    // Is chat ke messages ke readBy me uski id jod do -> blue tick
    const handleMessagesRead = (payload = {}) => {
      const { conversationId, userId: readerId } = payload;

      if (!conversationId || !readerId) return;
      if (String(readerId) === String(userId)) return;

      dispatch(
        markMessagesRead({
          chatId: String(conversationId),
          userId: String(readerId),
        }),
      );
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("typing", handleTyping);
    socket.on("stopTyping", handleStopTyping);
    socket.on("messagesRead", handleMessagesRead);

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("typing", handleTyping);
      socket.off("stopTyping", handleStopTyping);
      socket.off("messagesRead", handleMessagesRead);
    };
  }, [chatId, userId, dispatch, store]);

  // Chat badalne ya window band hone par pending typing event saaf karo
  useEffect(() => {
    setIsTyping(false);

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }

      if (chatId && typingTo.length) {
        socket.emit("stopTyping", {
          conversationId: String(chatId),
          to: typingTo,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, typingToKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [list.length, chatId]);

  useEffect(() => {
    setText("");
    setEmoji(false);
    setMenu(false);
    setMessageError("");
    setIsTyping(false);
  }, [chatId]);

  const stopTyping = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (chatId && typingTo.length) {
      socket.emit("stopTyping", {
        conversationId: String(chatId),
        to: typingTo,
      });
    }
  };

  const handleTextChange = (event) => {
    const value = event.target.value;
    setText(value);

    if (
      !chatId ||
      !chat ||
      chat.blocked ||
      chat.blockedByOther ||
      !typingTo.length
    ) {
      return;
    }

    if (value.trim()) {
      socket.emit("typing", {
        conversationId: String(chatId),
        to: typingTo,
      });

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

      typingTimerRef.current = setTimeout(() => {
        socket.emit("stopTyping", {
          conversationId: String(chatId),
          to: typingTo,
        });

        typingTimerRef.current = null;
      }, 1200);
    } else {
      stopTyping();
    }
  };

  if (!chat) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
        <MessageSquare size={40} />
        <p className="text-sm">Select a chat to start messaging</p>
      </div>
    );
  }

  // Dono me se kisi ne bhi block kiya ho to message/call band, status chhupa
  const cannotChat = chat.blocked || chat.blockedByOther;

  // Meri bheji message ko kisne dekha:
  // 1-1 me samne wale ne, group me baaki sabne dekha ho to true (blue tick)
  const isSeen = (message) => {
    const readers = new Set((message.readBy || []).map((r) => getId(r)));

    const others = (chat.participants || [])
      .map((p) => getId(p))
      .filter((id) => id && id !== userId);

    return others.length > 0 && others.every((id) => readers.has(id));
  };

  // Block / unblock: pehle server ko batao, phir screen badlo
  const changeBlock = async (shouldBlock) => {
    setMenu(false);
    setMessageError("");

    try {
      await setBlockedStatus(dispatch, chat, shouldBlock);
    } catch (error) {
      setMessageError(
        error.response?.data?.message || "Block status badal nahi paya.",
      );
    }
  };

  // Call lagao (type: "audio" ya "video")
  const call = (type) => {
    if (cannotChat || inCall || chat.isGroup) return;

    startCall({
      chatId,
      to: chat.otherUserId, // samne wale ki id
      name: chat.name,
      avatar: chat.avatar,
      type,
    });
  };

  const send = async (event) => {
    event.preventDefault();

    const messageText = text.trim();

    if (!messageText || cannotChat || sending) return;

    setSending(true);
    setMessageError("");
    stopTyping();

    try {
      const { data } = await api.post(`/api/message/send/${chatId}`, {
        text: messageText,
      });

      const message = formatMessage(data, userId);

      // Agar socket event pehle aa chuka hai to duplicate na jodo
      const alreadyReceived =
        message.id && seenMessageIds.current.has(String(message.id));

      if (!alreadyReceived) {
        if (message.id) seenMessageIds.current.add(String(message.id));

        dispatch(receiveMessage({ chatId, text: message.text, message }));
      }

      setText("");
      setEmoji(false);
    } catch (error) {
      console.error(
        "Send message error:",
        error.response?.data || error.message,
      );

      setMessageError(
        error.response?.data?.message ||
          "Message send nahi hua. Dobara try karein.",
      );
    } finally {
      setSending(false);
    }
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || cannotChat || uploading) return;

    if (!file.type.startsWith("image/")) {
      setMessageError("Abhi sirf image files send kar sakte hain.");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    setUploading(true);
    setMessageError("");
    stopTyping();

    try {
      const { data } = await api.post(`/api/message/send/${chatId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const message = formatMessage(data, userId);

      const alreadyReceived =
        message.id && seenMessageIds.current.has(String(message.id));

      if (!alreadyReceived) {
        if (message.id) seenMessageIds.current.add(String(message.id));

        dispatch(
          receiveMessage({
            chatId,
            text: message.text || (message.image ? "📷 Photo" : ""),
            message,
          }),
        );
      }
    } catch (error) {
      console.error(
        "Image upload error:",
        error.response?.data || error.message,
      );

      setMessageError(
        error.response?.data?.message ||
          "Image send nahi hui. Cloudinary aur server check karein.",
      );
    } finally {
      setUploading(false);
    }
  };

  const pickEmoji = (selectedEmoji) => {
    setText((current) => current + selectedEmoji);
    inputRef.current?.focus();
  };

  // Block hone par online / last seen nahi dikhana
  const subtitle = chat.isGroup
    ? ["You", ...(chat.members || [])].join(", ")
    : cannotChat
      ? ""
      : chat.online
        ? "Online"
        : formatLastSeen(chat.lastSeen);

  const showTyping = isTyping && !cannotChat;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Chat header */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-4">
        <button
          className="text-slate-600 md:hidden"
          onClick={() => dispatch(setMobileView("list"))}
        >
          <ArrowLeft size={20} />
        </button>

        <Avatar
          name={chat.name}
          src={chat.avatar}
          group={chat.isGroup}
          online={chat.online}
          size="w-10 h-10"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{chat.name}</p>

          {(showTyping || subtitle) && (
            <p
              className={`truncate text-xs ${
                showTyping
                  ? "font-medium italic text-blue-600"
                  : chat.isGroup || !chat.online
                    ? "text-slate-500"
                    : "text-green-600"
              }`}
            >
              {showTyping ? "typing..." : subtitle}
            </p>
          )}
        </div>

        <div className="relative flex items-center gap-4 text-slate-600">
          <button
            title="Voice call"
            disabled={chat.isGroup || cannotChat || inCall}
            onClick={() => call("audio")}
            className="disabled:opacity-40"
          >
            <Phone size={18} />
          </button>

          <button
            title="Video call"
            disabled={chat.isGroup || cannotChat || inCall}
            onClick={() => call("video")}
            className="disabled:opacity-40"
          >
            <Video size={18} />
          </button>

          <button title="Info" onClick={() => dispatch(toggleInfo())}>
            <Info size={18} />
          </button>

          <button onClick={() => setMenu((value) => !value)}>
            <MoreVertical size={18} />
          </button>

          {menu && !chat.isGroup && (
            <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-slate-100 bg-white py-1 text-sm shadow-lg">
              <button
                disabled={chat.blocked}
                onClick={() => changeBlock(true)}
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50 disabled:opacity-40"
              >
                <Ban size={15} className="text-red-500" />
                Block Contact
              </button>

              <button
                disabled={!chat.blocked}
                onClick={() => changeBlock(false)}
                className="flex w-full items-center gap-2 px-3 py-2 hover:bg-slate-50 disabled:opacity-40"
              >
                <CircleCheck size={15} className="text-green-600" />
                Unblock Contact
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 px-4 py-4">
        <div className="text-center">
          <span className="rounded-full bg-slate-200/70 px-3 py-1 text-xs text-slate-500">
            Today
          </span>
        </div>

        {messageError && (
          <div className="mx-auto max-w-lg rounded-lg bg-red-50 px-3 py-2 text-center text-xs text-red-600">
            {messageError}
          </div>
        )}

        {list.map((message, index) => {
          if (message.from === "system") {
            return (
              <div key={message.id ?? index} className="text-center">
                <span className="rounded-full bg-slate-200/70 px-3 py-1 text-xs text-slate-500">
                  {message.text}
                </span>
              </div>
            );
          }

          const mine = message.from === "me";

          return (
            <div
              key={message.id ?? index}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                  mine
                    ? "rounded-br-sm bg-blue-600 text-white"
                    : "rounded-bl-sm bg-slate-200/70 text-slate-800"
                }`}
              >
                {/* Group me dusron ke message par bhejne wale ka naam */}
                {chat.isGroup && !mine && message.sender?.name && (
                  <p className="mb-0.5 text-xs font-semibold text-blue-700">
                    {message.sender.name}
                  </p>
                )}

                {(message.imageUrl || message.image) && (
                  <img
                    src={message.imageUrl || message.image}
                    alt="Message attachment"
                    className="mb-1 max-h-60 max-w-full rounded-lg object-contain"
                  />
                )}

                {message.file && (
                  <div className="flex items-center gap-2">
                    <FileText size={26} />
                    <div>
                      <p className="break-all font-medium">
                        {message.file.name}
                      </p>
                      <p className="text-xs opacity-70">{message.file.size}</p>
                    </div>
                  </div>
                )}

                {message.text && (
                  <p className="whitespace-pre-wrap break-words">
                    {message.text}
                  </p>
                )}

                <p
                  className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                    mine ? "text-blue-100" : "text-slate-400"
                  }`}
                >
                  {message.time}

                  {/* Seen tick: sirf meri bheji hui messages par */}
                  {mine &&
                    (isSeen(message) ? (
                      <CheckCheck
                        size={14}
                        className="text-cyan-300"
                        title="Seen"
                      />
                    ) : (
                      <Check size={14} className="text-blue-200" title="Sent" />
                    ))}
                </p>
              </div>
            </div>
          );
        })}

        {showTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-xl rounded-bl-sm bg-blue-100 px-3 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-blue-500" />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-blue-500"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-blue-500"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Message composer */}
      {chat.blocked ? (
        <div className="border-t border-slate-100 p-4 text-center text-sm text-slate-500">
          You blocked this contact.{" "}
          <button className="text-blue-600" onClick={() => changeBlock(false)}>
            Unblock
          </button>{" "}
          to send messages.
        </div>
      ) : chat.blockedByOther ? (
        <div className="border-t border-slate-100 bg-red-50 p-4 text-center text-sm text-red-600">
          Aap block ho, is user ko message nahi bhej sakte.
        </div>
      ) : (
        <form
          onSubmit={send}
          className="flex items-center gap-3 border-t border-slate-100 p-3"
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setEmoji((value) => !value)}
              className="text-slate-500"
            >
              <Smile size={20} />
            </button>

            {emoji && (
              <EmojiPicker onPick={pickEmoji} onClose={() => setEmoji(false)} />
            )}
          </div>

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="text-slate-500 disabled:opacity-50"
            title="Send image"
          >
            <Paperclip size={20} />
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onFile}
          />

          <input
            ref={inputRef}
            value={text}
            onChange={handleTextChange}
            placeholder="Type a message..."
            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white disabled:cursor-not-allowed disabled:opacity-50"
            title="Send message"
          >
            {sending ? "..." : <Send size={18} />}
          </button>
        </form>
      )}

      {uploading && (
        <p className="border-t border-slate-100 px-3 py-2 text-center text-xs text-slate-500">
          Image upload ho rahi hai...
        </p>
      )}
    </div>
  );
}
