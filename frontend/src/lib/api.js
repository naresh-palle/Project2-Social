import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL || "https://project2-social.onrender.com";
export const API = BACKEND_URL ? `${BACKEND_URL.replace(/\/$/, "")}/api` : "/api";

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cr8_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Friendlier labels for API field names shown in toasts. */
const FIELD_LABELS = {
  category: "Niches",
  niches: "Niches",
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
  if (typeof detail === "string") return detail;
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

/** First field name from a FastAPI 422 detail array. */
export function firstErrorField(detail) {
  if (!Array.isArray(detail) || !detail.length) return null;
  const loc = detail[0]?.loc;
  if (!Array.isArray(loc)) return null;
  const parts = loc.filter((p) => p !== "body");
  return parts.length ? String(parts[parts.length - 1]) : null;
}
