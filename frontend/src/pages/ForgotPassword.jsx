import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
      toast.success("If an account exists, a reset link has been sent.");
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      <Nav />
      <div className="flex-1 flex items-center justify-center pt-28 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#121212] border border-white/15 p-8 md:p-12 rounded-sm shadow-2xl"
        >
          <div className="h-1 w-full bg-gradient-to-r from-[#FF3B30] to-purple-500 absolute top-0 left-0" />
          <p className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">§ Account Recovery</p>
          <h1 className="font-editorial text-4xl mt-2 leading-[1.15]">
            Forgot <span className="italic text-[#FF3B30]">password?</span>
          </h1>

          {sent ? (
            <div className="mt-8 p-4 bg-[#34C759]/10 border border-[#34C759]/30 rounded-xs">
              <p className="font-mono text-sm text-[#34C759]">
                Check your inbox for a password reset link. The link expires in 1 hour.
              </p>
              <Link to="/login" className="inline-flex items-center gap-2 mt-4 font-mono text-xs uppercase tracking-widest text-white/70 hover:text-white">
                ← Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-6">
              {err && (
                <div className="p-3 bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] font-mono text-xs rounded-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" /> {err}
                </div>
              )}
              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Email Address</label>
                <div className="relative mt-2">
                  <Mail className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent hairline-b py-3 pl-7 focus:outline-none focus:border-[#FF3B30]"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF3B30] hover:bg-[#e03126] text-white py-4 font-mono text-xs uppercase tracking-[0.2em] font-bold flex items-center justify-center gap-2"
              >
                {loading ? "Sending…" : "Send Reset Link"} <ArrowRight className="w-4 h-4" />
              </button>
              <Link to="/login" className="block text-center font-mono text-xs opacity-60 hover:text-white">
                ← Back to Sign In
              </Link>
            </form>
          )}
        </motion.div>
      </div>
      <Footer />
    </div>
  );
}
