import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  MessageSquare,
  MoreVertical,
  Search,
  Users,
  Settings,
  User,
  Palette,
  Shield,
  Bell,
  LogOut,
  ChevronRight,
  X,
} from "lucide-react";

import Avatar from "./Avatar";
import api from "../api";
import { setActiveChat, setSearch } from "../store/chatSlice";
import { setProfileOpen } from "../store/uiSlice";
import { logout } from "../store/authSlice";
import { loadChats } from "../utils/loadChats";
import ChangePassword from "./ChangePassword";
import AppearanceModal from "./AppearanceModal";

function CreateGroupModal({ onClose, onCreated }) {
  const currentUser = useSelector((state) => state.auth.user);
  const allChats = useSelector((state) => state.chat.chats);

  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Contacts ko existing direct chats ke participants se nikalo.
  const contacts = useMemo(() => {
    const currentUserId = currentUser?._id || currentUser?.id;

    const people = new Map();

    allChats.forEach((chat) => {
      if (chat.isGroup) return;

      (chat.participants || []).forEach((person) => {
        if (!person || typeof person !== "object") return;

        const id = String(person._id || person.id || "");
        if (!id || id === String(currentUserId)) return;

        people.set(id, {
          id,
          name: person.name || person.email || "User",
          avatar: person.profilePic || person.avatar || "",
        });
      });
    });

    return Array.from(people.values());
  }, [allChats, currentUser]);

  const toggleMember = (id) => {
    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  };

  const create = async () => {
    setError("");

    if (!name.trim()) {
      setError("Group ka naam enter karo.");
      return;
    }

    // Backend ko current user ke alawa kam-se-kam 2 members chahiye.
    if (selected.length < 2) {
      setError("Group banane ke liye kam-se-kam 2 members select karo.");
      return;
    }

    try {
      setLoading(true);

      await api.post("/api/chat/group", {
        name: name.trim(),
        members: selected,
      });

      await onCreated();
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Group create nahi hua. Backend aur login check karo.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Create Group</h3>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Group name"
          maxLength={50}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        />

        <p className="mb-1 mt-3 text-xs text-slate-500">
          Add members (kam-se-kam 2)
        </p>

        <div className="max-h-48 space-y-1 overflow-y-auto">
          {contacts.map((contact) => (
            <label
              key={contact.id}
              className="flex cursor-pointer items-center gap-3 rounded p-2 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(contact.id)}
                onChange={() => toggleMember(contact.id)}
              />
              <Avatar name={contact.name} src={contact.avatar} size="w-8 h-8" />
              <span>{contact.name}</span>
            </label>
          ))}

          {contacts.length === 0 && (
            <p className="py-3 text-xs text-slate-400">
              Abhi contacts available nahi hain. Pehle kisi se chat shuru karo.
            </p>
          )}
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <button
          onClick={create}
          disabled={loading}
          className="mt-4 h-10 w-full rounded-lg bg-blue-600 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Group"}
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const dispatch = useDispatch();

  const { chats, activeChatId, search } = useSelector((state) => state.chat);
  const user = useSelector((state) => state.auth.user);

  // dark mode apprience state here
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  // change password state here
  const [passwordOpen, setPasswordOpen] = useState(false);

  const [menu, setMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [people, setPeople] = useState([]); // search se mile naye users

  const currentUserId = user?._id || user?.id;

  // Chats ab seedha Redux se aati hain (Dashboard/loadChats pehle hi format kar deta hai)
  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();

    return chats.filter((chat) =>
      (chat.name || "").toLowerCase().includes(query),
    );
  }, [chats, search]);

  const refreshChats = async () => {
    try {
      setRefreshError("");
      await loadChats(dispatch, currentUserId);
    } catch (err) {
      setRefreshError(
        err.response?.data?.message || "Chats refresh nahi ho paaye.",
      );
      throw err;
    }
  };

  // Search me kuch likha to server se users dhundo
  // (300ms ruk ke, taaki har key par request na jaye)
  useEffect(() => {
    const q = search.trim();
    if (!q) return;

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/api/user/search", {
          params: { query: q },
        });
        setPeople(data);
      } catch {
        setPeople([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Kisi user par click -> uske saath chat kholo (nahi hai to server bana deta hai)
  const startChat = async (person) => {
    try {
      setRefreshError("");

      const { data } = await api.post(`/api/chat/direct/${person._id}`);

      await loadChats(dispatch, currentUserId);
      dispatch(setActiveChat(String(data._id)));
      dispatch(setSearch(""));
    } catch (err) {
      setRefreshError(err.response?.data?.message || "Chat nahi khul payi.");
    }
  };

  const handleLogout = async () => {
    try {
      await api.get("/api/auth/logout"); // server cookie hatata hai
    } catch {
      // network error ho to bhi logout aage badhne do
    }
    dispatch(logout());
  };

  const settingsItems = [
    {
      icon: User,
      label: "Account & Profile",
      action: () => dispatch(setProfileOpen(true)),
    },
    {
      icon: Palette,
      label: "Appearance",
      action: () => setAppearanceOpen(true),
    },
    {
      icon: Shield,
      label: "Privacy & Security",
      action: () => setPasswordOpen(true),
    },

    { icon: Bell, label: "Notifications" },
  ];

  const showPeople = search.trim() && people.length > 0;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <MessageSquare size={18} />
          </span>
          QuickChat
        </div>

        <div className="relative">
          <button
            onClick={() => setMenu((previous) => !previous)}
            className="p-1 text-slate-500"
            aria-label="Chat menu"
          >
            <MoreVertical size={18} />
          </button>

          {menu && (
            <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-slate-100 bg-white py-1 shadow-lg">
              <button
                onClick={() => {
                  setGroupOpen(true);
                  setMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <Users size={16} />
                Create Group
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex h-10 items-center gap-2 rounded-lg bg-slate-100 px-3">
          <Search size={16} className="text-slate-400" />
          <input
            value={search}
            onChange={(event) => dispatch(setSearch(event.target.value))}
            placeholder="Search chats or people..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-2">
        <h3 className="text-sm font-semibold text-slate-800">Chats</h3>
        <button
          onClick={() => refreshChats().catch(() => {})}
          className="text-xs text-blue-600 hover:underline"
        >
          Refresh
        </button>
      </div>

      {refreshError && (
        <p className="px-4 pb-2 text-xs text-red-600">{refreshError}</p>
      )}

      <ul className="flex-1 overflow-y-auto">
        {filteredChats.map((chat) => (
          <li key={chat.id}>
            <button
              onClick={() => dispatch(setActiveChat(chat.id))}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${
                String(activeChatId) === chat.id ? "bg-blue-50" : ""
              }`}
            >
              <Avatar
                name={chat.name}
                src={chat.avatar}
                group={chat.isGroup}
                online={chat.online}
              />

              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-800">
                    {chat.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {chat.time}
                  </span>
                </div>

                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-slate-500">
                    {chat.last || "Start a conversation"}
                  </span>

                  {chat.unread > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] text-white">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        ))}

        {/* Search me mile naye log: click karo to chat shuru */}
        {showPeople && (
          <>
            <li className="px-4 pb-1 pt-3 text-xs font-semibold uppercase text-slate-400">
              People
            </li>

            {people.map((person) => (
              <li key={person._id}>
                <button
                  onClick={() => startChat(person)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <Avatar name={person.name} src={person.profilePic} />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {person.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {person.email}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </>
        )}

        {filteredChats.length === 0 && !showPeople && (
          <p className="mt-8 px-4 text-center text-sm text-slate-400">
            {search ? "No chats found" : "Abhi koi chat nahi hai"}
          </p>
        )}
      </ul>

      <div className="relative flex items-center gap-2 border-t border-slate-100 p-3">
        <button
          onClick={() => setSettings((previous) => !previous)}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          aria-label="Settings"
        >
          <Settings size={18} />
        </button>

        {settings && (
          <div className="absolute bottom-14 left-3 z-20 w-52 rounded-lg border border-slate-100 bg-white py-1 shadow-lg">
            {settingsItems.map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                onClick={() => {
                  action?.();
                  setSettings(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <Icon size={15} />
                {label}
              </button>
            ))}

            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        )}

        <button
          onClick={() => dispatch(setProfileOpen(true))}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <Avatar
            name={user?.name || "User"}
            src={user?.avatar || user?.profilePic}
            size="w-9 h-9"
            online
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-green-600">Online</p>
          </div>

          <ChevronRight size={16} className="text-slate-400" />
        </button>
      </div>

      {groupOpen && (
        <CreateGroupModal
          onClose={() => setGroupOpen(false)}
          onCreated={refreshChats}
        />
      )}

      {/* changes password model here */}
      {passwordOpen && (
        <ChangePassword onClose={() => setPasswordOpen(false)} />
      )}

      {/* dark mode here ya apprience code model here */}
      {appearanceOpen && (
        <AppearanceModal onClose={() => setAppearanceOpen(false)} />
      )}
    </div>
  );
}
