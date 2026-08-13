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
      <div className="p-6">
        <Link 
          to="/dashboard" 
          className="flex items-center gap-2 cursor-pointer mb-8"
        >
          <span className="font-editorial italic text-2xl leading-[1.15] text-[#FF3B30]">CR</span>
          <span className="font-editorial text-2xl leading-[1.15] text-[#FF3B30]">8</span>
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 ml-2">Studio</span>
        </Link>

        {/* Profile Summary in Sidebar */}
        <div className="bg-white/5 rounded-2xl p-4 mb-8 border border-white/10 flex flex-col items-center text-center">
          <div className="relative mb-3">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-white/20 shadow-xl" />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center font-sans font-bold text-2xl text-white border-2 border-white/20 shadow-xl"
                style={{ backgroundColor: `hsl(${((displayAccountName(user) || "CR8").charCodeAt(0) * 47) % 360}, 60%, 32%)` }}
              >
                {(displayAccountName(user) || "C")[0]?.toUpperCase()}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-[#34C759] border-2 border-[#0B0B0E] rounded-full"></div>
          </div>
          
          <h3 className="font-sans font-bold text-sm text-white flex items-center gap-1 justify-center">
            {displayAccountName(user)}
            {user?.verified && <ShieldCheck className="w-3.5 h-3.5 text-[#34C759]" />}
          </h3>
          <p className="font-mono text-[9px] tracking-widest uppercase opacity-60 mt-1">
            {user?.role === "admin" ? "Admin Console" : user?.role === "owner" ? "Brand Desk" : user?.role === "agent" ? "Agency Desk" : "Influencer"}
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative mb-8">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 opacity-50 text-white" />
          <input 
            name="search"
            type="text" 
            placeholder="Search..." 
            className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-2 text-[10px] uppercase tracking-widest font-mono text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
          />
        </form>

        <nav className="flex flex-col gap-2 flex-1">
          {items.map(it => {
            const isActive = location.pathname === it.to;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`font-mono text-[10px] tracking-[0.2em] uppercase px-4 py-3 rounded-xl transition-colors flex items-center gap-3 ${
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

      <div className="mt-auto p-6 border-t border-white/10">
        <div className="flex items-center justify-between mb-4">
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
          className="w-full font-mono text-[10px] tracking-[0.2em] uppercase text-[#FF3B30] hover:text-[#ff6b63] transition-colors flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </motion.aside>
  );
}
