/**
 * flugr brand mark — rounded square + bronze corner dot + Fraunces wordmark.
 * Geometry: 40-unit grid, stroke 2.5, rounded corners; dot on top-right.
 */
export const LOGO_CACHE = "v10-mark";

const ESPRESSO = "#2A201A";
const CREAM = "#F6F0E6";
const BRONZE = "#A9824A";
const BRONZE_LIGHT = "#C9A26B";

function FlugrMark({ size = 40, dark = false, className = "" }) {
  const stroke = dark ? CREAM : ESPRESSO;
  const dot = dark ? BRONZE_LIGHT : BRONZE;
  // 40-unit grid; stroke 2.5; bronze dot ≈ 1.7× stroke (not oversized)
  const sw = 2.5;
  const pad = sw / 2;
  const side = 40 - sw;
  const radius = 8.5;
  // Dot centered on outer top-right corner of the stroke path
  const cx = 40 - pad;
  const cy = pad;
  const r = 2.15; // diameter ~4.3 on 40 grid (~11% of mark)
  return (
    <svg
      width={size}
      height={size}
      viewBox="-1.5 -1.5 43 43"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      overflow="visible"
    >
      <rect
        x={pad}
        y={pad}
        width={side}
        height={side}
        rx={radius}
        ry={radius}
        stroke={stroke}
        strokeWidth={sw}
      />
      <circle cx={cx} cy={cy} r={r} fill={dot} />
    </svg>
  );
}

function FlugrWord({
  height = 28,
  dark = false,
  className = "",
}) {
  const color = dark ? CREAM : ESPRESSO;
  // Fraunces SemiBold, -4% tracking ≈ letterSpacing -0.04em
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

/**
 * @param {"mark"|"wordmark"|"stacked"|"hero"} variant
 * @param {"paper"|"light"|"dark"} surface — dark → cream ink on espresso
 */
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
        className={`inline-flex flex-col items-center gap-2 ${className}`}
        role="img"
        aria-label={alt}
        style={{ maxWidth: Math.round(height * 2.4) }}
      >
        <FlugrMark size={Math.round(height * 0.72)} dark={dark} />
        <FlugrWord height={Math.round(height * 0.55)} dark={dark} />
      </span>
    );
  }

  // wordmark: mark + flugr horizontal
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
