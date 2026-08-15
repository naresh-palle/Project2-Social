/** Hover label for icon-only controls. */
export function IconTip({ label, children, className = "", side = "bottom" }) {
  const pos =
    side === "top"
      ? "bottom-full mb-1.5 left-1/2 -translate-x-1/2"
      : side === "left"
        ? "right-full mr-1.5 top-1/2 -translate-y-1/2"
        : side === "right"
          ? "left-full ml-1.5 top-1/2 -translate-y-1/2"
          : "top-full mt-1.5 left-1/2 -translate-x-1/2";

  return (
    <span className={`relative inline-flex group/icontip ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`theme-keep-dark pointer-events-none absolute ${pos} z-[80] whitespace-nowrap rounded-3xl border border-white/20 bg-[#111] px-2 py-1 font-sans text-[9px] tracking-[0.14em] uppercase text-white opacity-0 translate-y-0.5 shadow-lg transition-all duration-150 group-hover/icontip:opacity-100 group-hover/icontip:translate-y-0 group-focus-within/icontip:opacity-100`}
      >
        {label}
      </span>
    </span>
  );
}
