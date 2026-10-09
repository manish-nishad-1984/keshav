import { CheckCircle2, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

// Colour language for colour × size quantity grids (distribution, delivery), so a figure's
// meaning is clear at a glance without reading the label:
//   total = grey, earlier = amber, now = blue, pending = red, done (nothing pending) = green.
export type QtyTone = 'total' | 'earlier' | 'now' | 'pending' | 'done';

export const QTY_TONE_CLASSES: Record<QtyTone, { chip: string; text: string; bar: string }> = {
  total: { chip: 'border-status-neutral/30 bg-status-neutral/10 text-foreground', text: 'text-foreground', bar: 'bg-status-neutral' },
  earlier: { chip: 'border-status-warning/35 bg-status-warning/10 text-status-warning', text: 'text-status-warning', bar: 'bg-status-warning' },
  now: { chip: 'border-primary/35 bg-primary/10 text-primary', text: 'text-primary', bar: 'bg-primary' },
  pending: { chip: 'border-status-danger/35 bg-status-danger/10 text-status-danger', text: 'text-status-danger', bar: 'bg-status-danger' },
  done: { chip: 'border-status-success/35 bg-status-success/10 text-status-success', text: 'text-status-success', bar: 'bg-status-success' },
};

const formatQty = (value: number) => value.toLocaleString('en-IN');

/** A figure in a tinted box. "pending" with 0 turns into a green tick. */
export const QtyChip = ({ value, tone, size = 'md', className }: { value: number; tone: QtyTone; size?: 'sm' | 'md'; className?: string }) => {
  const done = tone === 'pending' && value === 0;
  const t = QTY_TONE_CLASSES[value < 0 ? 'pending' : done ? 'done' : tone];
  return (
    <span
      className={cn(
        'numeric inline-flex items-center justify-center gap-1 rounded-md border font-semibold',
        size === 'md' ? 'h-8 min-w-[3.5rem] px-2 text-[0.9375rem]' : 'h-6 min-w-[2.75rem] px-1.5 text-xs',
        t.chip,
        className,
      )}
    >
      {done ? <CheckCircle2 className={size === 'md' ? 'size-4' : 'size-3.5'} aria-label="nothing pending" /> : formatQty(value)}
    </span>
  );
};

/** Row label with a coloured bar and icon, matching its chips. */
export const QtyRowLabel = ({ tone, icon: Icon, label }: { tone: QtyTone; icon: LucideIcon; label: string }) => (
  <span className={cn('flex items-center gap-2 font-semibold', QTY_TONE_CLASSES[tone].text)}>
    <span className={cn('h-6 w-1 shrink-0 rounded-full', QTY_TONE_CLASSES[tone].bar)} aria-hidden />
    <Icon className="size-4 shrink-0" aria-hidden />
    {label}
  </span>
);

/** Small key explaining the colours, shown above the grid. */
export const QtyLegend = ({ items }: { items: readonly { tone: QtyTone; icon: LucideIcon; label: string }[] }) => (
  <ul className="flex flex-wrap items-center gap-1.5" aria-label="Colour key">
    {items.map(({ tone, icon: Icon, label }) => (
      <li key={label} className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', QTY_TONE_CLASSES[tone].chip)}>
        <Icon className="size-3.5" aria-hidden />
        {label}
      </li>
    ))}
  </ul>
);
