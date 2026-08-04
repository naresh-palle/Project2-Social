/** Shared platform categories used across Marketplace, Dashboard, Admin, Profile, Onboarding. */
export const PLATFORM_CATEGORIES = [
  "Fashion & Style",
  "Food & Cooking",
  "Beauty & Makeup",
  "Technology & Gadgets",
  "Fitness & Health",
  "Lifestyle & Home",
  "Travel & Adventure",
  "Business & Entrepreneurship",
  "Entertainment & Gaming",
  "Education & Learning",
  "Other",
];

/** Empty selection = All categories. */
export function matchesCategoryFilter(itemCategory, selected = []) {
  if (!selected?.length) return true;
  const raw = Array.isArray(itemCategory)
    ? itemCategory.join(" ")
    : String(itemCategory || "");
  const hay = raw.toLowerCase();
  return selected.some((c) => hay.includes(String(c).toLowerCase()));
}
