import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { Search, LifeBuoy, Bot, LogOut, ShieldCheck } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { displayAccountName } from "@/lib/username";

export function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const items = [
    { to: "/dashboard", label: "Dashboard", icon: "📊" },
    { to: "/feed", label: "Feed", icon: "📰" },
    { to: "/marketplace", label: "Directory", icon: "📇" },
    { to: "/leaderboard", label: "Leaderboard", icon: "🏆" },
    ...(user?.role !== "admin" ? [
      { to: "/referrals", label: "Referrals", icon: "👥" },
      { to: "/invitations", label: "Invitations", icon: "✉️" },
    ] : []),
    { to: "/wallet", label: "Wallet", icon: "💳" },
    { to: "/profile", label: "Profile", icon: "👤" },
    { to: "/settings", label: "Settings", icon: "⚙️" },
  ];

  const handleSearch = (e) => {
    e.preventDefault();
    const q = e.target.search.value.toLowerCase();
    if (q.includes("theme") || q.includes("dark") || q.includes("light") || q.includes("setting") || q.includes("password")) nav("/settings");
    else if (q.includes("dash")) nav("/dashboard");
    else if (q.includes("profile")) nav("/profile");
    else if (q.includes("wallet") || q.includes("money") || q.includes("escrow") || q.includes("pay")) nav("/wallet");
    else if (q.includes("referral") || q.includes("invite")) nav("/referrals");
    else if (q.includes("lead") || q.includes("rank")) nav("/leaderboard");
    else if (q.includes("directory") || q.includes("find")) nav("/directory");
    else if (q.includes("feed") || q.includes("campaign")) nav("/feed");
    else if (q.includes("message") || q.includes("chat")) nav("/messages");
    else nav("/search?q=" + encodeURIComponent(q));
    e.target.search.value = "";
  };

  return (
    <motion.aside
      initial={{ x: -250, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 h-screen w-64 bg-[#0B0B0E] border-r border-white/10 flex flex-col z-50 overflow-y-auto no-scrollbar"
    >
      <div className="p-4">
        <Link 
          to="/dashboard" 
          className="flex items-center gap-2 cursor-pointer mb-5"
        >
          <span className="font-editorial italic text-2xl leading-[1.15] text-[#FF3B30]">CR</span>
          <span className="font-editorial text-2xl leading-[1.15] text-[#FF3B30]">8</span>
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 ml-2">Studio</span>
        </Link>

        {/* Profile Summary in Sidebar */}
        <div className="bg-white/5 rounded-2xl p-3 mb-5 border border-white/10 flex flex-col items-center text-center">
          <div className="relative mb-2">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-white/20 shadow-xl" />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-sans font-bold text-xl text-white border-2 border-white/20 shadow-xl"
                style={{ backgroundColor: `hsl(${((displayAccountName(user) || "CR8").charCodeAt(0) * 47) % 360}, 60%, 32%)` }}
              >
                {(displayAccountName(user) || "C")[0]?.toUpperCase()}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#34C759] border-2 border-[#0B0B0E] rounded-full"></div>
          </div>
          
          <h3 className="font-sans font-bold text-sm text-white flex items-center gap-1 justify-center leading-tight">
            {displayAccountName(user)}
            {user?.verified && <ShieldCheck className="w-3.5 h-3.5 text-[#34C759]" />}
          </h3>
          <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-[#FF3B30] mt-0.5">
            {user?.role === "admin" ? "Admin Console" : user?.role === "owner" ? "Brand Desk" : user?.role === "agent" ? "Agency Desk" : "Influencer"}
          </p>
          {(() => {
            const niches = user?.niches || user?.category;
            let category = null;
            if (Array.isArray(niches) && niches.length) {
              category = niches.filter(Boolean).slice(0, 2).join(" · ");
            } else if (typeof niches === "string" && niches.trim()) {
              category = niches.trim();
            } else if (user?.industry?.trim()) {
              category = user.industry.trim();
            }
            const city = (user?.city || user?.location || "").trim() || null;
            if (!category && !city) return null;
            return (
              <p className="font-sans text-[10px] opacity-60 mt-0.5 text-center leading-tight max-w-[180px] truncate">
                {[category, city].filter(Boolean).join(" · ")}
              </p>
            );
          })()}
          <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 mt-1.5">
            <div className="w-1 h-1 rounded-full bg-[#34C759]" />
            <span className="font-mono text-[8px] uppercase tracking-widest opacity-80">Status: Online</span>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative mb-4">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2 opacity-50 text-white" />
          <input 
            name="search"
            type="text" 
            placeholder="Search..." 
            className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-[10px] uppercase tracking-widest font-mono text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
          />
        </form>

        <nav className="flex flex-col gap-1 flex-1">
          {items.map(it => {
            const isActive = location.pathname === it.to;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`font-mono text-[10px] tracking-[0.2em] uppercase px-4 py-2.5 rounded-xl transition-colors flex items-center gap-3 ${
                  isActive 
                    ? "bg-[#FF3B30] text-white shadow-lg shadow-[#FF3B30]/20 font-bold" 
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <span className="text-base opacity-80">{it.icon}</span>
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-4 border-t border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-2">
            <Link to="/support" className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="Support">
              <LifeBuoy className="w-4 h-4" />
            </Link>
            <Link to="/help" className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors" title="AI Help">
              <Bot className="w-4 h-4" />
            </Link>
          </div>
          <NotificationBell />
        </div>
        
        <button
          onClick={() => { logout(); nav("/"); }}
          className="w-full font-mono text-[10px] tracking-[0.2em] uppercase text-[#FF3B30] hover:text-[#ff6b63] transition-colors flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </motion.aside>
  );
}
