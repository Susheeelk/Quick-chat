import { useDispatch, useSelector } from "react-redux";
import { X, Sun, Moon, Monitor } from "lucide-react";
import { changeTheme } from "../store/themeSlice";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function AppearanceModal({ onClose }) {
  const dispatch = useDispatch();
  const mode = useSelector((state) => state.theme.mode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Appearance</h3>
          <button onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => dispatch(changeTheme(value))}
              className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm ${
                mode === value
                  ? "border-blue-600 text-blue-600"
                  : "border-slate-200 text-slate-600"
              }`}
            >
              <Icon size={22} />
              {label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          System me aapke computer ki setting follow hoti hai.
        </p>
      </div>
    </div>
  );
}
