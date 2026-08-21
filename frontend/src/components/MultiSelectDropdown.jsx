import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, Check } from "lucide-react";

/**
 * Shared multi-select dropdown.
 * - selected=[] means "All" when allowAll is true (default for filters)
 * - single=true for single-value picks (availability, etc.)
 * Menu is portaled to document.body so it is never clipped/overlapped by
 * glass-panel overflow or sibling stacking contexts.
 * Colors use theme tokens (.msd-*) so options stay readable in dark + light mode.
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
  const [menuStyle, setMenuStyle] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const values = Array.isArray(selected) ? selected : selected ? [selected] : [];

  const updatePosition = () => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const spaceBelow = viewportH - rect.bottom;
    const openUp = spaceBelow < 220 && rect.top > spaceBelow;
    const width = Math.min(Math.max(rect.width, 160), Math.min(viewportW - 16, 288));
    let left = rect.left;
    if (left + width > viewportW - 8) left = Math.max(8, viewportW - width - 8);
    setMenuStyle({
      position: "fixed",
      left,
      width,
      zIndex: 9999,
      ...(openUp
        ? { bottom: viewportH - rect.top + 4, top: "auto" }
        : { top: rect.bottom + 4, bottom: "auto" }),
      maxHeight: Math.min(224, openUp ? rect.top - 12 : spaceBelow - 12),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, values.length, options.length]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    // capture scroll from any scrollable ancestor
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const inTrigger = ref.current && ref.current.contains(e.target);
      const inMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!inTrigger && !inMenu) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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

  const menu = open && menuStyle
    ? createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="msd-menu overflow-y-auto rounded-xl"
          role="listbox"
        >
          {allowAll && (
            <button
              type="button"
              onClick={clearAll}
              className={`msd-item w-full px-3 py-2 text-left border-b flex justify-between items-center gap-3 font-sans text-sm whitespace-nowrap ${
                showAll ? "msd-item-selected" : "msd-item-muted"
              }`}
            >
              <span>All</span>
              {showAll && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>
          )}
          {options.map((opt) => {
            const isSel = values.includes(opt);
            return (
              <button
                type="button"
                key={opt}
                onClick={() => toggle(opt)}
                className={`msd-item w-full px-3 py-2 text-left border-b flex justify-between items-center gap-3 font-sans text-sm whitespace-nowrap transition-colors ${
                  isSel ? "msd-item-selected" : "msd-item-muted"
                }`}
              >
                <span>{opt}</span>
                {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>,
        document.body
      )
    : null;

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
        aria-expanded={open}
        className={`msd-trigger w-full bg-transparent outline-none cursor-pointer flex justify-between items-center gap-3 transition-colors text-left ${
          noUnderline
            ? "border border-white/15 hover:border-white/30 focus:border-[#FF3B30] px-3 rounded-3xl"
            : "border-b border-white/15 hover:border-white/30 focus:border-[#FF3B30]"
        } ${compact ? "py-2 min-h-[36px]" : "py-3 min-h-[48px]"}`}
      >
        <div className="flex flex-wrap gap-1.5 items-center flex-1 min-w-0">
          {showAll || values.length === 0 ? (
            <span
              className={`font-sans ${
                allowAll ? "" : "msd-trigger-placeholder"
              } ${compact ? "text-sm" : "text-base"}`}
            >
              {allowAll ? "All" : (placeholder || "Select…")}
            </span>
          ) : (
            values.map((sel) => (
              <span
                key={sel}
                className="msd-chip px-2 py-0.5 rounded-3xl text-[11px] font-sans inline-flex w-fit items-center gap-1.5 whitespace-nowrap"
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
      {menu}
    </div>
  );
}

export default MultiSelectDropdown;
