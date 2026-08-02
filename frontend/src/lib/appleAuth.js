const APPLE_CLIENT_ID = process.env.REACT_APP_APPLE_CLIENT_ID || "";

function loadAppleScript() {
  return new Promise((resolve, reject) => {
    if (window.AppleID?.auth) {
      resolve();
      return;
    }
    const existing = document.querySelector("script[data-cr8-apple]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    s.async = true;
    s.dataset.cr8Apple = "1";
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/** Load + init Apple Sign In only when the user taps Apple (avoids overlay click-stealing). */
export async function ensureAppleAuth() {
  if (!APPLE_CLIENT_ID) return false;
  await loadAppleScript();
  if (!window.AppleID?.auth) return false;
  try {
    window.AppleID.auth.init({
      clientId: APPLE_CLIENT_ID,
      scope: "name email",
      redirectURI: `${window.location.origin}${window.location.pathname}`,
      usePopup: true,
    });
    return true;
  } catch (_) {
    return false;
  }
}
