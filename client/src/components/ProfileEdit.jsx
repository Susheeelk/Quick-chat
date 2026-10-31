import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ArrowLeft, Camera, LoaderCircle } from "lucide-react";
import Avatar from "./Avatar";
import api from "../api";
import { updateProfile } from "../store/authSlice";
import { setProfileOpen } from "../store/uiSlice";

export default function ProfileEdit() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);

  const [name, setName] = useState(user.name || "");
  const [file, setFile] = useState(null); // naye select ki hui photo
  const [preview, setPreview] = useState(""); // us photo ka preview
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => dispatch(setProfileOpen(false));

  // purana preview memory se hata do
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const pickFile = (selected) => {
    if (!selected) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setError("Sirf JPG, PNG ya WebP image chuno.");
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      setError("Image 5 MB se chhoti honi chahiye.");
      return;
    }

    setError("");
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const save = async () => {
    const trimmed = name.trim();

    if (trimmed.length < 2 || trimmed.length > 50) {
      setError("Name 2 se 50 characters ka hona chahiye.");
      return;
    }

    // Kuch badla hi nahi to bas band kar do
    if (trimmed === user.name && !file) {
      close();
      return;
    }

    setSaving(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("name", trimmed);
      if (file) formData.append("profilePic", file);

      const { data } = await api.put("/api/user/profile", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      dispatch(updateProfile(data)); // server ka asli user redux me
      close();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Profile save nahi hui. Dobara try karo.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl p-5 overflow-y-auto">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={close} disabled={saving}>
            <ArrowLeft size={20} />
          </button>
          <h3 className="font-semibold">Edit Profile</h3>
        </div>

        <div className="flex flex-col items-center mb-5">
          <Avatar
            name={name || user.name || "?"}
            src={preview || user.profilePic}
            size="w-20 h-20"
          />

          <label className="mt-2 text-sm text-blue-600 cursor-pointer flex items-center gap-1">
            <Camera size={14} /> Change Photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={saving}
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="mb-3">
          <label className="block text-xs text-slate-500 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            maxLength={50}
            disabled={saving}
            className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-3">
          <label className="block text-xs text-slate-500 mb-1">
            Email (badla nahi ja sakta)
          </label>
          <input
            value={user.email || ""}
            disabled
            className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm bg-slate-100 text-slate-500"
          />
        </div>

        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="mt-3 w-full h-11 rounded-lg bg-blue-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving && <LoaderCircle size={18} className="animate-spin" />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
