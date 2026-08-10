import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import { Copy, Share2, Check, Send, Users, Sparkles, ChevronLeft } from "lucide-react";
import { ThemeToaster } from "@/components/ThemeToaster";
import { Link } from "react-router-dom";
import { Nav } from "@/components/Nav";
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
      } catch (err) {
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
        // refresh status
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

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0]">
      <Nav />
      <ThemeToaster />
      <div className="pt-20 max-w-4xl mx-auto px-4 pb-16">
        {/* Header */}
        <div className="mb-8">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors font-sans text-sm mb-2">
            <ChevronLeft className="w-4 h-4" /> Back
          </Link>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 mt-2">§ Rewards</p>
          <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mt-1 mb-2">Refer & Earn</h1>
          <p className="font-sans text-white/60 text-sm max-w-lg">
            Invite your friends to CR8 Studio and earn rewards when they complete their first campaign.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-gradient-to-br from-white/10 to-transparent border border-white/10 rounded-2xl p-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-[#FF3B30]/20 blur-[100px] rounded-full pointer-events-none" />
            
            <h2 className="font-mono text-xs tracking-widest uppercase text-white/60 mb-4">Your Referral Code</h2>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
              <div className="bg-black/50 border border-white/20 px-6 py-3 rounded-xl flex-1 text-center sm:text-left">
                <span className="font-mono text-2xl md:text-3xl tracking-wider text-white">
                  {loading ? "..." : refData?.code || "CR8-CODE"}
                </span>
              </div>
              <button 
                onClick={handleCopy}
                className="w-full sm:w-auto px-6 py-3 bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white rounded-xl font-mono text-xs tracking-widest uppercase transition-colors flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="space-y-4">
              <textarea 
                className="w-full bg-black/30 border border-white/10 rounded-xl p-4 font-sans text-sm text-white/80 resize-none h-24 focus:outline-none focus:border-white/30 transition-colors"
                readOnly
                value={refData?.share_text || `Join me on CR8 Studio using my code!`}
              />
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(refData?.link || "");
                    toast.success("Link copied!");
                  }}
                  className="flex-1 py-3 border border-white/20 hover:bg-white/5 rounded-xl font-mono text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-colors"
                >
                  <Share2 className="w-4 h-4" /> Copy Link
                </button>
                <a 
                  href={`https://wa.me/?text=${encodeURIComponent(refData?.share_text || "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 bg-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/30 border border-[#25D366]/30 rounded-xl font-mono text-xs tracking-widest uppercase flex items-center justify-center gap-2 transition-colors"
                >
                  <Send className="w-4 h-4" /> WhatsApp
                </a>
              </div>
            </div>
          </motion.div>

          {/* Stats Column */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] tracking-widest uppercase text-white/50 mb-1">Total Referrals</div>
                <div className="font-sans text-2xl font-bold">{status?.summary?.total || 0}</div>
              </div>
              <Users className="w-6 h-6 text-white/20" />
            </div>
            
            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] tracking-widest uppercase text-white/50 mb-1">Potential Earnings</div>
                <div className="font-sans text-2xl font-bold text-[#FF3B30]">
                  ₹{status?.summary?.potential_reward?.toLocaleString() || 0}
                </div>
              </div>
              <Sparkles className="w-6 h-6 text-[#FF3B30]/20" />
            </div>

            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-2">
              <div className="flex justify-between mb-2">
                <span className="font-mono text-xs tracking-widest uppercase text-white/50">Qualified</span>
                <span className="font-mono text-xs text-white">{status?.summary?.qualified || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono text-xs tracking-widest uppercase text-white/50">Pending</span>
                <span className="font-mono text-xs text-white">{status?.summary?.pending || 0}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {showApply && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4"
          >
            <div>
              <h3 className="font-editorial text-xl mb-1">Were you referred by a friend?</h3>
              <p className="font-sans text-white/70 text-xs">Enter their code below to claim your sign-up bonus.</p>
            </div>
            <div className="flex w-full md:w-auto gap-2">
              <input 
                type="text"
                placeholder="Enter Code"
                value={applyCode}
                onChange={e => setApplyCode(e.target.value)}
                className="bg-black/50 border border-white/20 rounded-xl px-4 py-2 font-mono text-xs uppercase flex-1 md:w-40 focus:outline-none focus:border-[#FF3B30]"
              />
              <button
                onClick={handleApply}
                disabled={applying || !applyCode.trim()}
                className="px-5 py-2 bg-[#FF3B30] disabled:opacity-50 text-white rounded-xl font-mono text-[10px] tracking-widest uppercase transition-colors"
              >
                {applying ? "..." : "Apply"}
              </button>
            </div>
          </motion.div>
        )}

        <div className="mt-8">
          <h3 className="font-editorial text-2xl mb-4">Referral History</h3>
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-sm">
                <thead className="bg-white/5 font-mono text-xs tracking-widest uppercase text-white/50 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Joined Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {status?.referrals?.length > 0 ? (
                    status.referrals.map((ref, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-white font-medium">{ref.name || "Unknown"}</td>
                        <td className="px-6 py-4 text-white/70">{new Date(ref.joined_at || Date.now()).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                            ref.status === "rewarded" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                            ref.status === "qualified" ? "bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/30" :
                            "bg-white/10 text-white/70 border border-white/20"
                          }`}>
                            {ref.status || "pending"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-white font-mono">
                          {ref.reward ? `₹${ref.reward}` : "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-white/40 font-mono text-sm uppercase tracking-widest">
                        Share your code to start earning!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div className="mt-20">
          <h3 className="font-editorial text-3xl mb-8 text-center">How it works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Share your code", desc: "Send your unique code or referral link to friends who want to join CR8 Studio." },
              { step: "2", title: "Friend signs up", desc: "Your friend uses your code during registration or applies it after joining." },
              { step: "3", title: "You both earn", desc: "When they complete their first campaign, you both get a reward in your wallet." },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-2xl text-center">
                <div className="w-12 h-12 bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/30 rounded-full flex items-center justify-center font-editorial text-2xl mx-auto mb-4">
                  {s.step}
                </div>
                <h4 className="font-sans font-bold text-lg mb-2">{s.title}</h4>
                <p className="font-sans text-sm text-white/60">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
