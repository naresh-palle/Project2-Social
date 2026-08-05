import { useMemo, useState } from "react";
import { format, parse, isValid, getYear, getMonth, getDate, setYear, setMonth, setDate } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Normalize API / form values into yyyy-MM-dd. */
export function toIsoDate(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  if (!s) return "";

  // Already ISO date or datetime
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const d = parse(iso[1], "yyyy-MM-dd", new Date());
    return isValid(d) ? iso[1] : "";
  }

  // dd/MM/yyyy or dd-MM-yyyy
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const d = parse(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`, "yyyy-MM-dd", new Date());
    return isValid(d) ? format(d, "yyyy-MM-dd") : "";
  }

  const asDate = new Date(s);
  if (!Number.isNaN(asDate.getTime())) return format(asDate, "yyyy-MM-dd");
  return "";
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * ISO yyyy-MM-dd date control.
 * - Default: calendar popover with month/year dropdowns
 * - birthDate: year/month/day selects (usable for DOB without endless clicking)
 */
export function DateField({
  value,
  onChange,
  required = false,
  className = "",
  placeholder = "Pick a date",
  birthDate = false,
  fromYear,
  toYear,
}) {
  const [open, setOpen] = useState(false);

  const iso = toIsoDate(value);
  const selected = iso ? parse(iso, "yyyy-MM-dd", new Date()) : undefined;
  const validSelected = selected && isValid(selected) ? selected : undefined;

  const now = new Date();
  const maxYear = toYear ?? (birthDate ? getYear(now) - 13 : getYear(now) + 5);
  const minYear = fromYear ?? (birthDate ? 1940 : getYear(now) - 80);
  const years = useMemo(() => {
    const list = [];
    for (let y = maxYear; y >= minYear; y -= 1) list.push(y);
    return list;
  }, [minYear, maxYear]);

  const year = validSelected ? getYear(validSelected) : "";
  const month = validSelected ? getMonth(validSelected) : "";
  const day = validSelected ? getDate(validSelected) : "";
  const maxDay =
    year !== "" && month !== ""
      ? daysInMonth(Number(year), Number(month))
      : 31;

  const emitParts = (nextYear, nextMonth, nextDay) => {
    if (nextYear === "" || nextMonth === "" || nextDay === "") {
      onChange?.("");
      return;
    }
    const y = Number(nextYear);
    const m = Number(nextMonth);
    const dim = daysInMonth(y, m);
    const d = Math.min(Number(nextDay), dim);
    const date = setDate(setMonth(setYear(new Date(y, m, 1), y), m), d);
    if (!isValid(date)) return;
    if (birthDate && date > now) return;
    onChange?.(format(date, "yyyy-MM-dd"));
  };

  if (birthDate) {
    return (
      <div className={`relative ${className}`} data-testid="dob-field">
        <div className="grid grid-cols-3 gap-2">
          <select
            className="inp bg-[#0B0B0E] cursor-pointer text-sm"
            value={day}
            aria-label="Day"
            data-testid="dob-day"
            required={required}
            onChange={(e) => emitParts(year === "" ? maxYear - 18 : year, month === "" ? 0 : month, e.target.value)}
          >
            <option value="">Day</option>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d} className="bg-[#0B0B0E]">
                {d}
              </option>
            ))}
          </select>
          <select
            className="inp bg-[#0B0B0E] cursor-pointer text-sm"
            value={month}
            aria-label="Month"
            data-testid="dob-month"
            required={required}
            onChange={(e) => emitParts(year === "" ? maxYear - 18 : year, e.target.value, day === "" ? 1 : day)}
          >
            <option value="">Month</option>
            {MONTHS.map((label, idx) => (
              <option key={label} value={idx} className="bg-[#0B0B0E]">
                {label}
              </option>
            ))}
          </select>
          <select
            className="inp bg-[#0B0B0E] cursor-pointer text-sm"
            value={year}
            aria-label="Year"
            data-testid="dob-year"
            required={required}
            onChange={(e) => emitParts(e.target.value, month === "" ? 0 : month, day === "" ? 1 : day)}
          >
            <option value="">Year</option>
            {years.map((y) => (
              <option key={y} value={y} className="bg-[#0B0B0E]">
                {y}
              </option>
            ))}
          </select>
        </div>
        {!validSelected && placeholder ? (
          <p className="mt-1 font-sans text-[10px] tracking-wider uppercase opacity-40">{placeholder}</p>
        ) : null}
      </div>
    );
  }

  const defaultMonth = validSelected || new Date();

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
        <PopoverContent
          className="w-auto p-0 bg-[#121212] border border-white/20 text-[#F4F4F0] z-[80]"
          align="start"
          sideOffset={6}
        >
          <Calendar
            mode="single"
            selected={validSelected}
            defaultMonth={defaultMonth}
            captionLayout="dropdown-buttons"
            fromYear={minYear}
            toYear={maxYear}
            onSelect={(d) => {
              if (!d) return;
              onChange?.(format(d, "yyyy-MM-dd"));
              setOpen(false);
            }}
            initialFocus
            className="bg-[#121212]"
          />
        </PopoverContent>
      </Popover>
      <input
        type="date"
        required={required}
        value={iso || ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
