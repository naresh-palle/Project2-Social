import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/Nav";
import { BrandLogo } from "@/components/BrandLogo";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const token = sp.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!token) {
      setErr("Invalid or missing reset token.");
      return;
    }
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      toast.success("Password updated. You can sign in now.");
      nav("/login");
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "w-full bg-[#F6F0E6] border border-[#D9CBB3] rounded-xl py-2.5 px-3 focus:outline-none focus:border-[#A9824A] focus:bg-[#FBF7F0] mt-1 text-[14px] text-[#2A201A] placeholder:text-[#6B5D50]/70";

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
            Set new password
          </p>
          <h1 className="font-editorial text-[28px] md:text-[32px] font-medium tracking-tight mt-1 leading-[1.15]">
            Reset <span className="italic text-[#A9824A]">password</span>
          </h1>

          {!token ? (
            <div className="mt-6 p-4 bg-[#A9824A]/10 border border-[#A9824A]/35 rounded-2xl font-sans text-[14px] text-[#2A201A]">
              This reset link is invalid or expired.{" "}
              <Link to="/forgot-password" className="text-[#A9824A] underline font-semibold">
                Request a new one
              </Link>
              .
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
                  New password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B5D50] mt-0.5" strokeWidth={2.35} />
                  <input
                    type={show ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${fieldClass} pl-10 pr-11`}
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#6B5D50] hover:text-[#A9824A]"
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff className="w-4 h-4" strokeWidth={2.35} /> : <Eye className="w-4 h-4" strokeWidth={2.35} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#6B5D50] font-bold">
                  Confirm password
                </label>
                <input
                  type={show ? "text" : "password"}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={fieldClass}
                  placeholder="Repeat password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2A201A] hover:bg-[#3A2E26] text-[#F6F0E6] py-3 rounded-full font-mono text-[11px] uppercase tracking-[0.2em] font-bold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? "Updating…" : "Update password"} <ArrowRight className="w-4 h-4" />
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
