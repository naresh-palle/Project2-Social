/**
 * flugr brand system: supplied wordmark, paper-plane mark, and hero lockup.
 * - mark: violet/blue paper plane for compact headers
 * - wordmark: ink logo for light UI (default); ivory when surface="dark"
 * - hero: wordmark plus "Create • Collaborate • Grow" (ivory for dark stages)
 * - surface="paper": ink wordmark for light surfaces (default)
 */
export const LOGO_CACHE = "v6";

export function brandAsset(path) {
  const base = `${process.env.PUBLIC_URL || ""}/${String(path).replace(/^\//, "")}`;
  return `${base}${base.includes("?") ? "&" : "?"}v=${LOGO_CACHE}`;
}

export function BrandLogo({
  variant = "wordmark",
  surface = "paper",
  className = "",
  alt = "flugr",
  height = 36,
}) {
  const ink = surface === "paper" || surface === "light";
  const src =
    variant === "mark"
      ? brandAsset("brand/flugr-mark.png")
      : variant === "hero"
        ? ink
          ? brandAsset("brand/flugr-logo-paper.png")
          : brandAsset("brand/flugr-logo-hero.png")
      : ink
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
            ? Math.round(height * 1.2)
            : Math.round(height * 4.2),
      }}
      draggable={false}
    />
  );
}
