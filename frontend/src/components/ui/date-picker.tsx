import { useState } from "react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@flowposltd/ui";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils";

interface DatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  disablePastDates?: boolean;
  placeholder?: string;
  className?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateOnly(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function DatePicker({ value, onChange, disablePastDates = true, placeholder = "Pick a date", className }: DatePickerProps) {
  const selected = parseDateOnly(value);
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selected ?? today);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  function isDisabled(d: Date): boolean {
    return disablePastDates && d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  function pick(d: Date) {
    if (isDisabled(d)) return;
    onChange(toDateOnly(d));
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setViewDate(selected ?? today);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring",
            !selected && "text-content-tertiary",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-content-secondary" />
          {selected ? selected.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center justify-between pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <p className="text-sm font-semibold text-foreground">
            {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="py-1 text-xs font-medium text-content-tertiary">
              {w}
            </span>
          ))}
          {cells.map((d, i) =>
            d ? (
              <button
                key={i}
                type="button"
                disabled={isDisabled(d)}
                onClick={() => pick(d)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm transition-colors",
                  selected && isSameDay(d, selected)
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "text-foreground hover:bg-secondary",
                  isDisabled(d) && "cursor-not-allowed text-content-tertiary/40 hover:bg-transparent"
                )}
              >
                {d.getDate()}
              </button>
            ) : (
              <span key={i} />
            )
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
