import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL || "https://project2-social.onrender.com";
export const API = BACKEND_URL ? `${BACKEND_URL.replace(/\/$/, "")}/api` : "/api";

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cr8_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Production PATCH /auth/me types `category` as a string. Niches UI is multi-select
  // (array) — coerce before the request so a selected niche never 422s as "Category".
  const method = String(config.method || "").toLowerCase();
  const url = String(config.url || "");
  if (method === "patch" && url.includes("/auth/me") && config.data && typeof config.data === "object" && !Array.isArray(config.data)) {
    const data = { ...config.data };
    if (Array.isArray(data.category)) {
      data.category = data.category.map((x) => String(x || "").trim()).filter(Boolean).join(", ") || null;
    } else if (data.category != null && typeof data.category !== "string") {
      data.category = String(data.category);
    }
    if (data.category === "") data.category = null;
    config.data = data;
  }
  return config;
});

/** Friendlier labels for API field names shown in toasts. */
const FIELD_LABELS = {
  category: "Niches / Category",
  niches: "Niches / Category",
  platform_metrics: "Social accounts",
  base_rate: "Base rate",
  content_types: "Content types",
  past_campaigns: "Past campaigns",
  date_of_birth: "Date of birth",
  cover_photo: "Cover photo",
  response_time: "Response time",
};

/** Human-readable label for a FastAPI / Pydantic field path. */
export function fieldLabelFromLoc(loc) {
  if (!Array.isArray(loc) || !loc.length) return null;
  const parts = loc.filter((p) => p !== "body" && (typeof p === "string" || typeof p === "number"));
  const key = parts.length ? String(parts[parts.length - 1]) : null;
  if (!key) return null;
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key.replace(/_/g, " ");
}

/**
 * Format API error detail. For validation arrays, include the field name
 * so users know where the problem is (e.g. "website: Input should be a valid string").
 */
export function formatApiError(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") {
    const lower = detail.toLowerCase();
    if (lower === "forbidden" || lower.includes("not enough permissions")) {
      return "You don’t have permission to view this.";
    }
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        if (!e || typeof e !== "object") return JSON.stringify(e);
        const label = fieldLabelFromLoc(e.loc);
        const msg = typeof e.msg === "string" ? e.msg : JSON.stringify(e);
        return label ? `${label}: ${msg}` : msg;
      })
      .join(" · ");
  }
  if (detail?.msg) return detail.msg;
  return String(detail);
}

/** User-facing auth failure copy — never expose stack traces or raw API payloads. */
export function friendlyAuthError(detail, fallback = "Login unsuccessful. Please check your credentials and try again.") {
  const raw = formatApiError(detail);
  if (!raw || raw === "Something went wrong.") return fallback;
  const lower = String(raw).toLowerCase();
  if (
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("failed to fetch") ||
    lower.includes("err_network")
  ) {
    return "We couldn’t reach the server. Check your connection and try again.";
  }
  if (lower.includes("otp") || lower.includes("verification code") || lower.includes("expired")) {
    return "Login unsuccessful. Please check the verification code and try again.";
  }
  if (
    lower.includes("invalid") ||
    lower.includes("incorrect") ||
    lower.includes("unauthorized") ||
    lower.includes("401") ||
    lower.includes("credential") ||
    lower.includes("password") ||
    lower.includes("not found")
  ) {
    return fallback;
  }
  // Keep short, non-technical messages; otherwise use the safe default.
  if (raw.length <= 120 && !/[{\\[\\]|traceback|exception|sql/i.test(raw)) {
    return raw;
  }
  return fallback;
}

/** First field name from a FastAPI 422 detail array. */
export function firstErrorField(detail) {
  if (!Array.isArray(detail) || !detail.length) return null;
  const loc = detail[0]?.loc;
  if (!Array.isArray(loc)) return null;
  const parts = loc.filter((p) => p !== "body");
  return parts.length ? String(parts[parts.length - 1]) : null;
}
