import { GoogleLogin } from "@react-oauth/google";
import { AppleIcon } from "@/components/AppleSignInButton";

function GoogleIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7 0-.7-.1-1.3-.2-1.9H12z" />
      <path fill="#34A853" d="M5.3 14.3l-.8.6-2.5 1.9C3.6 20 7.5 22.5 12 22.5c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 .9-3.6.9-2.8 0-5.1-1.9-5.9-4.4z" />
      <path fill="#4A90E2" d="M3.9 6.1C3.1 7.7 2.7 9.5 2.7 11.5s.4 3.8 1.2 5.4l3.3-2.6c-.4-1.1-.6-2-.6-2.8 0-.9.2-1.8.6-2.6L3.9 6.1z" />
      <path fill="#FBBC05" d="M12 4.7c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 1.7 14.7.8 12 .8 7.5.8 3.6 3.3 2 7.2l3.3 2.6C6.9 6.6 9.2 4.7 12 4.7z" />
    </svg>
  );
}

/**
 * Equal side-by-side Google + Apple buttons.
 * Google GIS control is clipped to the Google slot only (so Apple + form submit stay clickable).
 */
export function SocialAuthButtons({
  onGoogleCredential,
  onGoogleError,
  onAppleClick,
  loading = false,
  mode = "signin",
}) {
  const handleApple = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loading) onAppleClick?.(e);
  };

  return (
    <div className="w-full max-w-sm mx-auto" data-testid="social-auth-row">
      <div className="grid grid-cols-2 gap-2 w-full">
        {/* Google slot */}
        <div
          className="relative h-9 rounded-md overflow-hidden border border-white/15 bg-[#111] isolate"
          data-testid="google-signin-button"
        >
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center gap-2 text-white text-xs font-medium">
            <GoogleIcon className="w-4 h-4 shrink-0" />
            <span>Google</span>
          </div>
          {/* Real clickable Google control — only covers THIS cell */}
          <div className="absolute inset-0 z-10 opacity-0 cursor-pointer overflow-hidden [&>div]:!w-full [&>div]:!h-full [&_iframe]:!w-full [&_iframe]:!min-w-0 [&_iframe]:!max-w-full [&_iframe]:!h-[36px]">
            <GoogleLogin
              onSuccess={(res) => {
                if (res?.credential) onGoogleCredential?.(res.credential);
                else onGoogleError?.();
              }}
              onError={() => onGoogleError?.()}
              theme="filled_black"
              shape="rectangular"
              size="medium"
              text={mode === "signup" ? "continue_with" : "signin_with"}
              width="200"
              useOneTap={false}
              auto_select={false}
              locale="en"
            />
          </div>
        </div>

        {/* Apple slot — never a submit button; no focus ring steal from password form */}
        <button
          type="button"
          disabled={loading}
          onClick={handleApple}
          onMouseDown={(e) => e.preventDefault()}
          data-testid="apple-signin-button"
          aria-label={mode === "signup" ? "Continue with Apple" : "Sign in with Apple"}
          className="h-9 rounded-md border border-black/10 bg-white hover:bg-neutral-100 text-black text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 relative z-20 outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
        >
          <AppleIcon className="w-3.5 h-3.5 text-black shrink-0" />
          <span>Apple</span>
        </button>
      </div>
      <p className="mt-1 text-center font-sans text-[9px] tracking-widest uppercase text-white/40">
        Apple Sign In · In progress
      </p>
    </div>
  );
}
