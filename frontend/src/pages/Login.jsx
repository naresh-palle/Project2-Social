import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Smartphone, ShieldCheck, KeyRound, Loader2 } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { Nav } from "@/components/Nav";
import { BrandLogo } from "@/components/BrandLogo";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";
import { api, friendlyAuthError } from "@/lib/api";
import { postAuthPath } from "@/lib/supportOps";
import { postLoginDestination } from "@/lib/onboarding";

export default function Login() {
  const { login, googleLogin, mobileOtpLogin, user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState(location.state?.mode || "password");
  const [identifier, setIdentifier] = useState(location.state?.identifier || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(localStorage.getItem("cr8_remember_me") === "true");
  const [requires2fa, setRequires2fa] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [mobile, setMobile] = useState(location.state?.mobile || "");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (user) nav(postLoginDestination(user) || postAuthPath(user), { replace: true });
  }, [user, nav]);

  useEffect(() => {
    if (resendTimer <= 0) return undefined;
    const t = setInterval(() => setResendTimer((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendTimer]);

  const submitPassword = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setErr("");
    setLoading(true);
    const r = await login(identifier, password, { remember_me: rememberMe, totp_code: totpCode || undefined });
    setLoading(false);
    if (r.ok) {
      nav(postLoginDestination(r.user) || postAuthPath(r.user) || "/dashboard");
    } else if (r.requires_2fa) {
      setRequires2fa(true);
      setErr("");
    } else {
      const msg = friendlyAuthError(r.error);
      setErr(msg);
      toast.error(msg);
      setTotpCode("");
    }
  };

  const handleGoogleCredential = async (credential) => {
    try {
      setErr("");
      setLoading(true);
      if (!credential) {
        setLoading(false);
        setErr("Google sign-in did not return a credential");
        return;
      }
      const decoded = jwtDecode(credential);
      const r = await googleLogin(credential, { create_if_missing: true });
      setLoading(false);
      if (r.ok) {
        if (r.created) {
          toast.success("Your CR8 account has been created successfully. Complete your profile to access all features.");
        } else {
          toast.success(`Welcome back, ${decoded.name || decoded.email}!`);
        }
        nav(postLoginDestination(r.user) || postAuthPath(r.user));
      } else if (r.notRegistered) {
        toast.error("No account found for this Google email. Please register first.");
        nav("/register", {
          state: {
            fromGoogleLogin: true,
            email: decoded.email || "",
            firstName: decoded.given_name || (decoded.name ? decoded.name.split(" ")[0] : ""),
            lastName: decoded.family_name || (decoded.name ? decoded.name.split(" ").slice(1).join(" ") : ""),
          },
        });
      } else {
        const msg = friendlyAuthError(r.error || "Authentication failed");
        setErr(msg);
        toast.error(msg);
      }
    } catch (_) {
      setLoading(false);
      const msg = "Login unsuccessful. Please check your credentials and try again.";
      setErr(msg);
      toast.error(msg);
    }
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setErr("");
    const cleanMobile = (mobile || "").replace(/\D/g, "");
    if (!cleanMobile || cleanMobile.length !== 10 || !/^[6-9]\d{9}$/.test(cleanMobile)) {
      setErr("Please enter a valid 10-digit Indian mobile number (starts with 6-9)");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/mobile/send-otp", { mobile: cleanMobile });
      setOtpSent(true);
      setResendTimer(60);
      toast.success("OTP sent");
    } catch (ex) {
      const msg = friendlyAuthError(ex.response?.data?.detail || ex.message);
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    await handleSendOtp();
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const r = await mobileOtpLogin(mobile, otp, { remember_me: rememberMe });
    setLoading(false);
    if (r.ok) {
      toast.success("Signed in");
      nav(postLoginDestination(r.user) || postAuthPath(r.user));
    } else {
      const msg = friendlyAuthError(r.error);
      setErr(msg);
      toast.error(msg);
    }
  };

  const fieldClass =
    "mt-1 w-full bg-[#F6F0E6] border border-[#D9CBB3] rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#A9824A] focus:bg-[#FBF7F0] font-sans text-[14px] text-[#2A201A] placeholder:text-[#6B5D50]/70 transition-colors";
  const labelClass =
    "font-mono text-[10px] tracking-[0.22em] uppercase text-[#6B5D50] font-bold leading-none block";

  return (
    <div
      className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#F6F0E6] text-[#2A201A] relative"
      data-testid="login-page"
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 20% 10%, rgba(169,130,74,0.12) 0%, transparent 55%), radial-gradient(ellipse 55% 45% at 90% 85%, rgba(231,218,196,0.55) 0%, transparent 60%), #F6F0E6",
      }}
    >
      <Nav />
      <ThemeToaster />

      <div className="h-full overflow-y-auto overflow-x-hidden flex items-start sm:items-center justify-center pt-14 pb-4 px-3 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-md max-h-[calc(100dvh-4.5rem)] bg-[#FBF7F0] border border-[#D9CBB3] px-5 py-5 md:px-6 md:py-6 rounded-3xl shadow-[0_24px_50px_-28px_rgba(42,32,26,0.4)] relative overflow-y-auto overflow-x-hidden my-2"
        >
          <div className="h-1 w-full bg-gradient-to-r from-[#A9824A] via-[#C9A26B] to-[#2A201A] absolute top-0 left-0 rounded-t-3xl" />

          <BrandLogo variant="wordmark" height={32} className="mb-3" />
          <p className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#A9824A] font-bold">
            Sign in
          </p>
          <h1 className="font-editorial text-[28px] md:text-[32px] font-medium tracking-tight mt-1 leading-[1.15] text-[#2A201A]">
            Return to <span className="italic text-[#A9824A]">the studio</span>
          </h1>
          <p className="mt-1.5 font-sans text-[13px] text-[#6B5D50] leading-relaxed">
            Continue with Google — or use mobile / email.
          </p>

          {err && (
            <div className="mt-3 p-2.5 bg-[#A9824A]/10 border border-[#A9824A]/35 text-[#2A201A] font-sans text-[12px] rounded-xl flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-[#A9824A] mt-0.5" /> {err}
            </div>
          )}

          {/* Social first — matches Create Account pattern */}
          <div className={`mt-5 ${loading ? "pointer-events-none opacity-50" : ""}`}>
            <SocialAuthButtons
              mode="signin"
              forceMeta
              loading={loading}
              onGoogleCredential={handleGoogleCredential}
              onGoogleError={(reason) => {
                const msg =
                  reason ||
                  "Google sign-in failed. If this keeps happening, the site origin may not be authorized in Google Cloud Console.";
                setErr(msg);
                toast.error(msg);
              }}
            />
          </div>

          <div className="flex items-center gap-3 my-5 opacity-70">
            <div className="h-px bg-[#D9CBB3] flex-1" />
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#6B5D50] font-semibold">
              Or continue with mobile / email
            </span>
            <div className="h-px bg-[#D9CBB3] flex-1" />
          </div>

          <div className="flex bg-[#F6F0E6] border border-[#D9CBB3] p-1 rounded-full font-mono text-[10px] tracking-[0.14em] uppercase">
            <button
              type="button"
              onClick={() => { setMode("password"); setErr(""); }}
              className={`flex-1 py-2 flex items-center justify-center gap-1.5 rounded-full transition-all ${
                mode === "password"
                  ? "bg-[#2A201A] text-[#F6F0E6] font-bold shadow-sm"
                  : "text-[#6B5D50] hover:text-[#2A201A] font-semibold"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" /> Password
            </button>
            <button
              type="button"
              onClick={() => { setMode("otp"); setErr(""); }}
              className={`flex-1 py-2 flex items-center justify-center gap-1.5 rounded-full transition-all ${
                mode === "otp"
                  ? "bg-[#2A201A] text-[#F6F0E6] font-bold shadow-sm"
                  : "text-[#6B5D50] hover:text-[#2A201A] font-semibold"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile OTP
            </button>
          </div>

          {mode === "password" ? (
            <form onSubmit={submitPassword} className="mt-4 space-y-3.5" data-testid="login-form" id="login-form">
              <div>
                <label className={labelClass}>Email or Username</label>
                <input
                  data-testid="login-email"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={fieldClass}
                  placeholder="you@brand.com"
                />
              </div>

              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <input
                    data-testid="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${fieldClass} pr-11`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#6B5D50] hover:text-[#A9824A] transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={2.35} /> : <Eye className="w-4 h-4" strokeWidth={2.35} />}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2 gap-2">
                  <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] cursor-pointer font-semibold text-[#6B5D50]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="accent-[#A9824A] w-3.5 h-3.5"
                    />
                    Remember me
                  </label>
                  <Link
                    to="/forgot-password"
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#A9824A] hover:underline font-bold"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              {requires2fa && (
                <div>
                  <label className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#A9824A] font-bold leading-none block">
                    2FA authentication code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    className="mt-1 w-full bg-[#F6F0E6] border-2 border-[#A9824A] p-3 font-mono text-center text-[22px] tracking-[0.4em] text-[#2A201A] focus:outline-none rounded-xl"
                    placeholder="000000"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit"
                className="w-full bg-[#2A201A] hover:bg-[#3A2E26] text-[#F6F0E6] py-3 rounded-full font-mono text-[11px] uppercase tracking-[0.2em] font-bold transition-colors shadow-[0_12px_28px_-16px_rgba(42,32,26,0.55)] flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? "Authenticating…" : "Sign in to flugr"} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={!otpSent ? handleSendOtp : handleVerifyOtp} className="mt-4 space-y-3.5">
              <div>
                <label className={labelClass}>Mobile number (+91 India)</label>
                <div className="flex gap-2 mt-1">
                  <span className="bg-[#F6F0E6] border border-[#D9CBB3] px-3 py-2.5 font-mono text-[12px] flex items-center text-[#6B5D50] rounded-xl font-semibold">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    disabled={otpSent}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                    className={fieldClass}
                    placeholder="9876543210"
                  />
                </div>
              </div>

              {otpSent && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2.5">
                  <div>
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <label className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#A9824A] font-bold">
                        6-digit verification code
                      </label>
                      <span className="font-mono text-[9px] text-[#5A6B4E] bg-[#5A6B4E]/10 px-2 py-0.5 border border-[#5A6B4E]/30 tracking-wider uppercase font-bold rounded-full">
                        Sent
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      className="w-full bg-[#F6F0E6] border border-[#A9824A] py-2.5 font-mono text-center text-[22px] tracking-[0.4em] text-[#2A201A] focus:outline-none rounded-xl"
                      placeholder="123456"
                    />
                  </div>

                  <div className="flex justify-between items-center font-mono text-[10px] tracking-[0.14em] uppercase">
                    <button
                      type="button"
                      disabled={resendTimer > 0}
                      onClick={handleResendOtp}
                      className={`font-bold transition-all ${
                        resendTimer > 0 ? "text-[#6B5D50]/50 cursor-not-allowed" : "text-[#A9824A] hover:underline cursor-pointer"
                      }`}
                    >
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOtpSent(false); setOtp(""); }}
                      className="font-semibold text-[#6B5D50] hover:text-[#2A201A]"
                    >
                      Change number
                    </button>
                  </div>
                </motion.div>
              )}

              {!otpSent ? (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#2A201A] hover:bg-[#3A2E26] disabled:opacity-50 disabled:cursor-not-allowed text-[#F6F0E6] py-3 rounded-full font-mono text-[11px] uppercase tracking-[0.2em] font-bold transition-colors shadow-[0_12px_28px_-16px_rgba(42,32,26,0.55)] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…
                    </>
                  ) : (
                    "Send 6-digit OTP"
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#A9824A] hover:bg-[#96743F] text-[#F6F0E6] py-3 rounded-full font-mono text-[11px] uppercase tracking-[0.2em] font-bold transition-colors shadow-[0_12px_28px_-16px_rgba(169,130,74,0.55)] flex items-center justify-center gap-2"
                >
                  {loading ? "Verifying OTP…" : "Verify & sign in"}
                </button>
              )}
            </form>
          )}

          <div className="mt-4 pt-3 border-t border-[#D9CBB3] flex justify-between items-center font-sans text-[12px] text-[#6B5D50]">
            <Link to="/register" className="hover:text-[#A9824A] font-semibold transition-colors">
              Need an account? <span className="text-[#A9824A] font-bold">Register →</span>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
