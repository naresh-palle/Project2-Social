/**
 * Product feature flags (frontend).
 * Flip these when product asks — do not remove agent role / Meta OAuth from the backend.
 */
export const PUBLIC_AGENT_ENABLED = false;

/** Instagram + Facebook buttons on Sign In / Register (Google stays on). */
export const META_SOCIAL_BUTTONS_ENABLED = false;

/** Roles offered on public registration / profile-category pickers. */
export function publicRegisterRoles() {
  const roles = ["influencer", "owner"];
  if (PUBLIC_AGENT_ENABLED) roles.push("agent");
  return roles;
}

export function isPublicRegisterRole(role) {
  return publicRegisterRoles().includes(role);
}
