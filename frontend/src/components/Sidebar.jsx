import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { displayAccountName } from "@/lib/username";
import { formatUserLocation } from "@/lib/location";
import { AiIcon } from "@/components/AiIcon";
import {
  getSidebarItems,
  isNavItemActive,
  isSupportOpsRole,
  supportHomePath,
  supportRoleLabel,
} from "@/lib/navConfig";
import { BrandLogo } from "@/components/BrandLogo";

export function Sidebar({ mobileOpen = false, onClose }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const isSupportOps = isSupportOpsRole(user?.role);
  const items = getSidebarItems(user);

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
    else if (q.includes("directory") || q.includes("find") || q.includes("discover")) nav(user?.role === "owner" || user?.role === "agent" || user?.role === "admin" ? "/discover" : "/marketplace");
    else if (q.includes("feed") || q.includes("campaign")) nav("/feed");
    else if (q.includes("message") || q.includes("chat")) nav("/messages");
    else nav("/search?q=" + encodeURIComponent(q));
    e.target.search.value = "";
    onClose?.();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={`lg:hidden fixed inset-0 z-[80] bg-black/55 backdrop-blur-[2px] transition-opacity ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />
      <aside
        className={`fixed top-0 left-0 h-[100dvh] w-[min(16.5rem,86vw)] bg-[#0B0B0E] border-r border-white/10 flex flex-col z-[90] overflow-y-auto no-scrollbar font-sans transition-transform duration-300 ease-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0`}
      >
        <div className="p-4">
          <Link
            to={isSupportOps ? supportHomePath() : "/dashboard"}
            onClick={onClose}
            className="flex items-center gap-2 cursor-pointer mb-5 border-0 outline-none"
          >
            <BrandLogo variant="mark" height={36} />
          </Link>

          <div className="bg-white/5 rounded-2xl p-3 mb-5 border border-white/10 flex flex-col items-center text-center">
            <div className="relative mb-2">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-white/20 shadow-xl" />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-sans font-bold text-xl text-white border-2 border-white/20 shadow-xl"
                  style={{ backgroundColor: `hsl(${((displayAccountName(user) || "flugr").charCodeAt(0) * 47) % 360}, 60%, 32%)` }}
                >
                  {(displayAccountName(user) || "C")[0]?.toUpperCase()}
                </div>
              )}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#34C759] border-2 border-[#0B0B0E] rounded-full" />
            </div>

            <h3 className="font-sans font-bold text-[15px] tracking-tight text-white flex items-center gap-1 justify-center leading-tight max-w-full px-1">
              <span className="truncate">{displayAccountName(user)}</span>
              {user?.verified && <AiIcon name="sparkles" className="w-3.5 h-3.5 shrink-0" tone="brand" />}
            </h3>
            <p className="font-sans text-[10px] font-semibold tracking-[0.18em] uppercase text-[#FF3B30] mt-1">
              {user?.role === "admin"
                ? "Admin Console"
                : user?.role === "owner"
                  ? "Brand Desk"
                  : user?.role === "agent"
                    ? "Agency Desk"
                    : user?.role === "production"
                      ? "Hire / Production"
                      : isSupportOps
                        ? supportRoleLabel(user?.role)
                        : "Influencer"}
            </p>
            {(() => {
              if (user?.role === "admin") {
                return (
                  <p className="font-sans text-[11px] text-white/55 mt-0.5 text-center leading-tight max-w-[180px] truncate">
                    Ops Desk
                  </p>
                );
              }
              if (isSupportOps) {
                return (
                  <p className="font-sans text-[11px] text-white/55 mt-0.5 text-center leading-tight max-w-[180px] truncate">
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
              const city = formatUserLocation(user) || null;
              if (!category && !city) return null;
              return (
                <p className="font-sans text-[11px] text-white/55 mt-0.5 text-center leading-tight max-w-[180px] truncate" title={[category, city].filter(Boolean).join(" · ")}>
                  {[category, city].filter(Boolean).join(" · ")}
                </p>
              );
            })()}
            {(() => {
              const loc = formatUserLocation(user);
              return (
                <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-full border border-white/10 mt-2 max-w-[200px]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#34C759] shrink-0" />
                  <span className="font-sans text-[10px] font-medium text-white/70 truncate" title={loc || "Online"}>
                    {loc ? `Online · ${loc}` : "Online"}
                  </span>
                </div>
              );
            })()}
          </div>

          <form onSubmit={handleSearch} className="relative mb-4">
            <AiIcon name="search" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" tone="muted" />
            <input
              name="search"
              type="text"
              placeholder="Search…"
              className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-[13px] font-sans font-medium text-white placeholder-white/40 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
            />
          </form>

          <nav className="flex flex-col gap-1 flex-1">
            {items.map((it) => {
              const isActive = isNavItemActive(it, location, user);
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  onClick={onClose}
                  className={`font-sans text-[13px] tracking-tight px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-3 ${
                    isActive
                      ? "bg-[#FF3B30] text-white shadow-lg shadow-[#FF3B30]/20 font-semibold"
                      : "text-white/65 hover:text-white hover:bg-white/10 font-medium"
                  }`}
                >
                  <AiIcon name={it.icon} className="w-[18px] h-[18px] shrink-0" tone="white" />
                  {it.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-white/10">
          {!isSupportOps && (
            <div className="flex flex-col gap-1.5">
              <Link
                to="/support"
                onClick={onClose}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-white/20 bg-white/10 hover:border-[#FF3B30] hover:bg-[#FF3B30]/15 text-white transition-colors"
                aria-label="Support"
              >
                <AiIcon name="support" className="w-5 h-5" tone="white" />
                <span className="font-sans text-[13px] font-medium tracking-tight">Support</span>
              </Link>
              <Link
                to="/help"
                onClick={onClose}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-white/20 bg-white/10 hover:border-[#FF3B30] hover:bg-[#FF3B30]/15 text-white transition-colors"
                aria-label="AI Help"
              >
                <AiIcon name="ai" className="w-5 h-5" tone="white" />
                <span className="font-sans text-[13px] font-medium tracking-tight">AI Help</span>
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
