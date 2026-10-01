import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { daysInMonth, localIsoDate, parseIsoDate, toIsoDate } from '../../lib/date';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Monday-first week.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** 0 = Monday … 6 = Sunday. */
const mondayIndex = (year: number, month: number, day: number) => (new Date(year, month - 1, day).getDay() + 6) % 7;

const shiftDays = (iso: string, days: number) => {
  const p = parseIsoDate(iso)!;
  return localIsoDate(new Date(p.year, p.month - 1, p.day + days));
};

// Moves by whole months, clamping the day (31 Jan + 1 month → 28/29 Feb).
const shiftMonths = (iso: string, months: number) => {
  const p = parseIsoDate(iso)!;
  const target = new Date(p.year, p.month - 1 + months, 1);
  const year = target.getFullYear();
  const month = target.getMonth() + 1;
  return toIsoDate(year, month, Math.min(p.day, daysInMonth(year, month)));
};

const setMonthYear = (iso: string, year: number, month: number) => {
  const p = parseIsoDate(iso)!;
  return toIsoDate(year, month, Math.min(p.day, daysInMonth(year, month)));
};

interface CalendarProps {
  /** Selected date, ISO "YYYY-MM-DD" or ''. */
  value: string;
  onSelect: (iso: string) => void;
  min?: string;
  max?: string;
  /** Move focus into the day grid on mount (when opened via the calendar button / keyboard). */
  autoFocus?: boolean;
  /** When set, a "Clear" action is shown. */
  onClear?: () => void;
}

const navButton =
  'flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export const Calendar = ({ value, onSelect, min, max, autoFocus, onClear }: CalendarProps) => {
  const today = localIsoDate();
  const [focusIso, setFocusIso] = useState(() => (parseIsoDate(value) ? value.slice(0, 10) : today));
  const gridRef = useRef<HTMLDivElement>(null);
  const moveFocusRef = useRef(Boolean(autoFocus));

  const focus = parseIsoDate(focusIso)!;
  const selectedIso = parseIsoDate(value) ? value.slice(0, 10) : '';
  const isDisabled = (iso: string) => Boolean((min && iso < min) || (max && iso > max));

  // Roving focus: after keyboard navigation, move DOM focus to the newly focused cell.
  useEffect(() => {
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('[data-focused="true"]')?.focus();
  }, [focusIso]);

  const moveTo = (iso: string) => {
    moveFocusRef.current = true;
    setFocusIso(iso);
  };

  const onGridKeyDown = (e: KeyboardEvent) => {
    const weekday = mondayIndex(focus.year, focus.month, focus.day);
    const moves: Record<string, () => string> = {
      ArrowLeft: () => shiftDays(focusIso, -1),
      ArrowRight: () => shiftDays(focusIso, 1),
      ArrowUp: () => shiftDays(focusIso, -7),
      ArrowDown: () => shiftDays(focusIso, 7),
      Home: () => shiftDays(focusIso, -weekday),
      End: () => shiftDays(focusIso, 6 - weekday),
      PageUp: () => shiftMonths(focusIso, e.shiftKey ? -12 : -1),
      PageDown: () => shiftMonths(focusIso, e.shiftKey ? 12 : 1),
    };
    const next = moves[e.key];
    if (next) {
      e.preventDefault();
      moveTo(next());
    }
  };

  // Year dropdown covers min/max when given, else a practical window around today and the
  // focused year (so old join dates stay reachable).
  const thisYear = new Date().getFullYear();
  const firstYear = Math.min(min ? Number(min.slice(0, 4)) : thisYear - 30, focus.year);
  const lastYear = Math.max(max ? Number(max.slice(0, 4)) : thisYear + 5, focus.year);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => lastYear - i);

  const firstOfMonth = toIsoDate(focus.year, focus.month, 1);
  const gridStart = shiftDays(firstOfMonth, -mondayIndex(focus.year, focus.month, 1));
  const cells = Array.from({ length: 42 }, (_, i) => shiftDays(gridStart, i));

  return (
    <div className="w-[18.5rem] select-none">
      <div className="mb-3 flex items-center gap-1.5">
        <button type="button" aria-label="Previous month" onClick={() => setFocusIso(shiftMonths(focusIso, -1))} className={navButton}>
          <ChevronLeft className="size-4" strokeWidth={1.75} />
        </button>
        <Select value={String(focus.month)} onValueChange={(v) => setFocusIso(setMonthYear(focusIso, focus.year, Number(v)))}>
          <SelectTrigger aria-label="Month" className="h-8 flex-1 bg-card px-2.5 text-[13px] font-medium max-sm:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {MONTHS.map((name, i) => (
              <SelectItem key={name} value={String(i + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(focus.year)} onValueChange={(v) => setFocusIso(setMonthYear(focusIso, Number(v), focus.month))}>
          <SelectTrigger aria-label="Year" className="h-8 w-[5.75rem] shrink-0 bg-card px-2.5 text-[13px] font-medium max-sm:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button type="button" aria-label="Next month" onClick={() => setFocusIso(shiftMonths(focusIso, 1))} className={navButton}>
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      <div ref={gridRef} role="grid" aria-label={`${MONTHS[focus.month - 1]} ${focus.year}`} onKeyDown={onGridKeyDown}>
        <div role="row" className="mb-1 grid grid-cols-7">
          {WEEKDAYS.map((d, i) => (
            <span key={d} role="columnheader" aria-label={WEEKDAY_NAMES[i]} className="py-1 text-center text-xs font-medium text-muted-foreground">
              {d}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, row) => (
          <div role="row" key={row} className="grid grid-cols-7">
            {cells.slice(row * 7, row * 7 + 7).map((iso, col) => {
              const p = parseIsoDate(iso)!;
              const inMonth = p.month === focus.month;
              const isSelected = iso === selectedIso;
              const isToday = iso === today;
              const disabled = isDisabled(iso);
              const isFocused = iso === focusIso;
              return (
                <div role="gridcell" key={iso} aria-selected={isSelected} className="flex justify-center p-0.5">
                  <button
                    type="button"
                    tabIndex={isFocused ? 0 : -1}
                    data-focused={isFocused}
                    disabled={disabled}
                    aria-label={`${WEEKDAY_NAMES[col]}, ${p.day} ${MONTHS[p.month - 1]} ${p.year}${isToday ? ' (today)' : ''}`}
                    aria-current={isToday ? 'date' : undefined}
                    onClick={() => onSelect(iso)}
                    // Only sync focus within the visible month: re-rendering the grid for an
                    // adjacent-month day on mousedown would swallow the click that follows.
                    onFocus={() => inMonth && setFocusIso(iso)}
                    className={cn(
                      'flex size-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                      isSelected
                        ? 'bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90'
                        : cn('hover:bg-accent hover:text-primary', inMonth ? 'text-foreground' : 'text-muted-foreground/50'),
                      isToday && !isSelected && 'font-semibold text-primary ring-1 ring-inset ring-primary/50',
                      disabled && 'pointer-events-none opacity-30',
                    )}
                  >
                    {p.day}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between pt-1">
        <button
          type="button"
          disabled={isDisabled(today)}
          onClick={() => onSelect(today)}
          className="rounded-md px-2 py-1 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          Today
        </button>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
};
