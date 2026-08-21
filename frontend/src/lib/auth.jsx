import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError, friendlyAuthError } from "./api";
import { readLocalSettings, mergeSettings, writeLocalSettings } from "./settingsStore";

const AuthCtx = createContext(null);

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function readAppearance(source = {}) {
  const nested = source?.settings && typeof source.settings === "object" ? source.settings : {};
  const theme =
    source?.theme ??
    nested?.theme ??
    localStorage.getItem("cr8_theme") ??
    "dark";
  const highRaw = source?.high_contrast ?? nested?.high_contrast;
  const highContrast =
    highRaw === undefined || highRaw === null
      ? localStorage.getItem("cr8_high_contrast") === "true"
      : Boolean(highRaw);
  const fontRaw = source?.font_scale ?? nested?.font_scale;
  const fontScale = Number(
    fontRaw ?? localStorage.getItem("cr8_font_scale") ?? 1
  );
  const reducedRaw = source?.reduced_motion ?? nested?.reduced_motion;
  const reducedMotion =
    reducedRaw === undefined || reducedRaw === null
      ? localStorage.getItem("cr8_reduced_motion") === "true"
      : Boolean(reducedRaw);
  return {
    theme: String(theme || "dark"),
    high_contrast: highContrast,
    font_scale: Number.isFinite(fontScale) ? fontScale : 1,
    reduced_motion: reducedMotion,
  };
}

export function applyUserSettings(prefsOrUser) {
  const root = document.documentElement;
  const s = readAppearance(prefsOrUser || {});
  const theme = s.theme;
  const highContrast = s.high_contrast;
  const fontScale = Math.min(1.5, Math.max(0.85, s.font_scale));
  const reducedMotion = s.reduced_motion;

  root.classList.remove("theme-light", "theme-dark", "high-contrast", "reduced-motion");
  let resolved = "dark";
  if (theme === "light") resolved = "light";
  else if (theme === "dark") resolved = "dark";
  else if (window.matchMedia("(prefers-color-scheme: light)").matches) resolved = "light";

  if (resolved === "light") root.classList.add("theme-light");
  else root.classList.add("theme-dark");
  root.style.colorScheme = resolved;

  if (highContrast) root.classList.add("high-contrast");
  if (reducedMotion) root.classList.add("reduced-motion");
  root.style.fontSize = `${fontScale * 100}%`;
  root.style.setProperty("--font-scale", String(fontScale));

  localStorage.setItem("cr8_theme", theme);
  localStorage.setItem("cr8_high_contrast", String(highContrast));
  localStorage.setItem("cr8_font_scale", String(fontScale));
  localStorage.setItem("cr8_reduced_motion", String(reducedMotion));

  // Keep cached session user in sync so reloads don't wipe appearance prefs
  try {
    const raw = localStorage.getItem("cr8_user");
    if (raw) {
      const cached = JSON.parse(raw);
      const next = {
        ...cached,
        theme,
        high_contrast: highContrast,
        font_scale: fontScale,
        reduced_motion: reducedMotion,
      };
      localStorage.setItem("cr8_user", JSON.stringify(next));
    }
  } catch {}

  return s;
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
      let merged = data;
      try {
        const { data: settings } = await api.get("/settings");
        const local = readLocalSettings();
        const prefs = mergeSettings(settings, local);
        writeLocalSettings(prefs);
        merged = { ...data, ...prefs };
      } catch {
        const local = readLocalSettings();
        if (local) merged = { ...data, ...local };
      }
      localStorage.setItem("cr8_user", JSON.stringify(merged));
      setUser(merged);
      applyUserSettings(merged);
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
    localStorage.removeItem("cr8_settings");
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
        const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
        window.location.href = `${base}/#/login`;
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
      return { ok: false, error: friendlyAuthError(e.response?.data?.detail || e.message) };
    }
  };

  const googleLogin = async (credential) => {
    try {
      const { data } = await api.post("/auth/google-login", { credential });
      storeSession(data, false);
      return { ok: true, user: data.user };
    } catch (e) {
      const detail = e.response?.data?.detail || e.message;
      const status = e.response?.status;
      return {
        ok: false,
        error: friendlyAuthError(detail),
        status,
        notRegistered: status === 404,
        incomplete: status === 400 && String(detail || "").toLowerCase().includes("incomplete"),
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

  const mobileOtpLogin = async (mobile, code, opts = {}) => {
    const { remember_me = false } = opts;
    try {
      const cleanMobile = String(mobile || "").replace(/\D/g, "");
      const { data } = await api.post("/auth/mobile/verify-otp", {
        mobile: cleanMobile,
        code: String(code || "").trim(),
      });
      if (data?.token && data?.user) {
        storeSession(data, remember_me);
        return { ok: true, user: data.user };
      }
      return {
        ok: false,
        error: data?.detail || data?.message || "No account found for this mobile number. Please register first.",
        notRegistered: true,
      };
    } catch (e) {
      return {
        ok: false,
        error: friendlyAuthError(
          e.response?.data?.detail || e.message,
          "Login unsuccessful. Please check the verification code and try again."
        ),
        status: e.response?.status,
        notRegistered: e.response?.status === 404,
      };
    }
  };

  const mergeUserSettings = useCallback((payload) => {
    setUser((prev) => {
      if (!prev) {
        applyUserSettings(payload);
        return prev;
      }
      const next = { ...prev, ...payload };
      localStorage.setItem("cr8_user", JSON.stringify(next));
      applyUserSettings(next);
      return next;
    });
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        user,
        loading,
        login,
        googleLogin,
        register,
        firebaseRegister,
        mobileRegister,
        mobileOtpLogin,
        logout,
        refresh,
        applyUserSettings,
        mergeUserSettings,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
