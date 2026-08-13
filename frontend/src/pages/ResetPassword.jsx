import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import { Nav } from "@/components/Nav";
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

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      <ThemeToaster />
      <Nav />
      <div className="flex-1 flex items-center justify-center pt-28 pb-16 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#121212] border border-white/15 p-8 md:p-12 rounded-3xl shadow-2xl"
        >
          <p className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">§ Set New Password</p>
          <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight mt-2 leading-[1.15]">
            Reset <span className="italic text-[#FF3B30]">password</span>
          </h1>

          {!token ? (
            <div className="mt-8 p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-xs font-mono text-sm">
              This reset link is invalid or expired.{" "}
              <Link to="/forgot-password" className="text-[#FF3B30] underline">Request a new one</Link>.
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-6">
              {err && (
                <div className="p-3 bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] font-mono text-xs rounded-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" /> {err}
                </div>
              )}
              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">New Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 mt-1" />
                  <input
                    type={show ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent hairline-b py-3 pl-7 pr-10 focus:outline-none focus:border-[#FF3B30] mt-2"
                  />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-white/50">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Confirm Password</label>
                <input
                  type={show ? "text" : "password"}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] mt-2"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#FF3B30] hover:bg-[#e03126] text-white py-4 font-mono text-xs uppercase tracking-[0.2em] font-bold flex items-center justify-center gap-2"
              >
                {loading ? "Updating…" : "Update Password"} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
