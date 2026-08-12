import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User, Bell, Trash2, Download, Ban, VolumeX, UserX,
  Monitor, Sun, Moon, Eye, Loader2, ChevronRight, ChevronLeft
} from "lucide-react";
import { Nav } from "@/components/Nav";
import { useAuth, applyUserSettings } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";
import { readLocalSettings, writeLocalSettings, mergeSettings, settingsDiff } from "@/lib/settingsStore";
import { exportProfileReportPdf } from "@/lib/exportFormats";
import { formatUsername } from "@/lib/username";

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

const THEME_OPTIONS = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
];

export default function Settings() {
  const { user, logout, mergeUserSettings } = useAuth();
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [pwdBusy, setPwdBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fontTimer = useRef(null);
  const settingsRef = useRef(null);
  const saveSeq = useRef(0);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const load = useCallback(async () => {
    const local = readLocalSettings();
    if (local) {
      const seeded = mergeSettings({}, local);
      setSettings(seeded);
      applyUserSettings({ ...user, ...seeded });
    }
    try {
      const [sRes, sessRes, histRes, blockRes, muteRes, restrRes] = await Promise.all([
        api.get("/settings"),
        api.get("/auth/sessions").catch(() => ({ data: [] })),
        api.get("/auth/login-history").catch(() => ({ data: [] })),
        api.get("/privacy/blocks").catch(() => ({ data: [] })),
        api.get("/privacy/mutes").catch(() => ({ data: [] })),
        api.get("/privacy/restricted").catch(() => ({ data: [] })),
      ]);
      const merged = mergeSettings(sRes.data, local);
      setSettings(merged);
      writeLocalSettings(merged);
      applyUserSettings({ ...user, ...merged });
      mergeUserSettings?.(merged);
      // Re-push any local prefs the API has not stored yet
      const diff = settingsDiff(local, sRes.data);
      if (diff && Object.keys(diff).length) {
        api.patch("/settings", diff).then(({ data }) => {
          const synced = mergeSettings(data, readLocalSettings());
          writeLocalSettings(synced);
          setSettings(synced);
          applyUserSettings({ ...user, ...synced });
          mergeUserSettings?.(synced);
        }).catch(() => {});
      }
      setSessions(sessRes.data || []);
      setLoginHistory(histRes.data || []);
      setBlocks(blockRes.data || []);
      setMutes(muteRes.data || []);
      setRestricted(restrRes.data || []);
    } catch {
      if (!local) {
        toast.error("Failed to load settings from server");
        setSettings({});
      }
    }
  }, [user, mergeUserSettings]);

  // Load once per logged-in user — do NOT reload on every auth refresh (that was resetting toggles)
  useEffect(() => {
    if (user?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const patch = async (payload) => {
    const prev = settingsRef.current;
    const optimistic = {
      ...(prev || {}),
      ...payload,
      ...(payload.notification_prefs
        ? {
            notification_prefs: {
              ...(prev?.notification_prefs || {}),
              ...payload.notification_prefs,
            },
          }
        : {}),
    };
    setSettings(optimistic);
    settingsRef.current = optimistic;
    writeLocalSettings(optimistic);
    applyUserSettings({ ...user, ...optimistic });
    mergeUserSettings?.(optimistic);

    const seq = ++saveSeq.current;
    try {
      const { data } = await api.patch("/settings", payload);
      // Ignore stale responses if a newer patch finished first
      if (seq !== saveSeq.current) return;
      // Keep local optimistic values — never let a stale/partial API payload wipe toggles
      const merged = mergeSettings(data, settingsRef.current);
      setSettings(merged);
      settingsRef.current = merged;
      writeLocalSettings(merged);
      applyUserSettings({ ...user, ...merged });
      mergeUserSettings?.(merged);
    } catch (e) {
      if (seq !== saveSeq.current) return;
      // Keep optimistic local state; only toast — localStorage already has the choice
      toast.message("Saved on this device. Syncing to server when available.");
      console.warn("settings patch failed", e);
    }
  };

  const updateNotif = (key, val) => {
    patch({ notification_prefs: { [key]: val } });
  };

  const onFontScale = (val) => {
    const font_scale = parseFloat(val);
    const next = { ...(settingsRef.current || {}), font_scale };
    setSettings(next);
    settingsRef.current = next;
    applyUserSettings({ ...user, ...next });
    if (fontTimer.current) clearTimeout(fontTimer.current);
    fontTimer.current = setTimeout(() => {
      patch({ font_scale });
    }, 350);
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
    setDownloading(true);
    try {
      const { data } = await api.get("/auth/export-data");
      const userRow = data?.user && typeof data.user === "object" ? data.user : (user || {});
      let aiSummary = "";
      try {
        const { data: report } = await api.post("/ai/data-report");
        if (report?.summary) aiSummary = String(report.summary);
      } catch {
        /* optional AI endpoint may be unavailable on older deploys */
      }
      if (!aiSummary && (userRow.role === "influencer" || userRow.role === "creator")) {
        try {
          const niches = Array.isArray(userRow.niches)
            ? userRow.niches
            : Array.isArray(userRow.category)
              ? userRow.category
              : String(userRow.category || "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
          const { data: ai } = await api.post("/ai/suggest-profile", {
            niches: niches.slice(0, 6),
            name: userRow.name,
            username: userRow.username,
            handle: userRow.handle,
            city: userRow.city,
            state: userRow.state,
            languages: userRow.languages,
          });
          if (ai?.bio) aiSummary = String(ai.bio);
        } catch {
          /* local narrative fallback in exportProfileReportPdf */
        }
      }
      exportProfileReportPdf({
        filename: `cr8-profile-${new Date().toISOString().slice(0, 10)}`,
        user: userRow,
        posts: data?.posts || [],
        follows: data?.follows || [],
        messages: data?.messages || [],
        exportedAt: data?.exported_at || new Date().toISOString(),
        aiSummary,
      });
      toast.success("AI profile PDF downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setDownloading(false);
    }
  };

  const changePassword = async (e) => {
    e?.preventDefault?.();
    if (!pwdForm.current_password) {
      toast.error("Current password is required");
      return;
    }
    if (!/^(?=.*[a-zA-Z])(?=.*[0-9]).{8,}$/.test(pwdForm.new_password)) {
      toast.error("New password must be at least 8 characters with letters and numbers");
      return;
    }
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      toast.error("New password and confirm password do not match");
      return;
    }
    setPwdBusy(true);
    try {
      await api.post("/auth/change-password", {
        current_password: pwdForm.current_password,
        new_password: pwdForm.new_password,
      });
      toast.success("Password updated");
      setPwdForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Failed to change password");
    } finally {
      setPwdBusy(false);
    }
  };

  const deleteAccount = async () => {
    try {
      await api.post("/auth/delete-account");
      logout();
      toast.success("Account deleted");
      nav("/");
    } catch {
      toast.error("Deletion failed");
    }
  };

  if (!user || !settings) {
    return (
      <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex items-center justify-center">
      <ThemeToaster />
        <Loader2 className="w-6 h-6 animate-spin opacity-50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      <Nav />
      <div className="pt-24 max-w-6xl mx-auto px-4 md:px-8 pb-8 flex-1 w-full">
        <div className="mb-6">
          <button onClick={() => nav(-1)} className="font-mono text-[10px] uppercase tracking-widest text-white/60 hover:text-white flex items-center gap-1 transition-colors">
            <ChevronLeft className="w-3 h-3" /> Back
          </button>
        </div>
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Preferences</p>
        <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight mt-1">Settings</h1>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
          <div className="space-y-3">
            <Section title="Profile" icon={User} dense>
              <div className="space-y-0.5">
                <QuickLink to="/profile" label="View Profile" />
                <QuickLink to="/profile/edit" label="Edit Profile" />
                <button
                  type="button"
                  onClick={() => setSecurityOpen(true)}
                  className="flex items-center justify-between py-1.5 font-mono text-sm hover:text-[#FF3B30] transition-colors group min-h-[36px] w-full text-left"
                  data-testid="settings-reset-password"
                >
                  Reset Password
                  <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                </button>
              </div>
            </Section>

            <Section title="Account" icon={Monitor} dense>
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
                <div className="mt-2 flex gap-2">
                  {THEME_OPTIONS.map(({ id, label, Icon }) => {
                    const active = (settings.theme || "dark") === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        title={label}
                        aria-label={label}
                        aria-pressed={active}
                        onClick={() => patch({ theme: id })}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 border transition-colors ${
                          active
                            ? "border-[#FF3B30] bg-[#FF3B30]/15 text-[color:var(--fg)]"
                            : "border-white/15 bg-black/30 text-white/60 hover:text-white hover:border-white/30"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Toggle label="High Contrast" checked={!!settings.high_contrast} onChange={(v) => patch({ high_contrast: v })} />
              <Toggle label="Reduce Motion" checked={!!settings.reduced_motion} onChange={(v) => patch({ reduced_motion: v })} />
              <Field label={`Font Scale (${Number(settings.font_scale || 1).toFixed(2)}x)`}>
                <input
                  type="range"
                  min="0.85"
                  max="1.5"
                  step="0.05"
                  value={settings.font_scale || 1}
                  onChange={(e) => onFontScale(e.target.value)}
                  className="w-full accent-[#FF3B30]"
                />
              </Field>
            </Section>

            {user?.role !== "admin" && (<Section title="Privacy" icon={Eye} dense>
              <Toggle label="Private Account" checked={!!settings.is_private} onChange={(v) => patch({ is_private: v })} />
              <Toggle label="Show Last Seen" checked={settings.show_last_seen !== false} onChange={(v) => patch({ show_last_seen: v })} />
            </Section>)}

            <Section title="Notifications" icon={Bell} dense>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                {NOTIF_KEYS.map(({ key, label }) => (
                  <Toggle
                    key={key}
                    label={label}
                    checked={settings.notification_prefs?.[key] !== false}
                    onChange={(v) => updateNotif(key, v)}
                  />
                ))}
              </div>
            </Section>
          </div>

          <div className="space-y-3">
            {blocks.length > 0 && user?.role !== "admin" && (
              <Section title="Blocked Users" icon={Ban} dense>
                {blocks.map((b) => (
                  <div key={b.block?.id || b.user?.id} className="flex items-center justify-between py-1">
                    <span className="font-editorial text-sm">{formatUsername(b.user?.username, b.user?.handle, b.user?.name) || b.block?.blocked_id}</span>
                    <button type="button" onClick={() => unblock(b.user?.id || b.block?.blocked_id)} className="font-mono text-[10px] text-[#FF3B30] uppercase">
                      Unblock
                    </button>
                  </div>
                ))}
              </Section>
            )}

            {mutes.length > 0 && user?.role !== "admin" && (
              <Section title="Muted Users" icon={VolumeX} dense>
                {mutes.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-1">
                    <span className="font-mono text-sm">{m.muted_id}</span>
                    <button type="button" onClick={() => unmute(m.muted_id)} className="font-mono text-[10px] text-[#FF3B30] uppercase">Unmute</button>
                  </div>
                ))}
              </Section>
            )}

            {restricted.length > 0 && user?.role !== "admin" && (
              <Section title="Restricted Users" icon={UserX} dense>
                {restricted.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-1">
                    <span className="font-mono text-sm">{r.restricted_id}</span>
                    <button type="button" onClick={() => unrestrict(r.restricted_id)} className="font-mono text-[10px] text-[#FF3B30] uppercase">Unrestrict</button>
                  </div>
                ))}
              </Section>
            )}

            {user?.role !== "admin" && <DraftsAndAnalytics />}

            {user?.role !== "admin" && (<Section title="Your Data" icon={Download} dense>
              <button type="button" onClick={exportData} disabled={downloading} className="btn-sm-solid flex items-center gap-2 disabled:opacity-50">
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download My Data (AI PDF)
              </button>
            </Section>)}

            {user?.role !== "admin" && (<Section title="Danger Zone" icon={Trash2} dense>
              <p className="font-mono text-[11px] opacity-60 mb-2">Permanently delete your account and all data.</p>
              <input
                type="text"
                placeholder="Type DELETE to confirm"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="inp-field mb-2"
              />
              <button 
                type="button" 
                disabled={deleteConfirm !== "DELETE"}
                onClick={() => setShowDeleteModal(true)} 
                className="px-4 py-2 bg-[#FF3B30] font-mono text-xs uppercase tracking-widest font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Account
              </button>
            </Section>)}
          </div>
        </div>
      </div>

      {securityOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0B0B0E]/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSecurityOpen(false)}
          data-testid="security-modal-backdrop"
        >
          <div
            className="bg-[#121212] border border-white/20 p-5 md:p-6 max-w-lg w-full rounded-sm shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            data-testid="security-modal"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#FF3B30] font-bold">Security</p>
                <h3 className="font-sans text-xl font-bold mt-0.5">Reset password &amp; account security</h3>
              </div>
              <button
                type="button"
                onClick={() => setSecurityOpen(false)}
                className="text-white/60 hover:text-white text-xl leading-none px-2"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-60">Change password</h4>
              <input
                type="password"
                placeholder="Current password"
                autoComplete="current-password"
                value={pwdForm.current_password}
                onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })}
                className="inp-field"
              />
              <input
                type="password"
                placeholder="New password (8+ chars, letters + numbers)"
                autoComplete="new-password"
                value={pwdForm.new_password}
                onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })}
                className="inp-field"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={pwdForm.confirm_password}
                onChange={(e) => setPwdForm({ ...pwdForm, confirm_password: e.target.value })}
                className="inp-field"
              />
              <button type="button" disabled={pwdBusy} onClick={changePassword} className="btn-sm-solid">
                {pwdBusy ? "Updating…" : "Update password"}
              </button>
            </div>

            <div className="border-t border-white/10 pt-4 space-y-2">
              <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-60">Two-factor authentication</h4>
              {settings.two_fa_enabled ? (
                <div className="p-3 border border-[#34C759]/30 bg-[#34C759]/5 rounded-xs space-y-2">
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
                <div className="p-3 border border-white/10 rounded-xs space-y-2">
                  <p className="font-mono text-xs break-all">Secret: {twoFa.setup.secret}</p>
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
                <button type="button" onClick={setup2fa} className="btn-sm-solid">Set Up 2FA</button>
              )}
            </div>

            <details className="border-t border-white/10 pt-4 group">
              <summary className="font-mono text-[10px] uppercase tracking-widest opacity-60 cursor-pointer hover:opacity-100">
                Sessions &amp; login history
              </summary>
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {sessions.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-1 border-b border-white/5">
                    <div className="min-w-0">
                      <div className="font-mono text-xs truncate">{s.device_name || "Device"}</div>
                      <div className="font-mono text-[10px] opacity-50">{s.ip}</div>
                    </div>
                    <button type="button" onClick={() => revokeSession(s.id)} className="text-[#FF3B30] font-mono text-[10px] uppercase shrink-0">
                      Revoke
                    </button>
                  </div>
                ))}
                {loginHistory.slice(0, 5).map((h) => (
                  <div key={h.id} className="py-1 border-b border-white/5 font-mono text-[10px]">
                    <span className={h.success ? "text-[#34C759]" : "text-[#FF3B30]"}>{h.success ? "✓" : "✗"}</span>
                    {" "}{h.ip} · {h.created_at?.slice(0, 16)}
                  </div>
                ))}
                {!sessions.length && !loginHistory.length && (
                  <p className="font-mono text-[10px] opacity-40 py-2">No sessions on file.</p>
                )}
              </div>
            </details>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121215] border border-white/10 w-full max-w-sm rounded-md shadow-2xl p-6">
            <h3 className="font-sans text-sm tracking-widest uppercase text-[#FF3B30] font-semibold mb-2">Confirm Deletion</h3>
            <p className="font-sans text-xs text-white/80 mb-6">
              Are you absolutely sure you want to permanently delete your account? This action cannot be undone and all your data will be erased immediately.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest bg-white/10 hover:bg-white/20 text-white rounded-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest bg-[#FF3B30] hover:bg-[#e03126] text-white rounded-sm transition-colors shadow-lg shadow-[#FF3B30]/20"
              >
                Yes, Delete My Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* theme-aware .inp-field / .btn-sm-* live in index.css */}
    </div>
  );
}

function Section({ title, icon: Icon, children, dense = false }) {
  return (
    <section className={`border border-white/10 bg-[#121212] rounded-xs ${dense ? "p-4" : "p-6"}`}>
      <h2 className={`font-mono text-xs uppercase tracking-widest text-[#FF3B30] flex items-center gap-2 ${dense ? "mb-2" : "mb-4"}`}>
        <Icon className="w-4 h-4" /> {title}
      </h2>
      <div className={dense ? "space-y-1" : "space-y-4"}>{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div className="py-1">
      <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between py-1 cursor-pointer min-h-[34px] w-full text-left"
    >
      <span className="font-mono text-sm">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[#FF3B30]" : "bg-white/20"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function QuickLink({ to, label }) {
  return (
    <Link to={to} className="flex items-center justify-between py-1.5 font-mono text-sm hover:text-[#FF3B30] transition-colors group min-h-[36px]">
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
      {(drafts.length > 0 || scheduled.length > 0) && user?.role !== "admin" && (
        <Section title="Drafts & Scheduled" icon={Monitor} dense>
          {drafts.length > 0 && (
            <>
              <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-60">Drafts</h4>
              {drafts.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1 border-b border-white/5 gap-2">
                  <span className="font-editorial text-sm truncate">{p.title || p.text || "Untitled"}</span>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => publishDraft(p.id)} className="font-mono text-[10px] text-[#34C759] uppercase">Publish</button>
                    <button type="button" onClick={() => deletePost(p.id, drafts, setDrafts)} className="font-mono text-[10px] text-[#FF3B30] uppercase">Delete</button>
                  </div>
                </div>
              ))}
            </>
          )}
          {scheduled.length > 0 && (
            <>
              <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-60 mt-4">Scheduled</h4>
              {scheduled.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1 border-b border-white/5 gap-2">
                  <div>
                    <span className="font-editorial text-sm block truncate">{p.title || p.text || "Untitled"}</span>
                    <span className="font-mono text-[9px] opacity-60 text-indigo-300 block">{new Date(p.scheduled_for).toLocaleString()}</span>
                  </div>
                  <button type="button" onClick={() => deletePost(p.id, scheduled, setScheduled)} className="font-mono text-[10px] text-[#FF3B30] uppercase shrink-0">Delete</button>
                </div>
              ))}
            </>
          )}
        </Section>
      )}

      {analytics && user?.role !== "admin" && (
        <Section title="Social Analytics" icon={Eye} dense>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
              <div key={label} className="p-2 border border-white/10 bg-black/30">
                <div className="font-mono text-[9px] uppercase tracking-widest opacity-50">{label}</div>
                <div className="font-editorial text-xl mt-0.5">{val ?? 0}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
