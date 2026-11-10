import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { LifeBuoy, MessageSquare, Search } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { displayAccountName } from "@/lib/username";
import { BrandLogo } from "@/components/BrandLogo";

export function Nav({ variant = "paper" }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  useLocation();
  const items = user
    ? [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/leaderboard", label: "Leaderboard" },
        ...(user?.role !== "admin"
          ? [
              { to: "/referrals", label: "Referrals" },
              { to: "/invitations", label: "Invitations" },
            ]
          : []),
        { to: "/wallet", label: "Wallet" },
        { to: "/profile", label: "Profile" },
        { to: "/settings", label: "Settings" },
      ]
    : [];

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-[#1E1B4B]/10 bg-white text-[#1E1B4B] shadow-sm"
    >
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 px-3 sm:px-6 md:px-10 py-3 sm:py-3.5 min-w-0">
        <Link
          to={user ? "/dashboard" : "/"}
          onClick={() => {
            if (!user) {
              window.dispatchEvent(new Event("resetHomeDeck"));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          data-testid="nav-logo"
          className="flex items-center gap-2 cursor-pointer shrink-0 min-w-0 outline-none"
        >
          <BrandLogo variant="wordmark" height={34} className="shrink-0" />
        </Link>

        {user && (
          <div className="hidden lg:flex items-center justify-center flex-1 mx-8 gap-1 overflow-x-auto no-scrollbar">
            {items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                data-testid={`menu-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="font-sans text-[12px] font-semibold tracking-wide text-[#64748B] hover:text-[#1E1B4B] hover:bg-[#EEF2FF] px-3 py-2 rounded-full transition-colors whitespace-nowrap"
              >
                {it.label}
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
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
              className="relative hidden md:flex items-center mr-1"
            >
              <Search className="w-3.5 h-3.5 absolute left-3 text-[#1E1B4B]" strokeWidth={2.35} />
              <input
                name="search"
                type="text"
                placeholder="Search / Jump…"
                className="bg-[#F7F8FC] border border-[#1E1B4B]/10 rounded-full pl-9 pr-4 py-1.5 text-[11px] font-sans text-[#1E1B4B] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#7C3AED]/40 focus:bg-white transition-all w-44 focus:w-60"
              />
            </form>
          )}

          {user ? (
            <>
              {user?.role !== "admin" && (
                <>
                  <Link
                    to="/support"
                    className="text-[#1E1B4B] hover:text-[#FF2D55] transition-colors flex items-center gap-1.5 px-2"
                    title="Support"
                  >
                    <LifeBuoy className="w-4 h-4" strokeWidth={2.35} />
                    <span className="font-sans text-[11px] font-semibold hidden md:inline">Support</span>
                  </Link>
                  <Link
                    to="/messages"
                    className="text-[#1E1B4B] hover:text-[#FF2D55] transition-colors flex items-center gap-1.5 px-2 border-r border-[#1E1B4B]/10 pr-3 mr-1"
                    title="Messages"
                  >
                    <MessageSquare className="w-4 h-4" strokeWidth={2.35} />
                    <span className="font-sans text-[11px] font-semibold hidden md:inline">Messages</span>
                  </Link>
                </>
              )}
              <NotificationBell />
              <div className="flex items-center gap-2.5 pl-2 border-l border-[#1E1B4B]/10">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 border border-[#1E1B4B]/10" />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-sans font-bold text-sm text-[#1E1B4B] border border-[#1E1B4B]/10"
                    style={{
                      backgroundColor: `hsl(${((displayAccountName(user) || "flugr").charCodeAt(0) * 47) % 360}, 65%, 42%)`,
                    }}
                  >
                    {(displayAccountName(user) || "C")[0]?.toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => {
                    logout();
                    nav("/");
                  }}
                  data-testid="nav-logout"
                  className="font-sans text-[11px] font-bold tracking-wide uppercase text-[#FF2D55] hover:text-[#E11D48] transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                data-testid="nav-login"
                className="hidden sm:inline-flex items-center font-sans text-[14px] font-semibold text-[#1E1B4B] hover:text-[#FF2D55] transition-colors px-3 py-2"
              >
                Sign In
              </Link>
              <Link to="/register" data-testid="nav-register" className="btn-solid !py-2.5 !px-4 !text-[11px]">
                Enter flugr →
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
