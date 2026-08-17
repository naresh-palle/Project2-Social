/**
 * Build a short location label for any user/profile object.
 * Prefers "City, State", then free-form `location`, then either part alone.
 */
export function formatUserLocation(userOrProfile) {
  if (!userOrProfile || typeof userOrProfile !== "object") return "";

  const city = String(userOrProfile.city || "").trim();
  const state = String(userOrProfile.state || userOrProfile.region || "").trim();
  const country = String(userOrProfile.country || "").trim();
  const rawLocation = String(userOrProfile.location || "").trim();

  if (city && state) {
    if (state.toLowerCase() === city.toLowerCase()) return city;
    return `${city}, ${state}`;
  }
  if (city) return country && country.toLowerCase() !== city.toLowerCase() ? `${city}, ${country}` : city;
  if (state) return state;
  if (rawLocation) return rawLocation;
  if (country) return country;
  return "";
}

export function formatUserLocationOr(fallback = "", userOrProfile) {
  return formatUserLocation(userOrProfile) || fallback;
}
