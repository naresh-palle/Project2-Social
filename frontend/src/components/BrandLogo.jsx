/**
 * flugr brand system (P6 stacked identity)
 * - mark: gradient paper-plane app mark
 * - wordmark: horizontal mark + "flugr" for nav/headers
 * - stacked / hero: full stacked lockup with tagline (landing/splash)
 * - surface="paper"|"light": light UI assets (default)
 */
export const LOGO_CACHE = "v8-palram";

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
  const stacked = variant === "stacked" || variant === "hero";
  const src =
    variant === "mark"
      ? brandAsset("brand/flugr-mark.png")
      : stacked
        ? brandAsset("brand/flugr-logo-stacked.png")
        : brandAsset("brand/flugr-logo-paper.png");

  const maxW = variant === "mark"
    ? Math.round(height * 1.2)
    : stacked
      ? Math.round(height * 0.85)
      : Math.round(height * 4.8);

  return (
    <img
      src={src}
      alt={alt}
      height={height}
      className={`w-auto object-contain border-0 select-none ${
        stacked ? "object-center" : "object-left"
      } ${className}`}
      style={{
        height,
        maxWidth: maxW,
      }}
      draggable={false}
    />
  );
}
