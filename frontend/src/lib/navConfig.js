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

  const isBrandDesk = user?.role === "owner" || user?.role === "agent";
  const isCreator = user?.role === "influencer";
  const isProduction = user?.role === "production";
  const isAdmin = user?.role === "admin";

  if (isProduction) {
    return [
      { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { to: "/hire-requests", label: "Hire Requests", icon: "invitations" },
      { to: "/wishlist", label: "My Wishlist", icon: "save" },
      { to: "/messages", label: "Messages", icon: "bell" },
      { to: "/wallet", label: "Wallet", icon: "wallet" },
      { to: "/social-audit", label: "Social Audit", icon: "audit" },
      { to: "/profile", label: "Profile", icon: "profile" },
      { to: "/settings", label: "Settings", icon: "settings" },
    ];
  }

  // Brand desk: lean ops nav — no Feed / Discover / Brands / Leaderboard / Referrals / Invitations / Billing
  if (isBrandDesk) {
    return [
      { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { to: "/influencers", label: "Influencers", icon: "directory" },
      { to: "/marketplace?tab=campaigns", label: "Campaigns", icon: "sparkles" },
      { to: "/marketplace?tab=hire", label: "Hire / Production", icon: "directory" },
      { to: "/wishlist", label: "My Wishlist", icon: "save" },
      { to: "/messages", label: "Messages", icon: "bell" },
      { to: "/wallet", label: "Wallet", icon: "wallet" },
      { to: "/social-audit", label: "Social Audit", icon: "audit" },
      { to: "/profile", label: "Profile", icon: "profile" },
      { to: "/settings", label: "Settings", icon: "settings" },
    ];
  }

  return [
    { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { to: "/feed", label: "Feed", icon: "feed" },
    { to: "/influencers", label: "Influencers", icon: "directory" },
    ...(isCreator || isAdmin
      ? [{ to: "/marketplace?tab=brands", label: "Brands", icon: "directory" }]
      : []),
    { to: "/marketplace?tab=campaigns", label: "Campaigns", icon: "sparkles" },
    ...(isCreator || isAdmin
      ? [{ to: "/campaigns/map", label: "Campaign Map", icon: "directory" }]
      : []),
    { to: "/marketplace?tab=hire", label: "Hire / Production", icon: "directory" },
    ...(isAdmin ? [{ to: "/hire-requests", label: "Hire Requests", icon: "invitations" }] : []),
    { to: "/wishlist", label: "My Wishlist", icon: "save" },
    { to: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
    ...(!isAdmin
      ? [
          { to: "/referrals", label: "Referrals", icon: "referrals" },
          { to: "/invitations", label: "Invitations", icon: "invitations" },
        ]
      : []),
    { to: "/wallet", label: "Wallet", icon: "wallet" },
    ...(isAdmin ? [{ to: "/billing", label: "Billing", icon: "billing" }] : []),
    { to: "/social-audit", label: "Social Audit", icon: "audit" },
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
  if (user?.role === "production") {
    return [
      { to: "/dashboard", label: "Home", icon: "dashboard" },
      { to: "/hire-requests", label: "Requests", icon: "invitations" },
      { to: "/wishlist", label: "Wishlist", icon: "save" },
      { to: "/messages", label: "Inbox", icon: "bell" },
      { to: "/profile", label: "Profile", icon: "profile" },
    ];
  }
  if (user?.role === "owner" || user?.role === "agent") {
    return [
      { to: "/dashboard", label: "Home", icon: "dashboard" },
      { to: "/influencers", label: "Influencers", icon: "directory" },
      { to: "/marketplace?tab=campaigns", label: "Campaigns", icon: "sparkles" },
      { to: "/messages", label: "Inbox", icon: "bell" },
      { to: "/profile", label: "Profile", icon: "profile" },
    ];
  }
  return [
    { to: "/dashboard", label: "Home", icon: "dashboard" },
    { to: "/campaigns/map", label: "Map", icon: "directory" },
    { to: "/marketplace?tab=campaigns", label: "Campaigns", icon: "sparkles" },
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
    if (it.to === "/wishlist") return location.pathname === "/wishlist";
    if (it.to === "/hire-requests") return location.pathname === "/hire-requests";
    if ((it.to || "").includes("tab=brands") || it.label === "Brands") {
      return location.pathname === "/marketplace" && searchParams.get("tab") === "brands"
        || location.pathname.startsWith("/brands");
    }
    if ((it.to || "").includes("tab=hire") || it.label === "Hire / Production") {
      return (location.pathname === "/marketplace" && searchParams.get("tab") === "hire")
        || location.pathname.startsWith("/production");
    }
    if (it.to === "/influencers" || (it.to || "").startsWith("/influencers")) {
      return (
        location.pathname === "/influencers" ||
        (location.pathname === "/marketplace" && (searchParams.get("tab") || "creators") === "creators") ||
        location.pathname.startsWith("/creators")
      );
    }
    if (it.to === "/campaigns/map" || it.label === "Campaign Map" || it.label === "Map") {
      return location.pathname === "/campaigns/map";
    }
    if ((it.to || "").includes("tab=campaigns") || it.label === "Campaigns") {
      return (
        (location.pathname === "/marketplace" && searchParams.get("tab") === "campaigns") ||
        (location.pathname.startsWith("/campaigns") && location.pathname !== "/campaigns/map")
      );
    }
    if (it.to === "/marketplace") {
      return location.pathname === "/marketplace" || location.pathname.startsWith("/campaigns");
    }
    if (it.to === "/leaderboard") return location.pathname === "/leaderboard";
    if (it.to === "/messages") return location.pathname === "/messages";
    if (it.to === "/wallet") return location.pathname === "/wallet";
    if (it.to === "/billing") return location.pathname === "/billing" || location.pathname.startsWith("/billing/");
    if (it.to === "/social-audit") return location.pathname === "/social-audit";
    if (it.to === "/profile") return location.pathname.startsWith("/profile");
    return location.pathname === it.to;
  }
  if (location.pathname !== "/support/ops") return it.to === "/settings" && location.pathname === "/settings";
  if (it.tab === "dashboard") return opsTab === "dashboard" || opsTab === "overview" || !searchParams.get("tab");
  return opsTab === it.tab;
}

export { supportHomePath, supportRoleLabel, isSupportOpsRole };
