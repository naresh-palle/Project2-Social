import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User, Shield, Bell, Lock, Trash2, Download, Ban, VolumeX, UserX,
  Monitor, Globe, Eye, EyeOff, LogOut, ChevronRight, Loader2
} from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useAuth, applyUserSettings } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

const NOTIF_KEYS = [
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "follows", label: "Follows" },
  { key: "mentions", label: "Mentions" },
  { key: "messages", label: "Messages" },
  { key: "friend_requests", label: "Follow Requests" },
  { key: "post_updates", label: "Post Updates" },
  { key: "push", label: "Push Notifications" },
  { key: "email", label: "Email Notifications" },
];

export default function Settings() {
  const { user, logout, refresh } = useAuth();
  const nav = useNavigate();
  const [settings, setSettings] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [mutes, setMutes] = useState([]);
  const [restricted, setRestricted] = useState([]);
  const [twoFa, setTwoFa] = useState({ setup: null, code: "" });
  const [disable2fa, setDisable2fa] = useState({ password: "", code: "" });
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [sRes, sessRes, histRes, blockRes, muteRes, restrRes] = await Promise.all([
        api.get("/settings"),
        api.get("/auth/sessions").catch(() => ({ data: [] })),
        api.get("/auth/login-history").catch(() => ({ data: [] })),
        api.get("/privacy/blocks").catch(() => ({ data: [] })),
        api.get("/privacy/mutes").catch(() => ({ data: [] })),
        api.get("/privacy/restricted").catch(() => ({ data: [] })),
      ]);
      setSettings(sRes.data);
      setSessions(sessRes.data || []);
      setLoginHistory(histRes.data || []);
      setBlocks(blockRes.data || []);
      setMutes(muteRes.data || []);
      setRestricted(restrRes.data || []);
    } catch {
      toast.error("Failed to load settings");
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const patch = async (payload) => {
    setBusy(true);
    try {
      const { data } = await api.patch("/settings", payload);
      setSettings((prev) => ({ ...prev, ...data }));
      applyUserSettings({ ...user, ...data });
      await refresh();
      toast.success("Settings saved");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const updateNotif = (key, val) => {
    const prefs = { ...(settings?.notification_prefs || {}), [key]: val };
    setSettings((s) => ({ ...s, notification_prefs: prefs }));
    patch({ notification_prefs: { [key]: val } });
  };

  const setup2fa = async () => {
    try {
      const { data } = await api.post("/auth/2fa/setup");
      setTwoFa({ setup: data, code: "" });
      toast.success("Scan the secret in your authenticator app");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "2FA setup failed");
    }
  };

  const enable2fa = async () => {
    try {
      await api.post("/auth/2fa/enable", { code: twoFa.code });
      toast.success("2FA enabled");
      setTwoFa({ setup: null, code: "" });
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Invalid code");
    }
  };

  const handleDisable2fa = async () => {
    try {
      await api.post("/auth/2fa/disable", disable2fa);
      toast.success("2FA disabled");
      setDisable2fa({ password: "", code: "" });
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed");
    }
  };

  const revokeSession = async (id) => {
    try {
      await api.post("/auth/sessions/revoke", { session_id: id });
      toast.success("Session revoked");
      load();
    } catch {
      toast.error("Failed to revoke session");
    }
  };

  const unblock = async (userId) => {
    await api.post("/privacy/unblock", { user_id: userId });
    toast.success("Unblocked");
    load();
  };

  const unmute = async (userId) => {
    await api.post("/privacy/unmute", { user_id: userId });
    toast.success("Unmuted");
    load();
  };

  const unrestrict = async (userId) => {
    await api.post("/privacy/unrestrict", { user_id: userId });
    toast.success("Unrestricted");
    load();
  };

  const exportData = async () => {
    try {
      const { data } = await api.get("/auth/export-data");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cr8-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported");
    } catch {
      toast.error("Export failed");
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== "DELETE") {
      toast.error('Type DELETE to confirm');
      return;
    }
    try {
      await api.post("/auth/delete-account");
      logout();
      nav("/");
      toast.success("Account deleted");
    } catch {
      toast.error("Deletion failed");
    }
  };

  if (!user || !settings) {
    return (
      <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin opacity-50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      <Nav />
      <div className="pt-28 max-w-3xl mx-auto px-6 md:px-10 pb-24 flex-1 w-full">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Preferences</p>
        <h1 className="font-editorial text-5xl md:text-6xl mt-2">Settings<span className="tick">.</span></h1>

        <div className="mt-12 space-y-10">
          {/* Profile quick links */}
          <Section title="Profile" icon={User}>
            <div className="space-y-2">
              <QuickLink to="/profile" label="View Profile" />
              <QuickLink to="/profile/edit" label="Edit Profile & Change Password" />
            </div>
          </Section>

          {/* Account */}
          <Section title="Account" icon={Monitor}>
            <Field label="Language">
              <select
                value={settings.language || "en"}
                onChange={(e) => patch({ language: e.target.value })}
                className="inp-select"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </Field>
            <Field label="Theme">
              <select
                value={settings.theme || "dark"}
                onChange={(e) => patch({ theme: e.target.value })}
                className="inp-select"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </Field>
            <label className="flex items-center justify-between py-2 cursor-pointer">
              <span className="font-mono text-sm">High Contrast</span>
              <input
                type="checkbox"
                checked={!!settings.high_contrast}
                onChange={(e) => patch({ high_contrast: e.target.checked })}
                className="accent-[#FF3B30] w-4 h-4"
              />
            </label>
            <Field label={`Font Scale (${settings.font_scale || 1}x)`}>
              <input
                type="range"
                min="0.85"
                max="1.5"
                step="0.05"
                value={settings.font_scale || 1}
                onChange={(e) => patch({ font_scale: parseFloat(e.target.value) })}
                className="w-full accent-[#FF3B30]"
              />
            </Field>
          </Section>

          {/* Privacy */}
          <Section title="Privacy" icon={Eye}>
            <Toggle label="Private Account" checked={!!settings.is_private} onChange={(v) => patch({ is_private: v })} />
            <Toggle label="Show Online Status" checked={settings.show_online_status !== false} onChange={(v) => patch({ show_online_status: v })} />
            <Toggle label="Show Last Seen" checked={settings.show_last_seen !== false} onChange={(v) => patch({ show_last_seen: v })} />
          </Section>

          {/* Notifications */}
          <Section title="Notifications" icon={Bell}>
            {NOTIF_KEYS.map(({ key, label }) => (
              <Toggle
                key={key}
                label={label}
                checked={settings.notification_prefs?.[key] !== false}
                onChange={(v) => updateNotif(key, v)}
              />
            ))}
          </Section>

          {/* Security */}
          <Section title="Security" icon={Lock}>
            <QuickLink to="/profile/edit#sec-security" label="Change Password" />
            {settings.two_fa_enabled ? (
              <div className="mt-4 p-4 border border-[#34C759]/30 bg-[#34C759]/5 rounded-xs space-y-3">
                <p className="font-mono text-xs text-[#34C759]">2FA is enabled</p>
                <input
                  type="password"
                  placeholder="Current password"
                  value={disable2fa.password}
                  onChange={(e) => setDisable2fa({ ...disable2fa, password: e.target.value })}
                  className="inp-field"
                />
                <input
                  type="text"
                  placeholder="2FA code"
                  value={disable2fa.code}
                  onChange={(e) => setDisable2fa({ ...disable2fa, code: e.target.value })}
                  className="inp-field"
                />
                <button type="button" onClick={handleDisable2fa} className="btn-sm-outline">Disable 2FA</button>
              </div>
            ) : twoFa.setup ? (
              <div className="mt-4 p-4 border border-white/10 rounded-xs space-y-3">
                <p className="font-mono text-xs break-all">Secret: {twoFa.setup.secret}</p>
                <p className="font-mono text-[10px] opacity-60 break-all">{twoFa.setup.otpauth_uri}</p>
                <input
                  type="text"
                  placeholder="6-digit code"
                  value={twoFa.code}
                  onChange={(e) => setTwoFa({ ...twoFa, code: e.target.value })}
                  className="inp-field"
                />
                <button type="button" onClick={enable2fa} className="btn-sm-solid">Enable 2FA</button>
              </div>
            ) : (
              <button type="button" onClick={setup2fa} className="btn-sm-solid mt-2">Set Up 2FA</button>
            )}

            <div className="mt-6">
              <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-60 mb-3">Active Sessions</h4>
              {sessions.length === 0 ? (
                <p className="font-mono text-xs opacity-40">No sessions</p>
              ) : (
                sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-white/5">
                    <div>
                      <div className="font-mono text-sm">{s.device_name || "Device"}</div>
                      <div className="font-mono text-[10px] opacity-50">{s.ip} · {s.last_active?.slice(0, 16)}</div>
                    </div>
                    <button type="button" onClick={() => revokeSession(s.id)} className="text-[#FF3B30] font-mono text-[10px] uppercase">
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6">
              <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-60 mb-3">Login History</h4>
              {loginHistory.slice(0, 10).map((h) => (
                <div key={h.id} className="py-2 border-b border-white/5 font-mono text-xs">
                  <span className={h.success ? "text-[#34C759]" : "text-[#FF3B30]"}>{h.success ? "✓" : "✗"}</span>
                  {" "}{h.ip} · {h.created_at?.slice(0, 16)}
                </div>
              ))}
            </div>
          </Section>

          {/* Block list */}
          <Section title="Blocked Users" icon={Ban}>
            {blocks.length === 0 ? (
              <p className="font-mono text-xs opacity-40">No blocked users</p>
            ) : (
              blocks.map((b) => (
                <div key={b.block?.id || b.user?.id} className="flex items-center justify-between py-2">
                  <span className="font-editorial">{b.user?.name || b.block?.blocked_id}</span>
                  <button type="button" onClick={() => unblock(b.user?.id || b.block?.blocked_id)} className="font-mono text-[10px] text-[#FF3B30] uppercase">
                    Unblock
                  </button>
                </div>
              ))
            )}
          </Section>

          {/* Mute / Restrict */}
          <Section title="Muted Users" icon={VolumeX}>
            {mutes.length === 0 ? (
              <p className="font-mono text-xs opacity-40">No muted users</p>
            ) : (
              mutes.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2">
                  <span className="font-mono text-sm">{m.muted_id}</span>
                  <button type="button" onClick={() => unmute(m.muted_id)} className="font-mono text-[10px] text-[#FF3B30] uppercase">Unmute</button>
                </div>
              ))
            )}
          </Section>

          <Section title="Restricted Users" icon={UserX}>
            {restricted.length === 0 ? (
              <p className="font-mono text-xs opacity-40">No restricted users</p>
            ) : (
              restricted.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2">
                  <span className="font-mono text-sm">{r.restricted_id}</span>
                  <button type="button" onClick={() => unrestrict(r.restricted_id)} className="font-mono text-[10px] text-[#FF3B30] uppercase">Unrestrict</button>
                </div>
              ))
            )}
          </Section>

          {/* Drafts & Creator analytics */}
          <DraftsAndAnalytics />

          {/* Data & Delete */}
          <Section title="Your Data" icon={Download}>
            <button type="button" onClick={exportData} className="btn-sm-solid flex items-center gap-2">
              <Download className="w-4 h-4" /> Download My Data (JSON)
            </button>
          </Section>

          <Section title="Danger Zone" icon={Trash2}>
            <p className="font-mono text-xs opacity-60 mb-3">Permanently delete your account and all associated data.</p>
            <input
              type="text"
              placeholder='Type DELETE to confirm'
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="inp-field mb-3"
            />
            <button type="button" onClick={deleteAccount} className="px-4 py-2 bg-[#FF3B30] font-mono text-xs uppercase tracking-widest font-bold">
              Delete Account
            </button>
          </Section>
        </div>
      </div>
      <Footer />
      <style>{`
        .inp-select, .inp-field { width: 100%; background: #121212; border: 1px solid rgba(255,255,255,0.15); padding: 0.6rem; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #F4F4F0; border-radius: 2px; margin-top: 0.25rem; }
        .inp-select:focus, .inp-field:focus { outline: none; border-color: #FF3B30; }
        .btn-sm-solid { padding: 0.5rem 1rem; background: #FF3B30; font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold; color: white; }
        .btn-sm-outline { padding: 0.5rem 1rem; border: 1px solid rgba(255,255,255,0.2); font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; text-transform: uppercase; }
      `}</style>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <section className="p-6 border border-white/10 bg-[#121212] rounded-xs">
      <h2 className="font-mono text-xs uppercase tracking-widest text-[#FF3B30] flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4" /> {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="font-mono text-sm">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#FF3B30] w-4 h-4" />
    </label>
  );
}

function QuickLink({ to, label }) {
  return (
    <Link to={to} className="flex items-center justify-between py-2 font-mono text-sm hover:text-[#FF3B30] transition-colors group">
      {label}
      <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100" />
    </Link>
  );
}

function DraftsAndAnalytics() {
  const [drafts, setDrafts] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    api.get("/posts/mine", { params: { status: "draft" } }).then((r) => setDrafts(r.data || [])).catch(() => {});
    api.get("/posts/mine", { params: { status: "scheduled" } }).then((r) => setScheduled(r.data || [])).catch(() => {});
    api.get("/analytics/social").then((r) => setAnalytics(r.data)).catch(() => {});
  }, []);

  const publishDraft = async (id) => {
    try {
      await api.patch(`/posts/${id}`, { status: "published" });
      setDrafts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Draft published");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed");
    }
  };

  const deletePost = async (id, list, setList) => {
    try {
      await api.delete(`/posts/${id}`);
      setList((prev) => prev.filter((p) => p.id !== id));
      toast.success("Deleted");
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <>
      <Section title="Drafts & Scheduled" icon={Monitor}>
        <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-60">Drafts</h4>
        {drafts.length === 0 ? (
          <p className="font-mono text-xs opacity-40">No drafts</p>
        ) : (
          drafts.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 gap-2">
              <span className="font-editorial text-sm truncate">{p.title || p.text || "Untitled"}</span>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => publishDraft(p.id)} className="font-mono text-[10px] text-[#34C759] uppercase">Publish</button>
                <button type="button" onClick={() => deletePost(p.id, drafts, setDrafts)} className="font-mono text-[10px] text-[#FF3B30] uppercase">Delete</button>
              </div>
            </div>
          ))
        )}
        <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-60 mt-4">Scheduled</h4>
        {scheduled.length === 0 ? (
          <p className="font-mono text-xs opacity-40">No scheduled posts</p>
        ) : (
          scheduled.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 gap-2">
              <div className="truncate">
                <span className="font-editorial text-sm">{p.title || p.text || "Untitled"}</span>
                <div className="font-mono text-[10px] opacity-50">{p.scheduled_at}</div>
              </div>
              <button type="button" onClick={() => deletePost(p.id, scheduled, setScheduled)} className="font-mono text-[10px] text-[#FF3B30] uppercase shrink-0">Delete</button>
            </div>
          ))
        )}
      </Section>

      {analytics && (
        <Section title="Social Analytics" icon={Eye}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Profile Views", analytics.profile_views],
              ["Post Views", analytics.post_views],
              ["Likes", analytics.likes],
              ["Shares", analytics.shares],
              ["Followers", analytics.followers],
              ["Reach", analytics.reach],
              ["Engagement %", analytics.engagement_rate],
              ["Posts", analytics.posts_count],
            ].map(([label, val]) => (
              <div key={label} className="p-3 border border-white/10 bg-black/30">
                <div className="font-mono text-[9px] uppercase tracking-widest opacity-50">{label}</div>
                <div className="font-editorial text-2xl mt-1">{val ?? 0}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

