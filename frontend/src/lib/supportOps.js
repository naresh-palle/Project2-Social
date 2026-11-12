/** Support Operations — independent category (not Influencer/Company/Agent). */

export const SUPPORT_ROLES = ["support", "support_agent", "support_lead", "support_admin"];

export const SUPPORT_ALLOWED_PATHS = ["/support/ops", "/settings"];

export function isSupportOpsRole(role) {
  return SUPPORT_ROLES.includes(role);
}

export function supportHomePath() {
  return "/support/ops?tab=dashboard";
}

export function supportRoleLabel(role) {
  if (role === "support_admin") return "Support Admin";
  if (role === "support_lead") return "Support Lead";
  if (role === "support" || role === "support_agent") return "Support Agent";
  return "Support";
}

export function postAuthPath(user) {
  if (!user) return "/login";
  if (isSupportOpsRole(user.role)) return supportHomePath();
  // Incomplete profiles → campaigns (full rules live in lib/onboarding.js)
  if (user?.restricted_mode === true) {
    return user.campaigns_path || "/marketplace?tab=campaigns";
  }
  if (user?.onboarding_completed === false || user?.profile_completion_status === "PROFILE_INCOMPLETE") {
    return user.campaigns_path || "/marketplace?tab=campaigns";
  }
  if (user?.role === "agent" && user?.agent_approved === false) {
    return "/onboarding/agent";
  }
  if (user?.role && user.role !== "admin" && user?.onboarding_status && user.onboarding_status !== "completed" && user.onboarding_status !== "approved") {
    if (user.onboarding_status === "pending_approval" || user.onboarding_status === "declined") {
      return `/onboarding/${user.role}`;
    }
    return user.campaigns_path || "/marketplace?tab=campaigns";
  }
  return "/dashboard";
}
