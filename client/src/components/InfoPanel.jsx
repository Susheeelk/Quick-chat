import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { X, Phone, Mail, Calendar, Ban, UserPlus, LogOut } from "lucide-react";
import Avatar from "./Avatar";
import AddMemberModal from "./AddMemberModal";
import api from "../api";
import { toggleMute } from "../store/chatSlice";
import { setBlockedStatus } from "../utils/blockUser";
import { loadChats } from "../utils/loadChats";
import { getId, formatLastSeen } from "../utils/chatFormat";
import { setShowInfo, setMobileView } from "../store/uiSlice";

const PREVIEW_COUNT = 8; // "See All" se pehle itni photos dikhao

export default function InfoPanel() {
  const dispatch = useDispatch();
  const chat = useSelector((s) =>
    s.chat.chats.find((c) => c.id === s.chat.activeChatId),
  );
  const me = useSelector((s) => s.auth.user);

  // Is chat ke jo messages load ho chuke hain (ChatWindow ne store me daale hain)
  const chatMessages = useSelector((s) => s.chat.messages[s.chat.activeChatId]);

  const [addOpen, setAddOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showAll, setShowAll] = useState(false);

  if (!chat) return null;

  const myId = String(me?._id || me?.id || "");
  const refreshChats = () => loadChats(dispatch, myId);

  // Admin kisi member ko group se hataye
  const removeMember = async (member) => {
    if (!window.confirm(`${member.name} ko group se hatana hai?`)) return;

    try {
      setActionError("");
      await api.delete(`/api/chat/group/${chat.id}/members/${member.id}`);
      await refreshChats();
    } catch (err) {
      setActionError(err.response?.data?.message || "Member hata nahi paya.");
    }
  };

  // Khud group chhodna
  const leaveGroup = async () => {
    if (!window.confirm("Group chhodna hai?")) return;

    try {
      setActionError("");
      await api.post(`/api/chat/group/${chat.id}/leave`);
      dispatch(setMobileView("list"));
      await refreshChats(); // group list se hat jayega
    } catch (err) {
      setActionError(err.response?.data?.message || "Group chhod nahi paya.");
    }
  };

  // Samne wala user (sirf 1-1 chat me). Details server ke participants se aati hain.
  const other = chat.isGroup
    ? null
    : (chat.participants || []).find(
        (p) => p && typeof p === "object" && getId(p) !== myId,
      );

  const rows = [
    { icon: Phone, label: "Phone", value: other?.phone },
    { icon: Mail, label: "Email", value: other?.email },
    {
      icon: Calendar,
      label: "Joined",
      value: other?.createdAt
        ? new Date(other.createdAt).toLocaleDateString([], {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "",
    },
  ].filter((r) => r.value);

  const members = chat.memberList || [];

  // Asli shared photos (naye pehle)
  const photos = (chatMessages || [])
    .filter((m) => m.imageUrl || m.image)
    .map((m) => ({ id: m.id, url: m.imageUrl || m.image }))
    .reverse();

  const visiblePhotos = showAll ? photos : photos.slice(0, PREVIEW_COUNT);

  const statusText = chat.isGroup
    ? "Group"
    : chat.blocked || chat.blockedByOther
      ? ""
      : chat.online
        ? "Online"
        : formatLastSeen(chat.lastSeen);

  return (
    <div className="h-full overflow-y-auto p-5">
      <button
        className="ml-auto block text-slate-500"
        onClick={() => dispatch(setShowInfo(false))}
      >
        <X size={18} />
      </button>

      <div className="flex items-center gap-3 mt-2">
        <Avatar
          name={chat.name}
          src={chat.avatar}
          group={chat.isGroup}
          online={chat.online}
          size="w-14 h-14"
        />
        <div className="min-w-0">
          <p className="font-semibold truncate">{chat.name}</p>
          {statusText && (
            <p
              className={`text-xs ${chat.isGroup || !chat.online ? "text-slate-500" : "text-green-600"}`}
            >
              {statusText}
            </p>
          )}
        </div>
      </div>

      {chat.isGroup && (
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">
              Members ({members.length})
            </h4>

            {chat.iAmAdmin && (
              <button
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1 text-xs text-blue-600"
              >
                <UserPlus size={14} /> Add member
              </button>
            )}
          </div>

          <ul className="space-y-3">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar name={m.name} src={m.avatar} size="w-9 h-9" />
                <span className="flex-1 truncate text-sm">
                  {m.isMe ? "You" : m.name}
                </span>

                {m.isAdmin && (
                  <span className="text-xs text-blue-600">Group admin</span>
                )}

                {/* Sirf admin dusre members ko hata sakta hai */}
                {chat.iAmAdmin && !m.isMe && (
                  <button
                    onClick={() => removeMember(m)}
                    title={`Remove ${m.name}`}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length > 0 && (
        <section className="mt-6">
          <h4 className="font-semibold text-sm mb-3">Profile Details</h4>
          <ul className="space-y-3 text-sm">
            {rows.map(({ icon: I, label, value }) => (
              <li key={label} className="flex items-center gap-3">
                <I size={16} className="text-slate-500" />
                <span className="w-12 text-slate-500">{label}</span>
                <span className="truncate">{value}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-sm">
            Shared Photos{photos.length > 0 ? ` (${photos.length})` : ""}
          </h4>

          {photos.length > PREVIEW_COUNT && (
            <button
              onClick={() => setShowAll((value) => !value)}
              className="text-xs text-blue-600"
            >
              {showAll ? "Show Less" : "See All"}
            </button>
          )}
        </div>

        {photos.length === 0 ? (
          <p className="text-xs text-slate-400">
            Abhi koi photo share nahi hui.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {visiblePhotos.map((photo) => (
              <a
                key={photo.id}
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square overflow-hidden rounded-lg bg-slate-100"
              >
                <img
                  src={photo.url}
                  alt="Shared"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 flex items-center justify-between text-sm">
        <span className="font-medium">Mute Notifications</span>
        <button
          onClick={() => dispatch(toggleMute(chat.id))}
          role="switch"
          aria-checked={chat.muted}
          className={`w-10 h-6 rounded-full p-0.5 transition ${chat.muted ? "bg-blue-600" : "bg-slate-300"}`}
        >
          <span
            className={`block w-5 h-5 rounded-full bg-white transition ${chat.muted ? "translate-x-4" : ""}`}
          />
        </button>
      </div>

      {actionError && (
        <p className="mt-4 text-xs text-red-600">{actionError}</p>
      )}

      {chat.isGroup ? (
        <button
          onClick={leaveGroup}
          className="mt-6 w-full h-10 rounded-lg bg-red-50 text-red-500 text-sm font-medium flex items-center justify-center gap-2"
        >
          <LogOut size={16} /> Leave Group
        </button>
      ) : (
        <button
          onClick={() =>
            setBlockedStatus(dispatch, chat, !chat.blocked).catch(() =>
              alert("Block status badal nahi paya. Dobara try karo."),
            )
          }
          className="mt-6 w-full h-10 rounded-lg bg-red-50 text-red-500 text-sm font-medium flex items-center justify-center gap-2"
        >
          <Ban size={16} /> {chat.blocked ? "Unblock Contact" : "Block Contact"}
        </button>
      )}

      {addOpen && (
        <AddMemberModal
          chat={chat}
          onClose={() => setAddOpen(false)}
          onAdded={refreshChats}
        />
      )}
    </div>
  );
}
