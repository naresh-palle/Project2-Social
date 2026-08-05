import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Smartphone, ShieldCheck, KeyRound } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { Nav } from "@/components/Nav";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";
import { api, formatApiError } from "@/lib/api";
import { ensureAppleAuth } from "@/lib/appleAuth";

export default function Login() {
  const { login, googleLogin, appleLogin, mobileOtpLogin } = useAuth();
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

  const submitPassword = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Keep focus on the password submit path — never activate Apple/Google
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      const tag = document.activeElement.getAttribute("data-testid");
      if (tag === "apple-signin-button" || tag === "google-signin-button") {
        document.activeElement.blur();
      }
    }
    setErr("");
    setLoading(true);
    const r = await login(identifier, password, { remember_me: rememberMe, totp_code: totpCode || undefined });
    setLoading(false);
    if (r.ok) nav("/dashboard");
    else if (r.requires_2fa) {
      setRequires2fa(true);
      setErr("");
    } else setErr(r.error);
  };

  const finishAppleLogin = async (token) => {
    const r = await appleLogin(token, { remember_me: rememberMe });
    setLoading(false);
    if (r.ok) {
      toast.success("Welcome back via Apple!");
      nav("/dashboard");
      return;
    }
    if (r.notRegistered) {
      let email = "";
      let firstName = "";
      let lastName = "";
      try {
        const decoded = jwtDecode(token);
        email = decoded.email || "";
        const name = decoded.name || "";
        firstName = name.split(" ")[0] || "";
        lastName = name.split(" ").slice(1).join(" ") || "";
      } catch {}
      toast.error("No account found for this Apple ID. Please register first.");
      nav("/register", {
        state: { fromAppleLogin: true, email, firstName, lastName },
      });
      return;
    }
    setErr(r.error || "Apple login failed");
  };

  const handleAppleSignIn = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setErr("");
    const ready = await ensureAppleAuth();
    if (ready && window.AppleID?.auth) {
      try {
        setLoading(true);
        const res = await window.AppleID.auth.signIn();
        const token = res?.authorization?.id_token;
        if (!token) {
          setLoading(false);
          toast.message("Apple Sign In", { description: "In progress — please use Google or password for now." });
          return;
        }
        await finishAppleLogin(token);
      } catch (err) {
        setLoading(false);
        if (err?.error !== "popup_closed_by_user") {
          toast.message("Apple Sign In", { description: "In progress — please use Google or password for now." });
        }
      }
      return;
    }
    toast.message("Apple Sign In", { description: "In progress — please use Google or password for now." });
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
      const r = await googleLogin(credential);
      setLoading(false);
      if (r.ok) {
        toast.success(`Welcome back, ${decoded.name || decoded.email}!`);
        nav("/dashboard");
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
        setErr(r.error || "Authentication failed");
      }
    } catch (_) {
      setLoading(false);
      setErr("Failed to verify Google sign in");
    }
  };

  const [resendTimer, setResendTimer] = useState(0);

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
      const check = await api.post("/auth/check", { mobile: cleanMobile });
      if (check.data?.available) {
        setErr("No account found for this mobile number. Please register first.");
        setLoading(false);
        return;
      }

      const { data } = await api.post("/auth/mobile/send-otp", { mobile: cleanMobile });
      setOtpSent(true);
      setResendTimer(60);
      toast.success(data?.message || `Verification code sent to +91 ${cleanMobile}.`);

      const interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      const detail = formatApiError(err.response?.data?.detail) || err.message || "Failed to send verification code";
      setErr(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = () => {
    if (resendTimer > 0) return;
    setOtp("");
    handleSendOtp();
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setErr("");
    if (!otp || otp.length !== 6 || /\D/.test(otp)) {
      setErr("Please enter a valid 6-digit OTP code");
      return;
    }

    setLoading(true);
    try {
      const cleanMobile = (mobile || "").replace(/\D/g, "");
      const r = await mobileOtpLogin(cleanMobile, otp, { remember_me: rememberMe });
      if (r.ok) {
        toast.success("Mobile OTP verified. Welcome back.");
        nav("/dashboard");
      } else if (r.notRegistered) {
        setErr("No account found for this mobile number. Please register first.");
      } else {
        setErr(r.error || "OTP Verification failed");
      }
    } catch (err) {
      setErr(formatApiError(err.response?.data?.detail) || err.message || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#0B0B0E] text-[#F4F4F0] relative" data-testid="login-page">
      <Nav />
      
      <div className="h-full overflow-hidden flex items-center justify-center pt-14 pb-2 px-3 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-md max-h-[calc(100dvh-4rem)] bg-[#121212] border border-white/15 px-4 py-3 md:px-5 md:py-4 rounded-sm shadow-2xl relative overflow-hidden"
        >
          <div className="h-1 w-full bg-gradient-to-r from-[#FF3B30] via-purple-500 to-[#34C759] absolute top-0 left-0" />

          <p className="font-sans text-[10px] tracking-[0.2em] uppercase opacity-60 font-semibold">
            § Studio Sign In
          </p>
          <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight mt-0.5 leading-[1.15]">
            Return to <span className="italic text-[#FF3B30]">the studio</span>
          </h1>

          {/* LOGIN METHOD SWITCHER (Password vs Mobile OTP) */}
          <div className="flex bg-white/5 border border-white/10 p-0.5 rounded-xs mt-3 font-sans text-[11px]">
            <button
              type="button"
              onClick={() => { setMode("password"); setErr(""); }}
              className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-xs transition-all ${
                mode === "password" ? "bg-[#FF3B30] text-white font-bold shadow-md" : "text-white/60 hover:text-white"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" /> Password
            </button>
            <button
              type="button"
              onClick={() => { setMode("otp"); setErr(""); }}
              className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-xs transition-all ${
                mode === "otp" ? "bg-[#FF3B30] text-white font-bold shadow-md" : "text-white/60 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile OTP
            </button>
          </div>

          {err && (
            <div className="mt-2 p-2 bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] font-sans text-[11px] rounded-xs flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> {err}
            </div>
          )}

          {mode === "password" ? (
            <>
      <ThemeToaster />
              <form onSubmit={submitPassword} className="mt-3 space-y-2.5" data-testid="login-form" id="login-form">
              <div>
                <label className="font-sans text-[10px] tracking-[0.14em] uppercase opacity-60 font-medium leading-none block">
                  Email or Username
                </label>
                <input
                  data-testid="login-email"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="mt-0.5 w-full bg-transparent hairline-b py-1.5 focus:outline-none focus:border-[#FF3B30] font-sans text-sm"
                  placeholder=""
                />
              </div>

              <div>
                <label className="font-sans text-[10px] tracking-[0.14em] uppercase opacity-60 font-medium leading-none block">
                  Password
                </label>
                <div className="relative">
                  <input
                    data-testid="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-0.5 w-full bg-transparent hairline-b py-1.5 pr-10 focus:outline-none focus:border-[#FF3B30] font-sans text-sm"
                    placeholder=""
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-[calc(50%+2px)] -translate-y-1/2 p-1.5 text-white/50 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <label className="flex items-center gap-2 font-sans text-[10px] uppercase tracking-wider cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="accent-[#FF3B30]"
                    />
                    Remember Me
                  </label>
                  <Link to="/forgot-password" className="font-sans text-[10px] uppercase tracking-wider text-[#FF3B30] hover:underline font-medium">
                    Forgot password?
                  </Link>
                </div>
              </div>

              {requires2fa && (
                <div>
                  <label className="font-sans text-[11px] tracking-[0.16em] uppercase text-[#34C759] font-semibold leading-none block">
                    2FA Authentication Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                    className="mt-1 w-full bg-black/80 border-2 border-[#34C759] p-3 font-sans text-center text-2xl tracking-[0.4em] text-[#34C759] focus:outline-none"
                    placeholder="000000"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit"
                className="w-full bg-[#FF3B30] hover:bg-[#e03126] text-white py-2.5 font-sans text-[11px] uppercase tracking-[0.18em] font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? "Authenticating..." : "Sign In to Studio"} <ArrowRight className="w-4 h-4" />
              </button>
            </form>

              {/* Social AFTER password form so Apple never steals submit focus/click */}
              <div className={`mt-3 space-y-2 ${loading ? "pointer-events-none opacity-50" : ""}`}>
                <div className="flex items-center gap-3 opacity-50">
                  <div className="h-px bg-[#F4F4F0]/20 flex-1" />
                  <span className="font-sans text-[10px] tracking-widest uppercase">Or continue with</span>
                  <div className="h-px bg-[#F4F4F0]/20 flex-1" />
                </div>
                <SocialAuthButtons
                  mode="signin"
                  loading={loading}
                  onGoogleCredential={handleGoogleCredential}
                  onGoogleError={() => setErr("Google Sign In Failed")}
                  onAppleClick={handleAppleSignIn}
                />
              </div>
            </>
          ) : (
            <form onSubmit={!otpSent ? handleSendOtp : handleVerifyOtp} className="mt-3 space-y-2.5">
              <div>
                <label className="font-sans text-[10px] tracking-[0.14em] uppercase opacity-60 font-medium leading-none block">
                  Mobile Number (+91 India)
                </label>
                <div className="flex gap-2 mt-0.5">
                  <span className="bg-white/5 border border-white/10 px-2.5 py-1.5 font-sans text-xs flex items-center text-white/60">+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    disabled={otpSent}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-transparent hairline-b py-1.5 focus:outline-none focus:border-[#FF3B30] font-sans text-sm"
                    placeholder=""
                  />
                </div>
              </div>

              {otpSent && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <label className="font-sans text-[10px] tracking-[0.14em] uppercase text-[#34C759] font-semibold">
                        6-Digit Verification Code
                      </label>
                      <span className="font-sans text-[9px] text-[#34C759] bg-[#34C759]/10 px-1.5 py-0.5 border border-[#34C759]/30 tracking-wider uppercase font-medium">
                        Sent ✓
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      autoFocus
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-black/80 border border-[#34C759] py-2 font-sans text-center text-xl tracking-[0.4em] text-[#34C759] focus:outline-none"
                      placeholder="123456"
                    />
                  </div>

                  <div className="flex justify-between items-center font-sans text-[10px]">
                    <button
                      type="button"
                      disabled={resendTimer > 0}
                      onClick={handleResendOtp}
                      className={`uppercase tracking-wider font-bold transition-all ${
                        resendTimer > 0 ? "text-white/40 cursor-not-allowed" : "text-[#007AFF] hover:underline cursor-pointer"
                      }`}
                    >
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend OTP"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setOtpSent(false); setOtp(""); }}
                      className="uppercase tracking-wider text-white/50 hover:text-white"
                    >
                      Change Number
                    </button>
                  </div>
                </motion.div>
              )}

              {!otpSent ? (
                <button
                  type="submit"
                  className="w-full bg-[#007AFF] hover:bg-[#0062cc] text-white py-2.5 font-sans text-[11px] uppercase tracking-[0.18em] font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  Send 6-Digit OTP Code
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#34C759] hover:bg-[#2fb24f] text-black py-2.5 font-sans text-[11px] uppercase tracking-[0.18em] font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {loading ? "Verifying OTP..." : "Verify & Sign In"}
                </button>
              )}
            </form>
          )}

          <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center font-sans text-[10px] opacity-60">
            <Link to="/register" className="hover:text-white">Need an account? Register here →</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}