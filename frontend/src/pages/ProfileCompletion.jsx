import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { verificationLabel, isProfileComplete, postLoginDestination } from "@/lib/onboarding";

const STEPS = [
  { id: 1, label: "Basics" },
  { id: 2, label: "Verify" },
  { id: 3, label: "Category" },
  { id: 4, label: "Details" },
  { id: 5, label: "Review" },
];

const NICHES = [
  "Fashion & Style", "Food & Cooking", "Beauty & Makeup", "Technology & Gadgets",
  "Fitness & Health", "Lifestyle & Home", "Travel & Adventure",
  "Business & Entrepreneurship", "Entertainment & Gaming", "Education & Learning", "Other",
];

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];

export default function ProfileCompletion() {
  const { role: urlRole } = useParams();
  const { user, refresh } = useAuth();
  const nav = useNavigate();

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [mobileSent, setMobileSent] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    avatar: "",
    role: "influencer",
    company: "",
    industry: "",
    company_size: "",
    niches: [],
    handle: "",
    platform: "instagram",
    agent_type: "company_agent",
    website: "",
    bio: "",
    city: "",
  });

  useEffect(() => {
    if (!user) return;
    if (isProfileComplete(user) && user.role !== "agent") {
      nav("/dashboard", { replace: true });
      return;
    }
    const role =
      (urlRole && ["owner", "influencer", "agent"].includes(urlRole) && urlRole) ||
      (["owner", "influencer", "agent"].includes(user.role) ? user.role : "influencer");
    setForm((f) => ({
      ...f,
      name: user.name || f.name,
      email: user.needs_email ? "" : (user.email || f.email),
      mobile: user.mobile || f.mobile,
      avatar: user.avatar || f.avatar,
      role,
      company: user.company || f.company,
      industry: user.industry || f.industry,
      company_size: user.company_size || f.company_size,
      niches: Array.isArray(user.niches) ? user.niches : f.niches,
      handle:
        user.handle ||
        user?.platform_metrics?.instagram?.handle ||
        f.handle,
      agent_type: user.agent_type || f.agent_type,
      website: user.website || f.website,
      bio: user.bio || f.bio,
      city: user.city || f.city,
    }));
  }, [user, urlRole, nav]);

  const progress = useMemo(() => Math.round((step / STEPS.length) * 100), [step]);

  const set = (key) => (e) => {
    const val = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: val }));
    setErr("");
  };

  const emailStatus = verificationLabel(!!user?.email_verified && !user?.needs_email);
  const mobileStatus = verificationLabel(!!user?.mobile_verified);

  const saveBasics = async () => {
    if (!form.name.trim()) throw new Error("Full name is required");
    if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) throw new Error("Valid email is required");
    if (!/^[6-9]\d{9}$/.test(String(form.mobile || "").replace(/\D/g, ""))) {
      throw new Error("Enter a valid 10-digit Indian mobile number");
    }
    const payload = {
      name: form.name.trim(),
      mobile: String(form.mobile).replace(/\D/g, "").slice(-10),
      avatar: form.avatar || undefined,
    };
    if (user?.needs_email || (user?.email || "").includes("@users.flugr.local")) {
      payload.email = form.email.trim().toLowerCase();
    }
    await api.patch("/auth/me", payload);
    await refresh();
  };

  const sendEmailOtp = async () => {
    setBusy(true);
    setErr("");
    try {
      const email = form.email.trim().toLowerCase();
      await api.post("/auth/email/send-otp", { email });
      setEmailSent(true);
      toast.success("Verification code sent to your email");
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyEmail = async () => {
    setBusy(true);
    setErr("");
    try {
      await api.post("/auth/me/email/verify-otp", { email: form.email.trim().toLowerCase(), code: emailOtp });
      toast.success("Email verified");
      await refresh();
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendMobileOtp = async () => {
    setBusy(true);
    setErr("");
    try {
      const mobile = String(form.mobile).replace(/\D/g, "").slice(-10);
      await api.patch("/auth/me", { mobile });
      await api.post("/auth/mobile/send-otp", { mobile });
      setMobileSent(true);
      toast.success("OTP sent to your mobile");
      await refresh();
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyMobile = async () => {
    setBusy(true);
    setErr("");
    try {
      const mobile = String(form.mobile).replace(/\D/g, "").slice(-10);
      await api.post("/auth/me/mobile/verify-otp", { mobile, code: mobileOtp });
      toast.success("Mobile verified");
      await refresh();
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    setErr("");
    setBusy(true);
    try {
      if (step === 1) {
        await saveBasics();
      }
      if (step === 3) {
        await api.patch("/auth/me", { role: form.role });
        await refresh();
      }
      if (step === 4) {
        const payload = { city: form.city || undefined, website: form.website || undefined, bio: form.bio || undefined };
        if (form.role === "influencer") {
          payload.niches = form.niches;
          payload.category = form.niches;
          payload.handle = form.handle ? (form.handle.startsWith("@") ? form.handle : `@${form.handle}`) : undefined;
          payload.platform_metrics = {
            ...(user?.platform_metrics || {}),
            [form.platform]: {
              ...((user?.platform_metrics || {})[form.platform] || {}),
              handle: String(form.handle || "").replace(/^@/, ""),
            },
          };
        }
        if (form.role === "owner") {
          payload.company = form.company;
          payload.industry = form.industry;
          payload.company_size = form.company_size;
        }
        if (form.role === "agent") {
          payload.company = form.company;
          payload.agent_type = form.agent_type;
          payload.industry = form.industry || undefined;
        }
        await api.patch("/auth/me", payload);
        await refresh();
      }
      setStep((s) => Math.min(5, s + 1));
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || e.message || "Could not save step");
    } finally {
      setBusy(false);
    }
  };

  const submitAll = async () => {
    setBusy(true);
    setErr("");
    try {
      const payload = {
        name: form.name.trim(),
        mobile: String(form.mobile).replace(/\D/g, "").slice(-10),
        role: form.role,
        avatar: form.avatar || undefined,
        city: form.city || undefined,
        website: form.website || undefined,
        bio: form.bio || undefined,
      };
      if (form.role === "influencer") {
        payload.niches = form.niches;
        payload.category = form.niches;
        payload.handle = form.handle ? (form.handle.startsWith("@") ? form.handle : `@${form.handle}`) : undefined;
        payload.platform = form.platform;
      }
      if (form.role === "owner") {
        payload.company = form.company;
        payload.industry = form.industry;
        payload.company_size = form.company_size;
      }
      if (form.role === "agent") {
        payload.company = form.company;
        payload.agent_type = form.agent_type;
        payload.industry = form.industry || undefined;
      }

      const { data } = await api.post("/auth/onboarding/complete", payload);
      await refresh();
      toast.success(data?.message || "Congratulations! Your CR8 profile is complete.");
      nav(postLoginDestination(data.user || user), { replace: true });
    } catch (e) {
      const detail = e.response?.data?.detail;
      if (detail && typeof detail === "object" && detail.user) {
        await refresh();
      }
      setErr(formatApiError(detail) || e.message || "Could not complete profile");
      toast.error(formatApiError(detail) || "Profile incomplete");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F6F0E6] flex items-center justify-center font-mono text-[10px] tracking-[0.3em] uppercase text-[#A9824A]">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F6F0E6] text-[#2A201A] px-4 py-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <BrandLogo variant="wordmark" height={32} />
          <button
            type="button"
            onClick={() => nav("/marketplace?tab=campaigns")}
            className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#A9824A] font-bold"
          >
            Browse Campaigns →
          </button>
        </div>

        <div className="bg-[#FBF7F0] border border-[#D9CBB3] rounded-3xl shadow-[0_24px_50px_-28px_rgba(42,32,26,0.4)] overflow-hidden relative">
          <div className="h-1 bg-[#E7DAC4]">
            <div className="h-full bg-gradient-to-r from-[#A9824A] to-[#2A201A] transition-all" style={{ width: `${progress}%` }} />
          </div>

          <div className="p-6 md:p-8">
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#A9824A] font-bold mb-2">
              Profile completion · Step {step} / {STEPS.length}
            </p>
            <h1 className="font-editorial text-[28px] md:text-[32px] leading-tight text-[#2A201A]">
              Complete your <span className="italic text-[#A9824A]">CR8</span> profile
            </h1>
            <p className="font-sans text-[13px] text-[#6B5D50] mt-2">
              Authentication alone is not enough — verify email & mobile and finish mandatory details to unlock the dashboard.
            </p>

            <div className="flex flex-wrap gap-2 mt-5">
              {STEPS.map((s) => (
                <span
                  key={s.id}
                  className={`font-mono text-[9px] tracking-[0.16em] uppercase px-2.5 py-1 rounded-full border ${
                    s.id === step
                      ? "bg-[#2A201A] text-[#F6F0E6] border-[#2A201A]"
                      : s.id < step
                        ? "bg-[#E7DAC4] text-[#2A201A] border-[#D9CBB3]"
                        : "bg-transparent text-[#6B5D50] border-[#D9CBB3]"
                  }`}
                >
                  {s.label}
                </span>
              ))}
            </div>

            {err && (
              <div className="mt-4 text-[12px] text-[#B42318] bg-[#FEF3F2] border border-[#FECDCA] rounded-xl px-3 py-2">
                {err}
              </div>
            )}

            <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
              {step === 1 && (
                <>
                  <Field label="Full name *" value={form.name} onChange={set("name")} />
                  <Field
                    label="Email address *"
                    value={form.email}
                    onChange={set("email")}
                    disabled={!!user.email_verified && !user.needs_email && !(user.email || "").includes("@users.flugr.local")}
                  />
                  <Field label="Mobile number *" value={form.mobile} onChange={set("mobile")} placeholder="10-digit Indian mobile" />
                  <Field label="Profile image URL (optional)" value={form.avatar} onChange={set("avatar")} />
                </>
              )}

              {step === 2 && (
                <>
                  <StatusRow label="Email" status={emailStatus} />
                  {!user.email_verified || user.needs_email ? (
                    <div className="space-y-2 border border-[#D9CBB3] rounded-2xl p-4 bg-[#F6F0E6]">
                      <button type="button" disabled={busy} onClick={sendEmailOtp} className="text-[12px] font-semibold text-[#A9824A]">
                        {emailSent ? "Resend email OTP" : "Send email verification code"}
                      </button>
                      <div className="flex gap-2">
                        <input
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value)}
                          maxLength={6}
                          placeholder="6-digit code"
                          className="flex-1 rounded-full border border-[#D9CBB3] bg-[#FBF7F0] px-4 py-2 text-sm"
                        />
                        <button type="button" disabled={busy || emailOtp.length < 6} onClick={verifyEmail} className="rounded-full bg-[#2A201A] text-[#F6F0E6] px-4 py-2 text-[11px] font-bold uppercase tracking-wider">
                          Verify
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <StatusRow label="Mobile" status={mobileStatus} />
                  {!user.mobile_verified ? (
                    <div className="space-y-2 border border-[#D9CBB3] rounded-2xl p-4 bg-[#F6F0E6]">
                      <button type="button" disabled={busy} onClick={sendMobileOtp} className="text-[12px] font-semibold text-[#A9824A]">
                        {mobileSent ? "Resend mobile OTP" : "Send mobile OTP"}
                      </button>
                      <div className="flex gap-2">
                        <input
                          value={mobileOtp}
                          onChange={(e) => setMobileOtp(e.target.value)}
                          maxLength={6}
                          placeholder="6-digit code"
                          className="flex-1 rounded-full border border-[#D9CBB3] bg-[#FBF7F0] px-4 py-2 text-sm"
                        />
                        <button type="button" disabled={busy || mobileOtp.length < 6} onClick={verifyMobile} className="rounded-full bg-[#2A201A] text-[#F6F0E6] px-4 py-2 text-[11px] font-bold uppercase tracking-wider">
                          Verify
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}

              {step === 3 && (
                <div className="grid gap-3">
                  {[
                    { id: "influencer", title: "Influencer", sub: "Creators & talent" },
                    { id: "owner", title: "Company", sub: "Brand / business desk" },
                    { id: "agent", title: "Agent", sub: "Agency / talent manager" },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, role: r.id }))}
                      className={`text-left rounded-2xl border px-4 py-4 transition-colors ${
                        form.role === r.id
                          ? "border-[#A9824A] bg-[#F6F0E6]"
                          : "border-[#D9CBB3] bg-[#FBF7F0] hover:border-[#A9824A]"
                      }`}
                    >
                      <div className="font-editorial text-xl text-[#2A201A]">{r.title}</div>
                      <div className="font-sans text-[12px] text-[#6B5D50]">{r.sub}</div>
                    </button>
                  ))}
                </div>
              )}

              {step === 4 && form.role === "influencer" && (
                <>
                  <label className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#6B5D50] font-bold">Primary content category *</label>
                  <div className="flex flex-wrap gap-2">
                    {NICHES.map((n) => {
                      const on = form.niches.includes(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              niches: on ? f.niches.filter((x) => x !== n) : [...f.niches, n],
                            }))
                          }
                          className={`text-[11px] px-3 py-1.5 rounded-full border ${
                            on ? "bg-[#2A201A] text-[#F6F0E6] border-[#2A201A]" : "border-[#D9CBB3] text-[#2A201A]"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                  <Field label="Instagram username / handle *" value={form.handle} onChange={set("handle")} placeholder="@username" />
                </>
              )}

              {step === 4 && form.role === "owner" && (
                <>
                  <Field label="Company name *" value={form.company} onChange={set("company")} />
                  <Field label="Industry *" value={form.industry} onChange={set("industry")} />
                  <label className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#6B5D50] font-bold">Company size</label>
                  <select
                    value={form.company_size}
                    onChange={set("company_size")}
                    className="w-full rounded-full border border-[#D9CBB3] bg-[#FBF7F0] px-4 py-2.5 text-sm"
                  >
                    <option value="">Select…</option>
                    {COMPANY_SIZES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <Field label="Business website" value={form.website} onChange={set("website")} />
                </>
              )}

              {step === 4 && form.role === "agent" && (
                <>
                  <Field label="Agency / agent name *" value={form.company} onChange={set("company")} />
                  <Field label="Industry" value={form.industry} onChange={set("industry")} />
                  <Field label="Website" value={form.website} onChange={set("website")} />
                  <Field label="City" value={form.city} onChange={set("city")} />
                </>
              )}

              {step === 5 && (
                <div className="space-y-3 text-sm">
                  <ReviewRow k="Name" v={form.name} />
                  <ReviewRow k="Email" v={form.email} badge={emailStatus.text} />
                  <ReviewRow k="Mobile" v={form.mobile} badge={mobileStatus.text} />
                  <ReviewRow k="Category" v={form.role === "owner" ? "Company" : form.role === "agent" ? "Agent" : "Influencer"} />
                  {form.role === "influencer" && (
                    <>
                      <ReviewRow k="Niches" v={(form.niches || []).join(", ") || "—"} />
                      <ReviewRow k="Handle" v={form.handle || "—"} />
                    </>
                  )}
                  {form.role === "owner" && (
                    <>
                      <ReviewRow k="Company" v={form.company || "—"} />
                      <ReviewRow k="Industry" v={form.industry || "—"} />
                    </>
                  )}
                  {form.role === "agent" && <ReviewRow k="Agency" v={form.company || "—"} />}
                  <p className="text-[12px] text-[#6B5D50] flex items-start gap-2 pt-2">
                    <ShieldCheck className="w-4 h-4 text-[#A9824A] shrink-0 mt-0.5" />
                    Submitting validates mandatory fields and email/mobile verification on the server before unlocking the dashboard.
                  </p>
                </div>
              )}
            </motion.div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={step === 1 || busy}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase font-bold text-[#6B5D50] disabled:opacity-30"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Edit previous
              </button>

              {step < 5 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={next}
                  className="inline-flex items-center gap-2 rounded-full bg-[#2A201A] text-[#F6F0E6] px-5 py-2.5 text-[11px] font-bold tracking-[0.14em] uppercase disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Continue <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={submitAll}
                  className="inline-flex items-center gap-2 rounded-full bg-[#2A201A] text-[#F6F0E6] px-5 py-2.5 text-[11px] font-bold tracking-[0.14em] uppercase disabled:opacity-60"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Submit & unlock
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-[#6B5D50] font-bold">{label}</span>
      <input
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1.5 w-full rounded-full border border-[#D9CBB3] bg-[#FBF7F0] px-4 py-2.5 text-sm text-[#2A201A] disabled:opacity-60 focus:outline-none focus:border-[#A9824A]"
      />
    </label>
  );
}

function StatusRow({ label, status }) {
  const tone =
    status.tone === "ok"
      ? "text-[#027A48] bg-[#ECFDF3] border-[#A6F4C5]"
      : status.tone === "fail"
        ? "text-[#B42318] bg-[#FEF3F2] border-[#FECDCA]"
        : "text-[#B54708] bg-[#FFFAEB] border-[#FEDF89]";
  return (
    <div className="flex items-center justify-between">
      <span className="font-sans text-sm font-semibold">{label}</span>
      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full border ${tone}`}>{status.text}</span>
    </div>
  );
}

function ReviewRow({ k, v, badge }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[#E7DAC4] pb-2">
      <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[#6B5D50] font-bold">{k}</span>
      <div className="text-right">
        <div className="font-sans text-[13px] text-[#2A201A]">{v}</div>
        {badge && <div className="font-mono text-[9px] text-[#A9824A] uppercase tracking-wider mt-0.5">{badge}</div>}
      </div>
    </div>
  );
}
