import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "./api";

const AuthCtx = createContext(null);

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export function applyUserSettings(user) {
  const root = document.documentElement;
  const theme = user?.theme || localStorage.getItem("cr8_theme") || "dark";
  const highContrast = Boolean(
    user?.high_contrast ?? localStorage.getItem("cr8_high_contrast") === "true"
  );
  const fontScale = Number(user?.font_scale || localStorage.getItem("cr8_font_scale") || 1);

  root.classList.remove("theme-light", "theme-dark", "high-contrast");
  if (theme === "light") root.classList.add("theme-light");
  else if (theme === "dark") root.classList.add("theme-dark");
  else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
    root.classList.add("theme-light");
  } else {
    root.classList.add("theme-dark");
  }

  if (highContrast) root.classList.add("high-contrast");
  root.style.fontSize = `${Math.min(1.5, Math.max(0.85, fontScale)) * 100}%`;

  if (user?.theme) localStorage.setItem("cr8_theme", user.theme);
  localStorage.setItem("cr8_high_contrast", String(highContrast));
  localStorage.setItem("cr8_font_scale", String(fontScale));
}

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
    const cachedUser = localStorage.getItem("cr8_user");
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        setUser(parsed);
        applyUserSettings(parsed);
      } catch {}
    }
    try {
      const { data } = await api.get("/auth/me");
      localStorage.setItem("cr8_user", JSON.stringify(data));
      setUser(data);
      applyUserSettings(data);
      try {
        const { data: settings } = await api.get("/settings");
        applyUserSettings({ ...data, ...settings });
      } catch {}
    } catch (e) {
      if (e?.response?.status === 401) {
        localStorage.removeItem("cr8_token");
        localStorage.removeItem("cr8_user");
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    api.post("/auth/presence", { online: false }).catch(() => {});
    localStorage.removeItem("cr8_token");
    localStorage.removeItem("cr8_user");
    setUser(null);
  }, []);

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
    events.forEach((ev) => window.addEventListener(ev, resetIdleTimer));
    resetIdleTimer();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
    };
  }, [user, logout]);

  // Presence heartbeat every 60s when logged in
  useEffect(() => {
    if (!user) return;
    const beat = () => {
      api.post("/auth/presence", { online: true }).catch(() => {});
    };
    beat();
    const interval = setInterval(beat, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  const storeSession = (data, rememberMe) => {
    localStorage.setItem("cr8_token", data.token);
    localStorage.setItem("cr8_user", JSON.stringify(data.user));
    localStorage.setItem("cr8_remember_me", rememberMe ? "true" : "false");
    setUser(data.user);
    applyUserSettings(data.user);
  };

  const login = async (identifier, password, opts = {}) => {
    const { remember_me = false, totp_code } = opts;
    try {
      const { data } = await api.post("/auth/login", {
        identifier,
        password,
        remember_me,
        totp_code: totp_code || undefined,
      });
      if (data.requires_2fa) {
        return { ok: false, requires_2fa: true };
      }
      storeSession(data, remember_me);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const appleLogin = async (identityToken, opts = {}) => {
    const { remember_me = false } = opts;
    try {
      const { data } = await api.post("/auth/apple-login", {
        identity_token: identityToken,
        remember_me,
      });
      storeSession(data, remember_me);
      return { ok: true, user: data.user };
    } catch (e) {
      return {
        ok: false,
        error: formatApiError(e.response?.data?.detail) || e.message,
        status: e.response?.status,
        notRegistered: e.response?.status === 404,
      };
    }
  };

  const googleLogin = async (credential) => {
    try {
      const { data } = await api.post("/auth/google-login", { credential });
      storeSession(data, false);
      return { ok: true, user: data.user };
    } catch (e) {
      return {
        ok: false,
        error: formatApiError(e.response?.data?.detail) || e.message,
        status: e.response?.status,
        notRegistered: e.response?.status === 404,
      };
    }
  };

  const register = async (payload) => {
    try {
      const { data } = await api.post("/auth/register", payload);
      storeSession(data, false);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const firebaseRegister = async (payload) => {
    try {
      const { data } = await api.post("/auth/firebase-register", payload);
      storeSession(data, false);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const mobileRegister = async (payload) => {
    try {
      const { data } = await api.post("/auth/mobile-register", payload);
      storeSession(data, false);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  return (
    <AuthCtx.Provider
      value={{
        user,
        loading,
        login,
        appleLogin,
        googleLogin,
        register,
        firebaseRegister,
        mobileRegister,
        logout,
        refresh,
        applyUserSettings,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
