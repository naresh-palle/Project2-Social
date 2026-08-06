/** Demo / fallback brand profile fields when production seed is sparse. */
export const ACME_BRAND_DEFAULTS = {
  bio:
    "Acme Brand is a fashion-forward apparel house building seasonal capsule collections for metro audiences across India. We partner with influencers for product drops, lookbook reels, and city takeover stories — with escrow-backed briefs and clear brand guidelines.",
  website: "https://acmebrand.example",
  linkedin: "https://www.linkedin.com/company/acme-brand",
  company_size: "51–200 employees",
  city: "Mumbai",
  state: "Maharashtra",
  location: "Mumbai, Maharashtra",
  industry: "Fashion",
  past_campaigns: [
    {
      brand: "Acme Brand",
      title: "Summer Wearables City Drop",
      date: "2025-04",
      result: "+18% store traffic",
      post_url: "https://instagram.com",
    },
    {
      brand: "Acme Brand",
      title: "Festive Edit Influencer Series",
      date: "2025-10",
      result: "2.1M reach",
      post_url: "https://instagram.com",
    },
    {
      brand: "Acme Brand",
      title: "Workwear Essentials Launch",
      date: "2026-01",
      result: "42K engagements",
      post_url: "https://youtube.com",
    },
  ],
  platform_metrics: {
    facebook: { handle: "acmebrand", followers: 128000, engagement: 3.4, views: 920000, posts: 214 },
    instagram: { handle: "acme.brand", followers: 412000, engagement: 5.8, views: 2800000, posts: 486 },
    twitter: { handle: "acmebrand", followers: 64000, engagement: 2.1, views: 410000, posts: 1203 },
    youtube: { handle: "AcmeBrandOfficial", followers: 88000, engagement: 4.2, views: 5600000, posts: 96 },
  },
};

export function isSparseBrandBio(bio) {
  const t = String(bio || "").trim().toLowerCase();
  return !t || t === "brand account." || t === "brand account" || t.length < 40;
}

/** Fill missing brand profile display fields without overwriting real user data. */
export function withBrandDisplayDefaults(profile) {
  if (!profile || typeof profile !== "object") return profile;
  if (profile.role !== "owner" && profile.role !== "agent") return profile;
  const d = ACME_BRAND_DEFAULTS;
  const company = String(profile.company || "").toLowerCase();
  const isAcme = company.includes("acme") || String(profile.email || "").includes("company@cr8");
  const defaults = isAcme ? d : {
    ...d,
    bio: profile.bio && !isSparseBrandBio(profile.bio)
      ? profile.bio
      : `${profile.company || profile.name || "This brand"} partners with influencers on CR8 Studio for escrow-backed campaigns, product storytelling, and measurable reach across priority metros.`,
    website: profile.website || "",
    linkedin: profile.linkedin || "",
    past_campaigns: Array.isArray(profile.past_campaigns) ? profile.past_campaigns : [],
    platform_metrics: profile.platform_metrics || {},
  };

  const out = { ...profile };
  if (isSparseBrandBio(out.bio)) out.bio = defaults.bio;
  if (!out.website) out.website = defaults.website || out.website;
  if (!out.linkedin) out.linkedin = defaults.linkedin || out.linkedin;
  if (!out.company_size && !out.employees) out.company_size = defaults.company_size;
  if (!out.city && !out.location) {
    out.city = defaults.city;
    out.state = defaults.state;
    out.location = defaults.location;
  }
  if (!out.industry) out.industry = defaults.industry;

  const pm = out.platform_metrics && typeof out.platform_metrics === "object" ? { ...out.platform_metrics } : {};
  const hasAnyHandle = Object.values(pm).some((v) => v && String(v.handle || "").trim());
  if (!hasAnyHandle && defaults.platform_metrics) {
    out.platform_metrics = defaults.platform_metrics;
  }

  const past = Array.isArray(out.past_campaigns) ? out.past_campaigns : [];
  if (!past.length && defaults.past_campaigns?.length) {
    out.past_campaigns = defaults.past_campaigns;
  }
  return out;
}
