import { useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Instagram, Facebook } from "lucide-react";
import { startSocialOAuth } from "@/lib/onboarding";
import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * Social registration / login row: Instagram, Facebook, Google.
 * Google uses GIS ID-token (no client secret in browser).
 * Instagram / Facebook use official backend OAuth redirect (+ PKCE / state).
 */
export function SocialAuthButtons({
  onGoogleCredential,
  onGoogleError,
  loading = false,
  mode = "signin",
  role,
  showMeta = true,
}) {
  const [providers, setProviders] = useState({});

  useEffect(() => {
    let cancelled = false;
    api
      .get("/oauth/providers")
      .then(({ data }) => {
        if (cancelled) return;
        const map = {};
        (data?.providers || []).forEach((p) => {
          map[p.provider] = p;
        });
        setProviders(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const fail = (reason) => {
    onGoogleError?.(reason || "Google sign-in failed");
  };

  const metaMode = mode === "signup" ? "signup" : "login";

  const startMeta = (provider) => {
    const info = providers[provider];
    if (info && info.auth_code_ready === false) {
      toast.error(
        `${provider === "instagram" ? "Instagram" : "Facebook"} is not configured yet. Add App ID/Secret on the API, then try again.`
      );
      return;
    }
    startSocialOAuth(provider, { mode: metaMode, role });
  };

  return (
    <div className={`w-full space-y-3 ${loading ? "opacity-60 pointer-events-none" : ""}`} data-testid="social-auth-row">
      <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#A9824A] font-bold text-center">
        Continue with
      </p>

      {showMeta && (
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
