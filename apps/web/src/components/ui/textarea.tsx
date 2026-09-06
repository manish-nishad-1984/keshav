import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[5rem] w-full rounded-md border border-input bg-muted px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:bg-card disabled:opacity-70',
      invalid && 'border-destructive focus-visible:ring-destructive',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
