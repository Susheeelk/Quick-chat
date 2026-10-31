import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import api from "../api";

// Password change hone ke kitni der baad popup band ho (milliseconds me)
// 2000 = 2 second, 5000 = 5 second
const CLOSE_AFTER_MS = 3000;

const inputClass =
  "w-full h-10 border border-slate-200 rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100";

// Privacy & Security par click karne se ye screen khulti hai
export default function ChangePassword({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const timerRef = useRef(null);

  // Agar popup pehle hi band ho jaye, to timer bhi hata do
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  // Success ke baad fields aur button band rahenge
  const locked = saving || Boolean(success);

  const submit = async () => {
    if (locked) return;

    setError("");
    setSuccess("");

    if (!current || !next || !confirm) {
      setError("Teeno fields bharo.");
      return;
    }

    if (next.length < 6 || next.length > 72) {
      setError("Naya password 6 se 72 characters ka hona chahiye.");
      return;
    }

    if (next !== confirm) {
      setError("Naya password aur confirm password match nahi karte.");
      return;
    }

    if (next === current) {
      setError("Naya password purane se alag hona chahiye.");
      return;
    }

    setSaving(true);

    try {
      const { data } = await api.put("/api/auth/change-password", {
        currentPassword: current,
        newPassword: next,
      });

      setSuccess(data?.message || "Password change ho gaya.");
      setCurrent("");
      setNext("");
      setConfirm("");

      // Kuch der baad popup apne aap band
      timerRef.current = setTimeout(onClose, CLOSE_AFTER_MS);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Password change nahi hua. Dobara try karo.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl p-5 overflow-y-auto max-h-screen sm:max-h-[90vh]">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onClose} disabled={saving} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h3 className="font-semibold">Change Password</h3>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            disabled={locked}
            className={inputClass}
          />

          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            disabled={locked}
            className={inputClass}
          />

          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            disabled={locked}
            className={inputClass}
          />

          {error && <p className="text-xs text-red-600">{error}</p>}

          {success && (
            <p className="text-xs text-green-600">
              {success} Ye screen apne aap band ho jayegi.
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={locked}
            className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving && <LoaderCircle size={16} className="animate-spin" />}
            {saving ? "Updating..." : success ? "Done" : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
