import { useEffect, useRef, useState, type AriaAttributes } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays } from 'lucide-react';
import { Input } from './input';
import { Calendar } from './calendar';
import { cn } from '../../lib/utils';
import { formatDate, maskDisplayDate, parseDisplayDate } from '../../lib/date';

interface DatePickerProps extends Pick<AriaAttributes, 'aria-label' | 'aria-describedby'> {
  id?: string;
  /** ISO "YYYY-MM-DD", or '' for no date. */
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  /** Show a "Clear" action. Defaults to true for optional fields. */
  clearable?: boolean;
  placeholder?: string;
  /** Applied to the wrapper — use for width. */
  className?: string;
  /** Applied to the text input — use for height. */
  inputClassName?: string;
}

// DD-MM-YYYY date field: type it (dashes are inserted automatically) or pick from the calendar.
// The value passed in/out stays ISO "YYYY-MM-DD", which is what the API expects.
export const DatePicker = ({
  id,
  value,
  onChange,
  required,
  disabled,
  min,
  max,
  clearable = !required,
  placeholder = 'DD-MM-YYYY',
  className,
  inputClassName,
  ...aria
}: DatePickerProps) => {
  const [text, setText] = useState(formatDate(value));
  const [open, setOpen] = useState(false);
  // Calendar takes keyboard focus only when opened via the button/keyboard, not while typing.
  const [focusCalendar, setFocusCalendar] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const refocusInputRef = useRef(false);

  useEffect(() => setText(formatDate(value)), [value]);

  const inRange = (iso: string) => !(min && iso < min) && !(max && iso > max);

  const handleType = (raw: string) => {
    const masked = maskDisplayDate(raw);
    setText(masked);
    if (masked === '') {
      onChange('');
      return;
    }
    const iso = parseDisplayDate(masked);
    if (iso && inRange(iso)) onChange(iso);
  };

  const openCalendar = (withFocus: boolean) => {
    setFocusCalendar(withFocus);
    setOpen(true);
  };

  const pick = (iso: string) => {
    refocusInputRef.current = true;
    onChange(iso);
    setText(formatDate(iso));
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div ref={wrapperRef} className={cn('relative', className)}>
          <Input
            ref={inputRef}
            id={id}
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            maxLength={10}
            className={cn('pr-9 tabular-nums', inputClassName)}
            value={text}
            onChange={(e) => handleType(e.target.value)}
            onClick={() => !open && openCalendar(false)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && (e.altKey || !text)) {
                e.preventDefault();
                openCalendar(true);
              }
            }}
            onBlur={() => {
              // Leave the field showing the last valid date rather than a half-typed one.
              if (text && !parseDisplayDate(text)) setText(formatDate(value));
            }}
            {...aria}
          />
          <Popover.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Open calendar"
              onClick={(e) => {
                e.preventDefault();
                if (open) setOpen(false);
                else openCalendar(true);
              }}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            >
              <CalendarDays className="size-4" />
            </button>
          </Popover.Trigger>
        </div>
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (refocusInputRef.current) inputRef.current?.focus();
            refocusInputRef.current = false;
          }}
          onEscapeKeyDown={() => {
            refocusInputRef.current = true;
          }}
          // Clicks on the text field itself shouldn't count as "outside" and close the calendar.
          onInteractOutside={(e) => {
            if (wrapperRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
          className="z-50 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-popover data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <Calendar
            value={value}
            min={min}
            max={max}
            autoFocus={focusCalendar}
            onSelect={pick}
            onClear={clearable ? () => pick('') : undefined}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
