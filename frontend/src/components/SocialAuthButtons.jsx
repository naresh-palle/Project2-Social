import { GoogleLogin } from "@react-oauth/google";
import { Instagram, Facebook } from "lucide-react";
import { startSocialOAuth } from "@/lib/onboarding";
import { toast } from "sonner";
import { META_SOCIAL_BUTTONS_ENABLED } from "@/lib/features";

/**
 * Social auth row.
 * Google (GIS) is always shown.
 * Instagram / Facebook stay hidden until META_SOCIAL_BUTTONS_ENABLED is flipped on
 * (backend OAuth routes remain available).
 */
export function SocialAuthButtons({
  onGoogleCredential,
  onGoogleError,
  loading = false,
  mode = "signin",
  role,
  showMeta = META_SOCIAL_BUTTONS_ENABLED,
}) {
  const fail = (reason) => {
    onGoogleError?.(reason || "Google sign-in failed");
  };

  const metaMode = mode === "signup" ? "signup" : "login";

  const startMeta = (provider) => {
    if (!META_SOCIAL_BUTTONS_ENABLED) {
      toast.error("This sign-in method is not available yet.");
      return;
    }
    startSocialOAuth(provider, { mode: metaMode, role });
  };

  return (
    <div className={`w-full space-y-3 ${loading ? "opacity-60 pointer-events-none" : ""}`} data-testid="social-auth-row">
      <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#A9824A] font-bold text-center">
        Continue with
      </p>

      {showMeta && META_SOCIAL_BUTTONS_ENABLED && (
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
              "Google sign-in failed. This domain may not be authorized for the Google client ID (origin_mismatch)."
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
