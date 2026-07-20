import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
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

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const r = await login(identifier, password);
    setLoading(false);
    if (r.ok) nav(location.state?.from || "/dashboard");
    else setErr(r.error);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 pt-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="relative overflow-hidden hidden md:block hairline-r"
        >
          <img
            src="https://images.pexels.com/photos/11264890/pexels-photo-11264890.jpeg"
            alt="Studio"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[#0A0A0A]/40" />
          <div className="absolute bottom-10 left-10 right-10 font-editorial">
            <p className="italic text-3xl leading-tight">
              &ldquo;We built a studio where owners fund culture, not clout.&rdquo;
            </p>
            <p className="mt-4 font-mono text-[10px] tracking-[0.3em] uppercase opacity-70">
              — CR8 Editorial
            </p>
          </div>
        </motion.div>

        <div className="flex items-center justify-center px-6 md:px-16 py-12">
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            onSubmit={submit}
            className="w-full max-w-md"
            data-testid="login-form"
          >
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              § Sign in
            </p>
            <h1 className="font-editorial text-6xl mt-3 leading-[1.15]">
              Return to <span className="italic">the studio.</span>
            </h1>

            <div className="mt-10 space-y-6">
              <div className="flex justify-center w-full mb-8">
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    try {
                      setErr("");
                      setLoading(true);
                      const decoded = jwtDecode(credentialResponse.credential);
                      const r = await googleLogin(decoded.email);
                      setLoading(false);
                      if (r.ok) nav(location.state?.from || "/dashboard");
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
                  className="mt-2 w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] text-lg"
                  placeholder=""
                />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                  Password
                </label>
                <input
                  data-testid="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] text-lg"
                  placeholder=""
                />
              </div>
              {err && (
                <p data-testid="login-error" className="text-[#FF3B30] font-mono text-xs tracking-widest uppercase">
                  {err}
                </p>
              )}
              <button
                data-testid="login-submit"
                disabled={loading}
                className="btn-solid w-full justify-center"
              >
                {loading ? "Signing in…" : <>Sign in <ArrowRight className="w-4 h-4" /></>}
              </button>
              <p className="font-mono text-[11px] tracking-[0.2em] uppercase opacity-60">
                New to CR8?{" "}
                <Link to="/register" className="kinetic-underline text-[#FF3B30]" data-testid="link-to-register">
                  Enter the studio →
                </Link>
              </p>
            </div>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
