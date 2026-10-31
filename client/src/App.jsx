import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import api from "./api";
import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";
import { login, logout } from "./store/authSlice";

export default function App() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth?.user);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    api
      .get("/api/user/current")
      .then(({ data }) => {
        if (active) dispatch(login(data));
      })
      .catch(() => {
        if (active) dispatch(logout());
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [dispatch]);

  if (checkingSession) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return user ? <Dashboard /> : <AuthPage />;
}
