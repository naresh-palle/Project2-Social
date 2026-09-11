import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/Nav";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";

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
    <div className="min-h-screen bg-[#0B1020] text-[#F7F5ED] flex flex-col">
      <ThemeToaster />
      <Nav />
      <div className="flex-1 flex items-center justify-center pt-28 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#12182A] border border-white/15 p-8 md:p-12 rounded-3xl shadow-2xl"
        >
          <div className="h-1 w-full bg-gradient-to-r from-[#FF5C5C] to-purple-500 absolute top-0 left-0" />
          <p className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">§ Account Recovery</p>
          <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight mt-2 leading-[1.15]">
            Forgot <span className="italic text-[#FF5C5C]">password?</span>
          </h1>

          {sent ? (
            <div className="mt-8 p-4 bg-[#52D4B5]/10 border border-[#52D4B5]/30 rounded-xs">
              <p className="font-mono text-sm text-[#52D4B5]">
                Check your inbox for a password reset link. The link expires in 1 hour.
              </p>
              <Link to="/login" className="inline-flex items-center gap-2 mt-4 font-mono text-xs uppercase tracking-widest text-white/70 hover:text-white">
                ← Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-6">
              {err && (
                <div className="p-3 bg-[#FF5C5C]/10 border border-[#FF5C5C]/30 text-[#FF5C5C] font-mono text-xs rounded-xs flex items-center gap-2">
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
                    className="w-full bg-transparent hairline-b py-3 pl-7 focus:outline-none focus:border-[#FF5C5C]"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF5C5C] hover:bg-[#E5484D] text-white py-4 font-mono text-xs uppercase tracking-[0.2em] font-bold flex items-center justify-center gap-2"
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
    </div>
  );
}
