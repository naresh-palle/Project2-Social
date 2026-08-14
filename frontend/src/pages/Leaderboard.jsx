import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {  Trophy, Medal, Star, Target, TrendingUp, DollarSign, Wallet, ShieldCheck, Search, ChevronLeft, Coins, IndianRupee , Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Leaderboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("weekly");
  const [category, setCategory] = useState("top_performer");
  const [data, setData] = useState(null);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [boardRes, rankRes] = await Promise.all([
          api.get(`/leaderboard?type=${category}&period=${period}`),
          api.get(`/leaderboard/my-rank?type=${category}&period=${period}`).catch(() => null)
        ]);
        setData(boardRes.data);
        if (rankRes && rankRes.data) {
          setMyRank(rankRes.data);
        } else {
          setMyRank(null);
        }
      } catch (err) {
        toast.error("Failed to load leaderboard");
        setData({ entries: [] });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [category, period]);

  const categories = [
    { id: "top_performer", label: "Top Performer", icon: Trophy },
    { id: "top_earner", label: "Top Earner", icon: Coins },
    { id: "top_spender", label: "Top Spender", icon: IndianRupee },
  ];

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0]">
      
      
      <div className="flex flex-col h-full overflow-y-auto w-full flex-1">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-6 mb-8">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> § Rankings
            </p>
            <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight leading-none mt-2">Leaderboard</h1>
          </div>
        </div>

          
          <div className="flex justify-start mb-8">
            <div className="bg-white/5 p-1 rounded-full flex border border-white/10">
              {["weekly", "monthly"].map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-6 py-2 rounded-full font-mono text-sm tracking-widest uppercase transition-all ${period === p ? "bg-[#FF3B30] text-white shadow-lg" : "text-white/60 hover:text-white"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap justify-start gap-2 relative">
            {categories.map(c => {
              const active = category === c.id;
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`relative px-6 py-3 rounded-full font-mono text-sm tracking-widest uppercase transition-all flex items-center gap-2 ${active ? "text-white" : "text-white/50 hover:text-white/80"}`}
                >
                  {active && (
                    <motion.div
                      layoutId="cat-indicator"
                      className="absolute inset-0 bg-white/10 border border-white/20 rounded-full"
                    />
                  )}
                  <Icon className="w-4 h-4 z-10" />
                  <span className="z-10">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {myRank && myRank.rank && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex items-center justify-between"
          >
            <div>
              <div className="font-mono text-xs tracking-widest uppercase text-white/50 mb-1">Your Rank</div>
              <div className="font-editorial text-4xl text-white">#{myRank.rank}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-xs tracking-widest uppercase text-white/50 mb-1">Score</div>
              <div className="font-sans text-2xl font-bold text-[#FF3B30]">{myRank.score}</div>
            </div>
          </motion.div>
        )}

        <div className="space-y-3">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl" />
            ))
          ) : data?.entries?.length > 0 ? (
            data.entries.map((entry, idx) => {
              let bg = "bg-white/5";
              let rankStyle = "text-white/40 font-mono";
              
              if (entry.rank === 1) {
                bg = "bg-gradient-to-r from-[#FFD700]/20 to-transparent border border-[#FFD700]/30";
                rankStyle = "text-[#FFD700] text-3xl";
              } else if (entry.rank === 2) {
                bg = "bg-gradient-to-r from-[#C0C0C0]/20 to-transparent border border-[#C0C0C0]/30";
                rankStyle = "text-[#C0C0C0] text-3xl";
              } else if (entry.rank === 3) {
                bg = "bg-gradient-to-r from-[#CD7F32]/20 to-transparent border border-[#CD7F32]/30";
                rankStyle = "text-[#CD7F32] text-3xl";
              }

              return (
                <motion.div
                  key={entry.user_id || idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-4 rounded-xl flex items-center gap-6 ${bg} hover:bg-white/10 transition-colors`}
                >
                  <div className={`w-12 text-center font-editorial italic ${rankStyle}`}>
                    {entry.rank <= 3 ? `#${entry.rank}` : entry.rank}
                  </div>
                  
                  <div className="flex items-center justify-center w-12 h-12 rounded-full overflow-hidden border border-white/20 shrink-0">
                    {entry.avatar ? (
                      <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                    ) : (
                      <div 
                        className="w-full h-full flex items-center justify-center font-sans font-bold text-white text-lg"
                        style={{ backgroundColor: `hsl(${((entry.name || "U").charCodeAt(0) * 47) % 360}, 60%, 32%)` }}
                      >
                        {(entry.name || "U")[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-sans font-bold text-lg text-white truncate">{entry.name}</div>
                      {entry.level && (
                        <span className="px-2 py-0.5 rounded-full bg-[#FF3B30]/20 text-[#FF3B30] text-[10px] font-mono tracking-wider uppercase border border-[#FF3B30]/30">
                          Lvl {entry.level}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-white/50 truncate">@{entry.handle || "user"}</div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-sans text-xl font-bold text-white">
                      {category === "top_performer" ? entry.score : `₹${entry.score?.toLocaleString() || entry.stats?.toLocaleString() || 0}`}
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="text-center py-20 text-white/40 font-mono text-sm uppercase tracking-widest">
              No data available for this period.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
