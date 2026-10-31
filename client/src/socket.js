
import { io } from "socket.io-client";

const socket = io(
  import.meta.env.VITE_API_URL || "http://localhost:8000",
  {
    withCredentials: true,
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  },
);

export default socket;
