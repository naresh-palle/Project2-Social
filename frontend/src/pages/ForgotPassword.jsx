import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/Nav";
import { BrandLogo } from "@/components/BrandLogo";
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
    <div
      className="min-h-screen bg-[#F6F0E6] text-[#2A201A] flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 20% 10%, rgba(169,130,74,0.12) 0%, transparent 55%), #F6F0E6",
      }}
    >
      <ThemeToaster />
      <Nav />
      <div className="flex-1 flex items-center justify-center pt-24 pb-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#FBF7F0] border border-[#D9CBB3] p-6 md:p-8 rounded-3xl shadow-[0_24px_50px_-28px_rgba(42,32,26,0.4)] relative overflow-hidden"
        >
          <div className="h-1 w-full bg-gradient-to-r from-[#A9824A] via-[#C9A26B] to-[#2A201A] absolute top-0 left-0" />
          <BrandLogo variant="wordmark" height={30} className="mb-3" />
          <p className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#A9824A] font-bold">
            Account recovery
          </p>
          <h1 className="font-editorial text-[28px] md:text-[32px] font-medium tracking-tight mt-1 leading-[1.15]">
            Forgot <span className="italic text-[#A9824A]">password?</span>
          </h1>
          <p className="mt-1.5 font-sans text-[13px] text-[#6B5D50] leading-relaxed">
            We&apos;ll email a secure reset link if an account exists for that address.
          </p>

          {sent ? (
            <div className="mt-6 p-4 bg-[#5A6B4E]/10 border border-[#5A6B4E]/30 rounded-2xl">
              <p className="font-sans text-[14px] text-[#2A201A] leading-relaxed">
                Check your inbox for a password reset link. The link expires in 1 hour.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#A9824A] hover:underline font-bold"
              >
                ← Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-5">
              {err && (
                <div className="p-2.5 bg-[#A9824A]/10 border border-[#A9824A]/35 text-[#2A201A] font-sans text-[12px] rounded-xl flex items-start gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-[#A9824A] mt-0.5" /> {err}
                </div>
              )}
              <div>
                <label className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#6B5D50] font-bold">
                  Email address
                </label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B5D50]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#F6F0E6] border border-[#D9CBB3] rounded-xl py-2.5 pl-10 pr-3 focus:outline-none focus:border-[#A9824A] focus:bg-[#FBF7F0] text-[14px] text-[#2A201A] placeholder:text-[#6B5D50]/70"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2A201A] hover:bg-[#3A2E26] text-[#F6F0E6] py-3 rounded-full font-mono text-[11px] uppercase tracking-[0.2em] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send reset link"} <ArrowRight className="w-4 h-4" />
              </button>
              <Link
                to="/login"
                className="block text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[#6B5D50] hover:text-[#A9824A] font-semibold"
              >
                ← Back to Sign In
              </Link>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
