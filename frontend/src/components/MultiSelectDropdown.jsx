import { useEffect, useRef, useState } from "react";
import { X, ChevronDown, Check } from "lucide-react";

/**
 * Shared multi-select dropdown.
 * - selected=[] means "All" when allowAll is true (default for filters)
 * - single=true for single-value picks (availability, etc.)
 */
export function MultiSelectDropdown({
  options = [],
  selected = [],
  onChange,
  placeholder = "All",
  single = false,
  allowAll = false,
  compact = false,
  noUnderline = false,
  className = "",
  label,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const values = Array.isArray(selected) ? selected : selected ? [selected] : [];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showAll = allowAll && values.length === 0;

  const toggle = (opt) => {
    if (single) {
      onChange?.([opt]);
      setOpen(false);
      return;
    }
    if (values.includes(opt)) onChange?.(values.filter((x) => x !== opt));
    else onChange?.([...values, opt]);
  };

  const clearAll = (e) => {
    e?.stopPropagation?.();
    onChange?.([]);
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      {label && (
        <label className="font-sans text-[10px] tracking-[0.14em] uppercase opacity-60 font-medium leading-none block mb-1">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full bg-transparent outline-none cursor-pointer flex justify-between items-center gap-3 transition-colors text-left ${
          noUnderline
            ? "border border-white/15 hover:border-white/30 focus:border-[#FF3B30] px-3 rounded-sm"
            : "border-b border-white/15 hover:border-white/30 focus:border-[#FF3B30]"
        } ${compact ? "py-2 min-h-[36px]" : "py-3 min-h-[48px]"}`}
      >
        <div className="flex flex-wrap gap-1.5 items-center flex-1 min-w-0">
          {showAll || values.length === 0 ? (
            <span
              className={`font-sans inline-flex items-center gap-1.5 ${
                allowAll ? "text-white" : "opacity-60"
              } ${compact ? "text-sm" : "text-base"}`}
            >
              {allowAll ? (
                <span className="px-2 py-0.5 bg-white/5 border border-white/15 rounded-sm text-[11px] inline-flex items-center gap-1.5">
                  All
                  <Check className="w-3 h-3 text-[#FF3B30]" />
                </span>
              ) : (
                placeholder || "Select…"
              )}
            </span>
          ) : (
            values.map((sel) => (
              <span
                key={sel}
                className="px-2 py-0.5 bg-white/5 border border-white/15 rounded-sm text-[11px] font-sans inline-flex w-fit items-center gap-1.5 whitespace-nowrap"
              >
                <span>{sel}</span>
                {!single && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange?.(values.filter((x) => x !== sel));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        onChange?.(values.filter((x) => x !== sel));
                      }
                    }}
                    className="opacity-50 hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 opacity-50 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-[#121212] border border-white/15 z-50 shadow-2xl"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.2) transparent" }}
        >
          {allowAll && (
            <button
              type="button"
              onClick={clearAll}
              className={`w-full p-2.5 text-left hover:bg-white/5 border-b border-white/5 flex justify-between items-center font-sans text-sm ${
                showAll ? "text-[#FF3B30] bg-white/[0.03]" : "opacity-70 hover:opacity-100"
              }`}
            >
              <span>All</span>
              {showAll && <Check className="w-3.5 h-3.5" />}
            </button>
          )}
          {options.map((opt) => {
            const isSel = values.includes(opt);
            return (
              <button
                type="button"
                key={opt}
                onClick={() => toggle(opt)}
                className={`w-full p-2.5 text-left hover:bg-white/5 border-b border-white/5 flex justify-between items-center font-sans text-sm transition-colors ${
                  isSel ? "text-[#FF3B30] bg-white/[0.03]" : "opacity-70 hover:opacity-100"
                }`}
              >
                <span>{opt}</span>
                {isSel && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MultiSelectDropdown;
