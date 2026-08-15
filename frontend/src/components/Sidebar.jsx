import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { displayAccountName } from "@/lib/username";
import { isSupportOpsRole, supportHomePath, supportRoleLabel } from "@/lib/supportOps";
import { AiIcon } from "@/components/AiIcon";
import { IconTip } from "@/components/IconTip";

export function Sidebar() {
  const { user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const isSupportOps = isSupportOpsRole(user?.role);
  const searchParams = new URLSearchParams(location.search);
  const opsTab = searchParams.get("tab") || "overview";

  const supportItems = [
    { to: "/support/ops?tab=dashboard", label: "Dashboard", icon: "dashboard", tab: "dashboard" },
    { to: "/support/ops?tab=tickets", label: "Tickets", icon: "tickets", tab: "tickets" },
    ...(user?.role === "support_admin" || user?.role === "support_lead"
      ? [{ to: "/support/ops?tab=staff", label: "Users", icon: "users", tab: "staff" }]
      : []),
    { to: "/support/ops?tab=knowledge", label: "Knowledge Base", icon: "knowledge", tab: "knowledge" },
    ...(user?.role === "support_admin"
      ? [{ to: "/support/ops?tab=ai", label: "AI Support", icon: "ai", tab: "ai" }]
      : []),
    ...(user?.role === "support_admin" || user?.role === "support_lead"
      ? [{ to: "/support/ops?tab=analytics", label: "Analytics", icon: "analytics", tab: "analytics" }]
      : []),
    ...(user?.role === "support_admin" || user?.role === "support_lead"
      ? [{ to: "/support/ops?tab=audit", label: "Audit", icon: "audit", tab: "audit" }]
      : []),
    { to: "/settings", label: "Settings", icon: "settings", tab: "settings" },
  ];

  const items = isSupportOps
    ? supportItems
    : [
        { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { to: "/feed", label: "Feed", icon: "feed" },
        { to: "/marketplace", label: "Directory", icon: "directory" },
        { to: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
        ...(user?.role !== "admin"
          ? [
              { to: "/referrals", label: "Referrals", icon: "referrals" },
              { to: "/invitations", label: "Invitations", icon: "invitations" },
            ]
          : []),
        { to: "/wallet", label: "Wallet", icon: "wallet" },
        { to: "/profile", label: "Profile", icon: "profile" },
        { to: "/settings", label: "Settings", icon: "settings" },
      ];

  const handleSearch = (e) => {
    e.preventDefault();
    const q = e.target.search.value.toLowerCase();
    if (isSupportOps) {
      if (q.includes("ticket") || q.includes("queue")) nav("/support/ops?tab=tickets");
      else if (q.includes("user") || q.includes("staff")) nav("/support/ops?tab=staff");
      else if (q.includes("analytic")) nav("/support/ops?tab=analytics");
      else if (q.includes("knowledge") || q.includes("faq")) nav("/support/ops?tab=knowledge");
      else if (q.includes("setting")) nav("/settings");
      else nav("/support/ops?tab=dashboard");
    } else if (q.includes("theme") || q.includes("dark") || q.includes("light") || q.includes("setting") || q.includes("password")) nav("/settings");
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

  const isItemActive = (it) => {
    if (it.to === "/settings") return location.pathname === "/settings";
    if (!isSupportOps) return location.pathname === it.to;
    if (location.pathname !== "/support/ops") return false;
    if (it.tab === "dashboard") return opsTab === "dashboard" || opsTab === "overview" || !searchParams.get("tab");
    return opsTab === it.tab;
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
          to={isSupportOps ? supportHomePath() : "/dashboard"}
          className="flex items-center gap-2 cursor-pointer mb-5"
        >
          <span className="font-editorial italic text-2xl leading-[1.15] text-[#FF3B30]">CR</span>
          <span className="font-editorial text-2xl leading-[1.15] text-[#FF3B30]">8</span>
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 ml-2">Studio</span>
        </Link>

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
            {user?.verified && <AiIcon name="sparkles" className="w-3.5 h-3.5" />}
          </h3>
          <p className="font-mono text-[9px] tracking-[0.15em] uppercase text-[#FF3B30] mt-0.5">
            {user?.role === "admin"
              ? "Admin Console"
              : user?.role === "owner"
                ? "Brand Desk"
                : user?.role === "agent"
                  ? "Agency Desk"
                  : isSupportOps
                    ? supportRoleLabel(user?.role)
                    : "Influencer"}
          </p>
          {(() => {
            if (user?.role === "admin") {
              return (
                <p className="font-sans text-[10px] opacity-60 mt-0.5 text-center leading-tight max-w-[180px] truncate">
                  Ops Desk
                </p>
              );
            }
            if (isSupportOps) {
              return (
                <p className="font-sans text-[10px] opacity-60 mt-0.5 text-center leading-tight max-w-[180px] truncate">
                  Support Operations
                </p>
              );
            }
            const niches = user?.niches || user?.category;
            let category = null;
            if (Array.isArray(niches) && niches.length) {
              category = niches.filter(Boolean)[0] || null;
            } else if (typeof niches === "string" && niches.trim()) {
              category = niches.split(/[·,|]/)[0].trim();
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
          <AiIcon name="search" className="w-3.5 h-3.5 absolute left-3 top-2 opacity-70" />
          <input
            name="search"
            type="text"
            placeholder="Search..."
            className="w-full bg-white/5 border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-[10px] uppercase tracking-widest font-mono text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
          />
        </form>

        <nav className="flex flex-col gap-1 flex-1">
          {items.map((it) => {
            const isActive = isItemActive(it);
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
                <AiIcon name={it.icon} className={`w-4 h-4 shrink-0 ${isActive ? "brightness-110" : "opacity-80"}`} />
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-4 border-t border-white/10">
        {!isSupportOps && (
          <div className="flex gap-2">
            <IconTip label="Support">
              <Link to="/support" className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors inline-flex" aria-label="Support">
                <AiIcon name="support" className="w-4 h-4 opacity-80" />
              </Link>
            </IconTip>
            <IconTip label="AI Help">
              <Link to="/help" className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors inline-flex" aria-label="AI Help">
                <AiIcon name="ai" className="w-4 h-4 opacity-80" />
              </Link>
            </IconTip>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
