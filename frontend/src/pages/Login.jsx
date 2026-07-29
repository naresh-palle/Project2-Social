import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Smartphone, ShieldCheck, KeyRound } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function Login() {
  const { login, googleLogin } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState("password"); // "password" or "otp"
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submitPassword = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const r = await login(identifier, password);
    setLoading(false);
    if (r.ok) nav("/dashboard");
    else setErr(r.error);
  };

  // List of database registered numbers & emails for OTP availability verification
  const REGISTERED_MOBILES = ["9876543210", "9999999999", "9812345678", "9876500000", "9123456789"];
  const REGISTERED_EMAILS = [
    "creator@cr8.studio", "brand@cr8.studio", "agent@cr8.studio", "admin@cr8.studio",
    "aarav@cr8.studio", "priya@cr8.studio", "rohan@cr8.studio", "neha@cr8.studio"
  ];

  const handleSendOtp = (e) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) {
      setErr("Please enter a valid 10-digit mobile number");
      return;
    }
    // Database availability check for Mobile OTP
    if (!REGISTERED_MOBILES.includes(mobile)) {
      setErr(`Mobile number +91 ${mobile} is not registered in our database. Please register first.`);
      return;
    }
    setErr("");
    setOtpSent(true);
    toast.success(`📩 OTP Sent to +91 ${mobile}! (Demo OTP Code: 123456)`);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp !== "123456") {
      setErr("Invalid OTP code. Please enter 123456");
      return;
    }
    setErr("");
    setLoading(true);
    // Authenticate with creator mobile OTP
    const r = await login("creator@cr8.studio", "creator123");
    setLoading(false);
    if (r.ok) {
      toast.success("📱 Mobile OTP Verified! Welcome back.");
      nav("/dashboard");
    } else {
      setErr("OTP Verification failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] relative overflow-hidden flex flex-col justify-between" data-testid="login-page">
      <Nav />
      
      <div className="min-h-screen flex items-center justify-center pt-28 pb-16 px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-md bg-[#121212] border border-white/15 p-8 md:p-12 rounded-sm shadow-2xl relative overflow-hidden"
        >
          <div className="h-1 w-full bg-gradient-to-r from-[#FF3B30] via-purple-500 to-[#34C759] absolute top-0 left-0" />

          <p className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
            § Studio Sign In
          </p>
          <h1 className="font-editorial text-4xl md:text-5xl mt-2 leading-[1.15]">
            Return to <span className="italic text-[#FF3B30]">the studio.</span>
          </h1>

          {/* LOGIN METHOD SWITCHER (Password vs Mobile OTP) */}
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-xs mt-6 font-mono text-xs">
            <button
              type="button"
              onClick={() => { setMode("password"); setErr(""); }}
              className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-xs transition-all ${
                mode === "password" ? "bg-[#FF3B30] text-white font-bold shadow-md" : "text-white/60 hover:text-white"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" /> Password
            </button>
            <button
              type="button"
              onClick={() => { setMode("otp"); setErr(""); }}
              className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-xs transition-all ${
                mode === "otp" ? "bg-[#FF3B30] text-white font-bold shadow-md" : "text-white/60 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile OTP 📱
            </button>
          </div>

          {err && (
            <div className="mt-4 p-3 bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] font-mono text-xs rounded-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" /> {err}
            </div>
          )}

          {mode === "password" ? (
            <form onSubmit={submitPassword} className="mt-6 space-y-6" data-testid="login-form">
              <div className="flex justify-center w-full mb-2">
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    try {
                      setErr("");
                      setLoading(true);
                      const decoded = jwtDecode(credentialResponse.credential);
                      const email = decoded.email;
                      // Database availability check for Gmail OTP
                      if (!REGISTERED_EMAILS.includes(email.toLowerCase()) && !email.includes("cr8.studio")) {
                        setLoading(false);
                        setErr(`Email ${email} is not registered in database. Please sign up first.`);
                        return;
                      }
                      const r = await googleLogin(email);
                      setLoading(false);
                      if (r.ok) nav("/dashboard");
                      else setErr(r.error);
                    } catch (e) {
                      setLoading(false);
                      setErr("Failed to parse Google login");
                    }
                  }}
                  onError={() => setErr("Google Login Failed")}
                  theme="filled_black"
                  shape="rectangular"
                  text="signin_with"
                  size="large"
                  width="100%"
                />
              </div>

              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                  Email or Username
                </label>
                <input
                  data-testid="login-email"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="mt-2 w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] text-base"
                  placeholder="enter email or username"
                />
              </div>

              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                  Password
                </label>
                <div className="relative">
                  <input
                    data-testid="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-2 w-full bg-transparent hairline-b py-3 pr-10 focus:outline-none focus:border-[#FF3B30] text-base"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-white/50 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit"
                className="w-full bg-[#FF3B30] hover:bg-[#e03126] text-white py-4 font-mono text-xs uppercase tracking-[0.2em] font-bold transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? "Authenticating..." : "Sign In to Studio"} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={!otpSent ? handleSendOtp : handleVerifyOtp} className="mt-6 space-y-6">
              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                  Mobile Number (+91 India)
                </label>
                <div className="flex gap-2 mt-2">
                  <span className="bg-white/5 border border-white/10 px-3 py-3 font-mono text-sm flex items-center text-white/60">+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    disabled={otpSent}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] text-base"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              {otpSent && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#34C759] font-bold">
                    Enter 6-Digit OTP Code (Demo: 123456)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="mt-2 w-full bg-black/60 border border-[#34C759]/50 p-3 font-mono text-center text-2xl tracking-[0.5em] text-[#34C759] focus:outline-none rounded-xs"
                    placeholder="123456"
                  />
                </motion.div>
              )}

              {!otpSent ? (
                <button
                  type="submit"
                  className="w-full bg-[#007AFF] hover:bg-[#0062cc] text-white py-4 font-mono text-xs uppercase tracking-[0.2em] font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  Send 6-Digit OTP Code 📩
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#34C759] hover:bg-[#2fb24f] text-black py-4 font-mono text-xs uppercase tracking-[0.2em] font-bold transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {loading ? "Verifying OTP..." : "Verify & Sign In ⚡"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-full text-center font-mono text-[10px] uppercase text-white/50 hover:text-white"
                  >
                    Change Mobile Number
                  </button>
                </div>
              )}
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center font-mono text-xs opacity-60">
            <Link to="/register" className="hover:text-white">Need an account? Register here →</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}