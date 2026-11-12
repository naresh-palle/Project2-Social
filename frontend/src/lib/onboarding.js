/** Central CR8 onboarding / restricted-mode helpers (mirrors backend onboarding_gate). */

import { isSupportOpsRole, supportHomePath } from "@/lib/supportOps";

export const PROFILE_STATUS = {
  REGISTERED: "REGISTERED",
  EMAIL_PENDING: "EMAIL_PENDING",
  MOBILE_PENDING: "MOBILE_PENDING",
  PROFILE_INCOMPLETE: "PROFILE_INCOMPLETE",
  VERIFICATION_PENDING: "VERIFICATION_PENDING",
  COMPLETED: "COMPLETED",
  SUSPENDED: "SUSPENDED",
};

export function campaignsPathForUser(user) {
  if (!user) return "/marketplace?tab=campaigns";
  if (user.campaigns_path) return user.campaigns_path;
  if (user.role === "production") return "/hire-requests";
  return "/marketplace?tab=campaigns";
}

export function onboardingPathForUser(user) {
  if (!user) return "/complete-profile";
  if (user.onboarding_path) return user.onboarding_path;
  const role = ["owner", "influencer", "agent", "production"].includes(user.role)
    ? user.role
    : "influencer";
  return `/onboarding/${role}`;
}

export function isProfileComplete(user) {
  if (!user) return false;
  if (isSupportOpsRole(user.role) || user.role === "admin") return true;
  if (user.dashboard_accessible === true) return true;
  if (user.onboarding_completed === true && user.role !== "agent") return true;
  if (user.profile_completion_status === "COMPLETED") {
    if (user.role === "agent" && user.agent_approved === false) return false;
    return true;
  }
  // Legacy: completed onboarding with verifies
  if (
    user.onboarding_status === "completed" &&
    user.email_verified !== false &&
    (user.mobile_verified === true || user.mobile)
  ) {
    if (user.role === "agent" && user.agent_approved === false) return false;
    return true;
  }
  return false;
}

export function isRestrictedMode(user) {
  if (!user) return false;
  if (isSupportOpsRole(user.role) || user.role === "admin") return false;
  if (user.restricted_mode === true) return true;
  if (user.role === "agent" && user.agent_approved === false) return true;
  if (user.onboarding_status === "pending_approval" || user.onboarding_status === "declined") {
    return true;
  }
  return !isProfileComplete(user);
}

/** Paths incomplete users may visit. */
export function isPathAllowedWhileIncomplete(pathname, search = "") {
  const path = pathname || "";
  const qs = search || "";
  if (path.startsWith("/onboarding")) return true;
  if (path.startsWith("/complete-profile")) return true;
  if (path === "/marketplace" && qs.includes("tab=campaigns")) return true;
  if (path.startsWith("/campaigns/") && !path.includes("/new")) return true;
  if (path === "/campaigns/map") return true;
  if (path === "/oauth/callback") return true;
  if (path === "/settings") return true; // allow password / unlink basics
  if (path === "/profile" || path.startsWith("/profile/")) return true;
  if (path === "/legal" || path.startsWith("/legal/")) return true;
  if (path === "/support") return true;
  return false;
}

export function postLoginDestination(user) {
  if (!user) return "/login";
  if (isSupportOpsRole(user.role)) return supportHomePath();
  if (user.role === "agent" && (user.agent_approved === false || user.onboarding_status === "pending_approval")) {
    return "/onboarding/agent";
  }
  if (user.onboarding_status === "declined") return "/onboarding/agent";
  if (isRestrictedMode(user)) {
    // Spec: incomplete → Campaigns (+ complete-profile prompt)
    return campaignsPathForUser(user);
  }
  return "/dashboard";
}

export function verificationLabel(verified, failed = false) {
  if (failed) return { text: "Verification Failed", tone: "fail" };
  if (verified) return { text: "Verified", tone: "ok" };
  return { text: "Pending Verification", tone: "pending" };
}

export function profileBannerMessage(user) {
  if (!user || !isRestrictedMode(user)) return null;
  const status = user.profile_completion_status;
  if (status === "EMAIL_PENDING") return "Please verify your email address to continue.";
  if (status === "MOBILE_PENDING") return "Verify your mobile number to unlock your CR8 dashboard.";
  if (user.role === "agent" && user.agent_approved === false && user.onboarding_status === "pending_approval") {
    return "Your agency application is pending admin approval.";
  }
  return "Complete your CR8 profile to unlock your dashboard and all platform features.";
}

/** Start Meta/Google redirect OAuth via backend. */
export function startSocialOAuth(provider, { mode = "login", role, redirect } = {}) {
  const API = (process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL || "https://project2-social.onrender.com").replace(/\/$/, "");
  const params = new URLSearchParams({ mode });
  if (role) params.set("role", role);
  if (redirect) params.set("redirect", redirect);
  else {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://flugr.in";
    const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
    params.set("redirect", `${origin}${base}/#/oauth/callback`);
  }
  window.location.href = `${API}/api/oauth/${provider}/start?${params.toString()}`;
}
