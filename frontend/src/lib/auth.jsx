import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "./api";

const AuthCtx = createContext(null);

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("cr8_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    // Use cached user immediately so dashboard shows instantly
    const cachedUser = localStorage.getItem("cr8_user");
    if (cachedUser) {
      try { setUser(JSON.parse(cachedUser)); } catch {}
    }
    try {
      const { data } = await api.get("/auth/me");
      localStorage.setItem("cr8_user", JSON.stringify(data));
      setUser(data);
    } catch (e) {
      // Only log out on explicit 401 (invalid/expired token)
      // Network errors (backend sleeping/cold start) should NOT log the user out
      if (e?.response?.status === 401) {
        localStorage.removeItem("cr8_token");
        localStorage.removeItem("cr8_user");
        setUser(null);
      }
      // Otherwise keep the cached user — backend may just be waking up
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    localStorage.removeItem("cr8_token");
    localStorage.removeItem("cr8_user");
    setUser(null);
  }, []);

  // 30-Minute Inactivity / Idle Auto-Logout Listener
  useEffect(() => {
    if (!user) return;

    let idleTimer;

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        logout();
        alert("You have been automatically logged out due to 30 minutes of inactivity.");
        window.location.href = "/#/login";
      }, IDLE_TIMEOUT_MS);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach(ev => window.addEventListener(ev, resetIdleTimer));

    resetIdleTimer(); // Initialize timer

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      events.forEach(ev => window.removeEventListener(ev, resetIdleTimer));
    };
  }, [user, logout]);

  const login = async (identifier, password) => {
    try {
      const { data } = await api.post("/auth/login", { identifier, password });
      localStorage.setItem("cr8_token", data.token);
      localStorage.setItem("cr8_user", JSON.stringify(data.user));
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const googleLogin = async (email) => {
    try {
      const { data } = await api.post("/auth/google-login", { email });
      localStorage.setItem("cr8_token", data.token);
      localStorage.setItem("cr8_user", JSON.stringify(data.user));
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const register = async (payload) => {
    try {
      const { data } = await api.post("/auth/register", payload);
      localStorage.setItem("cr8_token", data.token);
      localStorage.setItem("cr8_user", JSON.stringify(data.user));
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const firebaseRegister = async (payload) => {
    try {
      const { data } = await api.post("/auth/firebase-register", payload);
      localStorage.setItem("cr8_token", data.token);
      localStorage.setItem("cr8_user", JSON.stringify(data.user));
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, googleLogin, register, firebaseRegister, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
