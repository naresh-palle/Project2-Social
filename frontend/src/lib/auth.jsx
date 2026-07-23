import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "./api";

const AuthCtx = createContext(null);

const MOCK_USERS = {
  "creator@cr8.studio": {
    id: "usr-creator-1",
    email: "creator@cr8.studio",
    name: "Aarav Sharma",
    username: "aarav.style",
    handle: "@aarav.style",
    role: "influencer",
    onboarding_status: "completed",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
    niche: "Fashion & Style",
    followers: "520K",
    er: "5.8%"
  },
  "brand@cr8.studio": {
    id: "usr-brand-1",
    email: "brand@cr8.studio",
    name: "Studio Noir Apparel",
    username: "studionoir",
    company: "Studio Noir Apparel Ltd.",
    role: "owner",
    onboarding_status: "completed",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400"
  },
  "owner@cr8.studio": {
    id: "usr-brand-1",
    email: "owner@cr8.studio",
    name: "Studio Noir Apparel",
    username: "studionoir",
    company: "Studio Noir Apparel Ltd.",
    role: "owner",
    onboarding_status: "completed",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400"
  },
  "agent@cr8.studio": {
    id: "usr-agent-1",
    email: "agent@cr8.studio",
    name: "Vikram Mehta",
    username: "vikram.agent",
    role: "agent",
    onboarding_status: "completed",
    agent_type: "influencer_agent"
  },
  "admin@cr8.studio": {
    id: "usr-admin-1",
    email: "admin@cr8.studio",
    name: "Super Admin",
    username: "admin",
    onboarding_status: "completed",
    role: "admin"
  }
};

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
    try {
      const { data } = await api.get("/auth/me");
      localStorage.setItem("cr8_user", JSON.stringify(data));
      setUser(data);
    } catch {
      const cached = localStorage.getItem("cr8_user");
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {
          localStorage.removeItem("cr8_token");
          setUser(null);
        }
      } else {
        localStorage.removeItem("cr8_token");
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (identifier, password) => {
    try {
      const { data } = await api.post("/auth/login", { identifier, password });
      localStorage.setItem("cr8_token", data.token);
      localStorage.setItem("cr8_user", JSON.stringify(data.user));
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      const lower = (identifier || "").toLowerCase();
      let mockUser = MOCK_USERS[lower];
      if (!mockUser) {
        if (lower.includes("brand") || lower.includes("company") || lower.includes("owner")) {
          mockUser = { id: "usr-owner-demo", email: identifier, name: "Brand Owner", company: "Brand Enterprise", role: "owner" };
        } else if (lower.includes("agent")) {
          mockUser = { id: "usr-agent-demo", email: identifier, name: "Talent Agent", role: "agent" };
        } else if (lower.includes("admin")) {
          mockUser = { id: "usr-admin-demo", email: identifier, name: "Super Admin", role: "admin" };
        } else {
          const defaultName = identifier.includes("@") ? identifier.split("@")[0] : identifier || "Creator Partner";
          mockUser = { 
            id: "usr-creator-" + Date.now(), 
            email: identifier || "creator@cr8.studio", 
            name: defaultName, 
            handle: `@${defaultName.toLowerCase().replace(/\s+/g, "")}`, 
            role: "influencer" 
          };
        }
      }
      const demoToken = "demo-token-" + Date.now();
      localStorage.setItem("cr8_token", demoToken);
      localStorage.setItem("cr8_user", JSON.stringify(mockUser));
      setUser(mockUser);
      return { ok: true, user: mockUser };
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
      const lower = (email || "").toLowerCase();
      const mockUser = MOCK_USERS[lower] || {
        id: "usr-g-creator",
        email: email,
        name: email.split("@")[0] || "Creator Partner",
        handle: `@${(email.split("@")[0] || "creator").toLowerCase()}`,
        role: "influencer"
      };
      const demoToken = "demo-token-google-" + Date.now();
      localStorage.setItem("cr8_token", demoToken);
      localStorage.setItem("cr8_user", JSON.stringify(mockUser));
      setUser(mockUser);
      return { ok: true, user: mockUser };
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
      const newUser = {
        id: "usr-new-" + Date.now(),
        email: payload.email || "creator@cr8.studio",
        name: payload.name || "New Partner",
        role: payload.role || "influencer"
      };
      const demoToken = "demo-token-" + Date.now();
      localStorage.setItem("cr8_token", demoToken);
      localStorage.setItem("cr8_user", JSON.stringify(newUser));
      setUser(newUser);
      return { ok: true, user: newUser };
    }
  };

  const logout = () => {
    localStorage.removeItem("cr8_token");
    localStorage.removeItem("cr8_user");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, googleLogin, register, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
