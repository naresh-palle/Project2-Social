import { GoogleLogin } from "@react-oauth/google";

/**
 * Google Identity button.
 * Keep the official GIS button visible — opacity:0 overlays and click-through
 * hacks break FedCM / origin checks and make sign-in look "dead".
 */
export function SocialAuthButtons({
  onGoogleCredential,
  onGoogleError,
  loading = false,
  mode = "signin",
}) {
  const fail = (reason) => {
    onGoogleError?.(reason || "Google sign-in failed");
  };

  return (
    <div
      className={`w-full flex justify-center ${loading ? "opacity-60 pointer-events-none" : ""}`}
      data-testid="social-auth-row"
    >
      <div
        className="w-full max-w-sm min-h-[40px] flex items-center justify-center overflow-visible"
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
          theme="filled_black"
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
