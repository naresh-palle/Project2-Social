/** Support Operations — independent category (not Influencer/Company/Agent). */

export const SUPPORT_ROLES = ["support", "support_agent", "support_lead", "support_admin"];

export const SUPPORT_ALLOWED_PATHS = ["/support/ops", "/settings"];

export function isSupportOpsRole(role) {
  return SUPPORT_ROLES.includes(role);
}

export function supportHomePath() {
  return "/support/ops";
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
  return "/dashboard";
}
