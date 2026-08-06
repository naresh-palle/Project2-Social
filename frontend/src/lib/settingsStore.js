/** Durable client-side settings store — keeps toggles sticky even if API lag/fails. */

const KEY = "cr8_settings";

const APPEARANCE_KEYS = [
  "language",
  "theme",
  "high_contrast",
  "reduced_motion",
  "font_scale",
  "is_private",
  "show_online_status",
  "show_last_seen",
  "notification_prefs",
];

export function readLocalSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLocalSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  try {
    const prev = readLocalSettings() || {};
    const next = {
      ...prev,
      ...settings,
      ...(settings.notification_prefs
        ? {
            notification_prefs: {
              ...(prev.notification_prefs || {}),
              ...settings.notification_prefs,
            },
          }
        : {}),
      _saved_at: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

/** Merge API payload with local overrides (local wins for preference keys). */
export function mergeSettings(apiSettings, localSettings) {
  const api = apiSettings && typeof apiSettings === "object" ? apiSettings : {};
  const local = localSettings && typeof localSettings === "object" ? localSettings : {};
  const merged = { ...api };

  for (const key of APPEARANCE_KEYS) {
    if (key === "notification_prefs") {
      merged.notification_prefs = {
        ...(api.notification_prefs || {}),
        ...(local.notification_prefs || {}),
      };
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(local, key) && local[key] !== undefined) {
      merged[key] = local[key];
    }
  }
  return merged;
}

/** Keys that differ between local and API (for background re-sync). */
export function settingsDiff(localSettings, apiSettings) {
  const local = localSettings || {};
  const api = apiSettings || {};
  const diff = {};
  for (const key of APPEARANCE_KEYS) {
    if (key === "notification_prefs") {
      const ln = local.notification_prefs || {};
      const an = api.notification_prefs || {};
      const prefs = {};
      let changed = false;
      for (const [k, v] of Object.entries(ln)) {
        if (an[k] !== v) {
          prefs[k] = v;
          changed = true;
        }
      }
      if (changed) diff.notification_prefs = prefs;
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(local, key)) continue;
    if (local[key] !== api[key]) diff[key] = local[key];
  }
  return diff;
}
