import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import { Trophy, Coins, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Leaderboard() {
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
        setMyRank(rankRes?.data || null);
      } catch {
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
  ];

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col h-full">
      <div className="flex flex-col h-full overflow-y-auto w-full flex-1 pb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-white/10 pb-4 mb-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Rankings
            </p>
            <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight leading-none mt-1.5">Leaderboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-white/5 p-0.5 rounded-full flex border border-white/10">
              {["weekly", "monthly"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-3.5 py-1.5 rounded-full font-mono text-[10px] tracking-widest uppercase transition-all ${
                    period === p ? "bg-[#FF3B30] text-white" : "text-white/55 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {categories.map((c) => {
                const active = category === c.id;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`px-3 py-1.5 rounded-full font-mono text-[10px] tracking-widest uppercase transition-all flex items-center gap-1.5 border ${
                      active
                        ? "bg-white/10 border-white/25 text-white"
                        : "border-white/10 text-white/45 hover:text-white/80"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {myRank?.rank && (
          <div className="mb-3 px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-[9px] tracking-widest uppercase text-white/45">Your rank</span>
              <span className="font-sans text-lg font-bold text-white">#{myRank.rank}</span>
            </div>
            <div className="text-right">
              <span className="font-mono text-[9px] tracking-widest uppercase text-white/45 mr-2">Score</span>
              <span className="font-sans text-base font-bold text-[#FF3B30]">{myRank.score}</span>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {loading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-white/5 animate-pulse rounded-lg" />
            ))
          ) : data?.entries?.length > 0 ? (
            data.entries.map((entry, idx) => {
              let row = "bg-white/[0.03] border-white/8";
              let rankStyle = "text-white/40 font-mono text-sm";
              if (entry.rank === 1) {
                row = "bg-[#FFD700]/10 border-[#FFD700]/25";
                rankStyle = "text-[#FFD700] font-sans font-bold text-sm";
              } else if (entry.rank === 2) {
                row = "bg-[#C0C0C0]/10 border-[#C0C0C0]/25";
                rankStyle = "text-[#C0C0C0] font-sans font-bold text-sm";
              } else if (entry.rank === 3) {
                row = "bg-[#CD7F32]/10 border-[#CD7F32]/25";
                rankStyle = "text-[#CD7F32] font-sans font-bold text-sm";
              }

              return (
                <motion.div
                  key={entry.user_id || idx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx, 12) * 0.02 }}
                  className={`px-3 py-2 rounded-lg border flex items-center gap-3 ${row} hover:bg-white/[0.06] transition-colors`}
                >
                  <div className={`w-8 text-center shrink-0 ${rankStyle}`}>
                    {entry.rank <= 3 ? `#${entry.rank}` : entry.rank}
                  </div>

                  <div className="flex items-center justify-center w-8 h-8 rounded-full overflow-hidden border border-white/15 shrink-0">
                    {entry.avatar ? (
                      <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center font-sans font-bold text-white text-xs"
                        style={{ backgroundColor: `hsl(${((entry.name || "U").charCodeAt(0) * 47) % 360}, 60%, 32%)` }}
                      >
                        {(entry.name || "U")[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="font-sans font-semibold text-sm text-white truncate">{entry.name}</div>
                      {entry.level && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-[#FF3B30]/15 text-[#FF3B30] text-[8px] font-mono tracking-wider uppercase border border-[#FF3B30]/25">
                          L{entry.level}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-white/40 truncate">@{entry.handle || "user"}</div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-sans text-sm font-bold text-white tabular-nums">
                      {category === "top_performer"
                        ? entry.score
                        : `₹${entry.score?.toLocaleString() || entry.stats?.toLocaleString() || 0}`}
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="text-center py-14 text-white/35 font-mono text-xs uppercase tracking-widest">
              No data available for this period.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
