/**
 * flugr brand mark / wordmark.
 * - mark: speed-F icon (favicons, compact headers)
 * - wordmark: F + FLUGR lockup (nav, splash, auth)
 */
export function BrandLogo({
  variant = "wordmark",
  className = "",
  alt = "flugr",
  height = 36,
}) {
  const src =
    variant === "mark"
      ? `${process.env.PUBLIC_URL}/brand/flugr-mark.png`
      : `${process.env.PUBLIC_URL}/flugr-logo.png`;

  return (
    <img
      src={src}
      alt={alt}
      height={height}
      className={`w-auto object-contain object-left border-0 select-none ${className}`}
      style={{ height, maxWidth: variant === "mark" ? height * 1.4 : undefined }}
      draggable={false}
    />
  );
}
