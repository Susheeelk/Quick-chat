import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone } from "lucide-react";
import Avatar from "./Avatar";
import {
  acceptCall,
  rejectCall,
  hangUp,
  toggleMute,
  toggleCamera,
  subscribeStreams,
  getStreams,
} from "../call/callEngine";

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function CallOverlay() {
  const {
    active: call,
    incoming,
    muted,
    camOff,
    seconds,
    notice,
    remoteReady,
  } = useSelector((state) => state.call);

  const localRef = useRef(null);
  const remoteRef = useRef(null);

  const hasCall = Boolean(call);
  const isVideo = call?.type === "video";

  // Stream ko video element se jodo (awaaz bhi isi se aati hai)
  useEffect(() => {
    const apply = () => {
      const { local, remote } = getStreams();
      if (localRef.current) localRef.current.srcObject = local;
      if (remoteRef.current) remoteRef.current.srcObject = remote;
    };

    apply();
    return subscribeStreams(apply);
  }, [hasCall, isVideo]);

  // Upar chhota message (jaise "Call reject ho gayi")
  const toast = notice && (
    <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
      {notice}
    </div>
  );

  // 1) Kisi ki call aa rahi hai
  if (incoming && !call) {
    return (
      <>
        {toast}

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white p-6 text-center">
            <div className="flex justify-center">
              <Avatar
                name={incoming.name}
                src={incoming.avatar}
                size="w-20 h-20"
              />
            </div>

            <p className="mt-3 text-lg font-semibold text-slate-800">
              {incoming.name}
            </p>

            <p className="text-sm text-slate-500">
              {incoming.type === "video" ? "Video call" : "Voice call"} aa rahi
              hai...
            </p>

            <div className="mt-6 flex items-center justify-center gap-8">
              <button
                onClick={rejectCall}
                title="Reject"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white"
              >
                <PhoneOff size={22} />
              </button>

              <button
                onClick={acceptCall}
                title="Accept"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white"
              >
                <Phone size={22} />
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Koi call nahi to bas message (agar ho)
  if (!call) return toast || null;

  const statusText =
    call.status === "connected"
      ? fmt(seconds)
      : call.status === "connecting"
        ? "Connecting..."
        : "Ringing...";

  // 2) Call chal rahi hai (ya ring ho rahi hai)
  return (
    <>
      {toast}

      <div
        className={`fixed inset-0 z-50 flex flex-col text-white ${
          isVideo
            ? "bg-slate-900"
            : "bg-gradient-to-b from-blue-700 to-slate-900"
        }`}
      >
        <div className="relative z-10 pt-10 text-center">
          <p className="text-xl font-semibold">{call.name}</p>
          <p className="mt-1 text-sm opacity-80">{statusText}</p>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          {/* Samne wale ka video. Audio call me ye chhupa rehta hai par awaaz yahi se aati hai */}
          <video
            ref={remoteRef}
            autoPlay
            playsInline
            className={
              isVideo ? "absolute inset-0 h-full w-full object-cover" : "hidden"
            }
          />

          {/* Audio call me, ya video aane se pehle, avatar dikhao */}
          {(!isVideo || !remoteReady) && (
            <div className={call.status === "connected" ? "" : "animate-pulse"}>
              <Avatar name={call.name} src={call.avatar} size="w-28 h-28" />
            </div>
          )}

          {/* Apna chhota video */}
          {isVideo && (
            <video
              ref={localRef}
              autoPlay
              playsInline
              muted
              className={`absolute bottom-4 right-4 w-28 rounded-xl border border-white/30 bg-slate-700 object-cover sm:w-36 ${
                camOff ? "opacity-30" : ""
              }`}
            />
          )}
        </div>

        <div className="relative z-10 flex items-center justify-center gap-5 pb-12">
          <button
            onClick={toggleMute}
            title={muted ? "Unmute" : "Mute"}
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              muted ? "bg-white text-slate-900" : "bg-white/20"
            }`}
          >
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {isVideo && (
            <button
              onClick={toggleCamera}
              title={camOff ? "Camera on" : "Camera off"}
              className={`flex h-14 w-14 items-center justify-center rounded-full ${
                camOff ? "bg-white text-slate-900" : "bg-white/20"
              }`}
            >
              {camOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>
          )}

          <button
            onClick={hangUp}
            title="End call"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500"
          >
            <PhoneOff size={26} />
          </button>
        </div>
      </div>
    </>
  );
}
