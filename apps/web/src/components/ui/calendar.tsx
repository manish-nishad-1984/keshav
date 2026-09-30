import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { daysInMonth, localIsoDate, parseIsoDate, toIsoDate } from '../../lib/date';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Sunday-first with Sunday tinted, like an Indian wall calendar.
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type View = 'days' | 'months' | 'years';

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

export const Calendar = ({ value, onSelect, min, max, autoFocus, onClear }: CalendarProps) => {
  const today = localIsoDate();
  const [focusIso, setFocusIso] = useState(() => (parseIsoDate(value) ? value.slice(0, 10) : today));
  const [view, setView] = useState<View>('days');
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
  }, [focusIso, view]);

  const moveTo = (iso: string) => {
    moveFocusRef.current = true;
    setFocusIso(iso);
  };

  const onDayKeyDown = (e: KeyboardEvent) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => shiftDays(focusIso, -1),
      ArrowRight: () => shiftDays(focusIso, 1),
      ArrowUp: () => shiftDays(focusIso, -7),
      ArrowDown: () => shiftDays(focusIso, 7),
      Home: () => shiftDays(focusIso, -new Date(focus.year, focus.month - 1, focus.day).getDay()),
      End: () => shiftDays(focusIso, 6 - new Date(focus.year, focus.month - 1, focus.day).getDay()),
      PageUp: () => shiftMonths(focusIso, e.shiftKey ? -12 : -1),
      PageDown: () => shiftMonths(focusIso, e.shiftKey ? 12 : 1),
    };
    const next = moves[e.key];
    if (next) {
      e.preventDefault();
      moveTo(next());
    }
  };

  // ── header ────────────────────────────────────────────────────────────────
  const yearPageStart = focus.year - (focus.year % 12);
  const title =
    view === 'days' ? `${MONTHS[focus.month - 1]} ${focus.year}` : view === 'months' ? `${focus.year}` : `${yearPageStart} – ${yearPageStart + 11}`;
  const step = (dir: -1 | 1) =>
    setFocusIso(view === 'days' ? shiftMonths(focusIso, dir) : shiftMonths(focusIso, dir * (view === 'months' ? 12 : 144)));
  const stepLabel = view === 'days' ? 'month' : view === 'months' ? 'year' : '12 years';

  // ── day grid ──────────────────────────────────────────────────────────────
  const firstOfMonth = toIsoDate(focus.year, focus.month, 1);
  const gridStart = shiftDays(firstOfMonth, -new Date(focus.year, focus.month - 1, 1).getDay());
  const cells = Array.from({ length: 42 }, (_, i) => shiftDays(gridStart, i));

  return (
    <div className="w-[17.5rem] select-none">
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          type="button"
          aria-label={`Previous ${stepLabel}`}
          onClick={() => step(-1)}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          aria-live="polite"
          disabled={view === 'years'}
          onClick={() => setView(view === 'days' ? 'months' : 'years')}
          className="rounded-lg px-2.5 py-1 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:hover:bg-transparent"
        >
          {title}
        </button>
        <button
          type="button"
          aria-label={`Next ${stepLabel}`}
          onClick={() => step(1)}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div ref={gridRef}>
        {view === 'days' ? (
          <div role="grid" aria-label={`${MONTHS[focus.month - 1]} ${focus.year}`} onKeyDown={onDayKeyDown}>
            <div role="row" className="mb-1 grid grid-cols-7">
              {WEEKDAYS.map((d, i) => (
                <span
                  key={d}
                  role="columnheader"
                  aria-label={WEEKDAY_NAMES[i]}
                  className={cn(
                    'py-1 text-center text-2xs font-semibold uppercase tracking-wider',
                    i === 0 ? 'text-destructive/80' : 'text-muted-foreground',
                  )}
                >
                  {d}
                </span>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, row) => (
              <div role="row" key={row} className="grid grid-cols-7 gap-0.5">
                {cells.slice(row * 7, row * 7 + 7).map((iso, col) => {
                  const p = parseIsoDate(iso)!;
                  const inMonth = p.month === focus.month;
                  const isSelected = iso === selectedIso;
                  const isToday = iso === today;
                  const disabled = isDisabled(iso);
                  const isFocused = iso === focusIso;
                  return (
                    <div role="gridcell" key={iso} aria-selected={isSelected} className="flex justify-center py-0.5">
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
                          'relative flex size-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                          !isSelected && 'hover:bg-primary/10 hover:text-primary',
                          !inMonth && !isSelected && 'text-muted-foreground/45',
                          inMonth && !isSelected && col === 0 && 'text-destructive/80',
                          isToday && !isSelected && 'font-semibold text-primary ring-1 ring-inset ring-primary/40',
                          isSelected && 'bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90',
                          disabled && 'pointer-events-none opacity-30',
                        )}
                      >
                        {p.day}
                        {isToday && !isSelected ? (
                          <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary" />
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : view === 'months' ? (
          <div className="grid grid-cols-3 gap-1.5 py-1">
            {MONTHS_SHORT.map((label, i) => {
              const isCurrent = i + 1 === focus.month;
              return (
                <button
                  key={label}
                  type="button"
                  data-focused={isCurrent}
                  onClick={() => {
                    const month = i + 1;
                    moveTo(toIsoDate(focus.year, month, Math.min(focus.day, daysInMonth(focus.year, month))));
                    setView('days');
                  }}
                  className={cn(
                    'h-11 rounded-lg text-sm transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isCurrent && 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 py-1">
            {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((year) => {
              const isCurrent = year === focus.year;
              return (
                <button
                  key={year}
                  type="button"
                  data-focused={isCurrent}
                  onClick={() => {
                    moveTo(toIsoDate(year, focus.month, Math.min(focus.day, daysInMonth(year, focus.month))));
                    setView('months');
                  }}
                  className={cn(
                    'h-11 rounded-lg text-sm tabular-nums transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isCurrent && 'bg-primary font-semibold text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                  )}
                >
                  {year}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        <button
          type="button"
          disabled={isDisabled(today)}
          onClick={() => onSelect(today)}
          className="rounded-md px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
        >
          Today
        </button>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
};
