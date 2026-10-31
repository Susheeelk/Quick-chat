import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import socket from "../socket";
import Sidebar from "./Sidebar";
import ChatWindow from "./ChatWindow";
import InfoPanel from "./InfoPanel";
import ProfileEdit from "./ProfileEdit";
import CallOverlay from "./CallOverlay";
import { setShowInfo } from "../store/uiSlice";
import { setOnlineUsers, setUserLastSeen } from "../store/chatSlice";
import { loadChats } from "../utils/loadChats";
import { initCallEngine } from "../call/callEngine";

export default function Dashboard() {
  const dispatch = useDispatch();

  // Call ka engine chalu karo (call ke socket events yahi sunta hai)
  useEffect(() => initCallEngine(), []);

  const { showInfo, mobileView, profileOpen } = useSelector(
    (state) => state.ui,
  );

  const user = useSelector((state) => state.auth.user);
  const myId = user?._id;

  const hasActive = useSelector((state) => state.chat.activeChatId !== null);

  // Socket connect (logout par ya Dashboard band hone par disconnect)
  // Listeners connect() se PEHLE lagte hain, taaki pehla onlineUsers event miss na ho
  useEffect(() => {
    const onConnect = () => console.log("Socket connected:", socket.id);
    const onError = (error) =>
      console.error("Socket connection error:", error.message);

    // server bhejta hai: ["userId1", "userId2", ...]
    const onOnlineUsers = (ids) => dispatch(setOnlineUsers(ids));

    // server bhejta hai: { userId, lastSeen }
    const onLastSeen = (data) => dispatch(setUserLastSeen(data));

    socket.on("connect", onConnect);
    socket.on("connect_error", onError);
    socket.on("onlineUsers", onOnlineUsers);
    socket.on("lastSeen", onLastSeen);

    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
      socket.off("onlineUsers", onOnlineUsers);
      socket.off("lastSeen", onLastSeen);
      socket.disconnect();
    };
  }, [dispatch]);

  // Backend se chats load karo
  useEffect(() => {
    if (!myId) return;

    loadChats(dispatch, myId).catch((error) =>
      console.error(
        "Failed to load chats:",
        error.response?.data || error.message,
      ),
    );
  }, [dispatch, myId]);

  // Group ke events aur block/unblock hone par chats dobara laao
  useEffect(() => {
    if (!myId) return;

    const refresh = () => loadChats(dispatch, myId).catch(() => {});

    socket.on("newChat", refresh);
    socket.on("chatUpdated", refresh);
    socket.on("removedFromChat", refresh);
    socket.on("blockChanged", refresh);

    return () => {
      socket.off("newChat", refresh);
      socket.off("chatUpdated", refresh);
      socket.off("removedFromChat", refresh);
      socket.off("blockChanged", refresh);
    };
  }, [dispatch, myId]);

  // Desktop par info panel ki default setting
  useEffect(() => {
    if (window.innerWidth >= 1024) {
      dispatch(setShowInfo(true));
    }
  }, [dispatch]);

  return (
    <div className="h-screen flex bg-white overflow-hidden text-slate-800">
      {/* Sidebar */}
      <aside
        className={`${
          mobileView === "list" ? "flex" : "hidden"
        } md:flex w-full md:w-80 lg:w-88 shrink-0 border-r border-slate-100`}
      >
        <Sidebar />
      </aside>

      {/* Chat window */}
      <main
        className={`${
          mobileView === "chat" ? "flex" : "hidden"
        } md:flex flex-1 min-w-0`}
      >
        <ChatWindow />
      </main>

      {/* Chat information panel */}
      {showInfo && hasActive && (
        <aside
          className={`${
            mobileView === "list" ? "hidden md:block" : "block"
          } fixed inset-y-0 right-0 z-30 w-full sm:w-80 bg-white shadow-xl lg:static lg:shadow-none lg:border-l lg:border-slate-100 lg:shrink-0`}
        >
          <InfoPanel />
        </aside>
      )}

      {/* Profile editor */}
      {profileOpen && <ProfileEdit />}

      {/* Call overlay */}
      <CallOverlay />
    </div>
  );
}
