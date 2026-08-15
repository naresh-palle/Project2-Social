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
    // Strip profile URLs → last path segment
    if (/^https?:\/\//i.test(s) || /(instagram|twitter|x|facebook|youtube|youtu)\.com\//i.test(s)) {
      try {
        const url = new URL(s.startsWith("http") ? s : `https://${s}`);
        const parts = url.pathname.split("/").filter(Boolean);
        const slug = (parts.find((p) => p.startsWith("@")) || parts[parts.length - 1] || "")
          .replace(/^@+/, "")
          .split("?")[0];
        if (slug && !["channel", "c", "user", "watch", "shorts", "reel", "p"].includes(slug.toLowerCase())) {
          s = slug;
        }
      } catch {
        s = s.split("/").filter(Boolean).pop() || s;
      }
    }
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

function brandName(userOrProfile) {
  if (!userOrProfile || typeof userOrProfile !== "object") return "";
  return (
    String(userOrProfile.company || "").trim() ||
    String(userOrProfile.company_name || "").trim() ||
    String(userOrProfile.brand || "").trim() ||
    String(userOrProfile.brand_name || "").trim() ||
    String(userOrProfile.other_company || "").trim() ||
    ""
  );
}

/**
 * Primary public label for a user account.
 * Company / agent → brand/company name; influencers & others → username.
 */
export function displayAccountName(userOrProfile, fallback = "User") {
  if (!userOrProfile || typeof userOrProfile !== "object") return fallback;
  const role = userOrProfile.role || userOrProfile.other_role;
  const brand = brandName(userOrProfile);
  if (role === "owner" || role === "agent" || role === "company") {
    if (brand) return brand;
    // Prefer brand-ish name over personal full name when company field is empty
    const name = String(userOrProfile.name || userOrProfile.other_name || "").trim();
    if (name) return name;
  }
  return (
    formatUsername(userOrProfile.username, userOrProfile.handle, userOrProfile.email) ||
    brand ||
    String(userOrProfile.name || "").trim() ||
    fallback
  );
}

/** Label for a conversation partner (company → brand). */
export function displayPartnerName(convo, fallback = "User") {
  if (!convo || typeof convo !== "object") return fallback;
  const role = convo.other_role;
  const company = String(convo.other_company || "").trim();
  if ((role === "owner" || role === "agent" || role === "company") && company) return company;
  const handle = formatUsername(convo.other_handle, convo.other_username);
  if (!handle && company) return company;
  return String(convo.other_name || "").trim() || company || handle || fallback;
}
