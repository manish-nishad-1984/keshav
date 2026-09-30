import type { ReactNode } from 'react';
import { Label } from './label';
import { cn } from '../../lib/utils';

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  /** Rendered inline after the label, e.g. a HelpTip. */
  labelAddon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const FormField = ({ label, required, hint, error, htmlFor, labelAddon, children, className }: FormFieldProps) => (
  <div className={cn('space-y-1.5', className)}>
    {labelAddon ? (
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
        {labelAddon}
      </div>
    ) : (
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
    )}
    {children}
    {error ? (
      <p className="text-2xs font-medium text-destructive">{error}</p>
    ) : hint ? (
      <p className="text-2xs text-muted-foreground">{hint}</p>
    ) : null}
  </div>
);
