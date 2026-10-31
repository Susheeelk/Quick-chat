import api from "../api";
import { setChats } from "../store/chatSlice";
import { formatChat } from "./chatFormat";

// Server se chats aur block status laao, format karo, Redux me daalo
export const loadChats = async (dispatch, myId) => {
  const [chatsRes, statusRes] = await Promise.all([
    api.get("/api/chat"),
    api.get("/api/user/block-status"),
  ]);

  const blockedByMe = new Set(statusRes.data.blockedByMe); // maine block kiye
  const blockedMe = new Set(statusRes.data.blockedMe); // jinhone mujhe block kiya

  dispatch(
    setChats(
      chatsRes.data.map((chat) => {
        const formatted = formatChat(chat, myId);

        return {
          ...formatted,
          blocked: !formatted.isGroup && blockedByMe.has(formatted.otherUserId),
          blockedByOther:
            !formatted.isGroup && blockedMe.has(formatted.otherUserId),
        };
      }),
    ),
  );
};
