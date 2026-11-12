/**
 * Product feature flags (frontend).
 * Flip these when product asks — do not remove agent role / Meta OAuth from the backend.
 */
export const PUBLIC_AGENT_ENABLED = false;

/**
 * Instagram + Facebook on Sign In / category register.
 * Splash stays categories-only (no SocialAuthButtons). Sign In + category register pass forceMeta.
 */
export const META_SOCIAL_BUTTONS_ENABLED = true;

/** Roles offered on public registration / profile-category pickers. */
export function publicRegisterRoles() {
  const roles = ["influencer", "owner"];
  if (PUBLIC_AGENT_ENABLED) roles.push("agent");
  return roles;
}

export function isPublicRegisterRole(role) {
  return publicRegisterRoles().includes(role);
}
