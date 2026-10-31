import { useEffect, useState } from "react";
import { X, Search, LoaderCircle } from "lucide-react";
import Avatar from "./Avatar";
import api from "../api";

export default function AddMemberModal({ chat, onClose, onAdded }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [addingId, setAddingId] = useState(""); // jise abhi add kar rahe hain
  const [error, setError] = useState("");

  // Jo pehle se group me hain unhe list me nahi dikhana
  const memberIds = new Set((chat.memberList || []).map((m) => m.id));

  // Naam/email likhte hi server se users dhundo (300ms ruk ke)
  useEffect(() => {
    const q = query.trim();
    if (!q) return;

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/api/user/search", {
          params: { query: q },
        });
        setResults(data);
      } catch {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const add = async (person) => {
    setAddingId(person._id);
    setError("");

    try {
      await api.post(`/api/chat/group/${chat.id}/members`, {
        userId: person._id,
      });

      await onAdded(); // chats dobara laao
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Member add nahi hua.");
    } finally {
      setAddingId("");
    }
  };

  const visible = query.trim()
    ? results.filter((person) => !memberIds.has(String(person._id)))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Add Member</h3>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex h-10 items-center gap-2 rounded-lg bg-slate-100 px-3">
          <Search size={16} className="text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError("");
            }}
            placeholder="Naam ya email se dhundo..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        <div className="mt-3 max-h-60 space-y-1 overflow-y-auto">
          {visible.map((person) => (
            <button
              key={person._id}
              disabled={Boolean(addingId)}
              onClick={() => add(person)}
              className="flex w-full items-center gap-3 rounded p-2 text-left hover:bg-slate-50 disabled:opacity-60"
            >
              <Avatar
                name={person.name}
                src={person.profilePic}
                size="w-9 h-9"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{person.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {person.email}
                </p>
              </div>

              {addingId === person._id && (
                <LoaderCircle
                  size={16}
                  className="animate-spin text-blue-600"
                />
              )}
            </button>
          ))}

          {query.trim() && visible.length === 0 && (
            <p className="py-3 text-center text-xs text-slate-400">
              Koi user nahi mila (ya wo pehle se group me hai).
            </p>
          )}
        </div>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
