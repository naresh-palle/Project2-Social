import { GoogleLogin } from "@react-oauth/google";
import { AppleSignInButton } from "@/components/AppleSignInButton";

/**
 * Side-by-side Google + Apple icon controls.
 * - Google uses GIS icon-only (no wide iframe / One Tap → no random background images)
 * - Apple is type=button and must sit outside password forms so it never steals submit
 */
export function SocialAuthButtons({
  onGoogleCredential,
  onGoogleError,
  onAppleClick,
  loading = false,
  mode = "signin",
}) {
  return (
    <div className="w-full flex flex-col items-center gap-2" data-testid="social-auth-row">
      <div className="flex items-center justify-center gap-4 relative z-10 isolate">
        <div
          className="h-11 w-11 overflow-hidden rounded-full bg-[#111] border border-white/15 flex items-center justify-center [&_iframe]:max-w-[44px] [&_div]:!m-0"
          data-testid="google-signin-button"
        >
          <GoogleLogin
            onSuccess={(res) => {
              if (res?.credential) onGoogleCredential?.(res.credential);
              else onGoogleError?.();
            }}
            onError={() => onGoogleError?.()}
            type="icon"
            shape="circle"
            theme="filled_black"
            size="large"
            text={mode === "signup" ? "continue_with" : "signin_with"}
            useOneTap={false}
            auto_select={false}
            locale="en"
          />
        </div>
        <AppleSignInButton
          mode={mode}
          loading={loading}
          variant="icon"
          onClick={onAppleClick}
        />
      </div>
      <p className="font-mono text-[10px] tracking-widest uppercase opacity-50">Google · Apple</p>
    </div>
  );
}
