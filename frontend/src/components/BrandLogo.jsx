/**
 * flugr brand — sample mark (rounded square + bronze corner dot) + Fraunces wordmark.
 * Mark art: public/brand/flugr-mark.png (from brand sample).
 */
export const LOGO_CACHE = "v11-sample";

const ESPRESSO = "#2A201A";
const CREAM = "#F6F0E6";

function brandSrc(file) {
  const base = `${process.env.PUBLIC_URL || ""}/brand/${file}`;
  return `${base}${base.includes("?") ? "&" : "?"}v=${LOGO_CACHE}`;
}

function FlugrMark({ size = 40, dark = false, className = "" }) {
  const src = dark ? brandSrc("flugr-mark-dark.png") : brandSrc("flugr-mark.png");
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={`shrink-0 object-contain select-none ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

function FlugrWord({ height = 28, dark = false, className = "" }) {
  const color = dark ? CREAM : ESPRESSO;
  const fontSize = Math.round(height * 0.92);
  return (
    <span
      className={`font-brand lowercase leading-none select-none ${className}`}
      style={{
        color,
        fontSize,
        fontWeight: 600,
        letterSpacing: "-0.04em",
        lineHeight: 1,
      }}
    >
      flugr
    </span>
  );
}

export function brandAsset(path) {
  const base = `${process.env.PUBLIC_URL || ""}/${String(path).replace(/^\//, "")}`;
  return `${base}${base.includes("?") ? "&" : "?"}v=${LOGO_CACHE}`;
}

/**
 * @param {"mark"|"wordmark"|"stacked"|"hero"} variant
 * @param {"paper"|"light"|"dark"} surface
 */
export function BrandLogo({
  variant = "wordmark",
  surface = "paper",
  className = "",
  alt = "flugr",
  height = 36,
}) {
  const dark = surface === "dark";
  const stacked = variant === "stacked" || variant === "hero";
  const markOnly = variant === "mark";
  const markSize = markOnly ? height : Math.round(height * 0.92);

  if (markOnly) {
    return (
      <span className={`inline-flex items-center justify-center ${className}`} role="img" aria-label={alt}>
        <FlugrMark size={markSize} dark={dark} />
      </span>
    );
  }

  if (stacked) {
    return (
      <span
        className={`inline-flex flex-col items-center gap-2.5 ${className}`}
        role="img"
        aria-label={alt}
        style={{ maxWidth: Math.round(height * 2.6) }}
      >
        <FlugrMark size={Math.round(height * 0.62)} dark={dark} />
        <FlugrWord height={Math.round(height * 0.42)} dark={dark} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2.5 ${className}`}
      role="img"
      aria-label={alt}
      style={{ height, maxWidth: Math.round(height * 5.2) }}
    >
      <FlugrMark size={markSize} dark={dark} />
      <FlugrWord height={Math.round(height * 0.72)} dark={dark} />
    </span>
  );
}

export default BrandLogo;
