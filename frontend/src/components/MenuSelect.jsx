import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Premium single-select menu (replaces dull native <select>).
 * Portaled so it never clips under scroll containers.
 *
 * options: [{ value, label, icon?, description? }]
 */
export function MenuSelect({
  value = "",
  onChange,
  options = [],
  placeholder = "Select",
  label,
  className = "",
  disabled = false,
  "aria-label": ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));
  const display = selected?.label || placeholder;

  const updatePosition = () => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const spaceBelow = viewportH - rect.bottom;
    const openUp = spaceBelow < 260 && rect.top > spaceBelow;
    const width = Math.min(Math.max(rect.width, 180), Math.min(viewportW - 16, 320));
    let left = rect.left;
    if (left + width > viewportW - 8) left = Math.max(8, viewportW - width - 8);
    setMenuStyle({
      position: "fixed",
      left,
      width,
      zIndex: 9999,
      ...(openUp
        ? { bottom: viewportH - rect.top + 6, top: "auto" }
        : { top: rect.bottom + 6, bottom: "auto" }),
      maxHeight: Math.min(280, openUp ? rect.top - 12 : spaceBelow - 12),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
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

  return (
    <div className={`relative min-w-0 ${className}`} ref={ref}>
      {label ? (
        <div className="font-mono text-[8px] uppercase tracking-[0.22em] text-white/40 mb-1.5 px-0.5">
          {label}
        </div>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || label || placeholder}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all disabled:opacity-50 ${
          open
            ? "border-[#FF3B30]/60 bg-[#1A1212] shadow-[0_0_0_1px_rgba(255,59,48,0.15)]"
            : "border-white/15 bg-gradient-to-b from-white/[0.07] to-white/[0.02] hover:border-white/30 hover:from-white/[0.09]"
        }`}
      >
        {selected?.icon ? (
          <span className="text-white/70 shrink-0">{selected.icon}</span>
        ) : null}
        <span className={`flex-1 text-[12px] font-medium truncate ${selected ? "text-[#F4F4F0]" : "text-white/45"}`}>
          {display}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-white/55 transition-transform duration-200 ${open ? "rotate-180 text-[#FF3B30]" : ""}`}
        />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && menuStyle && (
              <motion.div
                ref={menuRef}
                role="listbox"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                style={menuStyle}
                className="overflow-y-auto rounded-2xl border border-white/15 bg-[#121216]/98 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.55)] py-1.5"
              >
                {options.map((opt) => {
                  const active = String(opt.value) === String(value);
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange?.(opt.value);
                        setOpen(false);
                      }}
                      className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                        active ? "bg-[#FF3B30]/15" : "hover:bg-white/[0.06]"
                      }`}
                    >
                      {opt.icon ? (
                        <span className={`mt-0.5 shrink-0 ${active ? "text-[#FF3B30]" : "text-white/55"}`}>
                          {opt.icon}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[12px] font-medium ${active ? "text-white" : "text-white/85"}`}>
                          {opt.label}
                        </span>
                        {opt.description ? (
                          <span className="block text-[10px] text-white/40 mt-0.5 leading-snug">{opt.description}</span>
                        ) : null}
                      </span>
                      {active ? <Check className="w-3.5 h-3.5 text-[#FF3B30] shrink-0 mt-0.5" /> : null}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
