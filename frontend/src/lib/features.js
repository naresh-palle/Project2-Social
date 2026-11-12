/**
 * Product feature flags (frontend).
 * Flip these when product asks — do not remove agent role from the backend.
 */
export const PUBLIC_AGENT_ENABLED = false;

/** Roles offered on public registration / profile-category pickers. */
export function publicRegisterRoles() {
  const roles = ["influencer", "owner"];
  if (PUBLIC_AGENT_ENABLED) roles.push("agent");
  return roles;
}

export function isPublicRegisterRole(role) {
  return publicRegisterRoles().includes(role);
}
