import { useId } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface HelpTipProps {
  /** Accessible name of the trigger button, e.g. "About lot number". */
  label: string;
  text: string;
  className?: string;
}

// Small hover/focus tooltip for help text that shouldn't permanently occupy form space. The
// text is always in the DOM and linked via aria-describedby, so screen readers announce it on
// focus even while it's visually hidden. Opens leftwards from the icon to stay on-screen when
// the field sits in a right-hand column on narrow viewports.
export const HelpTip = ({ label, text, className }: HelpTipProps) => {
  const id = useId();
  return (
    <span className={cn('group relative inline-flex', className)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <HelpCircle className="size-3.5" />
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-1.5 w-max max-w-[15rem] rounded-md bg-foreground px-2 py-1 text-2xs font-normal text-background opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
};
