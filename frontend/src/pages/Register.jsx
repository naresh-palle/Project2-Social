import { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { Nav } from "@/components/Nav";
import { BrandLogo } from "@/components/BrandLogo";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";
import { postLoginDestination } from "@/lib/onboarding";

/**
 * Category registration (after splash door).
 * Only: Instagram / Facebook / Google + username + mobile.
 */
export default function Register() {
  const { googleLogin, usernameMobileRegister } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const { role: urlRole } = useParams();

  const role = ["owner", "influencer"].includes(urlRole) ? urlRole : "influencer";

  useEffect(() => {
    if (urlRole === "production") {
      toast.error("Hire / Production teams can only be created by Admin");
      nav("/register", { replace: true });
    } else if (urlRole === "agent") {
      toast.error("Agent registration is not open yet");
      nav("/register", { replace: true });
    }
  }, [urlRole, nav]);

  const prefill = location.state?.fromGoogleLogin ? location.state : null;
  const [username, setUsername] = useState(
    prefill?.email ? prefill.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() : ""
  );
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [usernameStatus, setUsernameStatus] = useState("typing");
  const [mobileStatus, setMobileStatus] = useState("typing");
  const [fieldErrors, setFieldErrors] = useState({});
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const p = location.state?.fromGoogleLogin ? location.state : null;
    setUsername(p?.email ? p.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() : "");
    setMobile("");
    setOtp("");
    setFieldErrors({});
    setErr("");
  }, [urlRole, location.state]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    const u = username.trim().toLowerCase();
    if (u.length < 3) {
      setUsernameStatus("typing");
      return undefined;
    }
    if (!/^[a-z0-9_]{3,30}$/.test(u)) {
      setFieldErrors((e) => ({ ...e, username: "3–30 chars: letters, numbers, underscore" }));
      setUsernameStatus("typing");
      return undefined;
    }
    const t = setTimeout(async () => {
      setUsernameStatus("checking");
      try {
        const res = await api.post("/auth/check", { username: u });
        setUsernameStatus(res.data.available ? "available" : "taken");
        setFieldErrors((e) => ({ ...e, username: res.data.available ? "" : "Username taken" }));
      } catch {
        setUsernameStatus("typing");
      }
    }, 450);
    return () => clearTimeout(t);
  }, [username]);

  useEffect(() => {
    const clean = (mobile || "").replace(/\D/g, "");
    if (!mobile) {
      setMobileStatus("typing");
      setFieldErrors((e) => ({ ...e, mobile: "" }));
      return undefined;
    }
    if (!/^[6-9]\d{9}$/.test(clean)) {
      setFieldErrors((e) => ({ ...e, mobile: "10-digit Indian mobile starting 6–9" }));
      setMobileStatus("typing");
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.post("/auth/check", { mobile: clean });
        setMobileStatus(res.data.available ? "available" : "taken");
        setFieldErrors((e) => ({ ...e, mobile: res.data.available ? "" : "Mobile already registered" }));
      } catch {
        setMobileStatus("available");
      }
    }, 450);
    return () => clearTimeout(t);
  }, [mobile]);

  const roleLabel = role === "owner" ? "a Brand" : "an Influencer";

  const handleGoogleCredential = async (credential) => {
    try {
      setLoading(true);
      setErr("");
      const decoded = jwtDecode(credential);
      const r = await googleLogin(credential, { create_if_missing: true, role });
      setLoading(false);
      if (r.ok) {
        toast.success(
          r.created
            ? "Account created. Complete your profile to unlock the dashboard."
            : `Welcome, ${decoded.name || decoded.email}!`
        );
        nav(postLoginDestination(r.user));
      } else {
        setErr(r.error || "Google sign-up failed");
        toast.error(r.error || "Google sign-up failed");
      }
    } catch (_) {
      setLoading(false);
      setErr("Google sign-up failed");
    }
  };

  const startSignup = async (e) => {
    e.preventDefault();
    setErr("");
    const u = username.trim().toLowerCase();
    const m = mobile.replace(/\D/g, "");
    if (!/^[a-z0-9_]{3,30}$/.test(u)) {
      setErr("Enter a valid username");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(m)) {
      setErr("Enter a valid mobile number");
      return;
    }
    if (usernameStatus === "taken" || mobileStatus === "taken") {
      setErr("Username or mobile is already registered");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/mobile/send-otp", { mobile: m });
      setShowOtpModal(true);
      setResendCooldown(60);
      toast.success("OTP sent to your mobile");
    } catch (ex) {
      setErr(formatApiError(ex.response?.data?.detail) || ex.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyAndRegister = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setOtpError("Enter the 6-digit OTP");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      const r = await usernameMobileRegister({
        username: username.trim().toLowerCase(),
        mobile: mobile.replace(/\D/g, ""),
        otp,
        role,
        name: username.trim(),
      });
      setOtpLoading(false);
      if (r.ok) {
        toast.success("Account created. Complete your profile next.");
        nav(postLoginDestination(r.user) || `/onboarding/${role}`);
      } else {
        setOtpError(r.error || "Registration failed");
      }
    } catch (ex) {
      setOtpLoading(false);
      setOtpError(formatApiError(ex.response?.data?.detail) || ex.message);
    }
  };

  const fieldClass =
    "mt-1 w-full bg-[#F6F0E6] border border-[#D9CBB3] rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#A9824A] focus:bg-[#FBF7F0] font-sans text-[14px] text-[#2A201A] placeholder:text-[#6B5D50]/70";

  return (
    <div
      className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#F6F0E6] text-[#2A201A] relative"
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 20% 10%, rgba(169,130,74,0.12) 0%, transparent 55%), #F6F0E6",
      }}
    >
      <Nav />
      <ThemeToaster />

      <div className="h-full overflow-y-auto flex items-start sm:items-center justify-center pt-14 pb-4 px-3 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#FBF7F0] border border-[#D9CBB3] px-5 py-5 md:px-6 md:py-6 rounded-3xl shadow-[0_24px_50px_-28px_rgba(42,32,26,0.4)] relative my-2"
        >
          <div className="h-1 w-full bg-gradient-to-r from-[#A9824A] via-[#C9A26B] to-[#2A201A] absolute top-0 left-0 rounded-t-3xl" />

          <div className="flex items-center justify-between mb-3 gap-3">
            <BrandLogo variant="mark" height={28} alt="flugr" className="shrink-0" />
            <Link
              to="/register"
              className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#6B5D50] hover:text-[#A9824A] font-semibold"
            >
              ← Change category
            </Link>
          </div>

          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#A9824A] font-bold">Sign up</p>
          <h1 className="font-editorial text-[26px] md:text-[30px] leading-tight text-[#2A201A] mt-1">
            Register as <span className="italic text-[#A9824A]">{roleLabel}</span>
          </h1>

          <div className="mt-4">
            <SocialAuthButtons
              mode="signup"
              role={role}
              showMeta
              forceMeta
              loading={loading}
              onGoogleCredential={handleGoogleCredential}
              onGoogleError={(reason) => {
                setErr(reason || "Google sign-up failed");
                toast.error(reason || "Google sign-up failed");
              }}
            />
          </div>

          <div className="flex items-center gap-3 my-5 opacity-70">
            <div className="h-px bg-[#D9CBB3] flex-1" />
            <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#6B5D50] font-semibold">
              Or username + mobile
            </span>
            <div className="h-px bg-[#D9CBB3] flex-1" />
          </div>

          {err && (
            <div className="mb-3 p-2.5 bg-[#A9824A]/10 border border-[#A9824A]/35 text-[12px] rounded-xl flex gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#A9824A] shrink-0 mt-0.5" /> {err}
            </div>
          )}

          <form onSubmit={startSignup} className="space-y-3.5" data-testid={`register-form-${role}`}>
            <div>
              <label className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#6B5D50] font-bold">
                Username
              </label>
              <input
                data-testid="reg-username"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, "").toLowerCase())}
                className={fieldClass}
                placeholder="your_handle"
                required
                minLength={3}
                maxLength={30}
              />
              {fieldErrors.username && (
                <p className="text-[11px] text-[#B42318] mt-1">{fieldErrors.username}</p>
              )}
            </div>

            <div>
              <label className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#6B5D50] font-bold">
                Mobile number
              </label>
              <div className="flex gap-2 mt-1">
                <span className="bg-[#F6F0E6] border border-[#D9CBB3] px-3 py-2.5 font-mono text-[12px] rounded-xl text-[#6B5D50] font-semibold">
                  +91
                </span>
                <input
                  data-testid="reg-mobile"
                  type="tel"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                  className={fieldClass + " mt-0"}
                  placeholder="9876543210"
                  required
                />
              </div>
              {fieldErrors.mobile && (
                <p className="text-[11px] text-[#B42318] mt-1">{fieldErrors.mobile}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2A201A] hover:bg-[#3A2E26] text-[#F6F0E6] py-3 rounded-full font-mono text-[11px] uppercase tracking-[0.2em] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Continue with OTP <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-4 pt-3 border-t border-[#D9CBB3] font-sans text-[12px] text-[#6B5D50]">
            Already have an account?{" "}
            <Link to="/login" className="text-[#A9824A] font-bold hover:underline">
              Sign in →
            </Link>
          </p>
        </motion.div>
      </div>

      <AnimatePresence>
        {showOtpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#2A201A]/45 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.form
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onSubmit={verifyAndRegister}
              className="w-full max-w-sm bg-[#FBF7F0] border border-[#D9CBB3] rounded-3xl p-6 shadow-xl"
            >
              <h2 className="font-editorial text-2xl text-[#2A201A]">Verify mobile</h2>
              <p className="font-sans text-[13px] text-[#6B5D50] mt-1">
                Enter the 6-digit code sent to +91 {mobile}
              </p>
              {otpError && <p className="text-[12px] text-[#B42318] mt-2">{otpError}</p>}
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="mt-4 w-full bg-[#F6F0E6] border border-[#A9824A] rounded-xl py-3 font-mono text-center text-[22px] tracking-[0.4em]"
                placeholder="000000"
                autoFocus
              />
              <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-wider">
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={async () => {
                    try {
                      await api.post("/auth/mobile/resend-otp", { mobile: mobile.replace(/\D/g, "") });
                      setResendCooldown(60);
                      toast.success("OTP resent");
                    } catch (ex) {
                      setOtpError(formatApiError(ex.response?.data?.detail) || ex.message);
                    }
                  }}
                  className={resendCooldown > 0 ? "text-[#6B5D50]/50" : "text-[#A9824A] font-bold"}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                </button>
                <button type="button" onClick={() => setShowOtpModal(false)} className="text-[#6B5D50]">
                  Cancel
                </button>
              </div>
              <button
                type="submit"
                disabled={otpLoading}
                className="mt-4 w-full bg-[#2A201A] text-[#F6F0E6] py-3 rounded-full font-mono text-[11px] uppercase tracking-[0.2em] font-bold disabled:opacity-60"
              >
                {otpLoading ? "Creating account…" : "Verify & create account"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
