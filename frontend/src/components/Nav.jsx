import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, LifeBuoy, Bot, MessageSquare, Search } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { displayAccountName } from "@/lib/username";

export function Nav({ variant = "dark" }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const isPaper = variant === "paper";

  const timeoutRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 250);
  };

  const items = user
    ? [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/leaderboard", label: "Leaderboard" },
        ...(user?.role !== "admin" ? [
          { to: "/referrals", label: "Referrals" },
          { to: "/invitations", label: "Invitations" },
        ] : []),
        { to: "/wallet", label: "Wallet" },
        { to: "/profile", label: "Profile" },
        { to: "/settings", label: "Settings" },
      ]
    : [];

  return (
    <>
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl hairline-b ${
        isPaper ? "bg-[#F4F4F0]/70 text-[#0A0A0A]" : "app-nav-surface"
      }`}
    >
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 px-3 sm:px-6 md:px-10 py-3 sm:py-4 min-w-0">
        <Link 
          to={user ? "/dashboard" : "/"} 
          onClick={() => {
            if (!user) {
              window.dispatchEvent(new Event("resetHomeDeck"));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }} 
          data-testid="nav-logo" 
          className="flex items-center gap-2 cursor-pointer shrink-0 min-w-0"
        >
          <span className="font-editorial italic text-xl sm:text-2xl leading-[1.15] truncate">flugr</span>
        </Link>


        {user && (
          <div className="hidden lg:flex items-center justify-center flex-1 mx-8 gap-4 overflow-x-auto no-scrollbar">
            {items.map(it => (
              <Link
                key={it.to}
                to={it.to}
                data-testid={`menu-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/70 hover:text-white hover:bg-white/10 px-3 py-2 rounded-3xl transition-colors whitespace-nowrap"
              >
                {it.label}
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
          {user && (
            <form
              onSubmit={(e) => {
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
              }}
              className="relative hidden md:flex items-center mr-2"
            >
              <Search className="w-3.5 h-3.5 absolute left-3 opacity-50 text-white" />
              <input 
                name="search"
                type="text" 
                placeholder="⌘ Search / Jump..." 
                className="bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-[10px] uppercase tracking-widest font-mono text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all w-48 focus:w-64"
              />
            </form>
          )}
          {user ? (
            <>
              {user?.role !== "admin" && (
                <>
                    <Link to="/support" className="text-white/60 hover:text-white transition-colors flex items-center gap-1.5 px-2" title="Support">
                      <LifeBuoy className="w-4 h-4" />
                      <span className="font-mono text-[9px] tracking-widest uppercase hidden md:inline">Support</span>
                    </Link>
                    <Link to="/messages" className="text-white/60 hover:text-white transition-colors flex items-center gap-1.5 px-2 border-r border-white/20 pr-4 mr-1" title="Messages">
                      <MessageSquare className="w-4 h-4" />
                      <span className="font-mono text-[9px] tracking-widest uppercase hidden md:inline">Messages</span>
                    </Link>
                  </>
              )}
              <NotificationBell />
              
              <div className="flex items-center gap-3 pl-2 border-l border-white/20">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/20" />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-sans font-bold text-sm text-white border border-white/20"
                      style={{ backgroundColor: `hsl(${((displayAccountName(user) || "flugr").charCodeAt(0) * 47) % 360}, 60%, 32%)` }}
                    >
                      {(displayAccountName(user) || "C")[0]?.toUpperCase()}
                    </div>
                  )}
                  <button
                    onClick={() => { logout(); nav("/"); }}
                    data-testid="nav-logout"
                    className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#FF3B30] hover:text-[#ff6b63] transition-colors"
                  >
                    Sign Out
                  </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" data-testid="nav-login" className="hidden sm:block font-mono text-[11px] tracking-[0.22em] uppercase kinetic-underline">Sign In</Link>
              <Link to="/register" data-testid="nav-register" className="btn-solid">Enter flugr →</Link>
            </>
          )}
        </div>
      </div>
    </motion.header>

    </>
  );
}
