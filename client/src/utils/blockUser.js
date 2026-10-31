import api from "../api";
import { setBlocked } from "../store/chatSlice";

// Server par block/unblock karo, phir screen ka status badlo
export const setBlockedStatus = async (dispatch, chat, shouldBlock) => {
  if (!chat?.otherUserId) throw new Error("Group ko block nahi kar sakte");

  if (shouldBlock) {
    await api.post(`/api/user/block/${chat.otherUserId}`);
  } else {
    await api.delete(`/api/user/block/${chat.otherUserId}`);
  }

  dispatch(setBlocked({ chatId: chat.id, blocked: shouldBlock }));
};
