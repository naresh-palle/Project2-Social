import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const { login, googleLogin } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const r = await login(identifier, password);
    setLoading(false);
    if (r.ok) nav("/dashboard");
    else setErr(r.error);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] relative overflow-hidden flex flex-col justify-between">
      <div className="grain" />
      
      {/* Sleek Radial Ambient Lighting Background */}
      <div 
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none opacity-20 blur-3xl" 
        style={{ background: "radial-gradient(circle, #FF3B30 0%, #7000FF 50%, transparent 80%)" }}
      />
      <div 
        className="absolute -bottom-40 right-10 w-[500px] h-[500px] rounded-full pointer-events-none opacity-15 blur-3xl" 
        style={{ background: "radial-gradient(circle, #34C759 0%, #FF3B30 60%, transparent 80%)" }}
      />

      <Nav />
      
      {/* Centered Sign In Form Container */}
      <div className="min-h-screen flex items-center justify-center pt-28 pb-16 px-6 relative z-10">
        <motion.form
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          onSubmit={submit}
          className="w-full max-w-md bg-[#121212]/90 backdrop-blur-2xl border border-white/15 p-8 md:p-12 rounded-sm shadow-2xl relative overflow-hidden"
          data-testid="login-form"
          autoComplete="off"
        >
          {/* Subtle top indicator bar */}
          <div className="h-1 w-full bg-gradient-to-r from-[#FF3B30] via-purple-500 to-[#34C759] absolute top-0 left-0" />

          <p className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
            § Studio Sign In
          </p>
          <h1 className="font-editorial text-4xl md:text-5xl mt-2 leading-[1.15]">
            Return to <span className="italic text-[#FF3B30]">the studio.</span>
          </h1>

          <div className="mt-8 space-y-6">
            <div className="flex justify-center w-full mb-6">
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  try {
                    setErr("");
                    setLoading(true);
                    const decoded = jwtDecode(credentialResponse.credential);
                    const r = await googleLogin(decoded.email);
                    setLoading(false);
                    if (r.ok) nav("/dashboard");
                    else setErr(r.error);
                  } catch (e) {
                    setLoading(false);
                    setErr("Failed to parse Google login");
                  }
                }}
                onError={() => {
                  setErr("Google Login Failed");
                }}
                theme="filled_black"
                shape="rectangular"
                text="signin_with"
                size="large"
                width="100%"
              />
            </div>

            <div className="flex items-center gap-4 opacity-60">
              <div className="h-px bg-[#F4F4F0]/20 flex-1"></div>
              <span className="font-mono text-[10px] tracking-widest uppercase">Or sign in manually</span>
              <div className="h-px bg-[#F4F4F0]/20 flex-1"></div>
            </div>

            <div>
              <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                Email, Username, or Mobile
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
                  className="absolute right-0 top-1/2 -translate-y-1/2 mt-1 p-2 opacity-60 hover:opacity-100 transition-opacity"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {err && (
              <p data-testid="login-error" className="text-[#FF3B30] font-mono text-xs tracking-widest uppercase">
                {err}
              </p>
            )}
            <button
              data-testid="login-submit"
              disabled={loading}
              type="submit"
              className="btn-solid w-full justify-center mt-4 bg-[#FF3B30] text-white hover:bg-[#e03126] transition-colors py-4 text-base"
            >
              <span>{loading ? "Verifying credentials…" : "Enter studio"}</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>

          <p className="mt-8 font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 text-center">
            New to CR8?{" "}
            <Link to="/register" className="underline hover:text-[#FF3B30] transition-colors">
              Apply for access
            </Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}
