/**
 * Normalize account usernames for display.
 * Strips leading @ and trailing punctuation/commas so UI never shows "@user" / "@user.".
 */
export function formatUsername(...candidates) {
  for (const raw of candidates) {
    if (raw == null) continue;
    let s = String(raw).trim();
    if (!s) continue;
    // Prefer username-like tokens over emails when a handle is passed
    if (s.includes("@") && s.includes(".") && /@.+\./.test(s) && !s.startsWith("@")) {
      // likely an email — use local part only as last resort below
      continue;
    }
    s = s.replace(/^@+/, "").replace(/[.,\s]+$/g, "").replace(/,/g, "").trim();
    if (s) return s;
  }
  for (const raw of candidates) {
    if (raw == null) continue;
    const s = String(raw).trim();
    if (s.includes("@") && !s.startsWith("@")) {
      const local = s.split("@")[0].replace(/[.,\s]+$/g, "").replace(/,/g, "").trim();
      if (local) return local;
    }
  }
  return "";
}

export function formatUsernameOr(fallback = "user", ...candidates) {
  return formatUsername(...candidates) || fallback;
}
