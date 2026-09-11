/**
 * flugr brand mark / wordmark (logo 3 lockup).
 * - mark: vermilion F (compact headers)
 * - wordmark: F + ivory italic flugr (dark UI)
 * - surface="paper": ink wordmark for light invoices
 */
export function BrandLogo({
  variant = "wordmark",
  surface = "dark",
  className = "",
  alt = "flugr",
  height = 36,
}) {
  const src =
    variant === "mark"
      ? `${process.env.PUBLIC_URL}/brand/flugr-mark.png`
      : surface === "paper"
        ? `${process.env.PUBLIC_URL}/brand/flugr-logo-paper.png`
        : `${process.env.PUBLIC_URL}/flugr-logo.png`;

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
