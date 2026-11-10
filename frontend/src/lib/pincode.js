/**
 * Indian pincode → city/state resolution.
 * Prefer town/block (and Head Post Office) over legacy District labels —
 * e.g. 502103 is Siddipet town, while India Post still lists District as Medak.
 */

/** Manual corrections for known India-Post lag / reorganized districts. */
export const PINCODE_OVERRIDES = {
  "502103": { city: "Siddipet", state: "Telangana", district: "Siddipet" },
  "502114": { city: "Siddipet", state: "Telangana", district: "Siddipet" },
  "502107": { city: "Gajwel", state: "Telangana", district: "Siddipet" },
  "502110": { city: "Dubbak", state: "Telangana", district: "Siddipet" },
  "502001": { city: "Medak", state: "Telangana", district: "Medak" },
  "502220": { city: "Sangareddy", state: "Telangana", district: "Sangareddy" },
};

function clean(value) {
  return String(value || "").trim();
}

function mostCommon(values) {
  const counts = {};
  for (const raw of values) {
    const v = clean(raw);
    if (!v) continue;
    counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function looksLikeLocality(name) {
  return /\b(nagar|colony|road|street|busstand|bus stand|market|cross|phase|sector|layout)\b/i.test(
    clean(name)
  );
}

/**
 * Resolve city/state from India Post PostOffice[] payload.
 */
export function resolveFromPostOffices(postOffices, pincode = "") {
  const pin = clean(pincode);
  if (PINCODE_OVERRIDES[pin]) {
    return { ...PINCODE_OVERRIDES[pin], pincode: pin, source: "override" };
  }

  const list = Array.isArray(postOffices) ? postOffices.filter((po) => po && typeof po === "object") : [];
  if (!list.length) return null;

  const state = clean(list[0].State);
  const district = clean(list[0].District);
  const block = mostCommon(list.map((po) => po.Block));
  const pinFromPo = clean(list[0].Pincode) || pin;

  const hpo = list.find((po) => /head\s*post\s*office/i.test(String(po.BranchType || "")));
  const hpoName = clean(hpo?.Name);

  let city = "";
  // Head PO town name when it is not a tiny locality label
  if (hpoName && !looksLikeLocality(hpoName)) {
    city = hpoName;
  }
  // Block/taluk is usually the actual town (Siddipet) even when District lags (Medak)
  if (!city && block) city = block;
  if (!city && hpoName) city = hpoName;
  if (!city) city = mostCommon(list.map((po) => po.Name).filter((n) => !looksLikeLocality(n)));
  if (!city) city = district;

  // Prefer block over outdated district when they disagree
  if (block && district && block.toLowerCase() !== district.toLowerCase()) {
    if (!city || city.toLowerCase() === district.toLowerCase()) {
      city = block;
    }
  }

  if (PINCODE_OVERRIDES[pinFromPo]) {
    return { ...PINCODE_OVERRIDES[pinFromPo], pincode: pinFromPo, source: "override" };
  }

  return {
    city,
    state,
    district: block && block.toLowerCase() !== district.toLowerCase() ? block : district || block,
    block,
    pincode: pinFromPo,
    source: "postalpincode",
  };
}

/**
 * Normalize zippopotam.us / other fallback place payloads.
 */
export function resolveFromZippopotam(payload, pincode = "") {
  const pin = clean(pincode);
  if (PINCODE_OVERRIDES[pin]) {
    return { ...PINCODE_OVERRIDES[pin], pincode: pin, source: "override" };
  }
  const places = payload?.places;
  if (!Array.isArray(places) || !places.length) return null;
  const place = places[0] || {};
  return {
    city: clean(place["place name"]),
    state: clean(place.state),
    district: clean(place["place name"]),
    pincode: pin || clean(payload["post code"]),
    source: "zippopotam",
  };
}
