import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import {
  Copy, Share2, Send, Check, Users, Sparkles, Gift, Clock, BadgeCheck
} from "lucide-react";
import { AiIcon } from "@/components/AiIcon";
import { toast } from "sonner";

export default function Referrals() {
  const { user } = useAuth();
  const [refData, setRefData] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [codeRes, statusRes] = await Promise.all([
          api.get("/referrals/my-code").catch(() => null),
          api.get("/referrals/status").catch(() => null)
        ]);
        if (codeRes?.data) setRefData(codeRes.data);
        if (statusRes?.data) setStatus(statusRes.data);
      } catch {
        toast.error("Failed to load referral data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCopy = () => {
    if (refData?.code) {
      navigator.clipboard.writeText(refData.code);
      setCopied(true);
      toast.success("Code copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApply = async () => {
    if (!applyCode.trim()) return;
    setApplying(true);
    try {
      const res = await api.post("/referrals/apply", { code: applyCode.trim() });
      if (res.data?.ok) {
        toast.success("Referral code applied successfully!");
        setApplyCode("");
        const statusRes = await api.get("/referrals/status");
        if (statusRes?.data) setStatus(statusRes.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to apply code");
    } finally {
      setApplying(false);
    }
  };

  const showApply = status?.referrals?.length === 0 && user?.role !== "referrer";
  const summary = status?.summary || {};

  const stats = [
    { label: "Referrals", value: summary.total || 0, icon: Users, accent: "text-white" },
    { label: "Qualified", value: summary.qualified || 0, icon: BadgeCheck, accent: "text-[#34C759]" },
    { label: "Pending", value: summary.pending || 0, icon: Clock, accent: "text-white/80" },
    { label: "Potential", value: `₹${Number(summary.potential_reward || 0).toLocaleString()}`, icon: Gift, accent: "text-[#FF3B30]" },
  ];

  return (
    <div className="w-full bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      <div className="flex flex-col w-full pb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-4 mb-5 pr-20">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
              <AiIcon name="sparkles" className="w-3.5 h-3.5" /> Referrals
            </p>
            <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight leading-none mt-1.5">
              Refer & Earn
            </h1>
            <p className="font-sans text-white/55 text-sm mt-2 max-w-md">
              Share your code. Earn when friends complete their first campaign.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {stats.map(({ label, value, icon: Icon, accent }) => (
            <div
              key={label}
              className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-mono text-[9px] tracking-widest uppercase text-white/45 mb-1">{label}</div>
                <div className={`font-sans text-xl font-bold truncate ${accent}`}>
                  {loading ? "—" : value}
                </div>
              </div>
              <Icon className={`w-5 h-5 shrink-0 opacity-30 ${accent}`} />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-5">
          {/* Code + share */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="xl:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#FF3B30]/15 blur-[80px] rounded-full pointer-events-none" />
            <h2 className="font-mono text-[10px] tracking-widest uppercase text-white/50 mb-3 relative">
              Your referral code
            </h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mb-4 relative">
              <div className="bg-black/40 border border-white/15 px-4 py-3 rounded-xl flex-1 text-center sm:text-left">
                <span className="font-mono text-xl md:text-2xl tracking-[0.18em] text-white font-semibold">
                  {loading ? "…" : refData?.code || "CR8-CODE"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="px-5 py-3 bg-[#FF3B30] hover:bg-[#e03126] text-white rounded-xl font-mono text-[10px] tracking-widest uppercase transition-colors flex items-center justify-center gap-2 shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy code"}
              </button>
            </div>

            <textarea
              className="w-full bg-black/30 border border-white/10 rounded-xl p-3 font-sans text-xs text-white/75 resize-none h-20 focus:outline-none focus:border-white/25 transition-colors mb-3 relative"
              readOnly
              value={refData?.share_text || "Join me on CR8 Studio using my code!"}
            />

            <div className="flex flex-col sm:flex-row gap-2.5 relative">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(refData?.link || "");
                  toast.success("Link copied!");
                }}
                className="flex-1 py-2.5 border border-white/15 hover:bg-white/5 rounded-xl font-mono text-[10px] tracking-widest uppercase flex items-center justify-center gap-2 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" /> Copy link
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(refData?.share_text || "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 border border-[#25D366]/25 rounded-xl font-mono text-[10px] tracking-widest uppercase flex items-center justify-center gap-2 transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> WhatsApp
              </a>
            </div>
          </motion.div>

          {/* How it works + apply */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="xl:col-span-2 space-y-3"
          >
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 h-full">
              <h3 className="font-mono text-[10px] tracking-widest uppercase text-white/50 mb-3">How it works</h3>
              <ol className="space-y-3">
                {[
                  { title: "Share your code", desc: "Send your link to friends joining CR8." },
                  { title: "They sign up", desc: "They apply your code at registration." },
                  { title: "You both earn", desc: "Reward hits your wallet after first campaign." },
                ].map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="w-7 h-7 rounded-full bg-[#FF3B30]/15 border border-[#FF3B30]/30 text-[#FF3B30] font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <div className="font-sans text-sm font-semibold text-white leading-tight">{s.title}</div>
                      <p className="font-sans text-xs text-white/50 mt-0.5 leading-snug">{s.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {showApply && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="font-sans text-xs text-white/60 mb-2">Have a friend’s code?</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter code"
                      value={applyCode}
                      onChange={(e) => setApplyCode(e.target.value)}
                      className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 font-mono text-xs uppercase flex-1 focus:outline-none focus:border-[#FF3B30]"
                    />
                    <button
                      type="button"
                      onClick={handleApply}
                      disabled={applying || !applyCode.trim()}
                      className="px-4 py-2 bg-[#FF3B30] disabled:opacity-50 text-white rounded-xl font-mono text-[10px] tracking-widest uppercase"
                    >
                      {applying ? "…" : "Apply"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* History */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-sans text-lg font-bold tracking-tight">Referral history</h3>
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
              {status?.referrals?.length || 0} total
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-sm">
                <thead className="bg-white/[0.04] font-mono text-[10px] tracking-widest uppercase text-white/45 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {status?.referrals?.length > 0 ? (
                    status.referrals.map((ref, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{ref.name || "Unknown"}</td>
                        <td className="px-4 py-3 text-white/60">
                          {new Date(ref.joined_at || Date.now()).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                              ref.status === "rewarded"
                                ? "bg-green-500/15 text-green-400 border border-green-500/25"
                                : ref.status === "qualified"
                                  ? "bg-[#FF3B30]/15 text-[#FF3B30] border border-[#FF3B30]/25"
                                  : "bg-white/8 text-white/65 border border-white/15"
                            }`}
                          >
                            {ref.status || "pending"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-white font-mono text-xs">
                          {ref.reward ? `₹${ref.reward}` : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-10 text-center text-white/35 font-mono text-xs uppercase tracking-widest">
                        Share your code to start earning
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
