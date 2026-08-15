import { isSupportOpsRole, supportHomePath, supportRoleLabel } from "@/lib/supportOps";

export function getSidebarItems(user) {
  const isSupportOps = isSupportOpsRole(user?.role);
  if (isSupportOps) {
    return [
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
        ? [
            { to: "/support/ops?tab=analytics", label: "Analytics", icon: "analytics", tab: "analytics" },
            { to: "/support/ops?tab=audit", label: "Audit", icon: "audit", tab: "audit" },
          ]
        : []),
      { to: "/settings", label: "Settings", icon: "settings", tab: "settings" },
    ];
  }
  return [
    { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/feed", label: "Feed", icon: "feed" },
    ...(user?.role === "owner" || user?.role === "agent" || user?.role === "admin"
      ? [{ to: "/discover", label: "Discover", icon: "sparkles" }]
      : []),
    { to: "/marketplace", label: "Directory", icon: "directory" },
    { to: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
    ...(user?.role !== "admin"
      ? [
          { to: "/referrals", label: "Referrals", icon: "referrals" },
          { to: "/invitations", label: "Invitations", icon: "invitations" },
        ]
      : []),
    { to: "/wallet", label: "Wallet", icon: "wallet" },
    { to: "/billing", label: "Billing", icon: "wallet" },
    { to: "/profile", label: "Profile", icon: "profile" },
    { to: "/settings", label: "Settings", icon: "settings" },
  ];
}

/** Five thumb-friendly destinations for phones and tablets. */
export function getBottomNavItems(user) {
  if (isSupportOpsRole(user?.role)) {
    return [
      { to: "/support/ops?tab=dashboard", label: "Home", icon: "dashboard", tab: "dashboard" },
      { to: "/support/ops?tab=tickets", label: "Tickets", icon: "tickets", tab: "tickets" },
      { to: "/support/ops?tab=knowledge", label: "Knowledge", icon: "knowledge", tab: "knowledge" },
      { to: "/settings", label: "Settings", icon: "settings" },
    ];
  }
  return [
    { to: "/dashboard", label: "Home", icon: "dashboard" },
    { to: user?.role === "owner" || user?.role === "agent" || user?.role === "admin" ? "/discover" : "/marketplace", label: user?.role === "owner" || user?.role === "agent" || user?.role === "admin" ? "Discover" : "Campaigns", icon: user?.role === "owner" || user?.role === "agent" || user?.role === "admin" ? "sparkles" : "directory" },
    { to: "/leaderboard", label: "Analytics", icon: "analytics" },
    { to: "/messages", label: "Inbox", icon: "bell" },
    { to: "/profile", label: "Profile", icon: "profile" },
  ];
}

export function isNavItemActive(it, location, user) {
  const isSupportOps = isSupportOpsRole(user?.role);
  const searchParams = new URLSearchParams(location.search);
  const opsTab = searchParams.get("tab") || "overview";
  if (it.to === "/settings") return location.pathname === "/settings";
  if (!isSupportOps) {
    if (it.to === "/dashboard") return location.pathname === "/dashboard";
    if (it.to === "/discover") return location.pathname === "/discover";
    if (it.to === "/marketplace") {
      return location.pathname === "/marketplace" || location.pathname.startsWith("/campaigns");
    }
    if (it.to === "/leaderboard") return location.pathname === "/leaderboard";
    if (it.to === "/messages") return location.pathname === "/messages";
    if (it.to === "/wallet") return location.pathname === "/wallet";
    if (it.to === "/billing") return location.pathname === "/billing" || location.pathname.startsWith("/billing/");
    if (it.to === "/profile") return location.pathname.startsWith("/profile");
    return location.pathname === it.to;
  }
  if (location.pathname !== "/support/ops") return it.to === "/settings" && location.pathname === "/settings";
  if (it.tab === "dashboard") return opsTab === "dashboard" || opsTab === "overview" || !searchParams.get("tab");
  return opsTab === it.tab;
}

export { supportHomePath, supportRoleLabel, isSupportOpsRole };
