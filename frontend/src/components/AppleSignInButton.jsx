/** Official-style Apple mark */
export function AppleIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.365 1.43c0 1.14-.422 2.2-1.18 3.01-.79.84-2.1 1.49-3.24 1.4-.14-1.1.43-2.26 1.18-3.04.8-.84 2.18-1.45 3.24-1.37zM20.76 17.4c-.55 1.27-.82 1.84-1.53 2.96-.99 1.55-2.39 3.48-4.13 3.5-1.54.02-1.94-.99-4.04-.98-2.1.01-2.54 1-4.08.98-1.74-.02-3.07-1.76-4.06-3.3C1.2 17.66.1 13.4 1.9 10.55c1.14-1.8 2.95-2.86 4.64-2.86 1.73 0 2.82 1 4.77 1 1.9 0 2.88-1.01 4.86-1.01 1.54 0 3.17.84 4.3 2.29-3.78 2.07-3.17 7.47.29 7.43z" />
    </svg>
  );
}

/** Compact Apple button sized to match Google's "large" control (~240×40). */
export function AppleSignInButton({ onClick, loading, mode = "signin", className = "" }) {
  const label = mode === "signup" ? "Continue with Apple" : "Sign in with Apple";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      data-testid="apple-signin-button"
      aria-label={label}
      className={`w-[240px] h-10 max-w-full bg-white hover:bg-neutral-100 text-black text-[14px] leading-none font-medium rounded-[4px] inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 border border-black/10 ${className}`}
      style={{ fontFamily: "Roboto, 'Helvetica Neue', Arial, sans-serif" }}
    >
      <AppleIcon className="w-4 h-4 text-black shrink-0" />
      <span>{loading ? "Connecting…" : label}</span>
    </button>
  );
}
