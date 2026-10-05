/**
 * flugr brand system: supplied wordmark, paper-plane mark, and hero lockup.
 * - mark: violet/blue paper plane for compact headers
 * - wordmark: ivory logo for dark UI
 * - hero: wordmark plus "Create • Collaborate • Grow"
 * - surface="paper": ink wordmark for light invoices
 */
export const LOGO_CACHE = "v5";

export function brandAsset(path) {
  const base = `${process.env.PUBLIC_URL || ""}/${String(path).replace(/^\//, "")}`;
  return `${base}${base.includes("?") ? "&" : "?"}v=${LOGO_CACHE}`;
}

export function BrandLogo({
  variant = "wordmark",
  surface = "dark",
  className = "",
  alt = "flugr",
  height = 36,
}) {
  const src =
    variant === "mark"
      ? brandAsset("brand/flugr-mark.png")
      : variant === "hero"
        ? brandAsset("brand/flugr-logo-hero.png")
      : surface === "paper"
        ? brandAsset("brand/flugr-logo-paper.png")
        : brandAsset("flugr-logo.png");

  return (
    <img
      src={src}
      alt={alt}
      height={height}
      className={`w-auto object-contain object-left border-0 select-none ${className}`}
      style={{
        height,
        maxWidth:
          variant === "mark"
            ? Math.round(height * 1.55)
            : Math.round(height * 3.4),
      }}
      draggable={false}
    />
  );
}
