import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** ISO yyyy-MM-dd value with calendar popover + native fallback. */
export function DateField({ value, onChange, required = false, className = "", placeholder = "Pick a date" }) {
  const [open, setOpen] = useState(false);
  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const validSelected = selected && isValid(selected) ? selected : undefined;

  return (
    <div className={`relative ${className}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inp flex items-center justify-between gap-3 text-left w-full"
            data-testid="date-field-trigger"
          >
            <span className={validSelected ? "" : "opacity-40"}>
              {validSelected ? format(validSelected, "dd MMM yyyy") : placeholder}
            </span>
            <CalendarIcon className="w-4 h-4 opacity-60 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-[#121212] border border-white/20 text-[#F4F4F0]" align="start">
          <Calendar
            mode="single"
            selected={validSelected}
            onSelect={(d) => {
              if (!d) return;
              onChange(format(d, "yyyy-MM-dd"));
              setOpen(false);
            }}
            initialFocus
            className="bg-[#121212]"
          />
        </PopoverContent>
      </Popover>
      {/* Keep a hidden native input for form semantics / accessibility */}
      <input
        type="date"
        required={required}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
