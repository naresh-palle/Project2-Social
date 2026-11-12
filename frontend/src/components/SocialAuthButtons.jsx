import { GoogleLogin } from "@react-oauth/google";
import { Instagram, Facebook } from "lucide-react";
import { startSocialOAuth } from "@/lib/onboarding";
import { META_SOCIAL_BUTTONS_ENABLED } from "@/lib/features";

/**
 * Social auth row.
 * - Google always available.
 * - Instagram / Facebook on Sign In + category register (forceMeta / META_SOCIAL_BUTTONS_ENABLED).
 * - Splash stays categories-only (no this component).
 */
export function SocialAuthButtons({
  onGoogleCredential,
  onGoogleError,
  loading = false,
  mode = "signin",
  role,
  showMeta = META_SOCIAL_BUTTONS_ENABLED,
  forceMeta = false,
}) {
  // forceMeta: category register restores IG/FB even while global flag stays off (login/splash).
  const metaOn = Boolean(forceMeta || showMeta);

  const fail = (reason) => {
    onGoogleError?.(reason || "Google sign-in failed");
  };

  const metaMode = mode === "signup" ? "signup" : "login";

  const startMeta = (provider) => {
    startSocialOAuth(provider, { mode: metaMode, role });
  };

  return (
    <div className={`w-full space-y-3 ${loading ? "opacity-60 pointer-events-none" : ""}`} data-testid="social-auth-row">
      <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#A9824A] font-bold text-center">
        Continue with
      </p>

      {metaOn && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="social-instagram"
            onClick={() => startMeta("instagram")}
            className="flex items-center justify-center gap-2 rounded-full border border-[#D9CBB3] bg-[#FBF7F0] hover:border-[#A9824A] hover:bg-[#F6F0E6] px-4 py-2.5 text-[13px] font-semibold text-[#2A201A] transition-colors"
          >
            <Instagram className="w-4 h-4 text-[#A9824A]" strokeWidth={2.2} />
            Instagram
          </button>
          <button
            type="button"
            data-testid="social-facebook"
            onClick={() => startMeta("facebook")}
            className="flex items-center justify-center gap-2 rounded-full border border-[#D9CBB3] bg-[#FBF7F0] hover:border-[#A9824A] hover:bg-[#F6F0E6] px-4 py-2.5 text-[13px] font-semibold text-[#2A201A] transition-colors"
          >
            <Facebook className="w-4 h-4 text-[#A9824A]" strokeWidth={2.2} />
            Facebook
          </button>
        </div>
      )}

      <div
        className="w-full max-w-sm min-h-[40px] flex items-center justify-center overflow-visible mx-auto"
        data-testid="google-signin-button"
      >
        <GoogleLogin
          onSuccess={(res) => {
            if (res?.credential) onGoogleCredential?.(res.credential);
            else fail("Google did not return a sign-in credential");
          }}
          onError={() =>
            fail(
              "Google Error 400: origin_mismatch — add https://flugr.in to Authorized JavaScript origins in Google Cloud Console (OAuth Web client), save, wait 1–5 min, hard-refresh."
            )
          }
          theme="outline"
          shape="pill"
          size="large"
          text={mode === "signup" ? "continue_with" : "signin_with"}
          width="320"
          useOneTap={false}
          auto_select={false}
          context={mode === "signup" ? "signup" : "signin"}
          ux_mode="popup"
          locale="en"
        />
      </div>
    </div>
  );
}
