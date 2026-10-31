import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  MessageSquare,
  Image as ImageIcon,
  LoaderCircle,
  KeyRound,
  ArrowLeft,
} from "lucide-react";

import { login, signup } from "../store/authSlice";
import api from "../api";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({
  icon: Icon,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  autoComplete,
  inputMode,
  maxLength,
}) {
  const [show, setShow] = useState(false);
  const isPwd = type === "password";

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <div
        className={`flex h-11 items-center gap-2 rounded-lg border px-3
        focus-within:ring-2 focus-within:ring-blue-500
        ${error ? "border-red-400" : "border-slate-200"}
        ${disabled ? "bg-slate-100" : ""}`}
      >
        <Icon size={16} className="text-slate-400" />

        <input
          type={isPwd && show ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required
          inputMode={inputMode}
          maxLength={maxLength}
          autoComplete={
            autoComplete ??
            (isPwd ? "current-password" : type === "email" ? "email" : "name")
          }
          className="flex-1 bg-transparent text-sm outline-none"
        />

        {isPwd && (
          <button
            type="button"
            onClick={() => setShow((previous) => !previous)}
            className="text-slate-400"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Forgot password: Step 1 email -> Step 2 OTP + naya password
function ForgotForm({ initialEmail, onBack }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(initialEmail || "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [done, setDone] = useState(false);

  const cleanEmail = email.trim().toLowerCase();

  // OTP mail par bhejo (pehli baar bhi, aur "Resend" par bhi)
  const sendOtp = async (e) => {
    e?.preventDefault();

    if (loading) return;

    if (!EMAIL_REGEX.test(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");
    setInfo("");

    try {
      const { data } = await api.post("/api/auth/forgot-password", {
        email: cleanEmail,
      });

      setInfo(data?.message || "OTP bhej diya gaya hai.");
      setStep(2);
    } catch (err) {
      setError(
        err.response?.data?.message || "OTP nahi bhej paye. Dobara try karo.",
      );
    } finally {
      setLoading(false);
    }
  };

  // OTP + naya password server ko bhejo
  const resetPassword = async (e) => {
    e.preventDefault();

    if (loading) return;

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("6 digit ka OTP daalo.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Naya password kam se kam 6 characters ka hona chahiye.");
      return;
    }

    setLoading(true);
    setError("");
    setInfo("");

    try {
      await api.post("/api/auth/reset-password", {
        email: cleanEmail,
        otp: otp.trim(),
        newPassword,
      });

      setDone(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Password reset nahi hua. Dobara try karo.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Password reset ho gaya
  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Password reset ho gaya. Ab naye password se login karo.
        </div>

        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-full items-center justify-center rounded-lg bg-blue-600 font-medium text-white hover:bg-blue-700"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={step === 1 ? sendOtp : resetPassword} className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Forgot Password</h2>

        <p className="text-sm text-slate-500">
          {step === 1
            ? "Apna email daalo, hum OTP bhejenge"
            : "Mail me aaya 6 digit OTP aur naya password daalo"}
        </p>
      </div>

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
          role="alert"
        >
          {error}
        </div>
      )}

      {info && !error && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          {info}
        </div>
      )}

      <Field
        icon={Mail}
        label="Email Address"
        type="email"
        value={email}
        onChange={(value) => {
          setEmail(value);
          setError("");
        }}
        placeholder="you@example.com"
        disabled={loading || step === 2}
      />

      {step === 2 && (
        <>
          <Field
            icon={KeyRound}
            label="OTP"
            value={otp}
            onChange={(value) => {
              setOtp(value.replace(/\D/g, ""));
              setError("");
            }}
            placeholder="6 digit OTP"
            disabled={loading}
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
          />

          <Field
            icon={Lock}
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(value) => {
              setNewPassword(value);
              setError("");
            }}
            placeholder="Naya password"
            disabled={loading}
            autoComplete="new-password"
          />
        </>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && <LoaderCircle size={18} className="animate-spin" />}

        {loading
          ? "Please wait..."
          : step === 1
            ? "Send OTP"
            : "Reset Password"}
      </button>

      {step === 2 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setStep(1);
              setOtp("");
              setNewPassword("");
              setError("");
              setInfo("");
            }}
            className="text-slate-500 hover:underline disabled:opacity-50"
          >
            Email badlo
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={sendOtp}
            className="text-blue-600 hover:underline disabled:opacity-50"
          >
            OTP dobara bhejo
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-slate-500 hover:underline disabled:opacity-50"
      >
        <ArrowLeft size={14} /> Back to Login
      </button>
    </form>
  );
}

export default function AuthPage() {
  const dispatch = useDispatch();

  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";
  const isForgot = mode === "forgot";

  const set = (key) => (value) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [key]: "",
    }));

    setServerError("");
  };

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const onFile = (file) => {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setServerError("Please select a JPG, PNG or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setServerError("Image size must be less than 5 MB.");
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setServerError("");
  };

  const submit = async (e) => {
    e.preventDefault();

    if (loading) return;

    const validationErrors = {};
    const email = form.email.trim().toLowerCase();

    if (!isLogin && form.name.trim().length < 2) {
      validationErrors.name = "Name must be at least 2 characters.";
    }

    if (!EMAIL_REGEX.test(email)) {
      validationErrors.email = "Enter a valid email address.";
    }

    if (form.password.length < 6) {
      validationErrors.password = "Minimum 6 characters required.";
    }

    setErrors(validationErrors);
    setServerError("");

    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";

      const payload = isLogin
        ? {
            email,
            password: form.password,
          }
        : {
            name: form.name.trim(),
            email,
            password: form.password,
          };

      const response = await api.post(endpoint, payload);

      // Supports common response shapes:
      // { user: {...} }, { data: { user: {...} } }, or { ...user }
      const body = response.data;
      const user = body?.user ?? body?.data?.user ?? body?.data ?? body;

      if (!user || !(user._id || user.id || user.email)) {
        throw new Error(
          body?.message || "Authentication response mein user data nahi mila.",
        );
      }

      // Signup ke baad cookie mil chuki hai, ab chuni hui photo upload karo
      let finalUser = user;

      if (!isLogin && avatarFile) {
        try {
          const formData = new FormData();
          formData.append("profilePic", avatarFile);

          const { data } = await api.put("/api/user/profile", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });

          finalUser = data;
        } catch (uploadError) {
          // Photo fail ho to bhi account ban chuka hai, baad me profile se laga sakte ho
          console.error(
            "Signup photo upload error:",
            uploadError.response?.data || uploadError.message,
          );
        }
      }

      if (isLogin) {
        dispatch(login(finalUser));
      } else {
        dispatch(signup(finalUser));
      }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Server se connect nahi ho pa raha.";

      setServerError(message);
    } finally {
      setLoading(false);
    }
  };

  const changeMode = () => {
    setMode(isLogin ? "signup" : "login");
    setErrors({});
    setServerError("");
  };

  const backToLogin = () => {
    setMode("login");
    setErrors({});
    setServerError("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-lg md:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden flex-col items-center justify-center bg-blue-50 p-10 text-center md:flex">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <MessageSquare size={32} />
          </div>

          <h1 className="text-3xl font-bold text-slate-800">ChatApp</h1>

          <p className="mt-1 text-sm text-blue-600">Connect • Chat • Share</p>

          <p className="mt-6 max-w-xs text-sm text-slate-500">
            {isForgot
              ? "Koi baat nahi! Email par OTP bhejkar apna password naya bana lo."
              : isLogin
                ? "Stay close to your friends and family with our secure and fast chat platform."
                : "Create your account and start chatting with the world."}
          </p>
        </div>

        {/* Form panel */}
        {isForgot ? (
          <div className="p-8 sm:p-10">
            <ForgotForm initialEmail={form.email} onBack={backToLogin} />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 p-8 sm:p-10">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {isLogin ? "Welcome Back" : "Create Account"}
              </h2>

              <p className="text-sm text-slate-500">
                {isLogin
                  ? "Login to your account to continue"
                  : "Sign up to get started"}
              </p>
            </div>

            {serverError && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"
                role="alert"
              >
                {serverError}
              </div>
            )}

            {!isLogin && (
              <Field
                icon={User}
                label="Full Name"
                value={form.name}
                onChange={set("name")}
                placeholder="Enter your name"
                error={errors.name}
                disabled={loading}
              />
            )}

            <Field
              icon={Mail}
              label="Email Address"
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="you@example.com"
              error={errors.email}
              disabled={loading}
            />

            <Field
              icon={Lock}
              label="Password"
              type="password"
              value={form.password}
              onChange={set("password")}
              placeholder="Enter your password"
              error={errors.password}
              disabled={loading}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />

            {!isLogin && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Profile Picture (Optional)
                </label>

                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!loading) onFile(e.dataTransfer.files[0]);
                  }}
                  className="flex h-20 cursor-pointer items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-200 text-xs text-slate-500 hover:border-blue-400"
                >
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Profile preview"
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={22} />
                  )}

                  <span>
                    {avatarPreview
                      ? "Change picture"
                      : "Click to upload or drag and drop (max 5 MB)"}
                  </span>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    disabled={loading}
                    onChange={(e) => {
                      onFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}

            {isLogin && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-slate-600">
                  <input type="checkbox" />
                  Remember me
                </label>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setMode("forgot");
                    setErrors({});
                    setServerError("");
                  }}
                  className="text-blue-600 hover:underline disabled:opacity-50"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <LoaderCircle size={18} className="animate-spin" />}

              {loading ? "Please wait..." : isLogin ? "Login" : "Sign Up"}
            </button>

            <p className="text-center text-sm text-slate-500">
              {isLogin
                ? "Don't have an account? "
                : "Already have an account? "}

              <button
                type="button"
                disabled={loading}
                onClick={changeMode}
                className="font-medium text-blue-600 hover:underline disabled:opacity-50"
              >
                {isLogin ? "Sign up" : "Login"}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
